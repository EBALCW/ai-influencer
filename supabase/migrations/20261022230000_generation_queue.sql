-- Üretim kuyruğu ve worker (#47).
--
-- Akış: panel `enqueue_generation()` ile `queued` satır açar (bütçe kontrolü aynı transaction'da).
-- pg_cron her dakika `process-generations` Edge Function'ını pg_net ile çağırır. Worker
-- `claim_generations()` ile işleri FOR UPDATE SKIP LOCKED + kira (next_run_at) ile alır,
-- sağlayıcıya gönderir (queued → running), durumu yoklar ve sonuç dosyasını Storage'a indirip
-- `complete_generation()` ile `assets` satırını (kind generated) ve üretimi tek transaction'da bağlar.
--
-- Kararlar:
-- * next_run_at hem geri çekilme (backoff) hem yoklama zamanı hem de kira süresidir. Claim satırı
--   kira süresi kadar ileri atar; worker çökse bile kira bitince iş yeniden alınır.
-- * Worker kolonları (provider_job_id, attempts, next_run_at, started_at, finished_at, progress,
--   cancel_requested_at) yalnız sunucu (service_role / SECURITY DEFINER RPC) tarafından değişir.
--   İstemci INSERT'inde varsayılana çekilir, UPDATE'te değiştirilirse 42501.
-- * Yeniden deneme (panel) mevcut satırı değiştirmez; `retry_of` ile bağlı YENİ satır açar.
--   Maliyet geçmişi korunur. Worker'ın kendi geçici hata denemeleri aynı satırda `attempts` artırır.
-- * İptal: sağlayıcıya gönderilmemiş iş anında `cancelled`; gönderilmiş iş için
--   `cancel_requested_at` işaretlenir, worker sağlayıcıda iptal eder.
-- * Bütçe koruması: o ayın toplam veya influencer bütçesi dolmuşsa (budget_status.ratio >= 1)
--   yeni üretim reddedilir (hint 'budget_exceeded'). Owner `p_override_budget` ile onaylayarak açar;
--   onay params.budget_override_by'a yazılır.
-- * Sırlar (cron_secret, project_url) Vault'tan okunur; migration değer içermez. Yoksa cron no-op.
-- * Maliyet kaydı mevcut `generations_record_cost` trigger'ıyla otomatik yazılır (burada yazılmaz).

-- ── Kolonlar ────────────────────────────────────────────────────
ALTER TABLE public.generations
  ADD COLUMN mode text CHECK (mode IN ('text_to_image', 'image_to_video', 'video_to_video')),
  ADD COLUMN provider_job_id text CHECK (provider_job_id IS NULL OR length(provider_job_id) BETWEEN 1 AND 200),
  ADD COLUMN progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  ADD COLUMN attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN max_attempts smallint NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  ADD COLUMN next_run_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN started_at timestamptz,
  ADD COLUMN finished_at timestamptz,
  ADD COLUMN cancel_requested_at timestamptz,
  ADD COLUMN retry_of uuid REFERENCES public.generations (id) ON DELETE SET NULL;

-- Var olan satırlar: tür ve prompt kategorisinden üretim modu.
UPDATE public.generations g
SET mode = CASE
  WHEN g.type = 'image' THEN 'text_to_image'
  WHEN EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = g.prompt_id AND p.category = 'video2video')
    THEN 'video_to_video'
  ELSE 'image_to_video'
END;

ALTER TABLE public.generations
  ALTER COLUMN mode SET NOT NULL,
  ADD CONSTRAINT generations_mode_matches_type CHECK ((mode = 'text_to_image') = (type = 'image'));

CREATE INDEX generations_queue_idx
  ON public.generations (next_run_at) WHERE status IN ('queued', 'running');
CREATE INDEX generations_retry_of_idx
  ON public.generations (retry_of) WHERE retry_of IS NOT NULL;

COMMENT ON COLUMN public.generations.mode IS 'text_to_image | image_to_video | video_to_video. Verilmezse türden türetilir (video → image_to_video).';
COMMENT ON COLUMN public.generations.provider_job_id IS 'Sağlayıcıdaki iş kimliği (Higgsfield request_id). Sadece worker yazar.';
COMMENT ON COLUMN public.generations.next_run_at IS 'Worker''ın işi tekrar ele alacağı an: geri çekilme, yoklama aralığı ve claim kirası.';
COMMENT ON COLUMN public.generations.retry_of IS 'Panelden yeniden deneme: bu satır hangi üretimin tekrarı.';

-- ── Mod varsayılanı ve worker kolonu koruması ───────────────────
CREATE FUNCTION public.generations_prepare()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  privileged boolean := current_user IN ('postgres', 'supabase_admin', 'service_role');
BEGIN
  IF TG_OP = 'INSERT' THEN
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
    NEW.provider_job_id IS DISTINCT FROM OLD.provider_job_id
    OR NEW.progress IS DISTINCT FROM OLD.progress
    OR NEW.attempts IS DISTINCT FROM OLD.attempts
    OR NEW.max_attempts IS DISTINCT FROM OLD.max_attempts
    OR NEW.next_run_at IS DISTINCT FROM OLD.next_run_at
    OR NEW.started_at IS DISTINCT FROM OLD.started_at
    OR NEW.finished_at IS DISTINCT FROM OLD.finished_at
    OR NEW.cancel_requested_at IS DISTINCT FROM OLD.cancel_requested_at
    OR NEW.retry_of IS DISTINCT FROM OLD.retry_of
  ) THEN
    RAISE EXCEPTION 'Kuyruk alanları yalnız sunucu tarafından değiştirilebilir.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.generations_prepare() FROM PUBLIC, anon;

