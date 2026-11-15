-- Üretim makinesi oturumu: en az yetki, oturumu bitiren yetki kaldırma, `productions` bucket'ı
-- (#211, docs/adr/0004-moduler-panel.md → Karar 1 ve 3).
--
-- Makine bir ekip üyesinin kendi Supabase Auth oturumudur (ADR Karar 3): `pnpm worker:login`
-- üye olarak giriş yapar ve `register_worker()` o oturumu makine olarak kaydeder (#201).
-- #201'in bıraktığı soru kapandı: `session_id` claim'i her erişim token'ında vardır (zorunlu
-- claim; kaynak ve CI kanıtı docs/AUTH.md → "Üretim makinesi oturumu").
--
-- Bu migration'ın getirdikleri:
-- * Makine olarak kaydedilen oturum en az yetkiyle çalışır: `current_team_role()` o oturumda
--   `viewer` döner (yetkisi kaldırılmışsa NULL). Böylece `can_write_data()` isteyen her RPC ve
--   tablo policy'si (iş açma, bölüm işi açma, yeniden deneme, iptal, onay, yayın, içerik, ekip,
--   ayarlar) makine oturumunu kendiliğinden reddeder. Makine RPC'leri (`claim_job`,
--   `report_progress` …) üyenin GERÇEK rolüne bakar.
-- * Makine oturumu `team_members`'ı okuyamaz: panel sunucusu (rolü bu tablodan okur) makine
--   oturumuyla gelen isteği üye saymaz.
-- * Yetki kaldırma (`revoke_worker`) oturumu da bitirir: `worker_sessions.revoked_at` yazılır ve
--   Auth oturumu silinir (yenileme token'ı ölür); süresi dolmamış erişim token'ı da artık hiçbir
--   satır göremez. Bir adım başarısızsa işlem bütünüyle geri alınır.
-- * Makinenin dosya yazabildiği tek yer `productions/<alan>/<iş>/…` ve yalnız kirası kendisinde
--   olan iş içindir. `assets` satırını makine değil `attach_job_output()` çekirdeği yazar.
--
-- v1'in sınırı (bilinçli): makine üyenin kendi oturumunu taşır; kaydedilmeden önce o oturum
-- sıradan bir üye oturumudur. Makineye özel kimlik, kısa ömürlü token ve eşleme akışı
-- sertleştirme işine bırakıldı (docs/AUTH.md → "Ertelenen sertleştirme").

-- ── 1) Makine oturumunun durumu ─────────────────────────────────────────────
ALTER TABLE private.worker_sessions ADD COLUMN revoked_at timestamptz;
COMMENT ON COLUMN private.worker_sessions.revoked_at IS
  'Oturumun makine yetkisi kaldırıldı (revoke_worker).';

-- 'none': insan oturumu · 'active': makine oturumu · 'revoked': yetkisi kaldırılmış makine oturumu.
CREATE FUNCTION private.worker_session_state()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN s.revoked_at IS NOT NULL OR w.revoked_at IS NOT NULL THEN 'revoked'
        ELSE 'active'
      END
      FROM private.worker_sessions s
      LEFT JOIN public.production_workers w ON w.id = s.worker_id
      WHERE s.session_id = private.current_session_id()
    ),
    'none'
  )
$$;

-- Policy'lerde ve panelde kullanılır (private şeması API rollerine kapalı).
CREATE FUNCTION public.is_worker_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.worker_session_state() <> 'none'
$$;
COMMENT ON FUNCTION public.is_worker_session() IS
  'Çağıran oturum üretim makinesi olarak kayıtlı mı? (yetkisi kaldırılmış olsa da true)';

-- Makine oturumu salt okur; yetkisi kaldırılmış makine oturumu üye sayılmaz.
CREATE OR REPLACE FUNCTION public.current_team_role()
RETURNS public.team_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT CASE private.worker_session_state()
    WHEN 'none' THEN member.role
    WHEN 'active' THEN 'viewer'::public.team_role
  END
  FROM public.team_members AS member
  WHERE member.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN (
      SELECT member.workspace_id
      FROM public.team_members AS member
      WHERE member.user_id = auth.uid()
        AND private.worker_session_state() <> 'revoked'
    )
    WHEN COALESCE(auth.role(), 'service_role') IN ('anon', 'authenticated') THEN NULL
    ELSE (
      SELECT (array_agg(w.id))[1]
      FROM public.workspaces AS w
      HAVING count(*) = 1
    )
  END
