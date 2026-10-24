-- #56 Bildirim ve uyarı sistemi.
--
-- Kararlar:
-- * Okundu bilgisi KİŞİ BAŞIDIR: public.alert_reads (alert_id, user_id). Viewer da kendi okundu
--   kaydını yazabilir; alerts satırına viewer için UPDATE politikası açılmaz. alerts.read_at
--   kolonu artık kullanılmaz (geriye uyum için durur).
-- * Uyarıları tarayıcı üretmez. Üreticiler trigger'lar ve pg_cron ile veritabanında çalışır.
--   Üretici fonksiyonlar API rollerine kapalı `private` şemasındadır (SECURITY DEFINER, boş search_path).
-- * Tekilleştirme: alerts.dedupe_key benzersizdir. Aynı olay tekrar gelirse yeni satır oluşmaz.
-- * Tür listesi CHECK ile sabitlenir; aynı liste packages/shared/src/alerts.ts içinde (Vitest eşitliği denetler).
-- * Push (ntfy / Telegram / e-posta): pg_net ile asenkron. Adres ve token'lar Vault'ta (notify_*),
--   tabloda veya kodda değil. Kanal hatası uyarı yazımını bozmaz.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

-- ── alerts: tekilleştirme, tür listesi, yazma sınırı ─────────────────────────
ALTER TABLE public.alerts
  ADD COLUMN dedupe_key text CHECK (dedupe_key IS NULL OR length(dedupe_key) BETWEEN 1 AND 200),
  ADD CONSTRAINT alerts_dedupe_key_key UNIQUE (dedupe_key);

-- NOT VALID: var olan satırlar (yalnız bütçe uyarıları) yeniden taranmaz; yeni satırlar denetlenir.
ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_type_known CHECK (type IN (
    'viral_post', 'follower_milestone', 'token_expiring', 'sync_failed',
    'budget_warning', 'budget_exceeded', 'content_not_ready', 'generation_failed'
  )) NOT VALID;

CREATE INDEX alerts_created_at_idx ON public.alerts (created_at DESC);

COMMENT ON COLUMN public.alerts.read_at IS 'Kullanılmıyor (#56). Okundu bilgisi kişi başı public.alert_reads tablosunda.';
COMMENT ON COLUMN public.alerts.dedupe_key IS 'Olay anahtarı (ör. token_expiring:<account_id>:<tarih>). Aynı anahtarla ikinci uyarı yazılmaz.';

-- Uyarı satırları değiştirilmez: owner/editor yalnız ekleyebilir (raise_budget_alerts çağıranın
-- RLS'iyle yazar). UPDATE/DELETE politikası yok; viewer hiç yazamaz.
DROP POLICY alerts_team_write ON public.alerts;
CREATE POLICY alerts_team_insert ON public.alerts
  FOR INSERT TO authenticated WITH CHECK (public.can_write_data());

-- ── alert_reads: kişi başı okundu ───────────────────────────────────────────
CREATE TABLE public.alert_reads (
  alert_id uuid NOT NULL REFERENCES public.alerts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, user_id)
);
CREATE INDEX alert_reads_user_idx ON public.alert_reads (user_id);

-- Sahiplik istemciden alınmaz: oturumdaki kullanıcıya ve şimdiki zamana sabitlenir.
CREATE FUNCTION private.alert_reads_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  NEW.read_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER alert_reads_set_owner
  BEFORE INSERT ON public.alert_reads
  FOR EACH ROW EXECUTE FUNCTION private.alert_reads_set_owner();

ALTER TABLE public.alert_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_reads_own_read ON public.alert_reads
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.is_team_member());
CREATE POLICY alert_reads_own_insert ON public.alert_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_team_member()
    AND EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_reads.alert_id)
  );
REVOKE ALL ON public.alert_reads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.alert_reads TO authenticated;

-- ── notification_settings: eşikler ve kanal seçimi (tek satır) ───────────────
CREATE TABLE public.notification_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  viral_multiplier numeric(6, 2) NOT NULL DEFAULT 3 CHECK (viral_multiplier BETWEEN 1.5 AND 100),
  follower_milestones integer[] NOT NULL
    DEFAULT '{1000,5000,10000,25000,50000,100000,250000,500000,1000000}'
    CHECK (
      cardinality(follower_milestones) BETWEEN 1 AND 20
      AND array_position(follower_milestones, NULL) IS NULL
      AND 0 < ALL (follower_milestones)
    ),
  token_expiry_days integer NOT NULL DEFAULT 7 CHECK (token_expiry_days BETWEEN 1 AND 60),
  push_ntfy boolean NOT NULL DEFAULT false,
  push_telegram boolean NOT NULL DEFAULT false,
  push_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
