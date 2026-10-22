-- #61 Birleşik yorum gelen kutusu: Instagram + YouTube yorumları tek listede, panelden yanıt.
--
-- Kararlar:
-- * Yorumlar `public.comments` tablosunda. Satırları yalnız service role yazar (Edge Function
--   `comments-dispatch`, iş 'fetch'). Ekip okur; owner/editor yalnız `status` (okundu/gizli) ve
--   `brand_deal_id` (yorumdan lead) alanlarını değiştirebilir (kolon yetkisi).
-- * Tekilleştirme: UNIQUE (account_id, external_id). Aynı yorum tekrar çekilince metin/beğeni
--   güncellenir, panel durumu (okundu/gizli/yanıtlandı) korunur.
-- * account_id ve platform posttan türetilir (trigger); istemci/fonksiyon yanlış hesap yazamaz.
-- * Yanıtlar `public.comment_replies` kuyruğunda. Panel (editor+) yalnız `comment_id` + `body`
--   ekler; gönderimi Edge Function yapar (iş 'reply'), token panele hiç gelmez. Yorum başına tek
--   etkin yanıt (kısmi UNIQUE, 'failed' hariç): çift tıklama ikinci yanıt üretmez. Gönderildiğinde
--   yorum 'replied' olur. 'sending'de takılan iş tekrar gönderilmez (platformda çift yanıt riski),
--   'failed' olur ve kullanıcı platformda kontrol eder.
-- * Kota: toplama ve gönderim sync_runs'a 'comments' / 'comment_reply' işleriyle yazılır;
--   YouTube birimleri (#51 quota_warning) aynı Pasifik günü toplamına girer.
-- * Kişisel veri: yorum yazarının yalnız görünen adı tutulur (profil id'si, fotoğraf, e-posta
--   yok). Yorumlar 90 gün sonra silinir (private.maintain_comments). Panelde gizlemek platformda
--   gizlemek değildir.

-- ── 1) Yorumlar ─────────────────────────────────────────────────────────────
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.social_accounts (id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  external_id text NOT NULL CHECK (length(trim(external_id)) > 0 AND length(external_id) <= 200),
  parent_external_id text CHECK (parent_external_id IS NULL OR length(parent_external_id) <= 200),
  author_name text NOT NULL DEFAULT '' CHECK (length(author_name) <= 100),
  text text NOT NULL CHECK (length(text) <= 10000),
  published_at timestamptz NOT NULL,
  like_count integer CHECK (like_count IS NULL OR like_count >= 0),
  is_brand_inquiry boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'hidden')),
  replied_at timestamptz,
  brand_deal_id uuid REFERENCES public.brand_deals (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT comments_account_external_id_key UNIQUE (account_id, external_id),
  CONSTRAINT comments_replied_has_time CHECK (status <> 'replied' OR replied_at IS NOT NULL)
);
CREATE INDEX comments_published_at_idx ON public.comments (published_at DESC);
CREATE INDEX comments_account_status_idx ON public.comments (account_id, status, published_at DESC);
CREATE INDEX comments_post_published_at_idx ON public.comments (post_id, published_at DESC);
CREATE INDEX comments_brand_inquiry_idx ON public.comments (published_at DESC) WHERE is_brand_inquiry;
CREATE INDEX comments_brand_deal_idx ON public.comments (brand_deal_id) WHERE brand_deal_id IS NOT NULL;

COMMENT ON TABLE public.comments IS
  'Instagram/YouTube yorumları (#61). Service role yazar; ekip okur, editor yalnız status/brand_deal_id değiştirir. 90 gün saklanır.';
COMMENT ON COLUMN public.comments.author_name IS
  'Yorum yazarının platformdaki görünen adı. Üçüncü kişi verisi: başka profil alanı tutulmaz, modele gönderilmez.';
COMMENT ON COLUMN public.comments.is_brand_inquiry IS
  'İş birliği fırsatı (collab, sponsor, iş birliği, e-posta adresi) anahtar kelime eşleşmesi; toplama sırasında hesaplanır.';
