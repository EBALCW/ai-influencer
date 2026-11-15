-- Ortak üretim işi modeli (#201, docs/adr/0004-moduler-panel.md → Karar 2 ve 3).
--
-- Bütün modüllerin (anlatım, klip, influencer) kullandığı kalıcı iş kuyruğu:
--   production_workers  üretim makinesi kaydı (ad, platform, yetenekler, son görülme, iptal)
--   jobs                iş: modül, tür, dondurulmuş parametreler, durum, kira, deneme, iptal isteği
--   job_stages          iş başına sıralı aşamalar: durum, ilerleme, hata, onay
--   job_assets          iş ↔ assets bağı ve rol
--
-- Kararlar:
-- * İstemcinin bu tablolarda YALNIZ SELECT izni vardır. Her yazım `public` INVOKER sarmalayıcı +
--   `internal` DEFINER çekirdek üzerinden geçer; çekirdek alanı `current_workspace_id()` ile
--   kendisi süzer, istemciden çalışma alanı kimliği almaz.
-- * Durum makinesi veritabanındadır: `private.jobs_guard()` ve `private.job_stages_guard()`
--   trigger'ları geçersiz geçişi service role ve postgres için de reddeder. RPC'ler yalnız
--   bu trigger'ların izin verdiği geçişleri yapar.
-- * Onay kapısı: onay gerektiren aşama bitince iş `awaiting_approval` olur. Onaysız çıkış
--   (`queued` / `succeeded`), onaysız aşamadan sonraki aşamayı başlatmak ve onay kolonlarını
--   doğrudan yazmak trigger'da reddedilir. Onayı yalnız owner/editor olan, oturum kimliği
--   bilinen ve makine olarak kaydedilmemiş bir oturum verebilir.
-- * Makine bir ekip üyesinin oturumudur (ADR Karar 3). `register_worker()` çağıran oturumun
--   kimliğini (`session_id` JWT claim'i) `private.worker_sessions`'a kalıcı olarak yazar; bu
--   oturum bir daha onay veremez. TODO(#211): claim'in gerçek erişim token'ında bulunduğu
--   yalnız pgTAP'te (elle verilen claim'le) denendi; eşleme kodlu giriş akışı #211'de yazılırken
--   gerçek oturumla doğrulanacak. Claim yoksa onay ve makine kaydı REDDEDİLİR (güvenli taraf).
-- * Kira ayrı kolondur (`lease_expires_at`). Kira dolarsa iş kuyruğa döner ve `attempts` artar;
--   `max_attempts`'e ulaşınca `failed`. `run_after` yalnız geçici hata sonrası beklemedir.
-- * Yeniden deneme (panel) mevcut işi değiştirmez; `retry_of` ile bağlı YENİ iş açar. Aşamalar
--   baştan başlar, onaylar devralınmaz (makine önceki işin çıktılarını `retry_of` üzerinden
--   okuyup yeniden kullanabilir).
-- * Sahip FK'si şimdilik yalnız `clip_source_id`; `episode_id` tablosuyla birlikte #216'da gelir.

-- ── 1) Üretim makineleri ────────────────────────────────────────────────────
CREATE TABLE public.production_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  -- Makine bir ekip üyesinin oturumuyla çalışır; üye çıkarılınca kaydı da silinir.
  user_id uuid NOT NULL REFERENCES public.team_members (user_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80 AND length(name) <= 80),
  platform text NOT NULL CHECK (platform IN ('darwin', 'win32', 'linux')),
  version text NOT NULL DEFAULT '' CHECK (length(version) <= 40),
  capabilities text[] NOT NULL DEFAULT '{}',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_workers_name_key UNIQUE (workspace_id, user_id, name),
  CONSTRAINT production_workers_capabilities_valid CHECK (
    cardinality(capabilities) <= 50
    AND array_position(capabilities, NULL) IS NULL
    AND '' <> ALL (capabilities)
    AND array_to_string(capabilities, ',') ~ '^([a-z0-9][a-z0-9_.:-]{0,39}(,|$))*$'
  )
);
CREATE INDEX production_workers_workspace_id_idx ON public.production_workers (workspace_id);
CREATE INDEX production_workers_user_idx ON public.production_workers (user_id);

COMMENT ON TABLE public.production_workers IS
  'Üretim makinesi kaydı (#201). Makine bir ekip üyesinin oturumudur; satırı yalnız RPC yazar.';
COMMENT ON COLUMN public.production_workers.capabilities IS
  'Makinenin yetenekleri (ör. ffmpeg, blender, hyperframes). İş, required_capabilities bunun alt kümesiyse verilir.';
COMMENT ON COLUMN public.production_workers.last_seen_at IS
  'Son kalp atışı. 90 saniyeden eskiyse makine çevrimdışı sayılır (arayüz kuralı).';

