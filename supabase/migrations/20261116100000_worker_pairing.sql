-- Üretim makinesi kimliği: eşleme kodlu giriş, makine oturumunun yetkisi, `productions`
-- bucket'ı (#211, docs/adr/0004-moduler-panel.md → Karar 1 ve 3).
--
-- #201'in bıraktığı iki TODO burada kapanır:
--   (a) `session_id` claim'i: Supabase Auth her erişim token'ına yazar (zorunlu claim; kaynak ve
--       CI kanıtı docs/AUTH.md → "Üretim makinesi oturumu"). Oturum işaretleme bu claim'e dayanır.
--   (b) Giriş: makine yerelde bir cihaz sırrı üretir ve yalnız özetini taşıyan bir eşleme metni
--       gösterir; oturumu açık bir owner/editor panelde onaylar; panel sunucusu o üye için AYRI
--       bir oturum açar ve onu makineye teslim edilmeden ÖNCE `private.worker_sessions`'a yazar.
--       Makinenin eline geçen oturum hiçbir an insan oturumu değildir.
--
-- Kararlar:
-- * Makine oturumu en az yetkiyle çalışır: `current_team_role()` makine oturumunda `viewer`
--   döner (yetkisi kaldırılmışsa NULL). Böylece `can_write_data()` isteyen her RPC ve her tablo
--   policy'si (iş açma, yeniden deneme, iptal, onay, yayın, içerik, ekip, ayarlar) makine
--   oturumunu kendiliğinden reddeder; RPC'leri tek tek işaretlemeye gerek kalmaz. Makine
--   RPC'leri (`claim_job`, `report_progress` …) üyenin GERÇEK rolüne bakar.
-- * Makine oturumu `team_members`'ı okuyamaz: panel sunucusu (rolü bu tablodan okur) makine
--   oturumuyla gelen isteği üye saymaz, service role yollarına ulaşılamaz.
-- * Yetki kaldırma (`revoke_worker`) oturumu da bitirir: `worker_sessions.revoked_at` yazılır,
--   Auth oturumu silinir; süresi dolmamış erişim token'ı bile artık hiçbir satır göremez.
-- * Makinenin dosya yazabildiği tek yer `productions/<alan>/<iş>/…` ve yalnız kirası kendisinde
--   olan iş içindir. `assets` satırını makine değil `attach_job_output()` çekirdeği yazar.
-- * Oturumsuz hiçbir çağrı paylaşılan durum yazmaz: eşleme satırını yalnız oturumlu onay açar,
--   sınırlar üye ve alan başınadır. Oturumsuz tek çağrı (yoklama) sır eşleşene kadar salt okurdur.
-- * Cihaz sırrı sunucuda saklanmaz (yalnız SHA-256 özeti). Yenileme token'ı makinenin açık
--   anahtarına mühürlü durur; veritabanını okuyan biri onu kullanamaz.

-- ── 1) Makine oturumunun durumu ─────────────────────────────────────────────
ALTER TABLE private.worker_sessions ADD COLUMN revoked_at timestamptz;
COMMENT ON COLUMN private.worker_sessions.revoked_at IS
  'Oturumun makine yetkisi kaldırıldı (revoke_worker, yeniden eşleme ya da teslim alınmayan eşleme).';

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