COMMENT ON COLUMN public.comments.status IS
  'new | read | replied | hidden. hidden yalnız panelde gizler. replied yalnız gönderilen yanıtla (replied_at) olur.';

CREATE TRIGGER comments_set_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER comments_set_created_by BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Hesap/platform posttan; durum kuralları; lead aynı influencer'a ait olmalı.
CREATE FUNCTION private.comments_prepare()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_account uuid;
  v_platform public.social_platform;
  v_influencer uuid;
BEGIN
  SELECT p.account_id, a.platform, a.influencer_id INTO v_account, v_platform, v_influencer
  FROM public.posts p
  JOIN public.social_accounts a ON a.id = p.account_id
  WHERE p.id = NEW.post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yorumun postu bulunamadı.' USING ERRCODE = '23503';
  END IF;
  NEW.account_id := v_account;
  NEW.platform := v_platform;

  -- Yanıtlanmış yorum "okunmadı/okundu"ya geri alınırsa (ör. gizlemeyi kaldırma) yanıtlandı kalır.
  IF NEW.status IN ('new', 'read') AND NEW.replied_at IS NOT NULL THEN
    NEW.status := 'replied';
  END IF;

  IF NEW.brand_deal_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.brand_deal_id IS DISTINCT FROM OLD.brand_deal_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.brand_deals d
       WHERE d.id = NEW.brand_deal_id AND d.influencer_id = v_influencer
     ) THEN
    RAISE EXCEPTION 'Deal bu yorumun influencer''ına ait değil.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER comments_prepare BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION private.comments_prepare();

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_team_read ON public.comments
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY comments_team_update ON public.comments
  FOR UPDATE TO authenticated
  USING (public.can_write_data()) WITH CHECK (public.can_write_data());
REVOKE ALL ON public.comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.comments TO authenticated;
GRANT UPDATE (status, brand_deal_id) ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO service_role;

-- ── 2) Yanıt kuyruğu ────────────────────────────────────────────────────────
CREATE TABLE public.comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 1000),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  external_id text CHECK (external_id IS NULL OR length(external_id) <= 200),
  error text CHECK (error IS NULL OR length(error) <= 500),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT comment_replies_sent_has_time CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);
-- Yorum başına tek etkin yanıt: aynı anda iki tıklama → ikinci INSERT 23505.
CREATE UNIQUE INDEX comment_replies_one_active_idx
  ON public.comment_replies (comment_id) WHERE status <> 'failed';
CREATE INDEX comment_replies_queue_idx
  ON public.comment_replies (next_attempt_at) WHERE status = 'queued';
CREATE INDEX comment_replies_comment_idx ON public.comment_replies (comment_id, created_at DESC);

COMMENT ON TABLE public.comment_replies IS
  'Yorum yanıt kuyruğu (#61). Editor comment_id+body ekler, comments-dispatch gönderir. Yorum başına tek etkin yanıt.';

CREATE TRIGGER comment_replies_set_updated_at BEFORE UPDATE ON public.comment_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER comment_replies_set_created_by BEFORE INSERT OR UPDATE ON public.comment_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Gönderilen yanıt yorumu 'replied' yapar (gizli yorum da yanıtlanmış sayılır).
CREATE FUNCTION private.comment_replies_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM 'sent' THEN
    UPDATE public.comments
    SET status = 'replied', replied_at = NEW.sent_at
    WHERE id = NEW.comment_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER comment_replies_sent
  AFTER UPDATE OF status ON public.comment_replies
  FOR EACH ROW EXECUTE FUNCTION private.comment_replies_sent();

ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY comment_replies_team_read ON public.comment_replies
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY comment_replies_team_insert ON public.comment_replies
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_data() AND status = 'queued' AND attempts = 0);
REVOKE ALL ON public.comment_replies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.comment_replies TO authenticated;
GRANT INSERT (comment_id, body) ON public.comment_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_replies TO service_role;

