-- Üretim makinesi oturumu (#211, migration 20261116100000_worker_sessions.sql).
--
-- Kapsam: izinler · makine olarak kaydedilen oturum salt okur (iş açamaz, bölüm işi açamaz,
-- iptal edemez, onaylayamaz, ekibi göremez, tabloya yazamaz) · productions bucket'ı ve
-- attach_job_output · yetki kaldırma oturumu bitirir (hata yutulmaz) · yeni girişle aynı
-- makinenin yeniden kaydı.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();

-- ── Fixture ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT u.id, 'authenticated', 'authenticated', u.email, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
FROM (VALUES
  ('f2110000-0000-4000-8000-000000000001'::uuid, 'ws-a-owner@example.invalid'),
  ('f2110000-0000-4000-8000-000000000002'::uuid, 'ws-a-editor@example.invalid'),
  ('f2110000-0000-4000-8000-000000000003'::uuid, 'ws-a-viewer@example.invalid'),
  ('f2110000-0000-4000-8000-000000000004'::uuid, 'ws-a-machine@example.invalid'),
  ('f2120000-0000-4000-8000-000000000001'::uuid, 'ws-b-owner@example.invalid')
) AS u (id, email);
INSERT INTO public.team_members (user_id, role) VALUES
  ('f2110000-0000-4000-8000-000000000001', 'owner'),
  ('f2110000-0000-4000-8000-000000000002', 'editor'),
  ('f2110000-0000-4000-8000-000000000003', 'viewer'),
  ('f2110000-0000-4000-8000-000000000004', 'editor');
-- Makinenin Auth oturumları (gerçekte `pnpm worker:login` açar).
INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES
  ('5e560000-0000-4000-8000-0000000000a1', 'f2110000-0000-4000-8000-000000000004', now(), now()),
  ('5e560000-0000-4000-8000-0000000000a2', 'f2110000-0000-4000-8000-000000000004', now(), now());

CREATE TEMP TABLE ws ON COMMIT DROP AS SELECT id AS a, NULL::uuid AS b FROM public.workspaces;
UPDATE ws SET b = private.create_workspace_for_user('f2120000-0000-4000-8000-000000000001', 'Makine alanı B');
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
GRANT SELECT ON ws TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON ids TO anon, authenticated, service_role;

-- ── Yapı ve izinler ─────────────────────────────────────────────────────────
SELECT extensions.is(
  ARRAY(
    SELECT p.oid::regprocedure::text FROM pg_proc p
    WHERE (
      p.pronamespace = 'private'::regnamespace
      AND p.proname IN ('worker_session_state', 'end_auth_sessions', 'end_worker_sessions')
      AND (
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
    ) OR (
      p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace, 'private'::regnamespace)
      AND p.proname IN (
        'worker_session_state', 'end_auth_sessions', 'end_worker_sessions', 'is_worker_session',
        'can_write_production_object', 'attach_job_output'
      )
      AND (NOT p.proconfig @> ARRAY['search_path=""'] OR has_function_privilege('anon', p.oid, 'EXECUTE'))
    )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'private helpers are closed to API roles; new functions pin an empty search_path; nothing is open to anon'
);
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE '%pairing%')
  AND NOT has_schema_privilege('anon', 'internal', 'USAGE')
  AND NOT has_schema_privilege('anon', 'private', 'USAGE')
  AND NOT has_function_privilege('anon', 'public.register_worker(text, text, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.claim_job(uuid, integer)', 'EXECUTE'),
  'there is no unauthenticated machine surface: no pairing functions, machine RPCs need a member session'
);
SELECT extensions.ok(
  pg_get_functiondef('private.end_auth_sessions(uuid[])'::regprocedure) NOT ILIKE '%EXCEPTION%',
  'ending Auth sessions does not swallow errors (revocation fails closed)'
);
SELECT extensions.results_eq(
  $$SELECT public, file_size_limit, 'application/json' = ANY (allowed_mime_types)
    FROM storage.buckets WHERE id = 'productions'$$,
  $$VALUES (false, 104857600::bigint, true)$$,
  'productions bucket is private, 100 MB, and accepts JSON'
);

-- Editor (insan) iki iş açar: jx makineye verilecek, jy sırada kalacak.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e2"}', true);
INSERT INTO ids SELECT 'jx', (public.enqueue_job(
  'clip', 'clip.selftest',
  '[{"key":"prepare"},{"key":"review","requires_approval":true},{"key":"finish"}]'::jsonb
)).id;
INSERT INTO ids SELECT 'jy', (public.enqueue_job(
  'clip', 'clip.selftest', '[{"key":"prepare"}]'::jsonb, '{}'::jsonb, ARRAY['render.blender']
)).id;