-- Auth oturumlarını bitirir (yenileme token'ları da silinir). Yetki yoksa uyarıyla geçer:
-- asıl engel worker_sessions.revoked_at'tir, bu ek bir kattır.
CREATE FUNCTION private.end_auth_sessions(p_session_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM auth.sessions WHERE id = ANY (p_session_ids);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'auth.sessions silinemedi; oturum yalnız worker_sessions üzerinden engellendi.';
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

-- Eşlemeyle açılmış oturum zaten bir makineye bağlıdır: kayıt yalnız o satırın platform, sürüm
-- ve yeteneklerini günceller (ad eşlemede onaylanan addır; oturum başka makineye geçemez).
-- Bağlı olmayan bir owner/editor oturumu kendini makine olarak kaydedebilir (#201 davranışı);
-- bu yalnız yetki düşürür: oturum o andan sonra salt okur ve onay veremez.
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
      RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı; yeniden eşleyin.'
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
      RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı; yeniden eşleyin.'
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
        capabilities = EXCLUDED.capabilities, last_seen_at = now()
  RETURNING * INTO w;
  IF w.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bu makinenin yetkisi kaldırıldı; yeniden eşleyin.'
      USING ERRCODE = '42501', HINT = 'worker_revoked';
  END IF;

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

-- ── 4) Eşleme ───────────────────────────────────────────────────────────────
-- Oturumsuz hiçbir çağrı satır oluşturmaz, silmez ya da değiştirmez. Akış:
--   1. Makine yerelde 256 bitlik bir cihaz sırrı ve X25519 anahtar çifti üretir; kullanıcıya
--      sırrın yalnız özetini (doğrulayıcı) ve açık anahtarı taşıyan bir eşleme metni gösterir.
--   2. Oturumu açık owner/editor metni panelde onaylar: eşleme satırını YALNIZ bu oturumlu çağrı
--      açar (`begin_worker_pairing`); sınırlar üye ve çalışma alanı başınadır, taklit edilemez.
--   3. Panel sunucusu (service role) o üye için açtığı yeni oturumu makineye bağlar ve yenileme
--      token'ını makinenin açık anahtarına mühürlenmiş olarak bırakır.
--   4. Makine sırrını sunarak yoklar. Yoklama, sır onaylanmış ve süresi dolmamış bir satırla
--      eşleşene kadar salt okurdur; eşleşince mühür bir kez teslim edilir ve satır silinir.
-- Sır 256 bit olduğu için tahmin edilemez; yoklamanın paylaşılan bir sayaca ihtiyacı yoktur.
CREATE TABLE private.worker_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cihaz sırrının SHA-256 özeti. Sırrın kendisi sunucuya yalnız teslim anında gelir, saklanmaz.
  verifier text NOT NULL UNIQUE CHECK (verifier ~ '^[0-9a-f]{64}$'),
  -- Makinenin X25519 açık anahtarı (base64url).
  public_key text NOT NULL CHECK (public_key ~ '^[A-Za-z0-9_-]{43}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80 AND length(name) <= 80),
  platform text NOT NULL CHECK (platform IN ('darwin', 'win32', 'linux')),
  -- Onaylayan üye ve alanı (satırı yalnız oturumlu çağrı açar).
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  session_id uuid,
  worker_id uuid REFERENCES public.production_workers (id) ON DELETE CASCADE,
  -- Yenileme token'ı, makinenin açık anahtarına mühürlü (X25519 + HKDF + AES-256-GCM).
  token_ciphertext text CHECK (
    length(token_ciphertext) BETWEEN 80 AND 1100 AND token_ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE INDEX worker_pairings_expiry_idx ON private.worker_pairings (expires_at);
CREATE INDEX worker_pairings_user_idx ON private.worker_pairings (user_id);
CREATE INDEX worker_pairings_workspace_idx ON private.worker_pairings (workspace_id);
ALTER TABLE private.worker_pairings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.worker_pairings FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.pairing_hash(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT encode(sha256(convert_to(p_value, 'UTF8')), 'hex')
$$;

-- İki SHA-256 özetini (64 hex) erken çıkmadan karşılaştırır.
CREATE FUNCTION private.pairing_hash_equal(p_a text, p_b text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_a bytea;
  v_b bytea;
  v_diff integer := 0;
BEGIN
  IF p_a IS NULL OR p_b IS NULL OR p_a !~ '^[0-9a-f]{64}$' OR p_b !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  v_a := decode(p_a, 'hex');
  v_b := decode(p_b, 'hex');
  FOR i IN 0 .. 31 LOOP
    v_diff := v_diff | (get_byte(v_a, i) # get_byte(v_b, i));
  END LOOP;
  RETURN v_diff = 0;
END;
$$;

-- Eşlemeleri siler. Onaylanmış ama teslim alınmamışsa oturumu da kapatır (yenileme token'ı
-- kimsenin elinde değildir; oturum açık kalmasın).
CREATE FUNCTION private.discard_worker_pairings(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sessions uuid[];
  v_count integer;
BEGIN
  WITH gone AS (
    DELETE FROM private.worker_pairings WHERE id = ANY (p_ids)
    RETURNING session_id
  )
  SELECT count(*)::integer, array_agg(session_id) FILTER (WHERE session_id IS NOT NULL)
  INTO v_count, v_sessions FROM gone;
  IF v_sessions IS NOT NULL THEN
    UPDATE private.worker_sessions SET revoked_at = COALESCE(revoked_at, now())
    WHERE session_id = ANY (v_sessions);
    PERFORM private.end_auth_sessions(v_sessions);
  END IF;
  RETURN v_count;
END;
$$;

-- Süresi dolan eşlemeler silinir (oturumlu her başlatmada ve cron ile).
CREATE FUNCTION private.cleanup_worker_pairings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.discard_worker_pairings(ARRAY(
    SELECT p.id FROM private.worker_pairings p WHERE p.expires_at <= clock_timestamp()
  ));
END;
$$;

-- 4a) Panel: oturumu açık owner/editor eşleme metnini onaylar. Eşleme satırını açan tek çağrı
-- budur. Sınırlar kimliğe bağlıdır: üye başına 3, çalışma alanı başına 10 bekleyen eşleme.
-- Sonuç: {status: pending, pairing_id} | too_many_pending | already_used | stale.
CREATE FUNCTION internal.begin_worker_pairing(
  p_verifier text, p_public_key text, p_name text, p_platform text, p_started_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ws uuid := public.current_workspace_id();
  v_name text := btrim(COALESCE(p_name, ''));
  r private.worker_pairings;
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Makine eşlemek için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  IF private.current_session_id() IS NULL OR private.is_worker_session() THEN
    RAISE EXCEPTION 'Üretim makinesi oturumu makine eşleyemez.'
      USING ERRCODE = '42501', HINT = 'worker_session';
  END IF;
  IF p_verifier IS NULL OR p_verifier !~ '^[0-9a-f]{64}$'
    OR p_public_key IS NULL OR p_public_key !~ '^[A-Za-z0-9_-]{43}$'
    OR length(v_name) NOT BETWEEN 1 AND 80
    OR p_platform IS NULL OR p_platform NOT IN ('darwin', 'win32', 'linux')
    OR p_started_at IS NULL THEN
    RAISE EXCEPTION 'Eşleme metni geçersiz.' USING ERRCODE = '22023';
  END IF;
  -- Eşleme metni makinede üretildikten sonra 10 dakika onaylanabilir.
  IF p_started_at > clock_timestamp() + interval '2 minutes'
    OR p_started_at <= clock_timestamp() - interval '10 minutes' THEN
    RETURN jsonb_build_object('status', 'stale');
  END IF;

  -- Aynı üyenin ve aynı alanın eşzamanlı istekleri sırayla işlensin (sınırlar tutsun).
  PERFORM 1 FROM public.workspaces WHERE id = v_ws FOR UPDATE;
  PERFORM private.cleanup_worker_pairings();
  IF EXISTS (SELECT 1 FROM private.worker_pairings p WHERE p.verifier = p_verifier) THEN
    RETURN jsonb_build_object('status', 'already_used');
  END IF;
  IF (SELECT count(*) FROM private.worker_pairings p WHERE p.user_id = v_uid) >= 3
    OR (SELECT count(*) FROM private.worker_pairings p WHERE p.workspace_id = v_ws) >= 10 THEN
    RETURN jsonb_build_object('status', 'too_many_pending');
  END IF;

  INSERT INTO private.worker_pairings (verifier, public_key, name, platform, user_id, workspace_id)
  VALUES (p_verifier, p_public_key, v_name, p_platform, v_uid, v_ws)
  RETURNING * INTO r;
  RETURN jsonb_build_object('status', 'pending', 'pairing_id', r.id, 'expires_at', r.expires_at);
END;
$$;

CREATE FUNCTION public.begin_worker_pairing(
  p_verifier text, p_public_key text, p_name text, p_platform text, p_started_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.begin_worker_pairing(p_verifier, p_public_key, p_name, p_platform, p_started_at);
END;
$$;

-- 4b) Panel sunucusu (service role) onayı tamamlar: o üye için açtığı YENİ oturumu makineye
-- bağlar ve mühürlü yenileme token'ını teslim için bırakır. Oturum bu çağrıyla makine oturumu
-- olur; token makineye bundan sonra ulaşır.
CREATE FUNCTION private.complete_worker_pairing(
  p_pairing_id uuid, p_user_id uuid, p_session_id uuid, p_token_ciphertext text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r private.worker_pairings;
  v_ws uuid;
  w public.production_workers;
BEGIN
  IF p_token_ciphertext IS NULL OR length(p_token_ciphertext) NOT BETWEEN 80 AND 1100
    OR p_token_ciphertext !~ '^[A-Za-z0-9+/]+={0,2}$' THEN
    RAISE EXCEPTION 'Mühürlü token geçersiz.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO r FROM private.worker_pairings WHERE id = p_pairing_id FOR UPDATE;
  IF NOT FOUND OR r.expires_at <= clock_timestamp() OR r.session_id IS NOT NULL
    OR r.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Eşleme bulunamadı ya da süresi doldu.' USING ERRCODE = 'P0002';
  END IF;
  SELECT m.workspace_id INTO v_ws FROM public.team_members m
  WHERE m.user_id = p_user_id AND m.role IN ('owner', 'editor');
  IF v_ws IS NULL OR v_ws IS DISTINCT FROM r.workspace_id THEN
    RAISE EXCEPTION 'Makine eşlemek için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM private.worker_sessions s WHERE s.session_id = p_session_id) THEN
    RAISE EXCEPTION 'Oturum bu kullanıcıya ait yeni bir oturum olmalı.' USING ERRCODE = '22023';
  END IF;
  IF (
    SELECT count(*) FROM public.production_workers p
    WHERE p.workspace_id = v_ws AND p.user_id = p_user_id AND p.name <> r.name
  ) >= 20 THEN
    RAISE EXCEPTION 'Kullanıcı başına en çok 20 makine kaydedilebilir.' USING ERRCODE = '54000';
  END IF;

  -- Aynı adla yeniden eşleme: satır korunur, eski oturumları kapanır, yetki yeniden verilir.
  INSERT INTO public.production_workers (workspace_id, user_id, name, platform)
  VALUES (v_ws, p_user_id, r.name, r.platform)
  ON CONFLICT (workspace_id, user_id, name) DO UPDATE
    SET platform = EXCLUDED.platform, revoked_at = NULL
  RETURNING * INTO w;
  PERFORM private.end_worker_sessions(w.id);
  INSERT INTO private.worker_sessions (session_id, user_id, worker_id)
  VALUES (p_session_id, p_user_id, w.id);

  UPDATE private.worker_pairings
  SET session_id = p_session_id, worker_id = w.id, token_ciphertext = p_token_ciphertext
  WHERE id = r.id;
  RETURN jsonb_build_object('worker_id', w.id, 'name', w.name, 'platform', w.platform);
END;
$$;

CREATE FUNCTION public.complete_worker_pairing(
  p_pairing_id uuid, p_user_id uuid, p_session_id uuid, p_token_ciphertext text
)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.complete_worker_pairing(p_pairing_id, p_user_id, p_session_id, p_token_ciphertext);
$$;

-- 4c) Makine cihaz sırrıyla yoklar (oturumsuz). Sır onaylanmış, süresi dolmamış ve teslim
-- edilmemiş bir eşlemeyle eşleşmedikçe hiçbir şey yazmaz ve yalnız "pending" der (yanlış,
-- süresi dolmuş ve kullanılmış sır ayırt edilemez). Eşleşince mühür bir kez döner ve satır
-- silinir. SECURITY DEFINER ve public'te: anon rolünün internal şemasına erişimi yoktur.
CREATE FUNCTION public.claim_worker_pairing(p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash text;
  r private.worker_pairings;
BEGIN
  IF p_secret IS NULL OR p_secret !~ '^[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object('status', 'pending');
  END IF;
  v_hash := private.pairing_hash(p_secret);
  SELECT * INTO r FROM private.worker_pairings p
  WHERE p.verifier = v_hash
    AND p.token_ciphertext IS NOT NULL
    AND p.expires_at > clock_timestamp();
  IF NOT FOUND OR NOT private.pairing_hash_equal(r.verifier, v_hash) THEN
    RETURN jsonb_build_object('status', 'pending');
  END IF;
  -- Tek kullanım: eşzamanlı iki yoklamadan yalnız biri satırı silebilir.
  DELETE FROM private.worker_pairings d WHERE d.id = r.id RETURNING * INTO r;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'pending');
  END IF;
  RETURN jsonb_build_object(
    'status', 'confirmed', 'token', r.token_ciphertext, 'worker_id', r.worker_id
  );
END;
$$;

-- ── 5) EXECUTE izinleri: açıkça ─────────────────────────────────────────────
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature, n.nspname AS schema_name, p.proname AS name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (
      n.nspname IN ('public', 'internal') AND p.proname IN (
        'is_worker_session', 'can_write_production_object', 'attach_job_output',
        'begin_worker_pairing', 'complete_worker_pairing', 'claim_worker_pairing'
      )
    ) OR (
      n.nspname = 'private' AND p.proname IN (
        'worker_session_state', 'end_auth_sessions', 'end_worker_sessions', 'pairing_hash',
        'pairing_hash_equal', 'discard_worker_pairings', 'cleanup_worker_pairings',
        'complete_worker_pairing'
      )
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.signature
    );
    IF f.name = 'complete_worker_pairing' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
    ELSIF f.name = 'claim_worker_pairing' THEN
      -- Makine henüz oturum açmamıştır; oturumu olan bir istemci de çağırabilir.
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f.signature);
    ELSIF f.schema_name <> 'private' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
    END IF;
  END LOOP;
END;
$$;

-- ── 6) Zamanlama: süresi dolan eşlemeleri temizle ───────────────────────────
SELECT cron.schedule(
  'worker-pairing-cleanup',
  '*/5 * * * *',
  $$SELECT private.cleanup_worker_pairings()$$
);
