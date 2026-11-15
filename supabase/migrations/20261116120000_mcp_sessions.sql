-- MCP oturumu türü, yapılandırılmış senaryoyu temizleme ve işi kuyruğa geri bırakma
-- (#241, docs/mcp-panel.md → "MCP oturumu insan oturumu değildir"; docs/AUTH.md).
--
-- #243 makine olarak kaydedilen oturumu salt okur yaptı; panel MCP sunucusu da aynı işareti
-- kullandığı için taslak yazamaz hâle geldi. Bu migration otomasyon oturumlarını türüne göre
-- ayırır:
-- * `private.worker_sessions.kind`: `worker` (üretim makinesi, #243'teki davranış AYNEN sürer)
--   ya da `mcp` (panel MCP sunucusu; makine satırı yoktur).
-- * Her iki tür de tablolarda ve genel RPC'lerde `viewer` sayılır (`current_team_role()` ve
--   `private.worker_session_state()` türe bakmaz): içerik, yayın, klip, ekip, ayarlar, anahtarlar,
--   `enqueue_job`, `retry_job`, dosya yazımı kapalıdır; `team_members` okunamaz (panel sunucusu
--   bu oturumu üye saymaz).
-- * MCP oturumu yalnız TASLAK çekirdeklerinde üyenin gerçek rolüyle (owner/editor) çalışır:
--   seri, konu isteği / önerisi, bölüm, senaryo kaydı, ön hazırlık işi (`explainer.topics`,
--   `explainer.script`) ve yalnız ön hazırlık işinin iptali. Senaryosu onaylanmış ya da üretimi
--   süren bölümü ve onun serisini güncelleyemez (üretim ayarları onayı silmeden render'ı değiştirir).
-- * Hiçbir otomasyon oturumu onay veremez (mevcut `private.is_worker_session()` denetimleri her
--   türü kapsar), üretim işi açamaz (yeni `jobs_automation_gate` trigger'ı), arşivleyemez,
--   bölüm taşıyamaz. MCP oturumu makine olamaz, makine RPC'lerini çağıramaz; makine oturumu MCP
--   oturumu olamaz.
--
-- Ayrıca:
-- * `save_episode_script(..., p_clear_script)`: PostgREST JSON null'ı SQL NULL olarak yollar
--   ("dokunma"); yapılandırılmış senaryo artık açık bir bayrakla temizlenir.
-- * `release_job()`: kapanan makine elindeki işi deneme hakkı harcamadan kuyruğa bırakır.

-- ── 1) Oturum türü ──────────────────────────────────────────────────────────
ALTER TABLE private.worker_sessions
  ADD COLUMN kind text NOT NULL DEFAULT 'worker',
  ADD COLUMN client_name text,
  ADD CONSTRAINT worker_sessions_kind_known CHECK (kind IN ('worker', 'mcp')),
  ADD CONSTRAINT worker_sessions_mcp_without_worker CHECK (kind = 'worker' OR worker_id IS NULL),
  ADD CONSTRAINT worker_sessions_client_name_length
    CHECK (client_name IS NULL OR char_length(client_name) BETWEEN 1 AND 80);
COMMENT ON COLUMN private.worker_sessions.kind IS
  'Otomasyon oturumunun türü: worker (üretim makinesi) ya da mcp (panel MCP sunucusu).';
COMMENT ON COLUMN private.worker_sessions.client_name IS
  'MCP oturumunu açan istemcinin görünen adı (yalnız bilgi).';
CREATE INDEX worker_sessions_user_kind_idx ON private.worker_sessions (user_id, kind);

-- Tür ve sahip değişmez; MCP oturumu makineye bağlanamaz. `register_worker()` MCP oturumundan
-- çağrılırsa oturumu makineye bağlamaya çalışır ve burada reddedilir (işlem geri alınır).
CREATE FUNCTION private.worker_sessions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'Otomasyon oturumunun türü ve sahibi sonradan değiştirilemez.'
      USING ERRCODE = '42501', HINT = 'session_kind_immutable';
  END IF;
  IF NEW.kind = 'mcp' AND NEW.worker_id IS NOT NULL THEN
    RAISE EXCEPTION 'MCP oturumu üretim makinesi olarak kaydedilemez.'
      USING ERRCODE = '42501', HINT = 'mcp_session';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER worker_sessions_guard BEFORE UPDATE ON private.worker_sessions
  FOR EACH ROW EXECUTE FUNCTION private.worker_sessions_guard();

-- 'human' | 'worker' | 'mcp' | 'revoked'. Kayıtsız oturum (ve oturum kimliği olmayan çağrı)
-- 'human' döner; onay çekirdekleri oturum kimliğini ayrıca ister.
CREATE FUNCTION private.session_kind()
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
        ELSE s.kind
      END
      FROM private.worker_sessions s
      LEFT JOIN public.production_workers w ON w.id = s.worker_id
      WHERE s.session_id = private.current_session_id()
    ),
    'human'
  )