-- Makine olarak kaydedilmiş oturumlar. Satır silinmez: bir kez makine olan oturum onay veremez.
CREATE TABLE private.worker_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.production_workers (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX worker_sessions_worker_idx ON private.worker_sessions (worker_id);
REVOKE ALL ON private.worker_sessions FROM PUBLIC, anon, authenticated, service_role;

-- ── 2) İşler ────────────────────────────────────────────────────────────────
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  module text NOT NULL,
  kind text NOT NULL,
  -- Sahip kayıt. Anlatım modülünün episode_id'si #216'da eklenir.
  clip_source_id uuid REFERENCES public.clip_sources (id) ON DELETE SET NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  current_stage text,
  stop_at text,
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  required_capabilities text[] NOT NULL DEFAULT '{}',
  worker_id uuid REFERENCES public.production_workers (id) ON DELETE SET NULL,
  lease_expires_at timestamptz,
  run_after timestamptz NOT NULL DEFAULT now(),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts smallint NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  cancel_requested_at timestamptz,
  failed_stage text,
  error text CHECK (error IS NULL OR length(error) <= 2000),
  retry_of uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT jobs_module_known CHECK (module IN ('influencer', 'explainer', 'clip')),
  CONSTRAINT jobs_status_known
    CHECK (status IN ('queued', 'running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT jobs_kind_valid CHECK (
    kind ~ '^[a-z][a-z0-9_]{0,39}\.[a-z][a-z0-9_]{0,39}$' AND split_part(kind, '.', 1) = module
  ),
  CONSTRAINT jobs_params_bounded
    CHECK (jsonb_typeof(params) = 'object' AND octet_length(params::text) <= 65536),
  CONSTRAINT jobs_capabilities_valid CHECK (
    cardinality(required_capabilities) <= 20
    AND array_position(required_capabilities, NULL) IS NULL
    AND '' <> ALL (required_capabilities)
    AND array_to_string(required_capabilities, ',') ~ '^([a-z0-9][a-z0-9_.:-]{0,39}(,|$))*$'
  ),
  -- Kira yalnız çalışan işte vardır (trigger running'den çıkarken temizler).
  CONSTRAINT jobs_lease_iff_running CHECK ((status = 'running') = (lease_expires_at IS NOT NULL))
);
CREATE INDEX jobs_workspace_id_idx ON public.jobs (workspace_id);
-- claim_job: alanın sıradaki işleri, eskiden yeniye.
CREATE INDEX jobs_claim_idx ON public.jobs (workspace_id, created_at, id) WHERE status = 'queued';
-- Kirası dolan işleri geri alma (cron ve claim_job).
CREATE INDEX jobs_lease_idx ON public.jobs (lease_expires_at) WHERE status = 'running';
CREATE INDEX jobs_workspace_created_idx ON public.jobs (workspace_id, created_at DESC);
CREATE INDEX jobs_worker_idx ON public.jobs (worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX jobs_retry_of_idx ON public.jobs (retry_of) WHERE retry_of IS NOT NULL;
CREATE INDEX jobs_clip_source_idx ON public.jobs (clip_source_id) WHERE clip_source_id IS NOT NULL;

COMMENT ON TABLE public.jobs IS
  'Ortak üretim işi (#201). Durum: queued → running → awaiting_approval → succeeded | failed | cancelled. Yalnız RPC yazar.';
COMMENT ON COLUMN public.jobs.kind IS '<modül>.<iş> biçiminde tür (ör. explainer.render, clip.cut).';
COMMENT ON COLUMN public.jobs.params IS 'İşe alınırken dondurulan parametreler (en çok 64 KB). Sonradan değişmez; sır yazılmaz.';
COMMENT ON COLUMN public.jobs.stop_at IS 'Bu aşama bitince (ve gerekiyorsa onaylanınca) iş tamamlanır; sonraki aşamalar atlanır.';
COMMENT ON COLUMN public.jobs.worker_id IS 'İşi alan (çalışıyorsa) ya da en son almış olan makine.';
COMMENT ON COLUMN public.jobs.lease_expires_at IS 'Kira bitişi. Makine ilerleme yazdıkça uzar; dolarsa iş kuyruğa döner.';
COMMENT ON COLUMN public.jobs.run_after IS 'Geçici hatadan sonra işin yeniden alınabileceği en erken an.';
COMMENT ON COLUMN public.jobs.attempts IS 'Başarısız deneme sayısı (geçici hata ya da dolan kira). max_attempts''e ulaşınca failed.';
COMMENT ON COLUMN public.jobs.retry_of IS 'Panelden yeniden deneme: bu iş hangi işin tekrarı.';

-- ── 3) Aşamalar ─────────────────────────────────────────────────────────────
CREATE TABLE public.job_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  seq smallint NOT NULL CHECK (seq BETWEEN 1 AND 20),
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  status text NOT NULL DEFAULT 'pending',
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  detail text CHECK (detail IS NULL OR length(detail) <= 500),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error text CHECK (error IS NULL OR length(error) <= 2000),
  requires_approval boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_stages_status_known
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  CONSTRAINT job_stages_output_bounded
    CHECK (jsonb_typeof(output) = 'object' AND octet_length(output::text) <= 8192),
  CONSTRAINT job_stages_job_seq_key UNIQUE (job_id, seq),
  CONSTRAINT job_stages_job_key_key UNIQUE (job_id, key)
);
CREATE INDEX job_stages_workspace_id_idx ON public.job_stages (workspace_id);

COMMENT ON TABLE public.job_stages IS 'İşin sıralı aşamaları ve geçmişi (#201). Yalnız RPC yazar.';
COMMENT ON COLUMN public.job_stages.detail IS 'Makinenin yazdığı kısa ilerleme notu (en çok 500 karakter).';
COMMENT ON COLUMN public.job_stages.output IS 'Aşamanın kısa çıktı özeti (en çok 8 KB). Dosyalar job_assets ile bağlanır.';
COMMENT ON COLUMN public.job_stages.approved_at IS
  'Yalnız approve_job_stage() ile yazılır; trigger oturumu denetler ve approved_by''ı auth.uid()''den doldurur.';

-- ── 4) İş varlıkları ────────────────────────────────────────────────────────
CREATE TABLE public.job_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets (id) ON DELETE CASCADE,
  stage_key text CHECK (stage_key IS NULL OR stage_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT job_assets_role_known
    CHECK (role IN ('input', 'audio', 'captions', 'frame', 'preview', 'final', 'other')),
  CONSTRAINT job_assets_job_asset_role_key UNIQUE (job_id, asset_id, role)
);
CREATE INDEX job_assets_workspace_id_idx ON public.job_assets (workspace_id);
CREATE INDEX job_assets_asset_idx ON public.job_assets (asset_id);

COMMENT ON TABLE public.job_assets IS 'İş ↔ assets bağı ve rol (girdi, ses, altyazı, ara kare, önizleme, final) (#201).';

-- ── 5) RLS, izinler, çalışma alanı ──────────────────────────────────────────
-- Ekip okur. Yazma policy'si ve yazma izni yok: her değişiklik RPC çekirdeğinden geçer.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['production_workers', 'jobs', 'job_stages', 'job_assets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_team_member())',
      t || '_team_read', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (workspace_id = (SELECT public.current_workspace_id())) '
      'WITH CHECK (workspace_id = (SELECT public.current_workspace_id()))',
      t || '_workspace', t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END;
$$;

CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.production_workers
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent('?user_id=team_members.user_id');
CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent(
    '?clip_source_id=clip_sources.id', '?worker_id=production_workers.id', '?retry_of=jobs.id'
  );
CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.job_stages
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent('job_id=jobs.id');
CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.job_assets
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent('job_id=jobs.id', '?asset_id=assets.id');

CREATE TRIGGER production_workers_set_updated_at BEFORE UPDATE ON public.production_workers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER jobs_set_created_by BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER job_stages_set_updated_at BEFORE UPDATE ON public.job_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER job_assets_set_created_by BEFORE INSERT OR UPDATE ON public.job_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- ── 6) Oturum yardımcıları ──────────────────────────────────────────────────
-- Erişim token'ındaki oturum kimliği. Claim yoksa ya da uuid değilse NULL.
-- TODO(#211): gerçek Supabase Auth oturumunda claim'in varlığı doğrulanacak.
CREATE FUNCTION private.current_session_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (auth.jwt() ->> 'session_id')
      ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN (auth.jwt() ->> 'session_id')::uuid
  END
$$;

-- Çağıran oturum bir kez makine olarak kaydedildi mi?
CREATE FUNCTION private.is_worker_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.worker_sessions s WHERE s.session_id = private.current_session_id()
  )
