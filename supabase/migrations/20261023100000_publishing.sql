-- #58 Panelden yayınlama ve zamanlanmış paylaşım (Instagram Reels, YouTube Shorts).
--
-- Akış: panel `enqueue_publish_job()` ile `queued` iş açar (route sağlayıcı API'sini çağırmaz).
-- pg_cron her dakika `publish-scheduled` Edge Function'ını pg_net ile çağırır (yalnız zamanı gelen
-- iş varsa). Worker `claim_publish_jobs()` ile işi FOR UPDATE SKIP LOCKED + kira ile atomik olarak
-- `processing`'e alır, platform adaptörüyle yayınlar ve `complete_publish_job()` ile posts satırını,
-- işi ve içerik kartını (stage → published) tek transaction'da bağlar.
--
-- Kararlar:
-- * Durumlar: queued → processing → published | failed | manual_required; queued → cancelled.
--   `manual_required`: içerik API ile güvenle yayınlanamaz (ör. ücretli ortaklık etiketi API'de yok,
--   yayın anında check-list eksik). Kullanıcı uygulamadan elle yayınlar ve postu eşleştirir.
-- * Aynı içerik + hesap için tek açık/yayınlanmış iş (kısmi benzersiz indeks). Başarısız, iptal
--   veya manuel işten sonra yeni iş açılabilir.
-- * Yayın öncesi zorunlu kontroller trigger'dadır (RPC'yi atlayan doğrudan INSERT de engellenir):
--   check-list tamam (content_checklist_ready), AI etiketi maddesi işaretli (#32), hedef hesap
--   bağlı, içeriğe bağlı final_video asset'i var. Hata kodu 23514, HINT makine okunur neden.
-- * AI etiketi her zaman gönderilir (YouTube status.containsSyntheticMedia, Instagram
--   is_ai_generated). Etiketsiz yayın seçeneği yoktur (docs/compliance.md).
-- * Ücretli ortaklık: içerik bir brand_deal'e bağlıysa paid_partnership = true (trigger hesaplar,
--   istemciye bırakılmaz). Adaptör bunu destekleyemiyorsa iş manual_required olur.
-- * Worker kolonları (attempts, next_attempt_at, provider_*, published_post_id, error, started_at,
--   finished_at) yalnız sunucu tarafından değişir. İstemci yalnız queued işi iptal edebilir.
-- * provider_upload_url (YouTube resumable oturum adresi) kimlik bilgisi gibi davranır: API
--   rollerine kolon düzeyinde SELECT verilmez.
-- * Token/URL/sağlayıcı yanıtı `error`'a yazılmaz; yalnız sağlayıcının hata kodu ve kısa özet.
-- * Hata ve manuel yayın gerekince `publish_failed` uyarısı (iş başına bir kez).
-- * Sırlar (project_url, cron_secret) Vault'tan; yoksa cron no-op.

-- ── 1) Tablo ────────────────────────────────────────────────────────────────
CREATE TYPE public.publish_job_status AS ENUM (
  'queued', 'processing', 'published', 'failed', 'manual_required', 'cancelled'
);

CREATE TABLE public.publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES public.content_items (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.social_accounts (id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets (id) ON DELETE SET NULL,
  platform public.social_platform NOT NULL,
  status public.publish_job_status NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 100),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 2200),
  tags text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(tags) <= 30 AND array_position(tags, NULL) IS NULL),
  paid_partnership boolean NOT NULL DEFAULT false,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts smallint NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_container_id text CHECK (provider_container_id IS NULL OR length(provider_container_id) BETWEEN 1 AND 200),
  provider_upload_url text CHECK (provider_upload_url IS NULL OR length(provider_upload_url) <= 2000),
  container_created_at timestamptz,
  external_id text CHECK (external_id IS NULL OR length(external_id) BETWEEN 1 AND 200),
  published_post_id uuid REFERENCES public.posts (id) ON DELETE SET NULL,
  error text CHECK (error IS NULL OR length(error) <= 500),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Aynı içerik aynı hesapta iki kez yayınlanmaz: açık veya yayınlanmış tek iş.
