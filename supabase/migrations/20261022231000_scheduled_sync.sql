-- #53 Zamanlanmış senkronizasyon ve 1s/5s/24s/72s/7g metrik snapshot'ları.
--
-- Kararlar:
-- * Toplama işi Edge Function'da (supabase/functions/sync-dispatch) koşar. pg_cron + pg_net
--   fonksiyonu `x-cron-secret` başlığıyla çağırır. Fonksiyon adresi Vault'taki `project_url`,
--   sır Vault'taki `cron_secret`. Bu migration sır DEĞERİ içermez; sırlar yoksa çağrı sessizce
--   atlanır (LOG satırı, hata yok), yani yapılandırılmamış ortamda hata fırtınası olmaz.
-- * Upsert kararı (#50/#51 için): posts (account_id, external_id) ve social_accounts
--   (platform, external_id) kısmi benzersiz indeksleri düz UNIQUE kısıta çevrilir. NULL'lar
--   Postgres'te çakışmadığı için anlam aynıdır; supabase-js `upsert(onConflict)` artık çalışır.
-- * Snapshot idempotency: metric_snapshots.target_hours (1, 5, 24, 72, 168; NULL = ad-hoc)
--   + UNIQUE (post_id, target_hours). hours_since_publish gerçek geçen süreyi tutmaya devam eder.
-- * "Zamanı gelen" sorgusu zaman parametreli: public.due_snapshots(p_at). Pencereler #55'teki
--   kontrol noktası pencereleriyle aynı: 1:[1,2) 5:[5,7) 24:[24,30) 72:[72,84) 168:[168,192) saat.
--   Pencere kaçarsa (ör. post geç keşfedildi) o hedef için snapshot alınmaz; yanlış saate
--   "1. saat" etiketi yazılmaz.
-- * Hesap snapshot'ı günde bir kez; gün sınırı UTC (captured_at = UTC gün başlangıcı, aynı gün
--   tekrar çalışırsa satır güncellenir).
-- * İş günlüğü public.sync_runs: ekip okur, yalnız service role yazar. 'failed' satırı
--   sync_failed uyarısı üretir (#56 ile aynı tekilleştirme anahtarı: hesap başına günde bir).
-- * "Şimdi senkronize et": public.request_sync() owner/editor için, sırrı panele vermeden aynı
--   pg_net yolunu kullanır. 2 dakikalık kısıtlama ile art arda tıklama çağrı yağdırmaz.

-- ── 1) Upsert kısıtları ─────────────────────────────────────────────────────
DROP INDEX public.posts_account_external_id_idx;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_account_external_id_key UNIQUE (account_id, external_id);

DROP INDEX public.social_accounts_platform_external_id_idx;
ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_platform_external_id_key UNIQUE (platform, external_id);

-- "Zamanı gelen" sorgusu yayın zamanına göre aralık tarar.
CREATE INDEX posts_published_at_idx ON public.posts (published_at) WHERE external_id IS NOT NULL;

-- ── 2) Hedef saat ───────────────────────────────────────────────────────────
ALTER TABLE public.metric_snapshots
  ADD COLUMN target_hours smallint
    CHECK (target_hours IS NULL OR target_hours IN (1, 5, 24, 72, 168)),
  ADD CONSTRAINT metric_snapshots_post_target_hours_key UNIQUE (post_id, target_hours);

COMMENT ON COLUMN public.metric_snapshots.target_hours IS
  'Zamanlanmış kontrol noktası (1, 5, 24, 72, 168 saat). NULL = ad-hoc ölçüm. (post_id, target_hours) benzersiz (#53).';