-- ── Kayıt: üye oturumu makine olur ──────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.results_eq(
  $$SELECT public.current_team_role()::text, public.is_worker_session(), public.can_write_data()$$,
  $$VALUES ('editor'::text, false, true)$$,
  'before registering, the session is an ordinary editor session'
);
INSERT INTO ids SELECT 'w', (public.register_worker('  Stüdyo Mac ', 'darwin', '0.1.0', ARRAY['voice.edge-tts'])).id;
RESET ROLE;

-- ── Makine oturumu: salt okur ───────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.results_eq(
  $$SELECT public.current_team_role()::text, public.is_worker_session(), public.can_write_data(),
      public.can_manage_team(), public.current_workspace_id() = (SELECT a FROM ws)$$,
  $$VALUES ('viewer'::text, true, false, false, true)$$,
  'an editor''s machine session acts as a viewer of the own workspace'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.team_members), 0,
  'a machine session cannot read team membership (the panel treats it as a non-member)'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.jobs), 2, 'a machine session reads the jobs of its workspace'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.selftest', '[{"key":"a"}]'::jsonb)$$,
  '42501', NULL, 'a machine session cannot enqueue jobs'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job(gen_random_uuid(), 'explainer.research')$$,
  '42501', NULL, 'a machine session cannot enqueue episode jobs'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Makine serisi')$$,
  '42501', NULL, 'a machine session cannot write explainer data'
);
SELECT extensions.throws_ok(
  $$SELECT public.retry_job((SELECT id FROM ids WHERE k = 'jx'))$$,
  '42501', NULL, 'a machine session cannot retry jobs'
);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'jx'))$$,
  '42501', NULL, 'a machine session cannot cancel jobs'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'jx'), 'review')$$,
  '42501', NULL, 'a machine session cannot approve'
);
SELECT extensions.throws_ok(
  $$SELECT public.revoke_worker((SELECT id FROM ids WHERE k = 'w'))$$,
  '42501', NULL, 'a machine session cannot revoke machines'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.assets (kind, storage_path) VALUES ('generated', 'makine/dogrudan.png')$$,
  '42501', NULL, 'a machine session cannot write tables directly'
);
SELECT extensions.results_eq(
  $$SELECT id, name, version, capabilities
    FROM public.register_worker('baska-ad', 'darwin', '0.2.0', ARRAY['voice.edge-tts'])$$,
  $$SELECT id, 'Stüdyo Mac'::text, '0.2.0'::text, ARRAY['voice.edge-tts'] FROM ids WHERE k = 'w'$$,
  'register_worker from a machine session updates its own machine and keeps the first name'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.production_workers), 1,
  'a machine session cannot create a second machine'
);
SELECT extensions.lives_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w'))$$,
  'the machine session sends heartbeats'
);
SELECT extensions.results_eq(
  $$SELECT id FROM public.claim_job((SELECT id FROM ids WHERE k = 'w'))$$,
  $$SELECT id FROM ids WHERE k = 'jx'$$,
  'the machine session claims the job it is capable of'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jx'), 'prepare')$$,
  'and runs its stage'
);