CREATE UNIQUE INDEX publish_jobs_one_open_idx
  ON public.publish_jobs (content_item_id, account_id)
  WHERE status IN ('queued', 'processing', 'published');
CREATE INDEX publish_jobs_due_idx
  ON public.publish_jobs (next_attempt_at) WHERE status IN ('queued', 'processing');
CREATE INDEX publish_jobs_content_idx ON public.publish_jobs (content_item_id, created_at DESC);

COMMENT ON TABLE public.publish_jobs IS
  'Yayın kuyruğu (#58). Panel iş açar, publish-scheduled Edge Function yayınlar. posts yalnız gerçekten yayınlanmış içeriği tutar.';
COMMENT ON COLUMN public.publish_jobs.provider_container_id IS 'Instagram Reels container id. Sadece worker yazar.';
COMMENT ON COLUMN public.publish_jobs.provider_upload_url IS 'YouTube resumable upload oturum adresi. API rollerine kapalı (kolon yetkisi).';
COMMENT ON COLUMN public.publish_jobs.paid_partnership IS 'İçerik bir marka anlaşmasına bağlı. Trigger hesaplar; istemci yazamaz.';
COMMENT ON COLUMN public.publish_jobs.error IS 'Kısa hata özeti (sağlayıcı kodu). Token, URL veya yanıt gövdesi yazılmaz.';

-- ── 2) Doğrulama ve worker kolonu koruması ─────────────────────────────────
CREATE FUNCTION public.publish_jobs_prepare()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  privileged boolean := current_user IN ('postgres', 'supabase_admin', 'service_role');
  c public.content_items;
  a public.social_accounts;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT privileged THEN
      -- İstemci yalnız kuyruktaki işi iptal edebilir; başka hiçbir alan değişmez.
      IF NOT (OLD.status = 'queued' AND NEW.status = 'cancelled')
        OR (to_jsonb(NEW) - ARRAY['status', 'updated_at', 'finished_at'])
           IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'updated_at', 'finished_at']) THEN
        RAISE EXCEPTION 'Yayın işi yalnız kuyruktayken iptal edilebilir.' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.status IN ('published', 'failed', 'manual_required', 'cancelled')
       AND OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.finished_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT
  IF NOT privileged THEN
    NEW.status := 'queued';
    NEW.attempts := 0;
    NEW.max_attempts := 5;
    NEW.provider_container_id := NULL;
    NEW.provider_upload_url := NULL;
    NEW.container_created_at := NULL;
    NEW.external_id := NULL;
    NEW.published_post_id := NULL;
    NEW.error := NULL;
    NEW.started_at := NULL;
    NEW.finished_at := NULL;
  END IF;
  NEW.scheduled_for := greatest(coalesce(NEW.scheduled_for, now()), now());
  NEW.next_attempt_at := NEW.scheduled_for;

  SELECT * INTO c FROM public.content_items WHERE id = NEW.content_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İçerik bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF c.stage = 'published' THEN
    RAISE EXCEPTION 'İçerik zaten yayında.' USING ERRCODE = '23505', HINT = 'already_published';
  END IF;
  IF (c.checklist->'items'->'ai_disclosure') IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Yayın öncesi “AI etiketi” maddesi işaretlenmeli.' USING ERRCODE = '23514', HINT = 'ai_label_missing';
  END IF;
  IF NOT public.content_checklist_ready(c.checklist) THEN
    RAISE EXCEPTION 'Yayın öncesi kontrol listesi tamamlanmadı.' USING ERRCODE = '23514', HINT = 'checklist_incomplete';
  END IF;

  SELECT * INTO a FROM public.social_accounts WHERE id = NEW.account_id;
  IF NOT FOUND OR a.influencer_id <> c.influencer_id THEN
    RAISE EXCEPTION 'Hedef hesap içerikle aynı influencer’a ait olmalı.' USING ERRCODE = '23514', HINT = 'no_target_account';
  END IF;
  IF a.platform NOT IN ('instagram', 'youtube') THEN
    RAISE EXCEPTION 'Bu platform için otomatik yayın yok.' USING ERRCODE = '23514', HINT = 'unsupported_platform';
  END IF;
  IF a.status NOT IN ('active', 'error') OR a.token_ref IS NULL THEN
    RAISE EXCEPTION 'Hedef hesap bağlı değil; önce hesabı bağlayın.' USING ERRCODE = '23514', HINT = 'account_not_connected';
  END IF;
  NEW.platform := a.platform;

  IF NEW.asset_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.content_item_assets l
    JOIN public.assets s ON s.id = l.asset_id
    WHERE l.content_item_id = c.id AND s.id = NEW.asset_id
      AND s.kind = 'final_video' AND s.influencer_id = c.influencer_id
  ) THEN
    RAISE EXCEPTION 'İçeriğe bağlı bir final video gerekli.' USING ERRCODE = '23514', HINT = 'no_final_video';
  END IF;

  NEW.paid_partnership := EXISTS (
    SELECT 1 FROM public.brand_deal_content_items d WHERE d.content_item_id = c.id
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_jobs_prepare() FROM PUBLIC, anon;

CREATE TRIGGER publish_jobs_prepare
  BEFORE INSERT OR UPDATE ON public.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.publish_jobs_prepare();
CREATE TRIGGER publish_jobs_set_updated_at
  BEFORE UPDATE ON public.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER publish_jobs_set_created_by
  BEFORE INSERT OR UPDATE ON public.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- ── 3) RLS ve yetkiler ─────────────────────────────────────────────────────
ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY publish_jobs_team_read ON public.publish_jobs
  FOR SELECT TO authenticated USING (public.is_team_member());