-- ── 3) İş günlüğü ───────────────────────────────────────────────────────────
CREATE TABLE public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL CHECK (job IN ('metrics', 'posts', 'accounts', 'manual')),
  platform public.social_platform,
  account_id uuid REFERENCES public.social_accounts (id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  quota_units integer CHECK (quota_units IS NULL OR quota_units >= 0),
  error text CHECK (error IS NULL OR length(error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT sync_runs_finished_when_done CHECK ((status = 'running') = (finished_at IS NULL)),
  CONSTRAINT sync_runs_finished_after_start CHECK (finished_at IS NULL OR finished_at >= started_at)
);
CREATE INDEX sync_runs_started_at_idx ON public.sync_runs (started_at DESC);
CREATE INDEX sync_runs_account_started_at_idx ON public.sync_runs (account_id, started_at DESC);

CREATE TRIGGER sync_runs_set_updated_at BEFORE UPDATE ON public.sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sync_runs_set_created_by BEFORE INSERT OR UPDATE ON public.sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Bitiş zamanını veritabanı saati yazar (fonksiyon saati ile kayma CHECK'i bozmasın).
CREATE FUNCTION private.sync_runs_close()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'running' AND NEW.finished_at IS NULL THEN
    NEW.finished_at := greatest(now(), NEW.started_at);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sync_runs_close BEFORE INSERT OR UPDATE ON public.sync_runs
  FOR EACH ROW EXECUTE FUNCTION private.sync_runs_close();

-- Okuma ekip üyelerine; yazma yalnız service role (Edge Function). authenticated'a
-- INSERT/UPDATE/DELETE politikası ve yetkisi verilmez.
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sync_runs_team_read ON public.sync_runs
  FOR SELECT TO authenticated USING (public.is_team_member());
REVOKE ALL ON public.sync_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sync_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_runs TO service_role;

COMMENT ON TABLE public.sync_runs IS
  'Senkronizasyon iş günlüğü (#53). Hesap/iş başına bir satır; yalnız service role yazar, ekip okur.';
COMMENT ON COLUMN public.sync_runs.quota_units IS 'Çalışmanın harcadığı API kota birimi (YouTube #51); bilinmiyorsa NULL.';
COMMENT ON COLUMN public.sync_runs.error IS 'Kısa, temizlenmiş hata özeti. Token veya sağlayıcı yanıtının tamamı yazılmaz.';

-- Başarısız iş → sync_failed uyarısı. Anahtar #56'daki hesap durumu uyarısıyla aynı olduğu için
-- token hatası (status = error) + başarısız iş aynı gün tek uyarı üretir.
CREATE FUNCTION private.sync_runs_failed_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_influencer uuid;
  v_platform public.social_platform;
BEGIN
  IF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'failed') THEN
    SELECT a.influencer_id, a.platform INTO v_influencer, v_platform
    FROM public.social_accounts a WHERE a.id = NEW.account_id;
    PERFORM private.raise_alert(
      'sync_failed',
      v_influencer,
      jsonb_build_object(
        'account_id', NEW.account_id,
        'platform', coalesce(NEW.platform, v_platform),
        'job', NEW.job,
        'sync_run_id', NEW.id
      ),
      'sync_failed:' || coalesce(NEW.account_id::text, 'job-' || NEW.job) || ':'
        || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    );
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER sync_runs_failed_alert
  AFTER INSERT OR UPDATE OF status ON public.sync_runs
  FOR EACH ROW EXECUTE FUNCTION private.sync_runs_failed_alert();

-- ── 4) Zamanı gelen snapshot'lar ────────────────────────────────────────────
-- SECURITY INVOKER: yalnız service role'e açık (Edge Function). Zaman parametre; now()'a bağlı değil.
CREATE FUNCTION public.due_snapshots(
  p_at timestamptz,
  p_limit integer DEFAULT 500,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE (
  post_id uuid,
  account_id uuid,
  platform public.social_platform,
  external_id text,
  published_at timestamptz,
  target_hours smallint,
  due_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.id, p.account_id, a.platform, p.external_id, p.published_at, w.target,
    p.published_at + w.target * interval '1 hour'
  FROM public.posts p
  JOIN public.social_accounts a ON a.id = p.account_id
  CROSS JOIN (VALUES (1::smallint, 2), (5::smallint, 7), (24::smallint, 30),
                     (72::smallint, 84), (168::smallint, 192)) AS w (target, hi)
  WHERE p.external_id IS NOT NULL
    AND p.published_at > p_at - interval '192 hours'
    AND p.published_at <= p_at - interval '1 hour'
    AND p_at >= p.published_at + w.target * interval '1 hour'
    AND p_at < p.published_at + w.hi * interval '1 hour'
    AND a.status IN ('active', 'error')
    AND a.token_ref IS NOT NULL
    AND (p_account_id IS NULL OR p.account_id = p_account_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.metric_snapshots m
      WHERE m.post_id = p.id AND m.target_hours = w.target
    )
  ORDER BY p.published_at + w.target * interval '1 hour', p.id
  LIMIT least(greatest(coalesce(p_limit, 500), 1), 5000)
$$;
REVOKE ALL ON FUNCTION public.due_snapshots(timestamptz, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_snapshots(timestamptz, integer, uuid) TO service_role;

-- ── 5) #55 ve #56 fonksiyonlarını target_hours ile uyumlu hale getir ────────
-- Kontrol noktası: target_hours'u olan snapshot doğrudan o noktaya sayılır (öncelikli);
-- eski/ad-hoc satırlar (target_hours NULL) için pencere kuralı aynen geçerli.
CREATE OR REPLACE FUNCTION public.post_checkpoint_views(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, target_hours integer, hours numeric, views bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT DISTINCT ON (s.post_id, w.target) s.post_id, w.target, round(s.hours, 2), s.views
  FROM (
    SELECT m.post_id, m.views, m.captured_at, m.target_hours AS planned,
      coalesce(m.hours_since_publish, extract(epoch FROM m.captured_at - p.published_at) / 3600)::numeric AS hours
    FROM public.metric_snapshots m
    JOIN public.posts p ON p.id = m.post_id
    WHERE m.post_id = ANY (p_post_ids)
  ) s
  JOIN (VALUES (1, 1, 2), (5, 5, 7), (24, 24, 30), (72, 72, 84), (168, 168, 192)) AS w (target, lo, hi)
    ON s.planned = w.target
    OR (s.planned IS NULL AND s.hours >= w.lo AND s.hours < w.hi)
  ORDER BY s.post_id, w.target, (s.planned IS NULL), s.hours, s.captured_at;
$$;

-- Viral uyarısı: zamanlanmış 1. saat snapshot'ı (target_hours = 1) yayından 1 saat SONRA
-- alındığı için hours_since_publish > 1 olur; eski kural onu hiç görmezdi.
CREATE OR REPLACE FUNCTION private.metric_snapshots_viral_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post record;
  v_multiplier numeric;
  v_baseline numeric;
  v_samples integer;
BEGIN
  IF NEW.views <= 0 OR NOT (
    coalesce(NEW.target_hours = 1, false) OR coalesce(NEW.hours_since_publish <= 1, false)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT p.id, p.account_id, a.influencer_id, a.platform INTO v_post
  FROM public.posts p
  JOIN public.social_accounts a ON a.id = p.account_id
  WHERE p.id = NEW.post_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT s.viral_multiplier INTO v_multiplier FROM public.notification_settings s WHERE s.id;
  v_multiplier := COALESCE(v_multiplier, 3);

  SELECT avg(first_hour.views), count(*)::integer INTO v_baseline, v_samples
  FROM (
    SELECT max(m.views) AS views
    FROM public.posts p
    JOIN public.metric_snapshots m ON m.post_id = p.id
    WHERE p.account_id = v_post.account_id
      AND p.id <> NEW.post_id
      AND (m.target_hours = 1 OR m.hours_since_publish <= 1)
    GROUP BY p.id
    ORDER BY p.published_at DESC NULLS LAST
    LIMIT 30
  ) first_hour;

  IF v_samples < 3 OR v_baseline IS NULL OR v_baseline <= 0
     OR NEW.views < v_baseline * v_multiplier THEN
    RETURN NULL;
  END IF;

  PERFORM private.raise_alert(
    'viral_post',
    v_post.influencer_id,
    jsonb_build_object(
      'post_id', NEW.post_id,
      'account_id', v_post.account_id,
      'platform', v_post.platform,
      'views', NEW.views,
      'baseline', round(v_baseline),
      'ratio', round(NEW.views / v_baseline, 1),
      'multiplier', v_multiplier
    ),
    'viral_post:' || NEW.post_id::text
  );
  RETURN NULL;
END;
$$;

-- ── 6) Edge Function çağrısı (pg_net) ───────────────────────────────────────
-- Vault sır adları (her ortamda bir kez, owner/pipeline girer):
--   project_url  → https://<ref>.supabase.co (sonunda / olmadan)
--   cron_secret  → Edge Function'daki CRON_SECRET ile aynı değer
-- Sırlar yoksa NULL döner ve hiçbir şey yapılmaz.
CREATE FUNCTION private.invoke_sync(p_job text, p_account_id uuid DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := private.notify_secret('project_url');
  v_secret text := private.notify_secret('cron_secret');
BEGIN
  IF p_job IS NULL OR p_job NOT IN ('metrics', 'posts', 'accounts', 'manual') THEN
    RAISE EXCEPTION 'Geçersiz senkronizasyon işi.' USING ERRCODE = '22023';
  END IF;
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE LOG 'sync: Vault sırları (project_url, cron_secret) tanımlı değil; % işi atlandı.', p_job;
    RETURN NULL;
  END IF;
  v_url := rtrim(v_url, '/');
  IF v_url !~ '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$' THEN
    RAISE LOG 'sync: project_url biçimi geçersiz; % işi atlandı.', p_job;
    RETURN NULL;
  END IF;
  RETURN private.http_post(
    v_url || '/functions/v1/sync-dispatch',
    jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    jsonb_build_object('job', p_job)
      || CASE WHEN p_account_id IS NULL THEN '{}'::jsonb
              ELSE jsonb_build_object('account_id', p_account_id) END
  );
END;
$$;

-- Manuel tetikleme kaydı (kim, ne zaman). API rollerine kapalı private şemada.
CREATE TABLE private.sync_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid REFERENCES public.social_accounts (id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  request_id bigint
);
CREATE INDEX sync_requests_requested_at_idx ON private.sync_requests (requested_at DESC);
REVOKE ALL ON private.sync_requests FROM PUBLIC, anon, authenticated, service_role;

-- "Şimdi senkronize et". Dönüş: queued | throttled | not_configured | not_found.
-- Sır panele hiç gelmez; çağrı veritabanındaki Vault sırrıyla yapılır.
CREATE FUNCTION public.request_sync(p_account_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request bigint;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Senkronizasyonu yalnız owner veya editör başlatabilir.' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.social_accounts a
    WHERE a.id = p_account_id AND a.status IN ('active', 'error') AND a.token_ref IS NOT NULL
  ) THEN
    RETURN 'not_found';
  END IF;
  -- Eşzamanlı iki tıklama da aynı kontrolden geçer: kısıtlama tek kilit altında.
  PERFORM pg_advisory_xact_lock(hashtext('public.request_sync'));
  IF EXISTS (
    SELECT 1 FROM private.sync_requests r
    WHERE r.requested_at > now() - interval '2 minutes'
      AND (r.account_id IS NULL OR r.account_id IS NOT DISTINCT FROM p_account_id)
  ) THEN
    RETURN 'throttled';
  END IF;
  v_request := private.invoke_sync('manual', p_account_id);
  IF v_request IS NULL THEN
    RETURN 'not_configured';
  END IF;
  INSERT INTO private.sync_requests (account_id, requested_by, request_id)
  VALUES (p_account_id, auth.uid(), v_request);
  RETURN 'queued';
END;
$$;
REVOKE ALL ON FUNCTION public.request_sync(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_sync(uuid) TO authenticated;

-- Bakım: kapanmadan kalan (fonksiyon süre sınırında öldürülen) işleri kapatır, eski günlüğü siler.
CREATE FUNCTION private.maintain_sync_runs(p_at timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  closed integer;
BEGIN
  UPDATE public.sync_runs
  SET status = 'failed', finished_at = greatest(p_at, started_at),
    error = 'Zaman aşımı: iş kapanmadan sonlandı.'
  WHERE status = 'running' AND started_at < p_at - interval '1 hour';
  GET DIAGNOSTICS closed = ROW_COUNT;
  DELETE FROM public.sync_runs WHERE started_at < p_at - interval '90 days';
  DELETE FROM private.sync_requests WHERE requested_at < p_at - interval '7 days';
  RETURN closed;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

-- ── 7) Zamanlama (UTC) ──────────────────────────────────────────────────────
-- Dakikalar kaydırılmıştır: işler aynı anda başlayıp API'lere yüklenmez.
SELECT cron.schedule('sync-metrics', '*/15 * * * *', $$SELECT private.invoke_sync('metrics')$$);
SELECT cron.schedule('sync-posts', '7,37 * * * *', $$SELECT private.invoke_sync('posts')$$);
SELECT cron.schedule('sync-accounts', '20 3 * * *', $$SELECT private.invoke_sync('accounts')$$);
SELECT cron.schedule('sync-maintenance', '50 * * * *', $$SELECT private.maintain_sync_runs()$$);
