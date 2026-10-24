-- Güvenlik sertleştirmesi (denetim bulguları).
--
-- 1) generations: istemci (owner/editor) satırı yalnız `enqueue_generation()` üzerinden açabilir.
--    RPC, aynı transaction'a yerel bir işaret (app.enqueue_generation) koyar; trigger işaret yoksa
--    doğrudan INSERT'i 42501 ile reddeder. İstemci INSERT'inde durum `queued`a, sonuç kolonları
--    boşa çekilir; `params.budget_override_by` yalnız RPC owner onayını yazdığında kalır.
--    İstemci UPDATE'i hiçbir kolonu değiştiremez (durum, kredi, tarih, influencer …): üretimi
--    worker (service_role) ilerletir, iptal `cancel_generation()` ile yapılır.
-- 2) alerts: tarayıcıdan INSERT politikası kaldırıldı. Bütçe uyarıları artık private şemadaki
--    SECURITY DEFINER trigger fonksiyonuyla yazılır (public.raise_budget_alerts kaldırıldı).
--    Push: kanal başına 10 dakikada en çok 20 gönderim; fazlası atlanır ve loglanır.
-- 3) project_url: https zorunlu; yalnız yerel adresler (localhost, 127.0.0.1,
--    host.docker.internal, kong) için http kabul edilir. Dört private çağrı fonksiyonu aynı
--    gövdeyle, yalnız bu denetim değişerek yeniden kuruldu.
-- 4) pg_net kuyruğu (istek başlıklarında cron sırrı taşır) API rollerine kapatıldı.
-- 5) public şemadaki SECURITY DEFINER RPC'ler (cancel_generation, request_sync) SECURITY INVOKER
--    sarmalayıcıya çevrildi; yetkili gövde PostgREST'e açık olmayan `internal` şemasında.
--    `private` şeması API rollerine tamamen kapalı kalır (authenticated orada fonksiyon
--    çağıramaz), bu yüzden çekirdekler ayrı bir şemada ve yalnız tek tek EXECUTE izniyle durur.