-- Yazma owner/editor; hangi alanların değişebileceğini publish_jobs_prepare sınırlar.
-- DELETE yetkisi verilmez: iş geçmişi silinmez (içerik silinirse CASCADE).
CREATE POLICY publish_jobs_team_write ON public.publish_jobs
  FOR ALL TO authenticated
  USING (public.can_write_data()) WITH CHECK (public.can_write_data());

REVOKE ALL ON public.publish_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, content_item_id, account_id, asset_id, platform, status, scheduled_for, title, caption, tags,
  paid_partnership, attempts, max_attempts, next_attempt_at, provider_container_id,
  container_created_at, external_id, published_post_id, error, started_at, finished_at,
  created_at, updated_at, created_by
) ON public.publish_jobs TO authenticated;
GRANT INSERT, UPDATE ON public.publish_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_jobs TO service_role;

-- ── 4) Panel RPC'leri ──────────────────────────────────────────────────────
-- "Şimdi yayınla" (p_scheduled_for NULL) veya "Planla". Kartı aynı transaction'da Planlandı'ya
-- taşır ve yayın zamanını işe eşitler. SECURITY INVOKER: RLS ve trigger kontrolleri uygulanır.
CREATE FUNCTION public.enqueue_publish_job(
  p_content_id uuid,
  p_title text,
  p_caption text DEFAULT '',
  p_tags text[] DEFAULT '{}',
  p_scheduled_for timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  c public.content_items;
  v_asset uuid;
  v_at timestamptz := greatest(coalesce(p_scheduled_for, now()), now());
  v_id uuid;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Yayınlamak için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.content_items WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İçerik bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF c.target_account_id IS NULL THEN
    RAISE EXCEPTION 'Önce hedef hesap seçin.' USING ERRCODE = '23514', HINT = 'no_target_account';
  END IF;

  -- En son eklenen final video.
  SELECT s.id INTO v_asset
  FROM public.content_item_assets l
  JOIN public.assets s ON s.id = l.asset_id
  WHERE l.content_item_id = c.id AND s.kind = 'final_video'
  ORDER BY s.created_at DESC, s.id DESC
  LIMIT 1;

  INSERT INTO public.publish_jobs (content_item_id, account_id, asset_id, platform, scheduled_for, title, caption, tags)
  VALUES (c.id, c.target_account_id, v_asset, 'instagram', v_at, btrim(coalesce(p_title, '')),
    coalesce(p_caption, ''), coalesce(p_tags, '{}'))
  RETURNING id INTO v_id;

  UPDATE public.content_items SET stage = 'scheduled', scheduled_at = v_at WHERE id = c.id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  IF SQLERRM LIKE '%publish_jobs_one_open_idx%' THEN
    RAISE EXCEPTION 'Bu içerik için açık veya yayınlanmış bir iş zaten var.' USING ERRCODE = '23505', HINT = 'already_queued';
  END IF;
  RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_publish_job(uuid, text, text, text[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_publish_job(uuid, text, text, text[], timestamptz) TO authenticated;

CREATE FUNCTION public.cancel_publish_job(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'İptal için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.publish_jobs SET status = 'cancelled'
  WHERE id = p_id AND status = 'queued'
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.publish_jobs WHERE id = p_id) THEN
      RAISE EXCEPTION 'Yayın işi bulunamadı.' USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'Yalnız kuyruktaki iş iptal edilebilir.' USING ERRCODE = '55000';
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_publish_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_publish_job(uuid) TO authenticated;

-- ── 5) Worker RPC'leri (yalnız service_role) ───────────────────────────────
-- Zamanı gelen işleri atomik olarak kapar: queued → processing, kira kadar ileri atar. Eşzamanlı iki
-- çalıştırma aynı satırı alamaz (SKIP LOCKED); kira biterse (worker çöktü) iş yeniden alınır.
CREATE FUNCTION public.claim_publish_jobs(p_limit integer DEFAULT 5, p_lease_seconds integer DEFAULT 600)
RETURNS SETOF public.publish_jobs
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH picked AS (
    SELECT j.id
    FROM public.publish_jobs j
    WHERE j.status IN ('queued', 'processing')
      AND j.next_attempt_at <= now()
    ORDER BY j.next_attempt_at, j.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 20)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.publish_jobs j
  SET status = 'processing',
      started_at = coalesce(j.started_at, now()),
      next_attempt_at = now() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 1800))
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*
$$;
REVOKE ALL ON FUNCTION public.claim_publish_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_publish_jobs(integer, integer) TO service_role;