INSERT INTO public.notification_settings DEFAULT VALUES;

CREATE TRIGGER notification_settings_set_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER notification_settings_set_created_by
  BEFORE INSERT OR UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_settings_team_read ON public.notification_settings
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY notification_settings_team_update ON public.notification_settings
  FOR UPDATE TO authenticated
  USING (public.can_write_data()) WITH CHECK (public.can_write_data());
REVOKE ALL ON public.notification_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.notification_settings TO authenticated;

-- ── Ortak üretici: tekrarsız uyarı yazar ────────────────────────────────────
CREATE FUNCTION private.raise_alert(
  p_type text, p_influencer_id uuid, p_payload jsonb, p_dedupe_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.alerts (type, influencer_id, payload, dedupe_key)
  VALUES (p_type, p_influencer_id, COALESCE(p_payload, '{}'::jsonb), p_dedupe_key)
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN FOUND;
END;
$$;

-- Viral: ilk saat izlenmesi, hesabın son 30 postunun ilk saat ortalamasının N katı (en az 3 örnek).
CREATE FUNCTION private.metric_snapshots_viral_alert()
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
  IF NEW.hours_since_publish IS NULL OR NEW.hours_since_publish > 1 OR NEW.views <= 0 THEN
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
      AND m.hours_since_publish <= 1
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
CREATE TRIGGER metric_snapshots_viral_alert
  AFTER INSERT OR UPDATE OF views, hours_since_publish ON public.metric_snapshots
  FOR EACH ROW EXECUTE FUNCTION private.metric_snapshots_viral_alert();

-- Takipçi kilometre taşı: önceki snapshot'ın altında kalan en büyük eşik aşılınca (ilk snapshot temel alınır).
CREATE FUNCTION private.account_snapshots_milestone_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous bigint;
  v_milestone integer;
  v_account record;
BEGIN
  SELECT max(s.followers) INTO v_previous
  FROM public.account_snapshots s
  WHERE s.account_id = NEW.account_id AND s.captured_at < NEW.captured_at;
  IF v_previous IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT max(t.m) INTO v_milestone
  FROM public.notification_settings ns
  CROSS JOIN LATERAL unnest(ns.follower_milestones) AS t(m)
  WHERE ns.id AND t.m > v_previous AND t.m <= NEW.followers;
  IF v_milestone IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.influencer_id, a.platform INTO v_account
  FROM public.social_accounts a WHERE a.id = NEW.account_id;

  PERFORM private.raise_alert(
    'follower_milestone',
    v_account.influencer_id,
    jsonb_build_object(
      'account_id', NEW.account_id,
      'platform', v_account.platform,
      'milestone', v_milestone,
      'followers', NEW.followers
    ),
    'follower_milestone:' || NEW.account_id::text || ':' || v_milestone::text
  );
  RETURN NULL;
END;
$$;
CREATE TRIGGER account_snapshots_milestone_alert
  AFTER INSERT ON public.account_snapshots
  FOR EACH ROW EXECUTE FUNCTION private.account_snapshots_milestone_alert();

-- Token süresi doluyor: süre ayardaki gün sayısından azsa (veya dolmuşsa) token tarihi başına bir kez.
CREATE FUNCTION private.raise_token_alerts(p_account_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  inserted integer := 0;
BEGIN
  FOR r IN
    SELECT a.id, a.influencer_id, a.platform, a.token_expires_at
    FROM public.social_accounts a
    CROSS JOIN public.notification_settings ns
    WHERE ns.id
      AND a.token_expires_at IS NOT NULL
      AND a.status IN ('active', 'expired')
      AND a.token_expires_at <= now() + make_interval(days => ns.token_expiry_days)
      AND (p_account_id IS NULL OR a.id = p_account_id)
  LOOP
    IF private.raise_alert(
      'token_expiring',
      r.influencer_id,
      jsonb_build_object(
        'account_id', r.id,
        'platform', r.platform,
        'expires_at', r.token_expires_at,
        'days_left', greatest(0, ceil(extract(epoch FROM r.token_expires_at - now()) / 86400))::integer
      ),
      'token_expiring:' || r.id::text || ':' || to_char(r.token_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ) THEN
      inserted := inserted + 1;
    END IF;
  END LOOP;
  RETURN inserted;
END;
$$;

-- Hesap durumu: senkronizasyon hatası (status = error, günde bir kez) ve token tarihi değişimi.
CREATE FUNCTION private.social_accounts_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'error' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'error') THEN
    PERFORM private.raise_alert(
      'sync_failed',
      NEW.influencer_id,
      jsonb_build_object('account_id', NEW.id, 'platform', NEW.platform),
      'sync_failed:' || NEW.id::text || ':' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    );
  END IF;
  IF NEW.token_expires_at IS NOT NULL THEN
    PERFORM private.raise_token_alerts(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER social_accounts_alerts
  AFTER INSERT OR UPDATE OF status, token_expires_at ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION private.social_accounts_alerts();

-- Başarısız üretim: üretim başına bir kez.
CREATE FUNCTION private.generations_failed_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'failed') THEN
    PERFORM private.raise_alert(
      'generation_failed',
      NEW.influencer_id,
      jsonb_build_object('generation_id', NEW.id, 'generation_type', NEW.type),
      'generation_failed:' || NEW.id::text
    );
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER generations_failed_alert
  AFTER INSERT OR UPDATE OF status ON public.generations
  FOR EACH ROW EXECUTE FUNCTION private.generations_failed_alert();

-- Zamana bağlı kurallar (pg_cron, 15 dakikada bir): token süresi ve
-- "yayın saati geldi ama içerik hazır değil" (son 24 saatte saati gelen, scheduled/published olmayan içerik).
CREATE FUNCTION private.raise_scheduled_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  inserted integer;
BEGIN
  inserted := private.raise_token_alerts(NULL);
  FOR r IN
    SELECT c.id, c.influencer_id, c.stage, c.scheduled_at
    FROM public.content_items c
    WHERE c.scheduled_at <= now()
      AND c.scheduled_at > now() - interval '1 day'
      AND c.stage NOT IN ('scheduled', 'published')
  LOOP
    IF private.raise_alert(
      'content_not_ready',
      r.influencer_id,
      jsonb_build_object('content_item_id', r.id, 'stage', r.stage, 'scheduled_at', r.scheduled_at),
      'content_not_ready:' || r.id::text || ':' || extract(epoch FROM r.scheduled_at)::bigint::text
    ) THEN
      inserted := inserted + 1;
    END IF;
  END LOOP;
  RETURN inserted;
END;
$$;

SELECT cron.schedule(
  'raise-scheduled-alerts',
  '*/15 * * * *',
  $$SELECT private.raise_scheduled_alerts()$$
);

-- ── Push kanalları (opsiyonel) ──────────────────────────────────────────────
-- Vault sır adları: notify_ntfy_url (https://sunucu/konu), notify_ntfy_token (ops.),
-- notify_telegram_bot_token, notify_telegram_chat_id, notify_resend_api_key,
-- notify_email_from, notify_email_to. Sır yoksa kanal sessizce atlanır.
CREATE FUNCTION private.notify_secret(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NULLIF(trim(s.decrypted_secret), '')
  FROM vault.decrypted_secrets s
  WHERE s.name = p_name
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1
$$;

-- Push metni: payload'daki kişisel olmayan alanlardan kısa başlık. Ayrıntı panelde.
CREATE FUNCTION private.alert_push_title(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_type
    WHEN 'viral_post' THEN 'Viral eşik aşıldı'
    WHEN 'follower_milestone' THEN 'Takipçi kilometre taşı'
    WHEN 'token_expiring' THEN 'Token süresi doluyor'
    WHEN 'sync_failed' THEN 'Senkronizasyon hatası'
    WHEN 'budget_warning' THEN 'Bütçe uyarı eşiğine ulaştı'
    WHEN 'budget_exceeded' THEN 'Bütçe aşıldı'
    WHEN 'content_not_ready' THEN 'Yayın saati geldi, içerik hazır değil'
    WHEN 'generation_failed' THEN 'Üretim başarısız'
    ELSE 'Yeni uyarı'
  END
$$;

-- Etkin ve yapılandırılmış her kanal için gönderilecek isteği üretir (gönderim yapmaz).
CREATE FUNCTION private.alert_push_requests(p_type text)
RETURNS TABLE (channel text, url text, headers jsonb, body jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.notification_settings;
  v_title text := private.alert_push_title(p_type);
  v_text text;
  v_url text;
  v_token text;
  v_chat text;
  v_from text;
  v_to text;
BEGIN
  SELECT * INTO s FROM public.notification_settings WHERE id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_text := v_title || '. Ayrıntılar panelde: Bildirimler.';

  IF s.push_ntfy THEN
    v_url := private.notify_secret('notify_ntfy_url');
    IF v_url ~ '^https://[^/?#]+/[A-Za-z0-9_-]{1,64}$' THEN
      v_token := private.notify_secret('notify_ntfy_token');
      channel := 'ntfy';
      url := regexp_replace(v_url, '/[^/]+$', '');
      headers := jsonb_build_object('Content-Type', 'application/json')
        || CASE WHEN v_token IS NULL THEN '{}'::jsonb
                ELSE jsonb_build_object('Authorization', 'Bearer ' || v_token) END;
      body := jsonb_build_object(
        'topic', substring(v_url FROM '[^/]+$'),
        'title', 'AI Influencer Studio',
        'message', v_text
      );
      RETURN NEXT;
    END IF;
  END IF;

  IF s.push_telegram THEN
    v_token := private.notify_secret('notify_telegram_bot_token');
    v_chat := private.notify_secret('notify_telegram_chat_id');
    IF v_token ~ '^[0-9]+:[A-Za-z0-9_-]+$' AND v_chat IS NOT NULL THEN
      channel := 'telegram';
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage';
      headers := jsonb_build_object('Content-Type', 'application/json');
      body := jsonb_build_object('chat_id', v_chat, 'text', v_text);
      RETURN NEXT;
    END IF;
  END IF;

  IF s.push_email THEN
    v_token := private.notify_secret('notify_resend_api_key');
    v_from := private.notify_secret('notify_email_from');
    v_to := private.notify_secret('notify_email_to');
    IF v_token IS NOT NULL AND v_from IS NOT NULL AND v_to IS NOT NULL THEN
      channel := 'email';
      url := 'https://api.resend.com/emails';
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_token
      );
      body := jsonb_build_object(
        'from', v_from,
        'to', to_jsonb(ARRAY(SELECT trim(x) FROM unnest(string_to_array(v_to, ',')) AS x WHERE trim(x) <> '')),
        'subject', 'AI Influencer Studio: ' || v_title,
        'text', v_text
      );
      RETURN NEXT;
    END IF;
  END IF;
END;
$$;

-- Tek gönderim noktası (testte hata simülasyonu için ayrı fonksiyon).
CREATE FUNCTION private.http_post(p_url text, p_headers jsonb, p_body jsonb)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT net.http_post(url := p_url, body := p_body, headers := p_headers, timeout_milliseconds := 5000)
$$;

-- Yeni uyarıda etkin kanallara asenkron istek kuyruğa alınır. Hiçbir hata uyarı yazımını bozmaz;
-- loga adres veya token yazılmaz.
CREATE FUNCTION private.alerts_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM private.alert_push_requests(NEW.type) LOOP
    BEGIN
      PERFORM private.http_post(r.url, r.headers, r.body);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Bildirim kanalı % için istek oluşturulamadı (SQLSTATE %).', r.channel, SQLSTATE;
    END;
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Bildirim gönderimi atlandı (SQLSTATE %).', SQLSTATE;
  RETURN NULL;
END;
$$;
CREATE TRIGGER alerts_push
  AFTER INSERT ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION private.alerts_push();

-- ── Panel RPC'leri ──────────────────────────────────────────────────────────
-- Okundu işaretleme: verilen (NULL ise tüm görünür) uyarıları oturumdaki kullanıcı için okundu yapar.
CREATE FUNCTION public.mark_alerts_read(p_alert_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  inserted integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_member() THEN
    RETURN 0;
  END IF;
  WITH ins AS (
    INSERT INTO public.alert_reads (alert_id, user_id)
    SELECT a.id, auth.uid()
    FROM public.alerts a
    WHERE p_alert_ids IS NULL OR a.id = ANY (p_alert_ids)
    ON CONFLICT (alert_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO inserted FROM ins;
  RETURN inserted;
END;
$$;

CREATE FUNCTION public.unread_alert_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM public.alerts a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.alert_reads r
    WHERE r.alert_id = a.id AND r.user_id = (SELECT auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.mark_alerts_read(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unread_alert_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_alerts_read(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unread_alert_count() TO authenticated;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.alert_reads IS 'Kişi başı okundu bilgisi (#56). Kullanıcı yalnız kendi kayıtlarını görür ve yazar.';
COMMENT ON TABLE public.notification_settings IS 'Uyarı eşikleri ve push kanal seçimi (tek satır). Kanal adres/token''ları Vault''ta (notify_*).';