-- ── productions bucket'ı ────────────────────────────────────────────────────
SELECT extensions.ok(
  public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jx')::text || '/cikti.txt')
  AND NOT public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jy')::text || '/cikti.txt')
  AND NOT public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jx')::text || '/alt/cikti.txt')
  AND NOT public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jx')::text || '/.gizli')
  AND NOT public.can_write_production_object(
    (SELECT b FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jx')::text || '/cikti.txt')
  AND NOT public.can_write_production_object((SELECT id FROM ids WHERE k = 'jx')::text || '/cikti.txt'),
  'a machine may write only <workspace>/<leased job>/<plain file name>'
);
SELECT extensions.lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, metadata)
    SELECT 'productions', a::text || '/' || (SELECT id FROM ids WHERE k = 'jx')::text || '/cikti.txt',
      '{"size": 12, "mimetype": "text/plain"}'::jsonb FROM ws$$,
  'the machine uploads into the folder of its leased job'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name)
    SELECT 'productions', a::text || '/' || (SELECT id FROM ids WHERE k = 'jy')::text || '/cikti.txt' FROM ws$$,
  '42501', NULL, 'the machine cannot upload into a job it does not hold'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name)
    SELECT 'productions', b::text || '/' || (SELECT id FROM ids WHERE k = 'jx')::text || '/cikti.txt' FROM ws$$,
  '42501', NULL, 'the machine cannot upload into another workspace'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_output((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jx'), '../cikti.txt', 'other')$$,
  '22023', NULL, 'attach_job_output rejects path tricks in the file name'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_output((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jx'), 'yok.txt', 'other')$$,
  'P0002', NULL, 'attach_job_output needs the uploaded object'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_output((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jy'), 'cikti.txt', 'other')$$,
  '55000', NULL, 'attach_job_output needs the lease on that job'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_output((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jx'), 'cikti.txt', 'other', 'yok')$$,
  '22023', NULL, 'attach_job_output validates the stage key'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_output((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jx'), 'cikti.txt', 'poster')$$,
  '23514', NULL, 'attach_job_output validates the role'
);
INSERT INTO ids SELECT 'asset', (public.attach_job_output(
  (SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jx'), 'cikti.txt', 'other', 'prepare'
)).asset_id;
SELECT extensions.results_eq(
  $$SELECT a.bucket, a.storage_path, a.mime_type, a.file_size_bytes, a.kind::text, a.influencer_id IS NULL,
      a.workspace_id, a.created_by, r.role, r.stage_key, r.job_id
    FROM public.assets a JOIN public.job_assets r ON r.asset_id = a.id
    WHERE a.id = (SELECT id FROM ids WHERE k = 'asset')$$,
  $$SELECT 'productions'::text, a::text || '/' || (SELECT id FROM ids WHERE k = 'jx')::text || '/cikti.txt',
      'text/plain'::text, 12::bigint, 'generated'::text, true, a,
      'f2110000-0000-4000-8000-000000000004'::uuid, 'other'::text, 'prepare'::text,
      (SELECT id FROM ids WHERE k = 'jx') FROM ws$$,
  'attach_job_output records the asset from the storage object and links it to the job'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.attach_job_output((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jx'), 'cikti.txt', 'other', 'prepare'))
    + (SELECT count(*)::integer FROM public.assets WHERE bucket = 'productions'),
  2, 'attaching the same file again does not duplicate the asset'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_asset((SELECT id FROM ids WHERE k = 'jx'), (SELECT id FROM public.assets WHERE bucket = 'productions'), 'final')$$,
  '42501', NULL, 'the panel-side attach_job_asset is closed to machine sessions'
);

-- İnsan editor alanın her işine yazabilir; viewer ve başka alan yazamaz.
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.ok(
  public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jy')::text || '/girdi.json')
  AND NOT public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || gen_random_uuid()::text || '/girdi.json')
  AND public.storage_object_in_workspace('productions', (SELECT a FROM ws)::text || '/x/y.json')
  AND NOT public.storage_object_in_workspace('productions', (SELECT b FROM ws)::text || '/x/y.json'),
  'a human editor writes into any job folder of the own workspace only'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'productions'), 1,
  'team members read production files of their workspace'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.assets (kind, bucket, storage_path)
    SELECT 'generated', 'productions', b::text || '/' || gen_random_uuid()::text || '/x.json' FROM ws$$,
  '23514', NULL, 'a productions asset path must start with the own workspace'
);
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000003","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e3"}', true);
SELECT extensions.ok(
  NOT public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jy')::text || '/girdi.json'),
  'a viewer cannot write production files'
);
SELECT set_config('request.jwt.claim.sub', 'f2120000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2120000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000b1"}', true);
SELECT extensions.ok(
  NOT public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jy')::text || '/girdi.json')
  AND NOT public.storage_object_in_workspace('productions', (SELECT a FROM ws)::text || '/x/y.json')
  AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'productions') = 0,
  'another workspace can neither write nor read these production files'
);

-- Kendini makine olarak kaydeden insan oturumu da salt okur olur (#201 yolu).
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e9"}', true);
SELECT extensions.lives_ok(
  $$SELECT public.register_worker('kendi-makinem', 'linux')$$,
  'another editor registers an own machine from a fresh session'
);
SELECT extensions.results_eq(
  $$SELECT public.current_team_role()::text, public.can_write_data()$$,
  $$VALUES ('viewer'::text, false)$$,
  'and is read-only from then on'
);

-- ── Yetki kaldırma oturumu bitirir ──────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e1"}', true);
SELECT extensions.is(
  (public.revoke_worker((SELECT id FROM ids WHERE k = 'w'))).revoked_at, now(), 'the owner revokes the machine'
);
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.results_eq(
  $$SELECT public.current_team_role() IS NULL, public.current_workspace_id() IS NULL, public.is_team_member(),
      (SELECT count(*)::integer FROM public.jobs) + (SELECT count(*)::integer FROM public.production_workers)
        + (SELECT count(*)::integer FROM public.assets) + (SELECT count(*)::integer FROM public.workspaces)
        + (SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'productions')$$,
  $$VALUES (true, true, false, 0)$$,
  'a revoked machine session is no longer a member: it reads nothing'
);
SELECT extensions.throws_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w'))$$,
  '42501', NULL, 'a revoked machine session cannot call machine RPCs'
);
SELECT extensions.throws_ok(
  $$SELECT public.register_worker('Stüdyo Mac', 'darwin')$$,
  '42501', NULL, 'a revoked machine session cannot register again (it cannot restore its own access)'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name)
    SELECT 'productions', a::text || '/' || (SELECT id FROM ids WHERE k = 'jx')::text || '/sonra.txt' FROM ws$$,
  '42501', NULL, 'a revoked machine session cannot upload'
);
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT (SELECT count(*)::integer FROM auth.sessions WHERE id = '5e560000-0000-4000-8000-0000000000a1'),
      (SELECT revoked_at IS NOT NULL FROM private.worker_sessions WHERE session_id = '5e560000-0000-4000-8000-0000000000a1'),
      (SELECT lease_expires_at = now() FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'jx'))$$,
  $$VALUES (0, true, true)$$,
  'revoking deletes the Auth session, marks the machine session and ends its lease'
);

-- ── Yeni girişle aynı makinenin yeniden kaydı ───────────────────────────────
-- Üye yeniden giriş yapar (yeni oturum a2) ve aynı adı kaydeder: satır korunur, yetki geri gelir,
-- eski oturum ölü kalır.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a2"}', true);
SELECT extensions.is(
  (public.register_worker('Stüdyo Mac', 'darwin', '0.3.0')).id, (SELECT id FROM ids WHERE k = 'w'),
  'a fresh login registering the same machine name reuses the machine row'
);
SELECT extensions.results_eq(
  $$SELECT public.current_team_role()::text, public.is_worker_session()$$,
  $$VALUES ('viewer'::text, true)$$,
  'and the new session is a machine session from then on'
);
SELECT extensions.lives_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w'))$$,
  'the new session speaks for the machine'
);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.ok(
  public.current_team_role() IS NULL,
  'the old session stays revoked after the machine is registered again'
);
SELECT extensions.throws_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w'))$$,
  '42501', NULL, 'and cannot speak for the machine'
);
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT w.revoked_at IS NULL, w.version,
      (SELECT revoked_at IS NOT NULL FROM private.worker_sessions WHERE session_id = '5e560000-0000-4000-8000-0000000000a1'),
      (SELECT revoked_at IS NULL FROM private.worker_sessions WHERE session_id = '5e560000-0000-4000-8000-0000000000a2')
    FROM public.production_workers w WHERE w.id = (SELECT id FROM ids WHERE k = 'w')$$,
  $$VALUES (true, '0.3.0'::text, true, true)$$,
  'the machine is authorised again; only the new session is live'
);

-- Makine yeniden kaydedilince önceki oturumu biter (aynı makinede iki canlı oturum kalmaz).
INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES
  ('5e560000-0000-4000-8000-0000000000a3', 'f2110000-0000-4000-8000-000000000004', now(), now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a3"}', true);
SELECT extensions.lives_ok(
  $$SELECT public.register_worker('Stüdyo Mac', 'darwin', '0.3.1')$$,
  'a third login takes the machine over'
);
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT (SELECT count(*)::integer FROM auth.sessions WHERE id = '5e560000-0000-4000-8000-0000000000a2'),
      (SELECT revoked_at IS NOT NULL FROM private.worker_sessions WHERE session_id = '5e560000-0000-4000-8000-0000000000a2'),
      (SELECT count(*)::integer FROM auth.sessions WHERE id = '5e560000-0000-4000-8000-0000000000a3')$$,
  $$VALUES (0, true, 1)$$,
  'the previous session of that machine is ended; the new one lives'
);

SELECT * FROM extensions.finish();
ROLLBACK;