CREATE TRIGGER generations_prepare
  BEFORE INSERT OR UPDATE ON public.generations
  FOR EACH ROW EXECUTE FUNCTION public.generations_prepare();

-- ── Worker durumu (panel "sağlayıcı yapılandırılmamış" bilgisini buradan okur) ──
CREATE TABLE public.generation_worker_status (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  providers text[] NOT NULL DEFAULT '{}',
  claimed integer NOT NULL DEFAULT 0 CHECK (claimed >= 0),
  message text CHECK (message IS NULL OR length(message) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generation_worker_status ENABLE ROW LEVEL SECURITY;
-- Ekip okur; yazma politikası yok (yalnız service_role).
CREATE POLICY generation_worker_status_team_read ON public.generation_worker_status
  FOR SELECT TO authenticated USING (public.is_team_member());
REVOKE ALL ON public.generation_worker_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.generation_worker_status TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.generation_worker_status TO service_role;
CREATE TRIGGER generation_worker_status_set_updated_at
  BEFORE UPDATE ON public.generation_worker_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.generation_worker_status IS 'Üretim worker''ının son çalışması (tek satır). providers boşsa sağlayıcı yapılandırılmamış.';

-- ── Kuyruğa ekleme (bütçe kontrolüyle tek transaction) ──────────
-- SECURITY INVOKER: RLS uygulanır; viewer ve ekip dışı INSERT edemez (42501).
CREATE FUNCTION public.enqueue_generation(
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
  v_params jsonb := COALESCE(p_params, '{}'::jsonb);
  v_inputs uuid[] := COALESCE(p_input_asset_ids, '{}');
  v_exceeded boolean;
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
    v_params := v_params || jsonb_build_object('budget_override_by', auth.uid());
  END IF;

  INSERT INTO public.generations (
    influencer_id, prompt_id, tool, type, mode, params, input_asset_ids, status, retry_of
  )
  VALUES (
    p_influencer_id, p_prompt_id, p_tool, p_type, p_mode, v_params, v_inputs, 'queued', p_retry_of
  )
  RETURNING * INTO created;

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_generation(uuid, public.generation_type, text, jsonb, text, uuid, uuid[], boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_generation(uuid, public.generation_type, text, jsonb, text, uuid, uuid[], boolean, uuid) TO authenticated;

-- ── Panel: yeniden dene / iptal ─────────────────────────────────
-- Yeniden deneme: başarısız veya iptal edilmiş üretimin aynı parametrelerle yeni satırı.
CREATE FUNCTION public.retry_generation(p_id uuid, p_override_budget boolean DEFAULT false)
RETURNS public.generations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  g public.generations;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Yeniden denemek için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO g FROM public.generations WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üretim bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF g.status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'Sadece başarısız veya iptal edilmiş üretim yeniden denenebilir.' USING ERRCODE = '55000';
  END IF;
  RETURN public.enqueue_generation(
    g.influencer_id, g.type, g.tool, g.params - 'budget_override_by', g.mode, g.prompt_id,
    g.input_asset_ids, p_override_budget, g.id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.retry_generation(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_generation(uuid, boolean) TO authenticated;

-- İptal. SECURITY DEFINER: worker kolonunu (cancel_requested_at) yazar; yetki elle denetlenir.
CREATE FUNCTION public.cancel_generation(p_id uuid)
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
REVOKE ALL ON FUNCTION public.cancel_generation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_generation(uuid) TO authenticated;

-- ── Worker RPC'leri (yalnız service_role) ───────────────────────
-- Zamanı gelmiş işleri kilitleyerek alır ve kira süresi kadar ileri atar. Eşzamanlı iki worker
-- aynı satırı alamaz (SKIP LOCKED + kira).
CREATE FUNCTION public.claim_generations(
  p_tools text[],
  p_limit integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.generations
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH picked AS (
    SELECT g.id
    FROM public.generations g
    WHERE g.status IN ('queued', 'running')
      AND g.next_run_at <= now()
      AND g.tool = ANY (p_tools)
    ORDER BY g.next_run_at, g.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 50)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.generations g
  SET next_run_at = now() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 10), 900))
  FROM picked
  WHERE g.id = picked.id
  RETURNING g.*
$$;
REVOKE ALL ON FUNCTION public.claim_generations(text[], integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generations(text[], integer, integer) TO service_role;

-- Sonuç dosyası Storage'a yüklendikten sonra: asset satırı + üretim tek transaction'da.
-- Tekrar çağrılırsa (worker yarıda kaldıysa) aynı asset yeniden kullanılır.
CREATE FUNCTION public.complete_generation(
  p_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes bigint DEFAULT NULL,
  p_credits numeric DEFAULT NULL
)
RETURNS public.generations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  g public.generations;
  v_asset_id uuid;
BEGIN
  SELECT * INTO g FROM public.generations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üretim bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF g.status NOT IN ('queued', 'running') THEN
    RETURN g;
  END IF;

  INSERT INTO public.assets (influencer_id, kind, storage_path, mime_type, file_size_bytes, tags, created_by)
  VALUES (
    g.influencer_id, 'generated', p_storage_path, p_mime_type, p_file_size_bytes,
    ARRAY['generated', g.mode], g.created_by
  )
  ON CONFLICT (storage_path) DO UPDATE
    SET mime_type = EXCLUDED.mime_type, file_size_bytes = EXCLUDED.file_size_bytes
  RETURNING id INTO v_asset_id;

  UPDATE public.generations
  SET status = 'succeeded',
      output_asset_id = v_asset_id,
      credits = COALESCE(p_credits, credits),
      progress = 100,
      error = NULL,
      finished_at = now(),
      duration_ms = LEAST(
        (extract(epoch FROM now() - COALESCE(started_at, created_at)) * 1000)::bigint,
        2147483647
      )::integer
  WHERE id = p_id
  RETURNING * INTO g;
  RETURN g;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_generation(uuid, text, text, bigint, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_generation(uuid, text, text, bigint, numeric) TO service_role;

-- ── Zamanlama: pg_cron + pg_net ─────────────────────────────────
-- Vault: project_url (https://<ref>.supabase.co) ve cron_secret. Biri yoksa çağrı yapılmaz.
-- Zamanı gelmiş iş yoksa da çağrı yapılmaz (boşa fonksiyon çağrısı yok).
CREATE FUNCTION private.invoke_generation_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := private.notify_secret('project_url');
  v_secret text := private.notify_secret('cron_secret');
BEGIN
  IF v_url IS NULL OR v_secret IS NULL OR v_url !~ '^https?://[^/?#]+/?$' THEN
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
REVOKE ALL ON FUNCTION private.invoke_generation_worker() FROM PUBLIC, anon, authenticated, service_role;

SELECT cron.schedule(
  'process-generations',
  '* * * * *',
  $$SELECT private.invoke_generation_worker()$$
);