$$;

-- Makine RPC'lerinin ortak denetimi: çağıran owner/editor, makine onun, alanında, iptal edilmemiş
-- ve çağrı o makineye kayıtlı oturumdan geliyor.
CREATE FUNCTION private.require_worker(p_worker_id uuid)
RETURNS public.production_workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w public.production_workers;
  v_session uuid := private.current_session_id();
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Üretim makinesi için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO w FROM public.production_workers
  WHERE id = p_worker_id
    AND workspace_id = public.current_workspace_id()
    AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üretim makinesi bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF w.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı.' USING ERRCODE = '42501', HINT = 'worker_revoked';
  END IF;
  IF v_session IS NULL OR NOT EXISTS (
    SELECT 1 FROM private.worker_sessions s WHERE s.session_id = v_session AND s.worker_id = w.id
  ) THEN
    RAISE EXCEPTION 'Bu oturum makineye kayıtlı değil.' USING ERRCODE = '42501', HINT = 'worker_session_required';
  END IF;
  RETURN w;
END;
$$;

-- ── 7) Durum makinesi (tek doğruluk kaynağı) ────────────────────────────────
-- İş geçişleri:
--   queued            → running | cancelled
--   running           → queued | awaiting_approval | succeeded | failed | cancelled
--   awaiting_approval → queued | succeeded | cancelled   (queued/succeeded yalnız onaydan sonra)
--   succeeded, failed, cancelled → (son durum)
CREATE FUNCTION private.jobs_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'queued' THEN
      RAISE EXCEPTION 'Yeni iş yalnız sırada (queued) açılabilir.'
        USING ERRCODE = '55000', HINT = 'illegal_transition';
    END IF;
    NEW.worker_id := NULL;
    NEW.lease_expires_at := NULL;
    NEW.attempts := 0;
    NEW.progress := 0;
    NEW.cancel_requested_at := NULL;
    NEW.failed_stage := NULL;
    NEW.error := NULL;
    NEW.started_at := NULL;
    NEW.finished_at := NULL;
    RETURN NEW;
  END IF;

  -- İşin tanımı dondurulmuştur. FK'lerin ON DELETE SET NULL'u serbesttir.
  IF ROW(NEW.module, NEW.kind, NEW.params, NEW.stop_at, NEW.required_capabilities, NEW.max_attempts)
       IS DISTINCT FROM
     ROW(OLD.module, OLD.kind, OLD.params, OLD.stop_at, OLD.required_capabilities, OLD.max_attempts)
     OR (NEW.retry_of IS DISTINCT FROM OLD.retry_of AND NEW.retry_of IS NOT NULL)
     OR (NEW.clip_source_id IS DISTINCT FROM OLD.clip_source_id AND NEW.clip_source_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'İşin tanımı (modül, tür, parametreler, aşama sınırı) sonradan değiştirilemez.'
      USING ERRCODE = '55000', HINT = 'job_immutable';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE(
    (OLD.status = 'queued' AND NEW.status IN ('running', 'cancelled'))
    OR (OLD.status = 'running'
        AND NEW.status IN ('queued', 'awaiting_approval', 'succeeded', 'failed', 'cancelled'))
    OR (OLD.status = 'awaiting_approval' AND NEW.status IN ('queued', 'succeeded', 'cancelled')),
    false
  ) THEN
    RAISE EXCEPTION 'Geçersiz iş durumu geçişi: % → %.', OLD.status, NEW.status
      USING ERRCODE = '55000', HINT = 'illegal_transition';
  END IF;

  -- Onay kapısı: onay bekleyen iş, bekleyen aşaması onaylanmadan ilerleyemez.
  IF OLD.status = 'awaiting_approval' AND NEW.status IN ('queued', 'succeeded') AND NOT EXISTS (
    SELECT 1 FROM public.job_stages s
    WHERE s.job_id = OLD.id AND s.key = OLD.current_stage
      AND s.status = 'succeeded' AND s.approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Aşama onaylanmadan iş ilerleyemez.'
      USING ERRCODE = '42501', HINT = 'approval_required';
  END IF;

  -- Onay beklemeye yalnız bitmiş, onay gerektiren ve henüz onaylanmamış aşamada girilir.
  IF NEW.status = 'awaiting_approval' AND NOT EXISTS (
    SELECT 1 FROM public.job_stages s
    WHERE s.job_id = NEW.id AND s.key = NEW.current_stage
      AND s.requires_approval AND s.status = 'succeeded' AND s.approved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'İş yalnız onay gerektiren bitmiş aşamada onay beklemeye geçer.'
      USING ERRCODE = '55000', HINT = 'illegal_transition';
  END IF;

  -- Tamamlanan işte açık aşama, hatalı aşama ya da onaysız onay aşaması kalamaz; aşama yalnız
  -- stop_at aşaması bittiği için atlanmış olabilir.
  IF NEW.status = 'succeeded' AND (
    EXISTS (
      SELECT 1 FROM public.job_stages s
      WHERE s.job_id = NEW.id AND (
        s.status IN ('pending', 'running', 'failed')
        OR (s.status = 'succeeded' AND s.requires_approval AND s.approved_at IS NULL)
      )
    )
    OR (
      EXISTS (SELECT 1 FROM public.job_stages s WHERE s.job_id = NEW.id AND s.status = 'skipped')
      AND NOT EXISTS (
        SELECT 1 FROM public.job_stages s
        WHERE s.job_id = NEW.id AND s.key = NEW.stop_at AND s.status = 'succeeded'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Aşamaları bitmemiş ya da onaylanmamış iş tamamlanamaz.'
      USING ERRCODE = '55000', HINT = 'job_incomplete';
  END IF;

  IF NEW.status = 'running' THEN
    NEW.started_at := COALESCE(OLD.started_at, now());
  ELSE
    NEW.lease_expires_at := NULL;
  END IF;
  IF NEW.status IN ('succeeded', 'failed', 'cancelled') THEN
    NEW.finished_at := now();
  END IF;
  IF NEW.status = 'succeeded' THEN
    NEW.progress := 100;
  END IF;
  RETURN NEW;
END;
$$;

-- Aşama geçişleri:
--   pending → running | skipped
--   running → pending (yeniden deneme) | succeeded | failed | skipped
--   succeeded, failed, skipped → (son durum)
-- Aşama ancak önceki bütün aşamalar bitmiş ve (gerekiyorsa) onaylanmışsa başlar.
CREATE FUNCTION private.job_stages_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' OR NEW.approved_at IS NOT NULL OR NEW.approved_by IS NOT NULL THEN
      RAISE EXCEPTION 'Yeni aşama yalnız bekliyor (pending) ve onaysız açılabilir.'
        USING ERRCODE = '55000', HINT = 'illegal_transition';
    END IF;
    NEW.attempts := 0;
    NEW.progress := 0;
    NEW.started_at := NULL;
    NEW.finished_at := NULL;
    RETURN NEW;
  END IF;

  IF ROW(NEW.job_id, NEW.seq, NEW.key, NEW.requires_approval)
       IS DISTINCT FROM ROW(OLD.job_id, OLD.seq, OLD.key, OLD.requires_approval) THEN
    RAISE EXCEPTION 'Aşamanın tanımı (sıra, ad, onay gereği) sonradan değiştirilemez.'
      USING ERRCODE = '55000', HINT = 'stage_immutable';
  END IF;

  -- Onay kolonları: yalnız bir kez, bitmiş ve onay gerektiren aşamada, alanın owner/editor'ü
  -- olan ve makine olarak kaydedilmemiş bir oturumdan. Değerler istemciden alınmaz.
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    IF OLD.approved_at IS NOT NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'Verilmiş onay değiştirilemez.' USING ERRCODE = '55000', HINT = 'already_approved';
    END IF;
    IF NOT NEW.requires_approval OR OLD.status <> 'succeeded' OR NEW.status <> 'succeeded' THEN
      RAISE EXCEPTION 'Yalnız bitmiş ve onay gerektiren aşama onaylanabilir.'
        USING ERRCODE = '55000', HINT = 'not_awaiting_approval';
    END IF;
    IF v_uid IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.team_members m
      WHERE m.user_id = v_uid AND m.workspace_id = NEW.workspace_id AND m.role IN ('owner', 'editor')
    ) THEN
      RAISE EXCEPTION 'Aşamayı yalnız çalışma alanının owner ya da editörü onaylayabilir.'
        USING ERRCODE = '42501';
    END IF;
    IF private.current_session_id() IS NULL OR private.is_worker_session() THEN
      RAISE EXCEPTION 'Üretim makinesi oturumu onay veremez.'
        USING ERRCODE = '42501', HINT = 'worker_session';
    END IF;
    NEW.approved_by := v_uid;
    NEW.approved_at := now();
  ELSIF NEW.approved_by IS DISTINCT FROM OLD.approved_by AND NEW.approved_by IS NOT NULL THEN
    RAISE EXCEPTION 'Onaylayan yalnız approve_job_stage() ile yazılır.' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE(
    (OLD.status = 'pending' AND NEW.status IN ('running', 'skipped'))
    OR (OLD.status = 'running' AND NEW.status IN ('pending', 'succeeded', 'failed', 'skipped')),
    false
  ) THEN
    RAISE EXCEPTION 'Geçersiz aşama durumu geçişi: % → %.', OLD.status, NEW.status
      USING ERRCODE = '55000', HINT = 'illegal_transition';
  END IF;

  IF NEW.status = 'running' THEN
    IF EXISTS (
      SELECT 1 FROM public.job_stages p
      WHERE p.job_id = NEW.job_id AND p.seq < NEW.seq AND p.status <> 'succeeded'
    ) THEN
      RAISE EXCEPTION 'Önceki aşamalar bitmeden bu aşama başlayamaz.'
        USING ERRCODE = '55000', HINT = 'stage_out_of_order';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.job_stages p
      WHERE p.job_id = NEW.job_id AND p.seq < NEW.seq
        AND p.requires_approval AND p.approved_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Önceki aşama onaylanmadan bu aşama başlayamaz.'
        USING ERRCODE = '42501', HINT = 'approval_required';
    END IF;
    NEW.started_at := COALESCE(OLD.started_at, now());
  ELSIF NEW.status IN ('succeeded', 'failed', 'skipped') THEN
    NEW.finished_at := now();
    IF NEW.status = 'succeeded' THEN
      NEW.progress := 100;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_guard BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.jobs_guard();
CREATE TRIGGER job_stages_guard BEFORE INSERT OR UPDATE ON public.job_stages
  FOR EACH ROW EXECUTE FUNCTION private.job_stages_guard();

-- ── 8) Çekirdek yardımcılar (private) ───────────────────────────────────────
CREATE FUNCTION private.lease_interval(p_seconds integer)
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT make_interval(secs => LEAST(GREATEST(COALESCE(p_seconds, 120), 30), 900))
$$;

-- İş ilerlemesi: atlanmayan aşamaların ortalaması.
CREATE FUNCTION private.job_progress(p_job_id uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    floor(
      sum(CASE s.status WHEN 'succeeded' THEN 100 WHEN 'running' THEN s.progress ELSE 0 END)::numeric
      / NULLIF(count(*), 0)
    ),
    0
  )::smallint
  FROM public.job_stages s
  WHERE s.job_id = p_job_id AND s.status <> 'skipped'
$$;

-- İş biterken açık kalan aşamalar atlanır.
CREATE FUNCTION private.skip_open_stages(p_job_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.job_stages SET status = 'skipped'
  WHERE job_id = p_job_id AND status IN ('pending', 'running')
$$;

-- İş + aşamaları oluşturur. Yetkiyi çağıran çekirdek denetler; alan parametre olarak gelir.
CREATE FUNCTION private.create_job(
  p_workspace_id uuid,
  p_module text,
  p_kind text,
  p_stages jsonb,
  p_params jsonb,
  p_required_capabilities text[],
  p_stop_at text,
  p_clip_source_id uuid,
  p_max_attempts integer,
  p_retry_of uuid
)
RETURNS public.jobs
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  j public.jobs;
BEGIN
  IF p_stages IS NULL OR jsonb_typeof(p_stages) IS DISTINCT FROM 'array'
    OR octet_length(p_stages::text) > 4096 THEN
    RAISE EXCEPTION 'Aşama listesi 1-20 elemanlı bir dizi olmalı.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_stages) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Aşama listesi 1-20 elemanlı bir dizi olmalı.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_stages) AS e (stage)
    WHERE jsonb_typeof(e.stage) IS DISTINCT FROM 'object'
      OR jsonb_typeof(e.stage -> 'key') IS DISTINCT FROM 'string'
      OR ((e.stage -> 'requires_approval') IS NOT NULL
          AND jsonb_typeof(e.stage -> 'requires_approval') <> 'boolean')
  ) THEN
    RAISE EXCEPTION 'Her aşama {"key": metin, "requires_approval": mantıksal} biçiminde olmalı.'
      USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT e.stage ->> 'key') FROM jsonb_array_elements(p_stages) AS e (stage))
    <> jsonb_array_length(p_stages) THEN
    RAISE EXCEPTION 'Aşama adları iş içinde tekil olmalı.' USING ERRCODE = '22023';
  END IF;
  IF p_stop_at IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_stages) AS e (stage) WHERE e.stage ->> 'key' = p_stop_at
  ) THEN
    RAISE EXCEPTION 'stop_at işin aşamalarından biri olmalı.' USING ERRCODE = '22023';
  END IF;
  -- DEFINER bağlamında RLS yok: sahip kayıt çağıranın alanında olmalı.
  IF p_clip_source_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clip_sources c
    WHERE c.id = p_clip_source_id AND c.workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Kaynak video bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.jobs (
    workspace_id, module, kind, clip_source_id, params, stop_at, required_capabilities,
    max_attempts, retry_of, current_stage
  )
  VALUES (
    p_workspace_id, p_module, p_kind, p_clip_source_id, COALESCE(p_params, '{}'::jsonb), p_stop_at,
    COALESCE(p_required_capabilities, '{}'), COALESCE(p_max_attempts, 3), p_retry_of,
    p_stages -> 0 ->> 'key'
  )
  RETURNING * INTO j;

  INSERT INTO public.job_stages (workspace_id, job_id, seq, key, requires_approval)
  SELECT j.workspace_id, j.id, e.ord, e.stage ->> 'key',
    COALESCE((e.stage ->> 'requires_approval')::boolean, false)
  FROM jsonb_array_elements(p_stages) WITH ORDINALITY AS e (stage, ord);

  RETURN j;