$$;

CREATE POLICY team_members_no_worker_session ON public.team_members
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_worker_session())
  WITH CHECK (NOT public.is_worker_session());

-- Auth oturumlarını bitirir (yenileme token'ları da silinir). Hata yutulmaz: silinemezse çağıran
-- işlem (yetki kaldırma) bütünüyle geri alınır.
CREATE FUNCTION private.end_auth_sessions(p_session_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM auth.sessions WHERE id = ANY (p_session_ids);
END;
$$;

-- Bir makinenin bütün oturumlarını kapatır.
CREATE FUNCTION private.end_worker_sessions(p_worker_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  WITH ended AS (
    UPDATE private.worker_sessions SET revoked_at = COALESCE(revoked_at, now())
    WHERE worker_id = p_worker_id
    RETURNING session_id
  )
  SELECT array_agg(session_id) INTO v_ids FROM ended;
  IF v_ids IS NOT NULL THEN
    PERFORM private.end_auth_sessions(v_ids);
  END IF;
END;
$$;

-- ── 2) Makine RPC'lerinin denetimi: üyenin gerçek rolü ──────────────────────
-- current_team_role() makine oturumunda 'viewer' döndüğü için can_write_data() kullanılamaz.
CREATE OR REPLACE FUNCTION private.require_worker(p_worker_id uuid)
RETURNS public.production_workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w public.production_workers;
  v_uid uuid := auth.uid();
  v_session uuid := private.current_session_id();
  v_ws uuid;
BEGIN
  SELECT m.workspace_id INTO v_ws FROM public.team_members m
  WHERE m.user_id = v_uid AND m.role IN ('owner', 'editor');
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Üretim makinesi için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO w FROM public.production_workers
  WHERE id = p_worker_id AND workspace_id = v_ws AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üretim makinesi bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF w.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı.' USING ERRCODE = '42501', HINT = 'worker_revoked';
  END IF;
  IF v_session IS NULL OR NOT EXISTS (
    SELECT 1 FROM private.worker_sessions s
    WHERE s.session_id = v_session AND s.worker_id = w.id AND s.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Bu oturum makineye kayıtlı değil.' USING ERRCODE = '42501', HINT = 'worker_session_required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.worker_sessions s WHERE s.session_id = v_session AND s.revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı.' USING ERRCODE = '42501', HINT = 'worker_revoked';
  END IF;
  RETURN w;
END;
$$;

-- Owner/editor oturumu kendini makine olarak kaydeder (#201). Kayıt yalnız yetki düşürür: oturum
-- o andan sonra salt okur ve onay veremez.
-- * Zaten bir makineye bağlı oturum yalnız o satırın platform, sürüm ve yeteneklerini günceller
--   (ad ilk kayıttaki addır; oturum başka makineye geçemez, ikinci makine açamaz).
-- * Yeni bir giriş (henüz makine olmayan oturum) aynı adı yeniden kaydederse satır korunur,
--   makinenin önceki oturumları biter ve kaldırılmış yetki yeniden verilir: bunu yapabilmek
--   üyenin kendi girişini gerektirir, yetkisi kaldırılmış oturum yapamaz.
CREATE OR REPLACE FUNCTION internal.register_worker(
  p_name text, p_platform text, p_version text, p_capabilities text[]
)
RETURNS public.production_workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session uuid := private.current_session_id();
  v_name text := btrim(COALESCE(p_name, ''));
  v_ws uuid;
  s private.worker_sessions;
  w public.production_workers;
BEGIN
  SELECT m.workspace_id INTO v_ws FROM public.team_members m
  WHERE m.user_id = v_uid AND m.role IN ('owner', 'editor');
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Makine kaydı için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Makine kaydı için oturum kimliği gerekir.'
      USING ERRCODE = '42501', HINT = 'session_required';
  END IF;

  SELECT * INTO s FROM private.worker_sessions WHERE session_id = v_session;
  IF FOUND THEN
    IF s.user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Bu oturum makineye kayıtlı değil.' USING ERRCODE = '42501';
    END IF;
    IF s.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı; yeniden giriş yapın (pnpm worker:login).'
        USING ERRCODE = '42501', HINT = 'worker_revoked';
    END IF;
  END IF;

  IF s.worker_id IS NOT NULL THEN
    SELECT * INTO w FROM public.production_workers
    WHERE id = s.worker_id AND workspace_id = v_ws AND user_id = v_uid
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Üretim makinesi bulunamadı.' USING ERRCODE = 'P0002';
    END IF;
    IF w.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı; yeniden giriş yapın (pnpm worker:login).'
        USING ERRCODE = '42501', HINT = 'worker_revoked';
    END IF;
    UPDATE public.production_workers
    SET platform = p_platform, version = COALESCE(p_version, ''),
        capabilities = COALESCE(p_capabilities, '{}'), last_seen_at = now()
    WHERE id = w.id
    RETURNING * INTO w;
    RETURN w;
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
        capabilities = EXCLUDED.capabilities, last_seen_at = now(), revoked_at = NULL
  RETURNING * INTO w;
  -- Aynı makine için yeni giriş: önceki oturumlar kapanır.
  PERFORM private.end_worker_sessions(w.id);

  INSERT INTO private.worker_sessions AS ws (session_id, user_id, worker_id)
  VALUES (v_session, v_uid, w.id)
  ON CONFLICT (session_id) DO UPDATE SET worker_id = EXCLUDED.worker_id
    WHERE ws.user_id = EXCLUDED.user_id;
  RETURN w;
END;
$$;

-- Yetki kaldırma artık makinenin oturumlarını da bitirir.
CREATE OR REPLACE FUNCTION internal.revoke_worker(p_worker_id uuid)
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
  PERFORM private.end_worker_sessions(w.id);
  UPDATE public.jobs SET lease_expires_at = now() WHERE worker_id = w.id AND status = 'running';
  RETURN w;
END;
$$;

-- ── 3) `productions` bucket'ı ve assets.bucket ──────────────────────────────
-- Yol: <workspace_id>/<job_id>/<dosya>. Ses, altyazı ve JSON da yüklenebilir (assets bucket'ı
-- yalnız görsel ve video kabul eder). Boyut sınırı aynı: 100 MB (ADR açık soru 3, #215).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'productions', 'productions', false, 104857600,
  ARRAY[
    'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'image/jpeg', 'image/png',
    'image/webp', 'application/json', 'text/plain', 'text/vtt', 'application/x-subrip'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.assets
  ADD COLUMN bucket text NOT NULL DEFAULT 'assets',
  ADD CONSTRAINT assets_bucket_known CHECK (bucket IN ('assets', 'productions')),
  ADD CONSTRAINT assets_productions_path CHECK (
    bucket <> 'productions'
    OR (
      influencer_id IS NULL
      AND thumbnail_path IS NULL
      AND storage_path ~ ('^' || workspace_id::text || '/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    )
  );
COMMENT ON COLUMN public.assets.bucket IS
  'Dosyanın Storage bucket''ı: assets (influencer klasörü) ya da productions (<alan>/<iş>/<dosya>).';

CREATE OR REPLACE FUNCTION public.storage_object_in_workspace(p_bucket_id text, p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE p_bucket_id
    WHEN 'assets' THEN EXISTS (
      SELECT 1 FROM public.influencers AS i
      WHERE i.id::text = (storage.foldername(p_object_name))[1]
        AND i.workspace_id = public.current_workspace_id()
    )
    WHEN 'contracts' THEN EXISTS (
      SELECT 1 FROM public.brand_deals AS d
      WHERE d.id::text = (storage.foldername(p_object_name))[1]
        AND d.workspace_id = public.current_workspace_id()
    )
    WHEN 'productions' THEN COALESCE(
      (storage.foldername(p_object_name))[1] = public.current_workspace_id()::text, false
    )
    ELSE false
  END
$$;

-- productions'a yazma: yol tam <alan>/<iş>/<dosya>; iş çağıranın alanında. İnsan oturumu
-- (owner/editor) alanın her işine, makine oturumu yalnız kirası kendisinde olan işe yazar.
CREATE FUNCTION public.can_write_production_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(array_length(storage.foldername(p_object_name), 1), 0) = 2
    AND storage.filename(p_object_name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(p_object_name))[2]
        AND j.workspace_id::text = (storage.foldername(p_object_name))[1]
        AND j.workspace_id = public.current_workspace_id()
        AND (
          public.can_write_data()
          OR (
            j.status = 'running' AND j.lease_expires_at > now()
            AND EXISTS (
              SELECT 1 FROM private.worker_sessions s
              JOIN public.production_workers w ON w.id = s.worker_id
              WHERE s.session_id = private.current_session_id()
                AND s.user_id = auth.uid()
                AND s.revoked_at IS NULL
                AND w.revoked_at IS NULL
                AND w.id = j.worker_id
            )
          )
        )
    )
$$;
COMMENT ON FUNCTION public.can_write_production_object(text) IS
  'productions bucket''ına yazma kuralı: <alan>/<iş>/<dosya>; makine oturumu yalnız kirası kendisinde olan işe yazar.';

CREATE POLICY productions_storage_team_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'productions' AND public.is_team_member());
CREATE POLICY productions_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'productions' AND public.can_write_production_object(name));
CREATE POLICY productions_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'productions' AND public.can_write_production_object(name))
  WITH CHECK (bucket_id = 'productions' AND public.can_write_production_object(name));
CREATE POLICY productions_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'productions' AND public.can_write_data());

-- Makine, yüklediği dosyayı işe bağlar. assets satırını çekirdek yazar: yol sunucuda kurulur,
-- boyut ve tür Storage kaydından okunur; makine başka bir dosyayı ya da başka bir işi gösteremez.
CREATE FUNCTION internal.attach_job_output(
  p_worker_id uuid, p_job_id uuid, p_file_name text, p_role text, p_stage_key text
)
RETURNS public.job_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jobs := private.job_for_worker(p_worker_id, p_job_id);
  v_path text;
  v_meta jsonb;
  v_mime text;
  v_asset uuid;
  r public.job_assets;
BEGIN
  IF p_file_name IS NULL OR p_file_name !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$' THEN
    RAISE EXCEPTION 'Dosya adı geçersiz.' USING ERRCODE = '22023';
  END IF;
  IF p_stage_key IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.job_stages s WHERE s.job_id = j.id AND s.key = p_stage_key
  ) THEN
    RAISE EXCEPTION 'Aşama bu işe ait değil.' USING ERRCODE = '22023';
  END IF;
  v_path := j.workspace_id::text || '/' || j.id::text || '/' || p_file_name;
  SELECT o.metadata INTO v_meta FROM storage.objects o
  WHERE o.bucket_id = 'productions' AND o.name = v_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dosya yüklenmemiş.' USING ERRCODE = 'P0002';
  END IF;
  v_mime := left(v_meta ->> 'mimetype', 100);

  INSERT INTO public.assets AS a (
    workspace_id, influencer_id, kind, bucket, storage_path, mime_type, file_size_bytes
  )
  VALUES (
    j.workspace_id, NULL,
    CASE WHEN p_role = 'final' AND v_mime LIKE 'video/%' THEN 'final_video' ELSE 'generated' END::public.asset_kind,
    'productions', v_path, v_mime,
    CASE WHEN (v_meta ->> 'size') ~ '^[0-9]{1,15}$' THEN (v_meta ->> 'size')::bigint END
  )
  ON CONFLICT (storage_path) DO UPDATE
    SET mime_type = EXCLUDED.mime_type, file_size_bytes = EXCLUDED.file_size_bytes
    WHERE a.bucket = 'productions' AND a.workspace_id = EXCLUDED.workspace_id
  RETURNING a.id INTO v_asset;
  IF v_asset IS NULL THEN
    RAISE EXCEPTION 'Dosya kaydı yazılamadı.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.job_assets (workspace_id, job_id, asset_id, role, stage_key)
  VALUES (j.workspace_id, j.id, v_asset, p_role, p_stage_key)
  ON CONFLICT (job_id, asset_id, role) DO UPDATE SET stage_key = EXCLUDED.stage_key
  RETURNING * INTO r;
  RETURN r;
END;
$$;

CREATE FUNCTION public.attach_job_output(
  p_worker_id uuid, p_job_id uuid, p_file_name text, p_role text, p_stage_key text DEFAULT NULL
)
RETURNS public.job_assets LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.attach_job_output(p_worker_id, p_job_id, p_file_name, p_role, p_stage_key);
END;
$$;

-- ── 4) EXECUTE izinleri: açıkça ─────────────────────────────────────────────
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
        'is_worker_session', 'can_write_production_object', 'attach_job_output'
      )
    ) OR (
      n.nspname = 'private' AND p.proname IN (
        'worker_session_state', 'end_auth_sessions', 'end_worker_sessions'
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
