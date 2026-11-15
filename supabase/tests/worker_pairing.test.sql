-- Üretim makinesi eşlemesi ve makine oturumunun yetkisi (#211, migration
-- 20261116100000_worker_pairing.sql).
--
-- Kapsam: izinler · oturumsuz çağrı hiçbir şey yazmaz (sel etkisizdir) · onay yalnız oturumlu
-- owner/editor (rol, bayat metin, üye ve alan başına sınır) · tamamlama (yalnız service role) ·
-- tek kullanımlık teslim (yanlış, süresi dolmuş ve kullanılmış sır) · makine oturumu salt okur ·
-- productions bucket'ı ve attach_job_output · yetki kaldırma oturumu bitirir · yeniden eşleme.
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
  ('f2110000-0000-4000-8000-000000000001'::uuid, 'pair-a-owner@example.invalid'),
  ('f2110000-0000-4000-8000-000000000002'::uuid, 'pair-a-editor@example.invalid'),
  ('f2110000-0000-4000-8000-000000000003'::uuid, 'pair-a-viewer@example.invalid'),
  ('f2110000-0000-4000-8000-000000000004'::uuid, 'pair-a-machine@example.invalid'),
  ('f2110000-0000-4000-8000-000000000005'::uuid, 'pair-a-spare@example.invalid'),
  ('f2110000-0000-4000-8000-000000000006'::uuid, 'pair-outsider@example.invalid'),
  ('f2120000-0000-4000-8000-000000000001'::uuid, 'pair-b-owner@example.invalid')
) AS u (id, email);
INSERT INTO public.team_members (user_id, role) VALUES
  ('f2110000-0000-4000-8000-000000000001', 'owner'),
  ('f2110000-0000-4000-8000-000000000002', 'editor'),
  ('f2110000-0000-4000-8000-000000000003', 'viewer'),
  ('f2110000-0000-4000-8000-000000000004', 'editor'),
  ('f2110000-0000-4000-8000-000000000005', 'editor');
-- Panel sunucusunun makine için açtığı oturumlar (gerçekte Auth açar).
INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES
  ('5e560000-0000-4000-8000-0000000000a1', 'f2110000-0000-4000-8000-000000000004', now(), now()),
  ('5e560000-0000-4000-8000-0000000000a2', 'f2110000-0000-4000-8000-000000000004', now(), now()),
  ('5e560000-0000-4000-8000-0000000000a3', 'f2110000-0000-4000-8000-000000000004', now(), now()),
  ('5e560000-0000-4000-8000-0000000000e2', 'f2110000-0000-4000-8000-000000000002', now(), now()),
  ('5e560000-0000-4000-8000-0000000000b9', 'f2120000-0000-4000-8000-000000000001', now(), now());