END;
$$;

-- Geçerli aşama bitti (ve gerekiyorsa onaylandı): iş tamamlanır ya da sonraki aşamaya geçer.
-- p_keep_worker: iş aynı makinede sürüyor (running kalır); değilse kuyruğa döner.
CREATE FUNCTION private.advance_job(p_job public.jobs, p_keep_worker boolean)
RETURNS public.jobs
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  j public.jobs := p_job;
  v_next text;
BEGIN
  IF j.stop_at IS DISTINCT FROM j.current_stage THEN
    SELECT s.key INTO v_next
    FROM public.job_stages s
    WHERE s.job_id = j.id
      AND s.seq > (SELECT c.seq FROM public.job_stages c WHERE c.job_id = j.id AND c.key = j.current_stage)
    ORDER BY s.seq
    LIMIT 1;
  END IF;

  IF v_next IS NULL THEN
    PERFORM private.skip_open_stages(j.id);
    UPDATE public.jobs SET status = 'succeeded' WHERE id = j.id RETURNING * INTO j;
  ELSIF p_keep_worker THEN
    UPDATE public.jobs
    SET current_stage = v_next, progress = private.job_progress(j.id)
    WHERE id = j.id
    RETURNING * INTO j;
  ELSE
    UPDATE public.jobs
    SET status = 'queued', current_stage = v_next, run_after = now(),
        progress = private.job_progress(j.id)
    WHERE id = j.id
    RETURNING * INTO j;
  END IF;
  RETURN j;