-- ── 3) İş günlüğü ───────────────────────────────────────────────────────────
-- Yorum toplama ve yanıt gönderimi de sync_runs'a yazılır (kota, hata uyarısı, panel günlüğü).
ALTER TABLE public.sync_runs DROP CONSTRAINT sync_runs_job_check;
ALTER TABLE public.sync_runs
  ADD CONSTRAINT sync_runs_job_check CHECK (job IN (
    'metrics', 'posts', 'accounts', 'manual', 'comments', 'comment_reply'
  ));

-- ── 4) Edge Function çağrısı (pg_net) ───────────────────────────────────────
-- Vault: project_url + cron_secret (#53 ile aynı). Sırlar yoksa NULL döner, hiçbir şey yapılmaz.
-- 'reply': bekleyen yanıt yoksa çağrı yapılmaz.
CREATE FUNCTION private.invoke_comments(p_job text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := private.notify_secret('project_url');
  v_secret text := private.notify_secret('cron_secret');
BEGIN
  IF p_job IS NULL OR p_job NOT IN ('fetch', 'reply') THEN
    RAISE EXCEPTION 'Geçersiz yorum işi.' USING ERRCODE = '22023';
  END IF;
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE LOG 'comments: Vault sırları (project_url, cron_secret) tanımlı değil; % işi atlandı.', p_job;
    RETURN NULL;
  END IF;
  v_url := rtrim(v_url, '/');
  IF v_url !~ '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$' THEN
    RAISE LOG 'comments: project_url biçimi geçersiz; % işi atlandı.', p_job;
    RETURN NULL;
  END IF;
  IF p_job = 'reply' AND NOT EXISTS (
    SELECT 1 FROM public.comment_replies r
    WHERE r.status = 'queued' AND r.next_attempt_at <= now()
  ) THEN
    RETURN NULL;
  END IF;
  RETURN private.http_post(
    v_url || '/functions/v1/comments-dispatch',
    jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    jsonb_build_object('job', p_job)
  );
END;
$$;

-- Yeni yanıt hemen gönderime çağrılır (cron yedek). Çağrı hatası yanıtın kaydını bozmaz.
CREATE FUNCTION private.comment_replies_enqueued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM private.invoke_comments('reply');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Yanıt gönderimi tetiklenemedi (SQLSTATE %); cron tekrar dener.', SQLSTATE;
  END;
  RETURN NULL;
END;
$$;
CREATE TRIGGER comment_replies_enqueued
  AFTER INSERT ON public.comment_replies
  FOR EACH ROW EXECUTE FUNCTION private.comment_replies_enqueued();

-- Bakım: takılan gönderimleri kapatır, saklama süresi dolan yorumları siler.
CREATE FUNCTION private.maintain_comments(p_at timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_closed integer;
BEGIN
  UPDATE public.comment_replies
  SET status = 'failed',
    error = 'Gönderim yarıda kaldı; tekrar göndermeden önce yanıtı platformda kontrol edin.'
  WHERE status = 'sending' AND updated_at < p_at - interval '15 minutes';
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  DELETE FROM public.comments WHERE published_at < p_at - interval '90 days';
  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION private.comments_prepare() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.comment_replies_sent() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.comment_replies_enqueued() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.invoke_comments(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.maintain_comments(timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- ── 5) Zamanlama (UTC) ──────────────────────────────────────────────────────
-- Toplama #53'ün posts işinden (7,37) sonra; yeni postların yorumları aynı yarım saatte gelir.
SELECT cron.schedule('comments-fetch', '12,42 * * * *', $$SELECT private.invoke_comments('fetch')$$);
SELECT cron.schedule('comments-reply', '*/5 * * * *', $$SELECT private.invoke_comments('reply')$$);
SELECT cron.schedule('comments-maintenance', '55 3 * * *', $$SELECT private.maintain_comments()$$);