CREATE TEMP TABLE ws ON COMMIT DROP AS SELECT id AS a, NULL::uuid AS b FROM public.workspaces;
UPDATE ws SET b = private.create_workspace_for_user('f2120000-0000-4000-8000-000000000001', 'Eşleme alanı B');
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE vals (k text PRIMARY KEY, v jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE consts ON COMMIT DROP AS
SELECT repeat('A', 43) AS public_key, repeat('B', 120) AS ciphertext;
-- Cihaz sırrı n: 43 karakter (makinede üretilir, burada sabit). Doğrulayıcı: SHA-256 özeti.
CREATE FUNCTION pg_temp.secret(n integer) RETURNS text LANGUAGE sql IMMUTABLE AS
  $f$SELECT 'cihazsirri' || lpad(n::text, 33, '0')$f$;
CREATE FUNCTION pg_temp.verifier(n integer) RETURNS text LANGUAGE sql IMMUTABLE AS
  $f$SELECT encode(sha256(convert_to(pg_temp.secret(n), 'UTF8')), 'hex')$f$;
GRANT SELECT ON ws, consts TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON ids, vals TO anon, authenticated, service_role;

-- ── Yapı ve izinler ─────────────────────────────────────────────────────────
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'private.worker_pairings', 'SELECT')
  AND NOT has_table_privilege('service_role', 'private.worker_pairings', 'SELECT')
  AND NOT has_table_privilege('anon', 'private.worker_pairings', 'SELECT')
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.worker_pairings'::regclass),
  'the pairing table is closed to every API role and has RLS on'
);
SELECT extensions.is(
  ARRAY(
    SELECT p.proname::text FROM pg_proc p
    WHERE p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace, 'private'::regnamespace)
      AND (p.proname LIKE '%pairing%' OR p.proname IN ('is_worker_session', 'can_write_production_object', 'attach_job_output'))
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ORDER BY 1
  ),
  ARRAY['claim_worker_pairing'],
  'the only pairing function an unauthenticated caller may run is the poll'
);
SELECT extensions.ok(
  NOT has_schema_privilege('anon', 'internal', 'USAGE')
  AND NOT has_schema_privilege('anon', 'private', 'USAGE')
  AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('start_worker_pairing', 'worker_pairing_lookup')),
  'anon reaches neither internal nor private; there is no unauthenticated start'
);
SELECT extensions.ok(
  pg_get_functiondef('public.claim_worker_pairing(text)'::regprocedure) NOT ILIKE '%insert %'
  AND pg_get_functiondef('public.claim_worker_pairing(text)'::regprocedure) NOT ILIKE '%update %'
  AND pg_get_functiondef('public.claim_worker_pairing(text)'::regprocedure) NOT ILIKE '%request.headers%'
  AND pg_get_functiondef('internal.begin_worker_pairing(text, text, text, text, timestamptz)'::regprocedure) NOT ILIKE '%request.headers%',
  'the poll neither inserts nor updates, and no limit reads caller-controlled headers'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.begin_worker_pairing(text, text, text, text, timestamptz)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'internal.begin_worker_pairing(text, text, text, text, timestamptz)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.attach_job_output(uuid, uuid, text, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.complete_worker_pairing(uuid, uuid, uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.complete_worker_pairing(uuid, uuid, uuid, text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.complete_worker_pairing(uuid, uuid, uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.begin_worker_pairing(text, text, text, text, timestamptz)', 'EXECUTE'),
  'confirmation is for members, completion only for the service role'
);
SELECT extensions.is(
  ARRAY(
    SELECT p.oid::regprocedure::text FROM pg_proc p
    WHERE (
      p.pronamespace = 'private'::regnamespace AND p.proname IN (
        'worker_session_state', 'end_auth_sessions', 'end_worker_sessions', 'pairing_hash',
        'pairing_hash_equal', 'discard_worker_pairings', 'cleanup_worker_pairings'
      ) AND (
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
    ) OR (
      p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace, 'private'::regnamespace)
      AND p.proname IN (
        'worker_session_state', 'end_auth_sessions', 'end_worker_sessions', 'pairing_hash',
        'pairing_hash_equal', 'discard_worker_pairings', 'cleanup_worker_pairings',
        'complete_worker_pairing', 'is_worker_session', 'can_write_production_object',
        'attach_job_output', 'begin_worker_pairing', 'claim_worker_pairing'
      )
      AND NOT p.proconfig @> ARRAY['search_path=""']
    )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'private pairing helpers are closed to API roles; every new function pins an empty search_path'
);
SELECT extensions.ok(
  private.pairing_hash_equal(repeat('a', 64), repeat('a', 64))
  AND NOT private.pairing_hash_equal(repeat('a', 64), repeat('a', 63) || 'b')
  AND NOT private.pairing_hash_equal('b' || repeat('a', 63), repeat('a', 64))
  AND NOT private.pairing_hash_equal(repeat('a', 64), NULL)
  AND NOT private.pairing_hash_equal('kısa', 'kısa'),
  'digest comparison is exact and rejects malformed input'
);
SELECT extensions.results_eq(
  $$SELECT schedule, command NOT LIKE '%http%' FROM cron.job WHERE jobname = 'worker-pairing-cleanup'$$,
  $$VALUES ('*/5 * * * *'::text, true)$$,
  'expired pairings are cleaned up on a schedule without network calls'
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
RESET ROLE;

-- ── Oturumsuz çağrı: hiçbir şey yazamaz ─────────────────────────────────────
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), 'Mac', 'darwin', now())$$,
  '42501', NULL, 'anon cannot open a pairing'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_worker_pairing(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), repeat('B', 120))$$,
  '42501', NULL, 'anon cannot complete a pairing'
);
SELECT extensions.is(
  (SELECT array_agg(DISTINCT public.claim_worker_pairing(s) ->> 'status')
   FROM unnest(ARRAY[pg_temp.secret(1), 'kisa', '', NULL, repeat('x', 5000), pg_temp.secret(1) || E'\n']) AS s),
  ARRAY['pending'], 'polling for an unknown or malformed secret only says pending'
);
RESET ROLE;