-- ── 1) generations: kuyruk dışı yazım yok ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.generations_prepare()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  privileged boolean := current_user IN ('postgres', 'supabase_admin', 'service_role');
  v_enqueue text := COALESCE(current_setting('app.enqueue_generation', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT privileged THEN
      -- Bütçe koruması ve owner onayı yalnız enqueue_generation() içinde; doğrudan INSERT yok.
      IF v_enqueue NOT IN ('on', 'override') THEN
        RAISE EXCEPTION 'Üretim yalnız kuyruk üzerinden (enqueue_generation) başlatılabilir.'
          USING ERRCODE = '42501';
      END IF;
      NEW.status := 'queued';
      NEW.credits := NULL;
      NEW.output_asset_id := NULL;
      NEW.error := NULL;
      NEW.duration_ms := NULL;
      NEW.created_at := now();
      NEW.params := COALESCE(NEW.params, '{}'::jsonb) - 'budget_override_by';
      IF v_enqueue = 'override' THEN
        NEW.params := NEW.params || jsonb_build_object('budget_override_by', auth.uid());
      END IF;
    END IF;
    IF NEW.mode IS NULL THEN
      NEW.mode := CASE WHEN NEW.type = 'image' THEN 'text_to_image' ELSE 'image_to_video' END;
    END IF;
    IF NOT privileged THEN
      NEW.provider_job_id := NULL;
      NEW.progress := 0;
      NEW.attempts := 0;
      NEW.max_attempts := 3;
      NEW.next_run_at := now();
      NEW.started_at := NULL;
      NEW.finished_at := NULL;
      NEW.cancel_requested_at := NULL;
    END IF;
    -- Tekrar yalnız aynı influencer'ın başarısız/iptal edilmiş üretimine bağlanabilir.
    IF NEW.retry_of IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.generations o
      WHERE o.id = NEW.retry_of AND o.influencer_id = NEW.influencer_id
        AND o.status IN ('failed', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Yeniden deneme yalnız biten (başarısız/iptal) üretime bağlanabilir.' USING ERRCODE = '23514';
    END IF;
  ELSIF NOT privileged AND (
    to_jsonb(NEW) - ARRAY['updated_at', 'created_by']
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - ARRAY['updated_at', 'created_by']
  ) THEN
    -- Durum, kredi, tarih ve kuyruk alanları maliyet/bütçe kaydını belirler; yalnız sunucu yazar.
    RAISE EXCEPTION 'Üretim satırı yalnız sunucu tarafından değiştirilebilir (iptal: cancel_generation).'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Aynı imza ve davranış; tek fark INSERT öncesi/sonrası transaction-yerel işaret.
CREATE OR REPLACE FUNCTION public.enqueue_generation(
  p_influencer_id uuid,
  p_type public.generation_type,
  p_tool text,
  p_params jsonb DEFAULT '{}'::jsonb,
  p_mode text DEFAULT NULL,
  p_prompt_id uuid DEFAULT NULL,
  p_input_asset_ids uuid[] DEFAULT '{}',
  p_override_budget boolean DEFAULT false,
  p_retry_of uuid DEFAULT NULL
)
RETURNS public.generations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_params jsonb := COALESCE(p_params, '{}'::jsonb) - 'budget_override_by';
  v_inputs uuid[] := COALESCE(p_input_asset_ids, '{}');
  v_exceeded boolean;
  v_override boolean := false;
  created public.generations;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Üretim başlatmak için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;

  -- Referans asset'ler aynı influencer'a ait olmalı.
  IF cardinality(v_inputs) > 0 AND (
    SELECT count(DISTINCT a.id) FROM public.assets a
    WHERE a.id = ANY (v_inputs) AND a.influencer_id = p_influencer_id
  ) <> cardinality(ARRAY(SELECT DISTINCT unnest(v_inputs))) THEN
    RAISE EXCEPTION 'Referans dosyalar bu influencer''a ait değil.' USING ERRCODE = '23514';
  END IF;

  -- Eşzamanlı eklemeler bütçe kontrolünde sıraya girer.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('generation-budget', 0));
  SELECT EXISTS (
    SELECT 1 FROM public.budget_status(current_date) s
    WHERE s.ratio >= 1 AND (s.influencer_id IS NULL OR s.influencer_id = p_influencer_id)
  ) INTO v_exceeded;

  IF v_exceeded THEN
    IF NOT (COALESCE(p_override_budget, false) AND public.can_manage_team()) THEN
      RAISE EXCEPTION 'Bu ayın bütçesi doldu; yeni üretim için owner onayı gerekli.'
        USING ERRCODE = 'P0001', HINT = 'budget_exceeded';
    END IF;
    v_override := true;
    v_params := v_params || jsonb_build_object('budget_override_by', auth.uid());
  END IF;

  PERFORM pg_catalog.set_config(
    'app.enqueue_generation', CASE WHEN v_override THEN 'override' ELSE 'on' END, true
  );
  INSERT INTO public.generations (
    influencer_id, prompt_id, tool, type, mode, params, input_asset_ids, status, retry_of
  )
  VALUES (
    p_influencer_id, p_prompt_id, p_tool, p_type, p_mode, v_params, v_inputs, 'queued', p_retry_of
  )
  RETURNING * INTO created;
  PERFORM pg_catalog.set_config('app.enqueue_generation', '', true);

  RETURN created;
END;
$$;

-- ── 5) internal şeması: INVOKER sarmalayıcıların yetkili çekirdekleri ────────
-- PostgREST'e açık değil (supabase/config.toml → api.schemas yalnız public, graphql_public).
-- Varsayılan EXECUTE yok; her çekirdeğe izin tek tek verilir.
CREATE SCHEMA internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA internal TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA internal REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMENT ON SCHEMA internal IS 'public SECURITY INVOKER RPC sarmalayıcılarının SECURITY DEFINER çekirdekleri. API''ye açık değil.';

-- İptal. SECURITY DEFINER: worker kolonunu (cancel_requested_at) yazar; yetki elle denetlenir.
CREATE FUNCTION internal.cancel_generation(p_id uuid)
RETURNS public.generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  g public.generations;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'İptal için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO g FROM public.generations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üretim bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF g.status NOT IN ('queued', 'running') THEN
    RAISE EXCEPTION 'Biten üretim iptal edilemez.' USING ERRCODE = '55000';
  END IF;

  IF g.provider_job_id IS NULL THEN
    UPDATE public.generations
    SET status = 'cancelled', finished_at = now(), cancel_requested_at = now()
    WHERE id = p_id
    RETURNING * INTO g;
  ELSE
    -- Sağlayıcıdaki işi worker iptal eder; hemen ele alınsın.
    UPDATE public.generations
    SET cancel_requested_at = now(), next_run_at = now()
    WHERE id = p_id
    RETURNING * INTO g;
  END IF;
  RETURN g;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_generation(p_id uuid)
RETURNS public.generations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN internal.cancel_generation(p_id);
END;
$$;

-- "Şimdi senkronize et". Dönüş: queued | throttled | not_configured | not_found.
-- Sır panele hiç gelmez; çağrı veritabanındaki Vault sırrıyla yapılır.
CREATE FUNCTION internal.request_sync(p_account_id uuid DEFAULT NULL)
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

CREATE OR REPLACE FUNCTION public.request_sync(p_account_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN internal.request_sync(p_account_id);
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA internal FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.cancel_generation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.request_sync(uuid) TO authenticated, service_role;
-- Sarmalayıcıların izinleri CREATE OR REPLACE ile korunur (anon kapalı, authenticated açık).

-- ── 2) alerts: tarayıcı yazamaz; bütçe uyarısı sunucuda ──────────────────────
DROP POLICY alerts_team_insert ON public.alerts;

-- Ayın bütçelerini kontrol eder, eşiği geçenler için alerts'e (tekrarsız) yazar.
CREATE FUNCTION private.raise_budget_alerts(p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted integer;
BEGIN
  WITH due AS (
    SELECT
      s.*,
      CASE WHEN s.ratio >= 1 THEN 'budget_exceeded' ELSE 'budget_warning' END AS level
    FROM public.budget_status(p_month) s
    WHERE s.ratio IS NOT NULL AND s.ratio >= s.warn_ratio
  ),
  ins AS (
    INSERT INTO public.alerts (influencer_id, type, payload)
    SELECT
      d.influencer_id,
      d.level,
      jsonb_build_object(
        'budget_id', d.budget_id::text,
        'month', to_char(d.month, 'YYYY-MM'),
        'amount', d.amount,
        'currency', d.currency,
        'spent', d.spent,
        'ratio', d.ratio
      )
    FROM due d
    ON CONFLICT (type, (payload ->> 'budget_id'), (payload ->> 'month'))
      WHERE type IN ('budget_warning', 'budget_exceeded')
      DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO inserted FROM ins;
  RETURN inserted;
END;
$$;

CREATE FUNCTION private.costs_check_budgets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'budgets' THEN
    PERFORM private.raise_budget_alerts(NEW.month);
  ELSE
    PERFORM private.raise_budget_alerts(NEW.incurred_on);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER costs_check_budgets ON public.costs;
DROP TRIGGER budgets_check_budgets ON public.budgets;
CREATE TRIGGER costs_check_budgets
  AFTER INSERT OR UPDATE OF amount, currency, incurred_on, influencer_id ON public.costs
  FOR EACH ROW EXECUTE FUNCTION private.costs_check_budgets();
CREATE TRIGGER budgets_check_budgets
  AFTER INSERT OR UPDATE OF amount, currency, warn_ratio ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION private.costs_check_budgets();
DROP FUNCTION public.costs_check_budgets();
DROP FUNCTION public.raise_budget_alerts(date);

-- Push sınırı: kanal başına son 10 dakikadaki gönderimler (yalnız sayaç; adres/token yok).
CREATE TABLE private.alert_push_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel text NOT NULL CHECK (length(channel) BETWEEN 1 AND 32),
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alert_push_log_channel_sent_at_idx ON private.alert_push_log (channel, sent_at DESC);
REVOKE ALL ON private.alert_push_log FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.alert_push_limit()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 20
$$;

-- Yeni uyarıda etkin kanallara asenkron istek kuyruğa alınır. Hiçbir hata uyarı yazımını bozmaz;
-- loga adres veya token yazılmaz. Kanal 10 dakikada sınırı doldurduysa istek atlanır.
CREATE OR REPLACE FUNCTION private.alerts_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  v_limit integer := private.alert_push_limit();
BEGIN
  FOR r IN SELECT * FROM private.alert_push_requests(NEW.type) LOOP
    BEGIN
      DELETE FROM private.alert_push_log l
      WHERE l.channel = r.channel AND l.sent_at < now() - interval '1 hour';
      IF (
        SELECT count(*) FROM private.alert_push_log l
        WHERE l.channel = r.channel AND l.sent_at > now() - interval '10 minutes'
      ) >= v_limit THEN
        RAISE LOG 'Bildirim kanalı % için 10 dakikalık sınır (%) doldu; push atlandı.', r.channel, v_limit;
        CONTINUE;
      END IF;
      PERFORM private.http_post(r.url, r.headers, r.body);
      INSERT INTO private.alert_push_log (channel) VALUES (r.channel);
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

-- ── 3) project_url: https (yerel geliştirme adresleri hariç) ─────────────────
CREATE FUNCTION private.valid_project_url(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
    OR p_url ~ '^http://(localhost|127\.0\.0\.1|host\.docker\.internal|kong)(:[0-9]{1,5})?$',
    false
  )
$$;

CREATE OR REPLACE FUNCTION private.invoke_generation_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := private.notify_secret('project_url');
  v_secret text := private.notify_secret('cron_secret');
BEGIN
  IF v_url IS NULL OR v_secret IS NULL OR NOT private.valid_project_url(rtrim(v_url, '/')) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.generations
    WHERE status IN ('queued', 'running') AND next_run_at <= now()
  ) THEN
    RETURN NULL;
  END IF;
  RETURN net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/process-generations',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 5000
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.invoke_sync(p_job text, p_account_id uuid DEFAULT NULL)
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
  IF NOT private.valid_project_url(v_url) THEN
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

CREATE OR REPLACE FUNCTION private.invoke_publish_worker()
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
  IF NOT private.valid_project_url(v_url) THEN
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

CREATE OR REPLACE FUNCTION private.invoke_comments(p_job text)
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
  IF NOT private.valid_project_url(v_url) THEN
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

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

-- ── 4) pg_net kuyruğu API rollerine kapalı ──────────────────────────────────
-- net.http_request_queue istek başlıklarını (x-cron-secret, push token'ları) tutar.
-- Bizim çağrılarımız private SECURITY DEFINER fonksiyonlarından (sahip rolüyle) yapılır.
-- Şema veya rol yoksa (farklı yerel kurulum) hiçbir şey yapılmaz.
-- Her REVOKE ayrı denenir: nesne sahibi platform rolüyse ve migration rolünün o nesnede yetkisi
-- yoksa PostgreSQL komutu reddeder; bu durumda NOTICE yazılır, migration durmaz (pgTAP sonucu denetler).
DO $$
DECLARE
  r text;
  stmt text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RETURN;
  END IF;
  FOREACH r IN ARRAY ARRAY['PUBLIC', 'anon', 'authenticated'] LOOP
    IF r <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      CONTINUE;
    END IF;
    FOREACH stmt IN ARRAY ARRAY[
      'REVOKE ALL ON ALL TABLES IN SCHEMA net FROM %s',
      'REVOKE ALL ON ALL SEQUENCES IN SCHEMA net FROM %s',
      'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA net FROM %s',
      'REVOKE USAGE ON SCHEMA net FROM %s'
    ] LOOP
      -- PUBLIC'ten yalnız tablo/sıra izni alınır; fonksiyon ve şema izinleri platform rollerine lazım.
      IF r = 'PUBLIC' AND (stmt LIKE '%FUNCTIONS%' OR stmt LIKE '%USAGE%') THEN
        CONTINUE;
      END IF;
      BEGIN
        EXECUTE format(stmt, CASE WHEN r = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r) END);
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'net: % atlandı (yetki yok).', format(stmt, r);
      END;
    END LOOP;
  END LOOP;
END;
$$;