END;
$$;

-- Makinenin elindeki iş: kilitler ve kiranın hâlâ bu makinede olduğunu doğrular.
CREATE FUNCTION private.job_for_worker(p_worker_id uuid, p_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  w public.production_workers := private.require_worker(p_worker_id);
  j public.jobs;
BEGIN
  SELECT * INTO j FROM public.jobs
  WHERE id = p_job_id AND workspace_id = w.workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İş bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF j.status <> 'running' OR j.worker_id IS DISTINCT FROM w.id OR j.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'İş bu makinede çalışmıyor (kira doldu ya da iş başka makinede).'
      USING ERRCODE = '55000', HINT = 'lease_lost';
  END IF;
  RETURN j;
END;
$$;

-- Kirası dolan işler: iptal istenmişse iptal, deneme hakkı bittiyse hata, değilse kuyruğa.
-- p_workspace_id NULL ise (cron) bütün alanlar; her satır kendi alanında işlenir.
CREATE FUNCTION private.reclaim_expired_jobs(p_workspace_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jobs;
  v_count integer := 0;
  v_error constant text := 'Makine yanıt vermedi: kira süresi doldu.';
BEGIN
  FOR j IN
    SELECT * FROM public.jobs q
    WHERE q.status = 'running' AND q.lease_expires_at <= now()
      AND (p_workspace_id IS NULL OR q.workspace_id = p_workspace_id)
    ORDER BY q.lease_expires_at
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  LOOP
    v_count := v_count + 1;
    IF j.cancel_requested_at IS NOT NULL THEN
      PERFORM private.skip_open_stages(j.id);
      UPDATE public.jobs SET status = 'cancelled' WHERE id = j.id;
    ELSIF j.attempts + 1 >= j.max_attempts THEN
      UPDATE public.job_stages SET status = 'failed', attempts = attempts + 1, error = v_error
      WHERE job_id = j.id AND status = 'running';
      PERFORM private.skip_open_stages(j.id);
      UPDATE public.jobs
      SET status = 'failed', attempts = attempts + 1, failed_stage = j.current_stage, error = v_error
      WHERE id = j.id;
    ELSE
      UPDATE public.job_stages SET status = 'pending', attempts = attempts + 1, error = v_error
      WHERE job_id = j.id AND status = 'running';
      UPDATE public.jobs
      SET status = 'queued', attempts = attempts + 1, run_after = now(), error = v_error
      WHERE id = j.id;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ── 9) Panel RPC çekirdekleri (owner/editor) ────────────────────────────────
CREATE FUNCTION internal.enqueue_job(
  p_module text,
  p_kind text,
  p_stages jsonb,
  p_params jsonb,
  p_required_capabilities text[],
  p_stop_at text,
  p_clip_source_id uuid,
  p_max_attempts integer
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'İş başlatmak için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  RETURN private.create_job(
    v_ws, p_module, p_kind, p_stages, p_params, p_required_capabilities, p_stop_at,
    p_clip_source_id, p_max_attempts, NULL
  );
END;
$$;

-- Yeniden deneme: başarısız ya da iptal edilmiş işin aynı tanımla yeni satırı.
CREATE FUNCTION internal.retry_job(p_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  j public.jobs;
  v_stages jsonb;
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'Yeniden denemek için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO j FROM public.jobs WHERE id = p_job_id AND workspace_id = v_ws;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İş bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF j.status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'Sadece başarısız veya iptal edilmiş iş yeniden denenebilir.' USING ERRCODE = '55000';
  END IF;
  SELECT jsonb_agg(
    jsonb_build_object('key', s.key, 'requires_approval', s.requires_approval) ORDER BY s.seq
  ) INTO v_stages
  FROM public.job_stages s WHERE s.job_id = j.id;
  RETURN private.create_job(
    v_ws, j.module, j.kind, v_stages, j.params, j.required_capabilities, j.stop_at,
    j.clip_source_id, j.max_attempts, j.id
  );
END;
$$;

-- İptal: çalışmayan iş anında iptal olur; çalışan işte istek yazılır, makine bir sonraki
-- ilerleme çağrısında görür ve acknowledge_cancel() ile kapatır (yanıt vermezse kira dolunca).
CREATE FUNCTION internal.request_cancel_job(p_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  j public.jobs;
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'İptal için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO j FROM public.jobs WHERE id = p_job_id AND workspace_id = v_ws FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İş bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF j.status IN ('succeeded', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Biten iş iptal edilemez.' USING ERRCODE = '55000';
  END IF;

  IF j.status = 'running' THEN
    UPDATE public.jobs
    SET cancel_requested_at = COALESCE(cancel_requested_at, now())
    WHERE id = j.id
    RETURNING * INTO j;
  ELSE
    PERFORM private.skip_open_stages(j.id);
    UPDATE public.jobs
    SET status = 'cancelled', cancel_requested_at = COALESCE(cancel_requested_at, now())
    WHERE id = j.id
    RETURNING * INTO j;
  END IF;
  RETURN j;
END;
$$;

-- Onay: yalnız owner/editor olan insan oturumu. Asıl denetim job_stages_guard trigger'ındadır
-- (doğrudan UPDATE de aynı kuraldan geçer); buradaki denetim erken ve anlaşılır hata içindir.
CREATE FUNCTION internal.approve_job_stage(p_job_id uuid, p_stage_key text)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  j public.jobs;
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'Onay için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  -- TODO(#211): makine oturumunu ayıran session_id claim'i gerçek oturumla doğrulanacak.
  IF private.current_session_id() IS NULL OR private.is_worker_session() THEN
    RAISE EXCEPTION 'Üretim makinesi oturumu onay veremez.'
      USING ERRCODE = '42501', HINT = 'worker_session';
  END IF;
  SELECT * INTO j FROM public.jobs WHERE id = p_job_id AND workspace_id = v_ws FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İş bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF j.status <> 'awaiting_approval' OR j.current_stage IS DISTINCT FROM p_stage_key THEN
    RAISE EXCEPTION 'Bu aşama onay beklemiyor.' USING ERRCODE = '55000', HINT = 'not_awaiting_approval';
  END IF;

  UPDATE public.job_stages SET approved_at = now() WHERE job_id = j.id AND key = p_stage_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aşama bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  RETURN private.advance_job(j, false);
END;
$$;

-- İşe dosya bağlama (girdi ya da çıktı). Asset ve iş çağıranın alanında olmalı.
CREATE FUNCTION internal.attach_job_asset(
  p_job_id uuid, p_asset_id uuid, p_role text, p_stage_key text
)
RETURNS public.job_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  r public.job_assets;
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'Dosya bağlamak için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs q WHERE q.id = p_job_id AND q.workspace_id = v_ws) THEN
    RAISE EXCEPTION 'İş bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assets a WHERE a.id = p_asset_id AND a.workspace_id = v_ws) THEN
    RAISE EXCEPTION 'Dosya bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF p_stage_key IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.job_stages s WHERE s.job_id = p_job_id AND s.key = p_stage_key
  ) THEN
    RAISE EXCEPTION 'Aşama bu işe ait değil.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.job_assets (workspace_id, job_id, asset_id, role, stage_key)
  VALUES (v_ws, p_job_id, p_asset_id, p_role, p_stage_key)
  ON CONFLICT (job_id, asset_id, role) DO UPDATE SET stage_key = EXCLUDED.stage_key
  RETURNING * INTO r;
  RETURN r;
END;
$$;

-- ── 10) Makine kaydı çekirdekleri ───────────────────────────────────────────
-- Çağıran oturumu makine olarak kaydeder (aynı ad yeniden kaydedilirse satır güncellenir).
-- TODO(#211): bu çağrı eşleme kodlu giriş akışının parçası olacak; şimdilik makine kendi
-- oturumundan çağırır. Kaydedilen oturum kalıcı olarak "makine oturumu" sayılır.
CREATE FUNCTION internal.register_worker(
  p_name text, p_platform text, p_version text, p_capabilities text[]
)
RETURNS public.production_workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  v_uid uuid := auth.uid();
  v_session uuid := private.current_session_id();
  v_name text := btrim(COALESCE(p_name, ''));
  w public.production_workers;
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'Makine kaydı için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Makine kaydı için oturum kimliği gerekir.'
      USING ERRCODE = '42501', HINT = 'session_required';
  END IF;
  IF (
    SELECT count(*) FROM public.production_workers p
    WHERE p.workspace_id = v_ws AND p.user_id = v_uid AND p.name <> v_name
  ) >= 20 THEN
    RAISE EXCEPTION 'Kullanıcı başına en çok 20 makine kaydedilebilir.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.production_workers (workspace_id, user_id, name, platform, version, capabilities)
  VALUES (v_ws, v_uid, v_name, p_platform, COALESCE(p_version, ''), COALESCE(p_capabilities, '{}'))
  ON CONFLICT (workspace_id, user_id, name) DO UPDATE
    SET platform = EXCLUDED.platform, version = EXCLUDED.version,
        capabilities = EXCLUDED.capabilities, last_seen_at = now()
  RETURNING * INTO w;
  IF w.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı; başka bir adla kaydedin.'
      USING ERRCODE = '42501', HINT = 'worker_revoked';
  END IF;

  INSERT INTO private.worker_sessions AS ws (session_id, user_id, worker_id)
  VALUES (v_session, v_uid, w.id)
  ON CONFLICT (session_id) DO UPDATE SET worker_id = EXCLUDED.worker_id
    WHERE ws.user_id = EXCLUDED.user_id;
  RETURN w;
END;
$$;

CREATE FUNCTION internal.worker_heartbeat(p_worker_id uuid, p_capabilities text[])
RETURNS public.production_workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w public.production_workers := private.require_worker(p_worker_id);
BEGIN
  UPDATE public.production_workers
  SET last_seen_at = now(), capabilities = COALESCE(p_capabilities, capabilities)
  WHERE id = w.id
  RETURNING * INTO w;
  RETURN w;
END;
$$;

-- Makinenin yetkisini kaldırır: owner her makineyi, editor yalnız kendisininkini. Makine oturumu
-- çağıramaz. Elindeki işlerin kirası hemen dolar; işler bir sonraki geri almada kuyruğa döner.
CREATE FUNCTION internal.revoke_worker(p_worker_id uuid)
RETURNS public.production_workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  w public.production_workers;
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL OR private.is_worker_session() THEN
    RAISE EXCEPTION 'Makine yetkisini kaldırma izniniz yok.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO w FROM public.production_workers
  WHERE id = p_worker_id AND workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üretim makinesi bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_manage_team() AND w.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Başkasının makinesini yalnız owner kaldırabilir.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.production_workers
  SET revoked_at = COALESCE(revoked_at, now())
  WHERE id = w.id
  RETURNING * INTO w;
  UPDATE public.jobs SET lease_expires_at = now() WHERE worker_id = w.id AND status = 'running';
  RETURN w;
END;
$$;

-- ── 11) Makine iş çekirdekleri ──────────────────────────────────────────────
-- Çağıranın alanındaki, yetenekleri yeten sıradaki en eski işi kirayla alır. Eşzamanlı iki
-- makine aynı işi alamaz (SKIP LOCKED + durum değişimi).
CREATE FUNCTION internal.claim_job(p_worker_id uuid, p_lease_seconds integer)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w public.production_workers := private.require_worker(p_worker_id);
  j public.jobs;
BEGIN
  PERFORM private.reclaim_expired_jobs(w.workspace_id);
  UPDATE public.production_workers SET last_seen_at = now() WHERE id = w.id;

  SELECT q.* INTO j
  FROM public.jobs q
  WHERE q.workspace_id = w.workspace_id
    AND q.status = 'queued'
    AND q.run_after <= now()
    AND q.required_capabilities <@ w.capabilities
  ORDER BY q.created_at, q.id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.jobs
  SET status = 'running', worker_id = w.id,
      lease_expires_at = now() + private.lease_interval(p_lease_seconds)
  WHERE id = j.id
  RETURNING * INTO j;
  RETURN NEXT j;
  RETURN;
END;
$$;

CREATE FUNCTION internal.start_stage(
  p_worker_id uuid, p_job_id uuid, p_stage_key text, p_lease_seconds integer
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jobs := private.job_for_worker(p_worker_id, p_job_id);
BEGIN
  IF j.cancel_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'İş için iptal istendi.' USING ERRCODE = '55000', HINT = 'cancel_requested';
  END IF;
  IF j.current_stage IS DISTINCT FROM p_stage_key THEN
    RAISE EXCEPTION 'Sıradaki aşama bu değil.' USING ERRCODE = '55000', HINT = 'stage_out_of_order';
  END IF;

  UPDATE public.job_stages SET status = 'running', progress = 0, detail = NULL
  WHERE job_id = j.id AND key = p_stage_key AND status = 'pending';
  -- Zaten çalışıyorsa çağrı yinelenmiştir; başka durumdaysa hata.
  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.job_stages s
    WHERE s.job_id = j.id AND s.key = p_stage_key AND s.status = 'running'
  ) THEN
    RAISE EXCEPTION 'Aşama başlatılamaz.' USING ERRCODE = '55000', HINT = 'illegal_transition';
  END IF;

  UPDATE public.jobs
  SET lease_expires_at = now() + private.lease_interval(p_lease_seconds),
      progress = private.job_progress(j.id)
  WHERE id = j.id
  RETURNING * INTO j;
  RETURN j;
END;
$$;

-- İlerleme yazar ve kirayı uzatır. Dönen satırdaki cancel_requested_at doluysa makine durur.
CREATE FUNCTION internal.report_progress(
  p_worker_id uuid, p_job_id uuid, p_progress integer, p_detail text, p_lease_seconds integer
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jobs := private.job_for_worker(p_worker_id, p_job_id);
BEGIN
  UPDATE public.job_stages
  SET progress = CASE WHEN p_progress IS NULL THEN progress
                      ELSE LEAST(GREATEST(p_progress, 0), 100) END,
      detail = COALESCE(left(p_detail, 500), detail)
  WHERE job_id = j.id AND key = j.current_stage AND status = 'running';

  UPDATE public.jobs
  SET lease_expires_at = now() + private.lease_interval(p_lease_seconds),
      progress = private.job_progress(j.id)
  WHERE id = j.id
  RETURNING * INTO j;
  UPDATE public.production_workers SET last_seen_at = now() WHERE id = p_worker_id;
  RETURN j;
END;
$$;

-- Aşamayı bitirir. İptal istenmişse iş iptal olur; aşama onay gerektiriyorsa iş onay bekler;
-- değilse sonraki aşamaya geçer ya da tamamlanır.
CREATE FUNCTION internal.complete_stage(
  p_worker_id uuid, p_job_id uuid, p_stage_key text, p_output jsonb
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jobs := private.job_for_worker(p_worker_id, p_job_id);
  s public.job_stages;
BEGIN
  IF j.current_stage IS DISTINCT FROM p_stage_key THEN
    RAISE EXCEPTION 'Sıradaki aşama bu değil.' USING ERRCODE = '55000', HINT = 'stage_out_of_order';
  END IF;
  UPDATE public.job_stages
  SET status = 'succeeded', output = COALESCE(p_output, '{}'::jsonb), error = NULL
  WHERE job_id = j.id AND key = p_stage_key AND status = 'running'
  RETURNING * INTO s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aşama çalışmıyor.' USING ERRCODE = '55000', HINT = 'illegal_transition';
  END IF;

  IF j.cancel_requested_at IS NOT NULL THEN
    PERFORM private.skip_open_stages(j.id);
    UPDATE public.jobs SET status = 'cancelled' WHERE id = j.id RETURNING * INTO j;
    RETURN j;
  END IF;
  IF s.requires_approval THEN
    UPDATE public.jobs
    SET status = 'awaiting_approval', progress = private.job_progress(j.id)
    WHERE id = j.id
    RETURNING * INTO j;
    RETURN j;
  END IF;
  RETURN private.advance_job(j, true);
END;
$$;

-- Aşama hatası. Geçici hata (p_retryable) deneme hakkı varsa işi beklemeyle kuyruğa döndürür;
-- kalıcı hata ya da biten deneme hakkı işi failed yapar ve hatanın aşamasını yazar.
CREATE FUNCTION internal.fail_stage(
  p_worker_id uuid, p_job_id uuid, p_stage_key text, p_error text, p_retryable boolean
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jobs := private.job_for_worker(p_worker_id, p_job_id);
  v_error text := left(COALESCE(NULLIF(btrim(p_error), ''), 'Bilinmeyen hata.'), 2000);
  v_retry boolean;
BEGIN
  IF j.current_stage IS DISTINCT FROM p_stage_key THEN
    RAISE EXCEPTION 'Sıradaki aşama bu değil.' USING ERRCODE = '55000', HINT = 'stage_out_of_order';
  END IF;
  v_retry := COALESCE(p_retryable, false)
    AND j.cancel_requested_at IS NULL
    AND j.attempts + 1 < j.max_attempts;

  UPDATE public.job_stages
  SET status = CASE WHEN v_retry THEN 'pending' ELSE 'failed' END,
      attempts = attempts + 1, error = v_error
  WHERE job_id = j.id AND key = p_stage_key AND status = 'running';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aşama çalışmıyor.' USING ERRCODE = '55000', HINT = 'illegal_transition';
  END IF;

  IF v_retry THEN
    UPDATE public.jobs
    SET status = 'queued', attempts = attempts + 1, error = v_error,
        run_after = now() + make_interval(secs => 30 * (j.attempts + 1))
    WHERE id = j.id
    RETURNING * INTO j;
    RETURN j;
  END IF;

  PERFORM private.skip_open_stages(j.id);
  UPDATE public.jobs
  SET status = CASE WHEN j.cancel_requested_at IS NULL THEN 'failed' ELSE 'cancelled' END,
      attempts = attempts + 1, failed_stage = p_stage_key, error = v_error
  WHERE id = j.id
  RETURNING * INTO j;
  RETURN j;
END;
$$;

-- Makine iptal isteğini gördü ve durdu.
CREATE FUNCTION internal.acknowledge_cancel(p_worker_id uuid, p_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jobs := private.job_for_worker(p_worker_id, p_job_id);
BEGIN
  IF j.cancel_requested_at IS NULL THEN
    RAISE EXCEPTION 'Bu iş için iptal istenmedi.' USING ERRCODE = '55000';
  END IF;
  PERFORM private.skip_open_stages(j.id);
  UPDATE public.jobs SET status = 'cancelled' WHERE id = j.id RETURNING * INTO j;
  RETURN j;
END;
$$;

-- ── 12) public sarmalayıcılar (SECURITY INVOKER) ────────────────────────────
CREATE FUNCTION public.enqueue_job(
  p_module text,
  p_kind text,
  p_stages jsonb,
  p_params jsonb DEFAULT '{}'::jsonb,
  p_required_capabilities text[] DEFAULT '{}',
  p_stop_at text DEFAULT NULL,
  p_clip_source_id uuid DEFAULT NULL,
  p_max_attempts integer DEFAULT 3
)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.enqueue_job(
    p_module, p_kind, p_stages, p_params, p_required_capabilities, p_stop_at, p_clip_source_id,
    p_max_attempts
  );
END;
$$;

CREATE FUNCTION public.retry_job(p_job_id uuid)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.retry_job(p_job_id);
END;
$$;

CREATE FUNCTION public.request_cancel_job(p_job_id uuid)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.request_cancel_job(p_job_id);
END;
$$;

CREATE FUNCTION public.approve_job_stage(p_job_id uuid, p_stage_key text)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.approve_job_stage(p_job_id, p_stage_key);
END;
$$;

CREATE FUNCTION public.attach_job_asset(
  p_job_id uuid, p_asset_id uuid, p_role text, p_stage_key text DEFAULT NULL
)
RETURNS public.job_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.attach_job_asset(p_job_id, p_asset_id, p_role, p_stage_key);
END;
$$;

CREATE FUNCTION public.register_worker(
  p_name text, p_platform text, p_version text DEFAULT '', p_capabilities text[] DEFAULT '{}'
)
RETURNS public.production_workers LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.register_worker(p_name, p_platform, p_version, p_capabilities);
END;
$$;

CREATE FUNCTION public.worker_heartbeat(p_worker_id uuid, p_capabilities text[] DEFAULT NULL)
RETURNS public.production_workers LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.worker_heartbeat(p_worker_id, p_capabilities);
END;
$$;

CREATE FUNCTION public.revoke_worker(p_worker_id uuid)
RETURNS public.production_workers LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.revoke_worker(p_worker_id);
END;
$$;

CREATE FUNCTION public.claim_job(p_worker_id uuid, p_lease_seconds integer DEFAULT 120)
RETURNS SETOF public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN QUERY SELECT * FROM internal.claim_job(p_worker_id, p_lease_seconds);
END;
$$;

CREATE FUNCTION public.start_stage(
  p_worker_id uuid, p_job_id uuid, p_stage_key text, p_lease_seconds integer DEFAULT 120
)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.start_stage(p_worker_id, p_job_id, p_stage_key, p_lease_seconds);
END;
$$;

CREATE FUNCTION public.report_progress(
  p_worker_id uuid,
  p_job_id uuid,
  p_progress integer DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_lease_seconds integer DEFAULT 120
)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.report_progress(p_worker_id, p_job_id, p_progress, p_detail, p_lease_seconds);
END;
$$;

CREATE FUNCTION public.complete_stage(
  p_worker_id uuid, p_job_id uuid, p_stage_key text, p_output jsonb DEFAULT '{}'::jsonb
)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.complete_stage(p_worker_id, p_job_id, p_stage_key, p_output);
END;
$$;

CREATE FUNCTION public.fail_stage(
  p_worker_id uuid, p_job_id uuid, p_stage_key text, p_error text, p_retryable boolean DEFAULT false
)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.fail_stage(p_worker_id, p_job_id, p_stage_key, p_error, p_retryable);
END;
$$;

CREATE FUNCTION public.acknowledge_cancel(p_worker_id uuid, p_job_id uuid)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.acknowledge_cancel(p_worker_id, p_job_id);
END;
$$;

-- ── 13) EXECUTE izinleri: açıkça ────────────────────────────────────────────
-- public sarmalayıcılar ve internal çekirdekler yalnız authenticated; private yardımcılar hiçbir
-- API rolüne açık değil. Service role'ün kullanıcı kimliği yoktur, bu RPC'leri çağıramaz.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature, n.nspname AS schema_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (
      n.nspname IN ('public', 'internal') AND p.proname IN (
        'enqueue_job', 'retry_job', 'request_cancel_job', 'approve_job_stage', 'attach_job_asset',
        'register_worker', 'worker_heartbeat', 'revoke_worker', 'claim_job', 'start_stage',
        'report_progress', 'complete_stage', 'fail_stage', 'acknowledge_cancel'
      )
    ) OR (
      n.nspname = 'private' AND p.proname IN (
        'current_session_id', 'is_worker_session', 'require_worker', 'jobs_guard',
        'job_stages_guard', 'lease_interval', 'job_progress', 'skip_open_stages', 'create_job',
        'advance_job', 'job_for_worker', 'reclaim_expired_jobs'
      )
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.signature
    );
    IF f.schema_name <> 'private' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
    END IF;
  END LOOP;
END;
$$;

-- ── 14) Zamanlama: kirası dolan işleri geri al ──────────────────────────────
-- Makineler iş alırken kendi alanlarını zaten süpürür; cron hiç makine yokken de çalışır.
-- Ağ çağrısı ve sır yok.
SELECT cron.schedule(
  'reclaim-production-jobs',
  '* * * * *',
  $$SELECT private.reclaim_expired_jobs()$$
);