$$;

-- Taslak yazma yetkisi: insan oturumunda owner/editor (bugünkü kural); MCP oturumunda üyenin
-- GERÇEK rolü owner/editor ise. Makine oturumu ve yetkisi kaldırılmış oturum yazamaz.
CREATE FUNCTION internal.can_draft()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE private.session_kind()
    WHEN 'human' THEN public.can_write_data()
    WHEN 'mcp' THEN EXISTS (
      SELECT 1 FROM public.team_members m
      WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'editor')
    )
    ELSE false
  END
$$;

CREATE FUNCTION public.can_draft()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT internal.can_draft()
$$;
COMMENT ON FUNCTION public.can_draft() IS
  'Çağıran oturum anlatım taslağı yazabilir mi? (insan owner/editor ya da owner/editor üyenin MCP oturumu)';

-- İnsana ayrılmış çekirdeklerin ortak denetimi (arşiv, taşıma, MCP oturumu yönetimi).
CREATE FUNCTION private.require_human_session()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF private.is_worker_session() THEN
    RAISE EXCEPTION 'Bu işlem otomasyon oturumuna kapalı; panelden bir insan yapar.'
      USING ERRCODE = '42501', HINT = 'automation_session';
  END IF;
END;
$$;

-- ── 2) MCP oturumu kaydı ────────────────────────────────────────────────────
-- Owner/editor üyenin oturumu kendini MCP oturumu olarak işaretler. İşaret kalıcıdır ve yalnız
-- yetki DÜŞÜRÜR. Yinelenen çağrı etkisizdir. Viewer v1'de desteklenmez.
CREATE FUNCTION internal.register_mcp_session(p_client_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session uuid := private.current_session_id();
  v_name text := NULLIF(left(btrim(COALESCE(p_client_name, '')), 80), '');
  s private.worker_sessions;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.team_members m WHERE m.user_id = v_uid AND m.role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'MCP oturumu için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'MCP oturumu için oturum kimliği gerekir.'
      USING ERRCODE = '42501', HINT = 'session_required';
  END IF;

  SELECT * INTO s FROM private.worker_sessions x WHERE x.session_id = v_session;
  IF FOUND THEN
    IF s.user_id IS DISTINCT FROM v_uid OR s.kind <> 'mcp' THEN
      RAISE EXCEPTION 'Bu oturum üretim makinesi olarak kayıtlı; MCP için yeniden giriş yapın.'
        USING ERRCODE = '42501', HINT = 'worker_session';
    END IF;
    IF s.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Bu MCP oturumunun yetkisi kaldırıldı; yeniden giriş yapın.'
        USING ERRCODE = '42501', HINT = 'session_revoked';
    END IF;
    RETURN true;
  END IF;

  -- Yalnız yaşayan oturumlar sayılır (çıkış yapılmış oturumun Auth kaydı silinmiştir).
  IF (
    SELECT count(*) FROM private.worker_sessions x
    WHERE x.user_id = v_uid AND x.kind = 'mcp' AND x.revoked_at IS NULL
      AND EXISTS (SELECT 1 FROM auth.sessions a WHERE a.id = x.session_id)
  ) >= 20 THEN
    RAISE EXCEPTION 'Kullanıcı başına en çok 20 etkin MCP oturumu olabilir.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO private.worker_sessions (session_id, user_id, kind, client_name)
  VALUES (v_session, v_uid, 'mcp', v_name)
  ON CONFLICT (session_id) DO NOTHING;
  RETURN true;
END;
$$;

CREATE FUNCTION public.register_mcp_session(p_client_name text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.register_mcp_session(p_client_name);
END;
$$;
COMMENT ON FUNCTION public.register_mcp_session(text) IS
  'Çağıran oturumu panel MCP oturumu olarak işaretler (kalıcı; onay ve üretim kapanır).';

-- MCP oturumları: owner alanındaki hepsini, diğer üyeler kendisininkini görür. Yalnız insan
-- oturumundan.
CREATE FUNCTION internal.list_mcp_sessions()
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  client_name text,
  created_at timestamptz,
  revoked_at timestamptz,
  active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
BEGIN
  PERFORM private.require_human_session();
  IF NOT public.is_team_member() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'MCP oturumlarını görme izniniz yok.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.session_id, s.user_id, s.client_name, s.created_at, s.revoked_at,
    s.revoked_at IS NULL AND EXISTS (SELECT 1 FROM auth.sessions a WHERE a.id = s.session_id)
  FROM private.worker_sessions s
  JOIN public.team_members m ON m.user_id = s.user_id
  WHERE s.kind = 'mcp' AND m.workspace_id = v_ws
    AND (public.can_manage_team() OR s.user_id = auth.uid())
  ORDER BY s.created_at DESC
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.list_mcp_sessions()
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  client_name text,
  created_at timestamptz,
  revoked_at timestamptz,
  active boolean
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM internal.list_mcp_sessions()
$$;

-- MCP oturumunun yetkisini kaldırır ve Auth oturumunu bitirir: owner alanındaki her oturumu,
-- diğer üyeler yalnız kendisininkini. Yalnız insan oturumundan.
CREATE FUNCTION internal.revoke_mcp_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  v_found uuid;
BEGIN
  PERFORM private.require_human_session();
  IF NOT public.is_team_member() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'MCP oturumunu kaldırma izniniz yok.' USING ERRCODE = '42501';
  END IF;
  SELECT s.session_id INTO v_found
  FROM private.worker_sessions s
  JOIN public.team_members m ON m.user_id = s.user_id
  WHERE s.session_id = p_session_id AND s.kind = 'mcp' AND m.workspace_id = v_ws
    AND (public.can_manage_team() OR s.user_id = auth.uid())
  FOR UPDATE OF s;
  IF v_found IS NULL THEN
    RAISE EXCEPTION 'MCP oturumu bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE private.worker_sessions SET revoked_at = COALESCE(revoked_at, now())
  WHERE session_id = v_found;
  PERFORM private.end_auth_sessions(ARRAY[v_found]);
  RETURN true;
END;
$$;

CREATE FUNCTION public.revoke_mcp_session(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.revoke_mcp_session(p_session_id);
END;
$$;

-- ── 3) Taslak çekirdekleri MCP oturumuna açılır ─────────────────────────────
-- Anlatım çekirdeklerinin ortak denetimi artık can_draft()'tır. Makine oturumu ve viewer
-- eskisi gibi reddedilir.
CREATE OR REPLACE FUNCTION private.require_explainer_writer()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
BEGIN
  IF NOT internal.can_draft() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'Bu işlem için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  RETURN v_ws;
END;
$$;

-- Onaylanmış iş otomasyon oturumuna kilitlidir. Bölümün ve serinin üretim ayarları (görsel yol,
-- stil, ses, altyazı, parametreler) senaryo onayını SİLMEDEN render'ı değiştirir; bu yüzden
-- otomasyon oturumu senaryosu onaylı ya da üretim işi açık bölümü, ve böyle bir bölümü olan
-- seriyi güncelleyemez. İnsan oturumu etkilenmez. (Senaryo kaydı serbesttir: onayı siler.)
CREATE FUNCTION private.require_unlocked_for_automation(p_episode_id uuid, p_series_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_worker_session() THEN
    RETURN;
  END IF;
  -- Kilit: onay ile güncelleme aynı anda yarışamaz.
  PERFORM 1 FROM public.episodes e
  WHERE e.id = p_episode_id AND e.workspace_id = public.current_workspace_id()
  FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.episodes e
    WHERE (e.id = p_episode_id OR e.series_id = p_series_id)
      AND e.workspace_id = public.current_workspace_id()
      AND (e.script_approved_at IS NOT NULL OR private.episode_has_open_job(e.id))
  ) THEN
    RAISE EXCEPTION 'Senaryosu onaylanmış ya da üretimi süren bölümü (ve serisini) otomasyon oturumu değiştiremez; panelden bir insan yapar.'
      USING ERRCODE = '42501', HINT = 'approved_locked';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION internal.update_series(p_series_id uuid, p_patch jsonb)
RETURNS public.series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  r public.series;
BEGIN
  PERFORM private.require_unlocked_for_automation(NULL, p_series_id);
  PERFORM private.assert_patch(p_patch, ARRAY[
    'name', 'theme', 'kind', 'visual_route', 'style_key', 'voice_provider', 'voice_name',
    'voice_rate', 'caption_style', 'language', 'default_params'
  ]);
  UPDATE public.series s
  SET
    name = CASE WHEN p_patch ? 'name' THEN btrim(p_patch ->> 'name') ELSE s.name END,
    theme = CASE WHEN p_patch ? 'theme' THEN COALESCE(p_patch ->> 'theme', '') ELSE s.theme END,
    kind = CASE WHEN p_patch ? 'kind' THEN p_patch ->> 'kind' ELSE s.kind END,
    visual_route = CASE WHEN p_patch ? 'visual_route' THEN p_patch ->> 'visual_route' ELSE s.visual_route END,
    style_key = CASE WHEN p_patch ? 'style_key' THEN p_patch ->> 'style_key' ELSE s.style_key END,
    voice_provider = CASE WHEN p_patch ? 'voice_provider' THEN p_patch ->> 'voice_provider' ELSE s.voice_provider END,
    voice_name = CASE WHEN p_patch ? 'voice_name' THEN p_patch ->> 'voice_name' ELSE s.voice_name END,
    voice_rate = CASE WHEN p_patch ? 'voice_rate' THEN p_patch ->> 'voice_rate' ELSE s.voice_rate END,
    caption_style = CASE WHEN p_patch ? 'caption_style'
      THEN COALESCE(NULLIF(p_patch -> 'caption_style', 'null'::jsonb), '{}'::jsonb) ELSE s.caption_style END,
    language = CASE WHEN p_patch ? 'language' THEN COALESCE(p_patch ->> 'language', 'tr') ELSE s.language END,
    default_params = CASE WHEN p_patch ? 'default_params'
      THEN COALESCE(NULLIF(p_patch -> 'default_params', 'null'::jsonb), '{}'::jsonb) ELSE s.default_params END
  WHERE s.id = p_series_id AND s.workspace_id = v_ws
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seri bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION internal.update_episode(p_episode_id uuid, p_patch jsonb)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  r public.episodes;
BEGIN
  PERFORM private.require_unlocked_for_automation(p_episode_id, NULL);
  PERFORM private.assert_patch(p_patch, ARRAY[
    'title', 'summary', 'hook', 'visual_idea', 'kind', 'language', 'visual_route', 'style_key',
    'voice_provider', 'voice_name', 'voice_rate', 'caption_style', 'params'
  ]);
  UPDATE public.episodes e
  SET
    title = CASE WHEN p_patch ? 'title' THEN btrim(p_patch ->> 'title') ELSE e.title END,
    summary = CASE WHEN p_patch ? 'summary' THEN COALESCE(p_patch ->> 'summary', '') ELSE e.summary END,
    hook = CASE WHEN p_patch ? 'hook' THEN COALESCE(p_patch ->> 'hook', '') ELSE e.hook END,
    visual_idea = CASE WHEN p_patch ? 'visual_idea' THEN COALESCE(p_patch ->> 'visual_idea', '') ELSE e.visual_idea END,
    kind = CASE WHEN p_patch ? 'kind' THEN p_patch ->> 'kind' ELSE e.kind END,
    language = CASE WHEN p_patch ? 'language' THEN p_patch ->> 'language' ELSE e.language END,
    visual_route = CASE WHEN p_patch ? 'visual_route' THEN p_patch ->> 'visual_route' ELSE e.visual_route END,
    style_key = CASE WHEN p_patch ? 'style_key' THEN p_patch ->> 'style_key' ELSE e.style_key END,
    voice_provider = CASE WHEN p_patch ? 'voice_provider' THEN p_patch ->> 'voice_provider' ELSE e.voice_provider END,
    voice_name = CASE WHEN p_patch ? 'voice_name' THEN p_patch ->> 'voice_name' ELSE e.voice_name END,
    voice_rate = CASE WHEN p_patch ? 'voice_rate' THEN p_patch ->> 'voice_rate' ELSE e.voice_rate END,
    caption_style = CASE WHEN p_patch ? 'caption_style'
      THEN NULLIF(p_patch -> 'caption_style', 'null'::jsonb) ELSE e.caption_style END,
    params = CASE WHEN p_patch ? 'params'
      THEN COALESCE(NULLIF(p_patch -> 'params', 'null'::jsonb), '{}'::jsonb) ELSE e.params END
  WHERE e.id = p_episode_id AND e.workspace_id = v_ws
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  RETURN r;
END;
$$;

-- İptal isteği taslak işidir, ama otomasyon oturumu yalnız anlatım ön hazırlık işini iptal
-- edebilir; bir insanın başlattığı üretim (render) işini ve başka modülün işini edemez.
CREATE OR REPLACE FUNCTION internal.request_cancel_job(p_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  j public.jobs;
BEGIN
  IF NOT internal.can_draft() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'İptal için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO j FROM public.jobs WHERE id = p_job_id AND workspace_id = v_ws FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İş bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF private.is_worker_session() AND NOT COALESCE(
    j.module = 'explainer' AND j.kind = ANY (private.explainer_pre_approval_kinds()), false
  ) THEN
    RAISE EXCEPTION 'Otomasyon oturumu yalnız ön hazırlık işini iptal edebilir; üretim işini panelden bir insan iptal eder.'
      USING ERRCODE = '42501', HINT = 'automation_session';
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

-- ── 4) İnsana ayrılanlar ────────────────────────────────────────────────────
-- Otomasyon oturumu (makine ya da MCP) yalnız anlatım ön hazırlık işi açabilir; üretim (render)
-- işini ve başka modülün işini bir insan açar. Kural hangi çekirdekten gelinirse gelinsin
-- geçerlidir (enqueue_job, enqueue_episode_job, retry_job).
CREATE FUNCTION private.jobs_automation_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.is_worker_session() AND NOT COALESCE(
    NEW.module = 'explainer' AND NEW.kind = ANY (private.explainer_pre_approval_kinds()), false
  ) THEN
    RAISE EXCEPTION 'Otomasyon oturumu üretim işi açamaz; üretimi panelden bir insan başlatır.'
      USING ERRCODE = '42501', HINT = 'automation_session';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER jobs_automation_gate BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.jobs_automation_gate();

-- Arşivleme ve taşıma taslak işi değildir: gövdeler aynı, başa insan oturumu denetimi eklendi.
CREATE OR REPLACE FUNCTION internal.archive_series(p_series_id uuid, p_archived boolean)
RETURNS public.series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  r public.series;
BEGIN
  PERFORM private.require_human_session();
  UPDATE public.series s
  SET status = CASE WHEN COALESCE(p_archived, true) THEN 'archived' ELSE 'active' END
  WHERE s.id = p_series_id AND s.workspace_id = v_ws
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seri bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION internal.move_episode(p_episode_id uuid, p_series_id uuid)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  e public.episodes;
  sr public.series;
BEGIN
  PERFORM private.require_human_session();
  SELECT * INTO e FROM public.episodes x
  WHERE x.id = p_episode_id AND x.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF e.series_id IS NOT DISTINCT FROM p_series_id THEN
    RETURN e;
  END IF;
  IF e.status NOT IN ('draft', 'script_ready', 'script_approved') THEN
    RAISE EXCEPTION 'Üretimi başlamış bölüm taşınamaz.' USING ERRCODE = '55000', HINT = 'episode_locked';
  END IF;

  IF p_series_id IS NULL THEN
    UPDATE public.episodes SET series_id = NULL, episode_number = NULL WHERE id = e.id RETURNING * INTO e;
  ELSE
    sr := private.next_episode_number(p_series_id, v_ws);
    UPDATE public.episodes
    SET series_id = sr.id, episode_number = sr.next_episode_number - 1
    WHERE id = e.id
    RETURNING * INTO e;
  END IF;
  RETURN e;
END;
$$;

CREATE OR REPLACE FUNCTION internal.archive_episode(p_episode_id uuid, p_archived boolean)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  e public.episodes;
BEGIN
  PERFORM private.require_human_session();
  SELECT * INTO e FROM public.episodes x
  WHERE x.id = p_episode_id AND x.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(p_archived, true) AND private.episode_has_open_job(e.id) THEN
    RAISE EXCEPTION 'Üretim sürerken bölüm arşivlenemez; önce işi iptal edin.'
      USING ERRCODE = '55000', HINT = 'episode_in_production';
  END IF;
  UPDATE public.episodes
  SET archived_at = CASE WHEN COALESCE(p_archived, true) THEN COALESCE(archived_at, now()) END
  WHERE id = e.id
  RETURNING * INTO e;
  RETURN e;
END;
$$;

-- ── 5) Senaryo kaydı: yapılandırılmış senaryoyu açıkça temizleme ────────────
-- İmza değiştiği için eski fonksiyonlar kaldırılır (aynı adla iki imza PostgREST'te belirsizdir).
DROP FUNCTION public.save_episode_script(uuid, text, jsonb, jsonb, text[], text, integer);
DROP FUNCTION internal.save_episode_script(uuid, text, jsonb, jsonb, text[], text, integer);

-- NULL parametre "dokunma" demektir. Yapılandırılmış senaryo `p_clear_script = true` ile
-- temizlenir (JSON null da temizler, ama PostgREST onu SQL NULL olarak yollar). İçerik değiştiyse
-- trigger yeni sürüm açar ve onayı siler.
CREATE FUNCTION internal.save_episode_script(
  p_episode_id uuid,
  p_script_text text,
  p_fact_notes jsonb,
  p_script jsonb,
  p_sensitivity_flags text[],
  p_sensitivity_note text,
  p_expected_version integer,
  p_clear_script boolean
)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  v_clear boolean := COALESCE(p_clear_script, false);
  e public.episodes;
BEGIN
  IF v_clear AND p_script IS NOT NULL AND p_script <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Yapılandırılmış senaryo aynı çağrıda hem temizlenip hem yazılamaz.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO e FROM public.episodes x
  WHERE x.id = p_episode_id AND x.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> e.script_version THEN
    RAISE EXCEPTION 'Senaryo bu arada değişti (sürüm %).', e.script_version
      USING ERRCODE = '55000', HINT = 'version_conflict';
  END IF;
  UPDATE public.episodes
  SET
    script_text = COALESCE(p_script_text, script_text),
    fact_notes = COALESCE(p_fact_notes, fact_notes),
    script = CASE
      WHEN v_clear THEN NULL
      WHEN p_script IS NULL THEN script
      ELSE NULLIF(p_script, 'null'::jsonb)
    END,
    sensitivity_flags = COALESCE(p_sensitivity_flags, sensitivity_flags),
    sensitivity_note = CASE WHEN p_sensitivity_note IS NULL THEN sensitivity_note
                            ELSE NULLIF(btrim(p_sensitivity_note), '') END
  WHERE id = e.id
  RETURNING * INTO e;
  RETURN e;
END;
$$;

CREATE FUNCTION public.save_episode_script(
  p_episode_id uuid,
  p_script_text text,
  p_fact_notes jsonb DEFAULT NULL,
  p_script jsonb DEFAULT NULL,
  p_sensitivity_flags text[] DEFAULT NULL,
  p_sensitivity_note text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL,
  p_clear_script boolean DEFAULT false
)
RETURNS public.episodes LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.save_episode_script(
    p_episode_id, p_script_text, p_fact_notes, p_script, p_sensitivity_flags, p_sensitivity_note,
    p_expected_version, p_clear_script
  );
END;
$$;

-- ── 6) Makine işi kuyruğa geri bırakır ──────────────────────────────────────
-- Kapanan makine (Ctrl+C) elindeki işi bırakır: çalışan aşama bekliyor'a, iş sıraya döner ve
-- hemen alınabilir. Deneme hakkı HARCANMAZ (fail_stage ve kira dolması harcar). İptal istenmişse
-- iş iptal olur. Yalnız kirası çağıran makinede olan iş için.
CREATE FUNCTION internal.release_job(p_worker_id uuid, p_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jobs := private.job_for_worker(p_worker_id, p_job_id);
BEGIN
  IF j.cancel_requested_at IS NOT NULL THEN
    PERFORM private.skip_open_stages(j.id);
    UPDATE public.jobs SET status = 'cancelled' WHERE id = j.id RETURNING * INTO j;
    RETURN j;
  END IF;
  UPDATE public.job_stages SET status = 'pending' WHERE job_id = j.id AND status = 'running';
  UPDATE public.jobs SET status = 'queued', run_after = now() WHERE id = j.id RETURNING * INTO j;
  RETURN j;
END;
$$;

CREATE FUNCTION public.release_job(p_worker_id uuid, p_job_id uuid)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.release_job(p_worker_id, p_job_id);
END;
$$;
COMMENT ON FUNCTION public.release_job(uuid, uuid) IS
  'Makine elindeki işi deneme hakkı harcamadan kuyruğa bırakır (kapanış).';

-- ── 7) EXECUTE izinleri: açıkça ─────────────────────────────────────────────
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
        'can_draft', 'register_mcp_session', 'list_mcp_sessions', 'revoke_mcp_session',
        'save_episode_script', 'release_job'
      )
    ) OR (
      n.nspname = 'private' AND p.proname IN (
        'worker_sessions_guard', 'session_kind', 'require_human_session', 'jobs_automation_gate',
        'require_unlocked_for_automation'
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