-- ── Onay: yalnız oturumlu owner/editor ──────────────────────────────────────
SET LOCAL ROLE authenticated;
-- Viewer.
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000003","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e3"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), 'Mac', 'darwin', now())$$,
  '42501', NULL, 'a viewer cannot pair a machine'
);
-- Ekip dışı.
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000006', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000006","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e6"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), 'Mac', 'darwin', now())$$,
  '42501', NULL, 'a non-member cannot pair a machine'
);
-- Oturum kimliği olmayan editor.
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), 'Mac', 'darwin', now())$$,
  '42501', NULL, 'pairing needs a session id claim'
);
-- Makinenin sahibi (editor, insan oturumu).
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a0"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.begin_worker_pairing('kisa', (SELECT public_key FROM consts), 'Mac', 'darwin', now())$$,
  '22023', NULL, 'a malformed verifier is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.begin_worker_pairing(pg_temp.verifier(1), 'kisa-anahtar', 'Mac', 'darwin', now())$$,
  '22023', NULL, 'a malformed public key is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), 'Mac', 'amiga', now())$$,
  '22023', NULL, 'an unknown platform is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), '   ', 'darwin', now())$$,
  '22023', NULL, 'an empty machine name is rejected'
);
SELECT extensions.is(
  ARRAY[
    public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), 'Mac', 'darwin',
      clock_timestamp() - interval '11 minutes') ->> 'status',
    public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), 'Mac', 'darwin',
      clock_timestamp() + interval '5 minutes') ->> 'status'
  ],
  ARRAY['stale', 'stale'], 'a pairing text older than ten minutes (or from the future) is refused'
);
INSERT INTO vals SELECT 'p1', public.begin_worker_pairing(
  pg_temp.verifier(1), (SELECT public_key FROM consts), '  Stüdyo Mac ', 'darwin',
  clock_timestamp() - interval '9 minutes'
);
SELECT extensions.ok(
  (SELECT v ->> 'status' = 'pending' AND (v ->> 'pairing_id') IS NOT NULL
     AND (v ->> 'expires_at')::timestamptz = now() + interval '5 minutes'
   FROM vals WHERE k = 'p1'),
  'the member opens a pairing that lives five minutes'
);
-- Aynı metin ikinci kez onaylanamaz.
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.is(
  public.begin_worker_pairing(pg_temp.verifier(1), (SELECT public_key FROM consts), 'Mac', 'darwin', now()) ->> 'status',
  'already_used', 'a pairing text cannot be confirmed twice'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_worker_pairing(
      (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p1'),
      'f2110000-0000-4000-8000-000000000002', '5e560000-0000-4000-8000-0000000000e2',
      (SELECT ciphertext FROM consts))$$,
  '42501', NULL, 'a member cannot complete a pairing (service role only)'
);
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT p.user_id, p.workspace_id, p.name, p.verifier = pg_temp.verifier(1),
      to_jsonb(p)::text NOT LIKE '%cihazsirri%'
    FROM private.worker_pairings p WHERE p.id = (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p1')$$,
  $$SELECT 'f2110000-0000-4000-8000-000000000004'::uuid, a, 'Stüdyo Mac'::text, true, true FROM ws$$,
  'the pairing belongs to the confirming member; only the digest of the device secret is stored'
);
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT extensions.is(
  public.claim_worker_pairing(pg_temp.secret(1)) ->> 'status',
  'pending', 'the right secret gets nothing before the server completes the pairing'
);
RESET ROLE;

-- ── Tamamlama (panel sunucusu, service role) ────────────────────────────────
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.complete_worker_pairing(
      (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p1'),
      'f2110000-0000-4000-8000-000000000002', '5e560000-0000-4000-8000-0000000000e2',
      (SELECT ciphertext FROM consts))$$,
  'P0002', NULL, 'completion is refused for a member who did not confirm'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_worker_pairing(
      (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p1'),
      'f2110000-0000-4000-8000-000000000004', '5e560000-0000-4000-8000-0000000000e2',
      (SELECT ciphertext FROM consts))$$,
  '22023', NULL, 'the session must belong to the confirming member'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_worker_pairing(
      (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p1'),
      'f2110000-0000-4000-8000-000000000004', '5e560000-0000-4000-8000-0000000000a1', 'düz metin')$$,
  '22023', NULL, 'the token must be ciphertext-shaped'
);
INSERT INTO vals SELECT 'c1', public.complete_worker_pairing(
  (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p1'),
  'f2110000-0000-4000-8000-000000000004', '5e560000-0000-4000-8000-0000000000a1',
  (SELECT ciphertext FROM consts)
);
INSERT INTO ids SELECT 'w', (v ->> 'worker_id')::uuid FROM vals WHERE k = 'c1';
SELECT extensions.throws_ok(
  $$SELECT public.complete_worker_pairing(
      (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p1'),
      'f2110000-0000-4000-8000-000000000004', '5e560000-0000-4000-8000-0000000000a2',
      (SELECT ciphertext FROM consts))$$,
  'P0002', NULL, 'a pairing completes only once'
);
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT w.name, w.platform, w.user_id, w.workspace_id, w.revoked_at IS NULL, s.revoked_at IS NULL
    FROM public.production_workers w
    JOIN private.worker_sessions s ON s.worker_id = w.id
    WHERE w.id = (SELECT id FROM ids WHERE k = 'w')
      AND s.session_id = '5e560000-0000-4000-8000-0000000000a1'$$,
  $$SELECT 'Stüdyo Mac'::text, 'darwin'::text, 'f2110000-0000-4000-8000-000000000004'::uuid, a, true, true FROM ws$$,
  'completion creates the machine for the confirming member and binds the new session to it'
);

-- ── Teslim: tek kullanımlık ─────────────────────────────────────────────────
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT extensions.is(
  public.claim_worker_pairing(pg_temp.secret(999)) ->> 'status',
  'pending', 'a wrong secret cannot collect the token'
);
SELECT extensions.results_eq(
  $$SELECT r ->> 'status', r ->> 'token' = (SELECT ciphertext FROM consts),
      (r ->> 'worker_id')::uuid = (SELECT id FROM ids WHERE k = 'w')
    FROM (SELECT public.claim_worker_pairing(pg_temp.secret(1)) AS r) AS x$$,
  $$VALUES ('confirmed'::text, true, true)$$,
  'the machine collects the sealed token with its device secret'
);
SELECT extensions.is(
  public.claim_worker_pairing(pg_temp.secret(1)) ->> 'status',
  'pending', 'a used secret collects nothing: the token is handed out once'
);
RESET ROLE;
SELECT extensions.is(
  (SELECT count(*)::integer FROM private.worker_pairings), 0, 'a collected pairing is deleted'
);

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
  $$SELECT public.begin_worker_pairing(repeat('a', 64), (SELECT public_key FROM consts), 'Başka', 'linux', now())$$,
  '42501', NULL, 'a machine session cannot pair other machines'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.assets (kind, storage_path) VALUES ('generated', 'makine/dogrudan.png')$$,
  '42501', NULL, 'a machine session cannot write tables directly'
);
SELECT extensions.results_eq(
  $$SELECT id, name, version, capabilities
    FROM public.register_worker('baska-ad', 'darwin', '0.2.0', ARRAY['voice.edge-tts'])$$,
  $$SELECT id, 'Stüdyo Mac'::text, '0.2.0'::text, ARRAY['voice.edge-tts'] FROM ids WHERE k = 'w'$$,
  'register_worker from a paired session updates its own machine and keeps the confirmed name'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.production_workers), 1,
  'a paired session cannot create a second machine'
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
  'an unpaired editor session may still register itself as a machine'
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
  '42501', NULL, 'a revoked machine session cannot register again'
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

-- ── Aynı adla yeniden eşleme ────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a0"}', true);
INSERT INTO vals SELECT 'p2', public.begin_worker_pairing(
  pg_temp.verifier(2), (SELECT public_key FROM consts), 'Stüdyo Mac', 'darwin', now());
INSERT INTO vals SELECT 'p3', public.begin_worker_pairing(
  pg_temp.verifier(3), (SELECT public_key FROM consts), 'İkinci makine', 'win32', now());
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT extensions.is(
  (public.complete_worker_pairing(
    (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p2'),
    'f2110000-0000-4000-8000-000000000004', '5e560000-0000-4000-8000-0000000000a2',
    (SELECT ciphertext FROM consts)) ->> 'worker_id')::uuid,
  (SELECT id FROM ids WHERE k = 'w'),
  'pairing the same machine name again reuses the machine row'
);
INSERT INTO vals SELECT 'c3', public.complete_worker_pairing(
  (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p3'),
  'f2110000-0000-4000-8000-000000000004', '5e560000-0000-4000-8000-0000000000a3',
  (SELECT ciphertext FROM consts)
);
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT w.revoked_at IS NULL,
      (SELECT revoked_at IS NOT NULL FROM private.worker_sessions WHERE session_id = '5e560000-0000-4000-8000-0000000000a1'),
      (SELECT revoked_at IS NULL FROM private.worker_sessions WHERE session_id = '5e560000-0000-4000-8000-0000000000a2')
    FROM public.production_workers w WHERE w.id = (SELECT id FROM ids WHERE k = 'w')$$,
  $$VALUES (true, true, true)$$,
  'the machine is authorised again; only the new session is live'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.ok(
  public.current_team_role() IS NULL,
  'the old session stays revoked after the machine is paired again'
);
SELECT extensions.throws_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w'))$$,
  '42501', NULL, 'and cannot speak for the machine'
);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a2"}', true);
SELECT extensions.lives_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w'))$$,
  'the new session speaks for the machine'
);
-- a3 oturumu ikinci makineye bağlı: ilk makine adına konuşamaz.
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a3"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w'))$$,
  '42501', NULL, 'a session bound to one machine cannot speak for another machine of the same member'
);
RESET ROLE;

-- ── Süresi dolan eşleme ─────────────────────────────────────────────────────
UPDATE private.worker_pairings SET expires_at = clock_timestamp() - interval '1 second'
WHERE id = (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p3');
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT extensions.is(
  public.claim_worker_pairing(pg_temp.secret(3)) ->> 'status',
  'pending', 'an expired pairing cannot be collected, even with the right secret'
);
RESET ROLE;
SELECT extensions.ok(private.cleanup_worker_pairings() >= 1, 'cleanup removes expired pairings');
SELECT extensions.results_eq(
  $$SELECT (SELECT count(*)::integer FROM private.worker_pairings
            WHERE id = (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'p3')),
      (SELECT revoked_at IS NOT NULL FROM private.worker_sessions WHERE session_id = '5e560000-0000-4000-8000-0000000000a3'),
      (SELECT count(*)::integer FROM auth.sessions WHERE id = '5e560000-0000-4000-8000-0000000000a3')$$,
  $$VALUES (0, true, 0)$$,
  'a completed pairing that was never collected ends its session'
);

-- ── Sınırlar kimliğe bağlıdır ───────────────────────────────────────────────
-- Üye başına en çok 3 bekleyen eşleme; istek başlığını değiştirmek hakkı artırmaz.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e2"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"198.51.100.1"}', true);
SELECT extensions.is(
  (SELECT array_agg(public.begin_worker_pairing(pg_temp.verifier(g), (SELECT public_key FROM consts), 'Sınır ' || g, 'linux', now()) ->> 'status' ORDER BY g)
   FROM generate_series(11, 14) AS g),
  ARRAY['pending', 'pending', 'pending', 'too_many_pending'],
  'a member may hold three pending pairings; the fourth is refused'
);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.200, 198.51.100.77"}', true);
SELECT extensions.is(
  public.begin_worker_pairing(pg_temp.verifier(14), (SELECT public_key FROM consts), 'Sınır 14', 'linux', now()) ->> 'status',
  'too_many_pending', 'changing X-Forwarded-For does not raise the allowance'
);
-- Alan başına en çok 10: owner (3) + yedek editor (3) ile A alanı 10'a ulaşır (p2 dahil).
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e1"}', true);
SELECT extensions.is(
  (SELECT array_agg(DISTINCT public.begin_worker_pairing(pg_temp.verifier(g), (SELECT public_key FROM consts), 'Owner ' || g, 'linux', now()) ->> 'status')
   FROM generate_series(21, 23) AS g),
  ARRAY['pending'], 'another member of the workspace has an own allowance'
);
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000005', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000005","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e5"}', true);
SELECT extensions.is(
  (SELECT array_agg(DISTINCT public.begin_worker_pairing(pg_temp.verifier(g), (SELECT public_key FROM consts), 'Yedek ' || g, 'linux', now()) ->> 'status')
   FROM generate_series(31, 33) AS g),
  ARRAY['pending'], 'and a third member too'
);
SELECT set_config('request.jwt.claim.sub', 'f2110000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2110000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000a0"}', true);
SELECT extensions.is(
  public.begin_worker_pairing(pg_temp.verifier(41), (SELECT public_key FROM consts), 'Onbirinci', 'linux', now()) ->> 'status',
  'too_many_pending', 'the workspace as a whole holds at most ten pending pairings'
);
-- Başka bir çalışma alanı bundan etkilenmez.
SELECT set_config('request.jwt.claim.sub', 'f2120000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2120000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000b1"}', true);
INSERT INTO vals SELECT 'pv', public.begin_worker_pairing(
  pg_temp.verifier(51), (SELECT public_key FROM consts), 'B makinesi', 'win32', now());
SELECT extensions.is(
  (SELECT v ->> 'status' FROM vals WHERE k = 'pv'), 'pending',
  'a full workspace does not stop another workspace from pairing'
);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT extensions.lives_ok(
  $$SELECT public.complete_worker_pairing(
      (SELECT (v ->> 'pairing_id')::uuid FROM vals WHERE k = 'pv'),
      'f2120000-0000-4000-8000-000000000001', '5e560000-0000-4000-8000-0000000000b9',
      (SELECT ciphertext FROM consts))$$,
  'the other workspace completes its pairing'
);
RESET ROLE;

-- ── Oturumsuz sel etkisizdir ────────────────────────────────────────────────
CREATE TEMP TABLE before_flood ON COMMIT DROP AS
SELECT md5(string_agg(to_jsonb(p)::text, '|' ORDER BY p.id)) AS digest, count(*) AS n
FROM private.worker_pairings p;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"192.0.2.1"}', true);
SELECT extensions.is(
  (SELECT array_agg(DISTINCT public.claim_worker_pairing(pg_temp.secret(100000 + g)) ->> 'status')
   FROM generate_series(1, 3000) AS g),
  ARRAY['pending'], 'three thousand unauthenticated polls with wrong secrets all say pending'
);
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT md5(string_agg(to_jsonb(p)::text, '|' ORDER BY p.id)), count(*) FROM private.worker_pairings p$$,
  $$SELECT digest, n FROM before_flood$$,
  'and change nothing: no pairing row is created, removed or modified by unauthenticated calls'
);
SET LOCAL ROLE anon;
SELECT extensions.is(
  public.claim_worker_pairing(pg_temp.secret(51)) ->> 'status',
  'confirmed', 'after the flood the other workspace''s machine still collects its token'
);
RESET ROLE;
SELECT extensions.is(
  (SELECT workspace_id FROM public.production_workers WHERE name = 'B makinesi'), (SELECT b FROM ws),
  'the machine belongs to the other workspace'
);

SELECT * FROM extensions.finish();
ROLLBACK;