-- Yayın başarılı: posts satırı (sync önce bulduysa ona bağlanır), iş ve içerik kartı tek
-- transaction'da. Tekrar çağrılırsa (worker yarıda kaldıysa) aynı post döner.
CREATE FUNCTION public.complete_publish_job(
  p_id uuid,
  p_external_id text,
  p_url text,
  p_published_at timestamptz,
  p_duration_s numeric DEFAULT NULL,
  p_is_short boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  j public.publish_jobs;
  v_post uuid;
  v_at timestamptz := coalesce(p_published_at, now());
BEGIN
  SELECT * INTO j FROM public.publish_jobs WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yayın işi bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF j.status = 'published' THEN
    RETURN j.published_post_id;
  END IF;
  IF j.status <> 'processing' THEN
    RAISE EXCEPTION 'İş işlenmiyor (%).', j.status USING ERRCODE = '55000';
  END IF;
  IF p_external_id IS NULL OR length(btrim(p_external_id)) = 0 THEN
    RAISE EXCEPTION 'Platform post kimliği gerekli.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.posts (content_item_id, account_id, external_id, url, caption, published_at, duration_s, is_short, created_by)
  VALUES (j.content_item_id, j.account_id, p_external_id, p_url, j.caption, v_at, p_duration_s, coalesce(p_is_short, true), j.created_by)
  ON CONFLICT (account_id, external_id) DO UPDATE
    SET content_item_id = coalesce(public.posts.content_item_id, EXCLUDED.content_item_id),
        url = coalesce(public.posts.url, EXCLUDED.url),
        published_at = coalesce(public.posts.published_at, EXCLUDED.published_at)
  RETURNING id, published_at INTO v_post, v_at;

  UPDATE public.publish_jobs
  SET status = 'published', external_id = p_external_id, published_post_id = v_post,
      provider_upload_url = NULL, error = NULL
  WHERE id = p_id;

  UPDATE public.content_items
  SET stage = 'published', target_account_id = j.account_id, scheduled_at = v_at
  WHERE id = j.content_item_id;
  RETURN v_post;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_publish_job(uuid, text, text, timestamptz, numeric, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_publish_job(uuid, text, text, timestamptz, numeric, boolean) TO service_role;

-- ── 6) Uyarı ────────────────────────────────────────────────────────────────
ALTER TABLE public.alerts DROP CONSTRAINT alerts_type_known;
ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_type_known CHECK (type IN (
    'viral_post', 'follower_milestone', 'token_expiring', 'sync_failed',
    'budget_warning', 'budget_exceeded', 'content_not_ready', 'generation_failed',
    'weekly_report_ready', 'quota_warning', 'publish_failed'
  )) NOT VALID;

CREATE OR REPLACE FUNCTION private.alert_push_title(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT CASE p_type
    WHEN 'viral_post' THEN 'Viral eşik aşıldı'
    WHEN 'follower_milestone' THEN 'Takipçi kilometre taşı'
    WHEN 'token_expiring' THEN 'Token süresi doluyor'
    WHEN 'sync_failed' THEN 'Senkronizasyon hatası'
    WHEN 'budget_warning' THEN 'Bütçe uyarı eşiğine ulaştı'
    WHEN 'budget_exceeded' THEN 'Bütçe aşıldı'
    WHEN 'content_not_ready' THEN 'Yayın saati geldi, içerik hazır değil'
    WHEN 'generation_failed' THEN 'Üretim başarısız'
    WHEN 'weekly_report_ready' THEN 'Haftalık rapor hazır'
    WHEN 'quota_warning' THEN 'YouTube API kotası sınıra yaklaştı'
    WHEN 'publish_failed' THEN 'Yayınlanamadı'
    ELSE 'Yeni uyarı'
  END
$fn$;

CREATE FUNCTION private.publish_jobs_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_influencer uuid;
BEGIN
  IF NEW.status IN ('failed', 'manual_required') AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT c.influencer_id INTO v_influencer FROM public.content_items c WHERE c.id = NEW.content_item_id;
    PERFORM private.raise_alert(
      'publish_failed',
      v_influencer,
      jsonb_build_object(
        'publish_job_id', NEW.id,
        'content_item_id', NEW.content_item_id,
        'account_id', NEW.account_id,
        'platform', NEW.platform,
        'status', NEW.status
      ),
      'publish_failed:' || NEW.id::text
    );
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER publish_jobs_alert
  AFTER UPDATE OF status ON public.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION private.publish_jobs_alert();

-- ── 7) Zamanlama: pg_cron + pg_net ─────────────────────────────────────────
-- Her dakika; yalnız zamanı gelmiş iş varsa çağrı yapılır (Instagram container durumunu dakikada
-- bir yoklamak için 5 dk yerine 1 dk). Vault sırları yoksa no-op. Saatler UTC.
CREATE FUNCTION private.invoke_publish_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := private.notify_secret('project_url');
  v_secret text := private.notify_secret('cron_secret');
BEGIN
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NULL;
  END IF;
  v_url := rtrim(v_url, '/');
  IF v_url !~ '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$' THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.publish_jobs
    WHERE status IN ('queued', 'processing') AND next_attempt_at <= now()
  ) THEN
    RETURN NULL;
  END IF;
  RETURN private.http_post(
    v_url || '/functions/v1/publish-scheduled',
    jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

SELECT cron.schedule('publish-scheduled', '* * * * *', $$SELECT private.invoke_publish_worker()$$);
