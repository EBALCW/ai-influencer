-- MCP oturumu türü, senaryo temizleme, işi kuyruğa bırakma
-- (#241, migration 20261116120000_mcp_sessions.sql).
--
-- Kapsam: izinler · MCP oturumu taslak yazar (seri, istek, öneri, bölüm, senaryo, ön hazırlık
-- işi, iptal) · hiçbir otomasyon oturumu onaylayamaz, üretim işi açamaz, arşivleyemez, taşıyamaz,
-- makine olamaz, ekibi göremez, tabloya yazamaz · aynı kullanıcının insan oturumu onaylar ·
-- makine oturumu ve viewer MCP oturumu olamaz · başka alan · listeleme ve yetki kaldırma ·
-- save_episode_script(p_clear_script) · release_job.
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
  ('f2410000-0000-4000-8000-000000000001'::uuid, 'mcp-a-owner@example.invalid'),
  ('f2410000-0000-4000-8000-000000000002'::uuid, 'mcp-a-editor@example.invalid'),
  ('f2410000-0000-4000-8000-000000000003'::uuid, 'mcp-a-viewer@example.invalid'),
  ('f2420000-0000-4000-8000-000000000001'::uuid, 'mcp-b-owner@example.invalid')
) AS u (id, email);
INSERT INTO public.team_members (user_id, role) VALUES
  ('f2410000-0000-4000-8000-000000000001', 'owner'),
  ('f2410000-0000-4000-8000-000000000002', 'editor'),
  ('f2410000-0000-4000-8000-000000000003', 'viewer');
-- MCP girişlerinin Auth oturumları (gerçekte `pnpm mcp:login` açar).
INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES
  ('5e570000-0000-4000-8000-0000000000c1', 'f2410000-0000-4000-8000-000000000002', now(), now()),
  ('5e570000-0000-4000-8000-0000000000c2', 'f2410000-0000-4000-8000-000000000001', now(), now()),
  ('5e570000-0000-4000-8000-0000000000cb', 'f2420000-0000-4000-8000-000000000001', now(), now());

CREATE TEMP TABLE ws ON COMMIT DROP AS SELECT id AS a, NULL::uuid AS b FROM public.workspaces;
UPDATE ws SET b = private.create_workspace_for_user('f2420000-0000-4000-8000-000000000001', 'MCP alanı B');
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
GRANT SELECT ON ws TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON ids TO anon, authenticated, service_role;

-- ── Yapı ve izinler ─────────────────────────────────────────────────────────
SELECT extensions.is(
  ARRAY(
    SELECT p.oid::regprocedure::text FROM pg_proc p
    WHERE (
      p.pronamespace = 'private'::regnamespace
      AND p.proname IN ('worker_sessions_guard', 'session_kind', 'require_human_session', 'jobs_automation_gate', 'require_unlocked_for_automation')
      AND (
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
    ) OR (
      p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace, 'private'::regnamespace)
      AND p.proname IN (
        'worker_sessions_guard', 'session_kind', 'require_human_session', 'jobs_automation_gate',
        'require_unlocked_for_automation', 'can_draft', 'register_mcp_session', 'list_mcp_sessions', 'revoke_mcp_session',
        'save_episode_script', 'release_job'
      )
      AND (
        NOT p.proconfig @> ARRAY['search_path=""']
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
        OR (p.pronamespace = 'public'::regnamespace AND p.prosecdef)
      )
    )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'private helpers are closed to API roles; new functions pin an empty search_path, are closed to anon and service_role, and public wrappers are SECURITY INVOKER'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM pg_proc WHERE proname = 'save_episode_script'), 2,
  'save_episode_script has exactly one public wrapper and one core (no ambiguous overload)'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'private.worker_sessions', 'SELECT')
  AND NOT has_table_privilege('service_role', 'private.worker_sessions', 'SELECT'),
  'the session registry stays closed to API roles'
);

-- ── İnsan editor: seri, bölüm, senaryo, işler ───────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2410000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.results_eq(
  $$SELECT public.can_draft(), public.can_write_data()$$, $$VALUES (true, true)$$,
  'a human editor session drafts as before'
);
INSERT INTO ids SELECT 's1', (public.create_series('MCP serisi', '{"kind":"event"}'::jsonb)).id;
INSERT INTO ids SELECT 's2', (public.create_series('MCP ikinci seri', '{"kind":"event"}'::jsonb)).id;
INSERT INTO ids SELECT 'ep1', (public.create_episode('MCP bölümü', 'event', (SELECT id FROM ids WHERE k = 's1'))).id;
INSERT INTO ids SELECT 'ep2', (public.create_episode('MCP ikinci bölüm', 'event', (SELECT id FROM ids WHERE k = 's1'))).id;
INSERT INTO ids SELECT 'jc', (public.enqueue_job('clip', 'clip.selftest', '[{"key":"prepare"}]'::jsonb)).id;
INSERT INTO ids SELECT 'jr', (public.enqueue_job('clip', 'clip.selftest', '[{"key":"prepare"},{"key":"finish"}]'::jsonb, '{}'::jsonb, ARRAY['render.blender'])).id;

-- save_episode_script(p_clear_script)
SELECT extensions.results_eq(
  $$SELECT script, script_version FROM public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep2'), 'Metin', NULL, '{"scenes":[1]}'::jsonb)$$,
  $$VALUES ('{"scenes":[1]}'::jsonb, 1)$$,
  'the structured script is saved'
);
SELECT extensions.results_eq(
  $$SELECT script, script_version FROM public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep2'), 'Metin', NULL, NULL)$$,
  $$VALUES ('{"scenes":[1]}'::jsonb, 1)$$,
  'SQL NULL (what PostgREST sends for JSON null) leaves the structured script untouched'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep2'), NULL, NULL, '{"scenes":[2]}'::jsonb, NULL, NULL, NULL, true)$$,
  '22023', NULL, 'clearing and writing the structured script in one call is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep2'), NULL, p_expected_version => 0, p_clear_script => true)$$,
  '55000', NULL, 'clearing honours the optimistic lock'
);
SELECT extensions.results_eq(
  $$SELECT script IS NULL, script_text, script_version FROM public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep2'), NULL, p_expected_version => 1, p_clear_script => true)$$,
  $$VALUES (true, 'Metin'::text, 2)$$,
  'p_clear_script clears the structured script, keeps the text and opens a new version'
);
SELECT extensions.results_eq(
  $$SELECT script IS NULL, script_version FROM public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep2'), NULL, p_clear_script => true)$$,
  $$VALUES (true, 2)$$,
  'clearing an already empty structured script changes nothing'
);

-- Editor ayrı bir oturumdan kendi makinesini kaydeder (e9 artık makine oturumu).
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e9"}', true);
INSERT INTO ids SELECT 'w', (public.register_worker('mcp-test-makinesi', 'linux')).id;

-- ── Kayıt: üye oturumu MCP oturumu olur ─────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000c1"}', true);
SELECT extensions.results_eq(
  $$SELECT public.current_team_role()::text, public.is_worker_session()$$,
  $$VALUES ('editor'::text, false)$$,
  'before registering, the session is an ordinary editor session'
);
SELECT extensions.ok(public.register_mcp_session('  Claude Code (test)  '), 'an editor registers the session as an MCP session');
SELECT extensions.ok(public.register_mcp_session('başka ad'), 'registering again is a no-op');
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT kind, client_name, worker_id IS NULL, revoked_at IS NULL FROM private.worker_sessions
    WHERE session_id = '5e570000-0000-4000-8000-0000000000c1'$$,
  $$VALUES ('mcp'::text, 'Claude Code (test)'::text, true, true)$$,
  'the registry holds one mcp row without a machine; the first client name is kept'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.production_workers WHERE user_id = 'f2410000-0000-4000-8000-000000000002'),
  1, 'an MCP session does not appear among production machines'
);

-- ── MCP oturumu: tablolarda viewer, taslakta gerçek rol ─────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2410000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000c1"}', true);
SELECT extensions.results_eq(
  $$SELECT public.current_team_role()::text, public.is_worker_session(), public.can_write_data(),
      public.can_manage_team(), public.can_draft(), public.current_workspace_id() = (SELECT a FROM ws)$$,
  $$VALUES ('viewer'::text, true, false, false, true, true)$$,
  'an editor''s MCP session is a viewer everywhere except drafting'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.team_members), 0,
  'an MCP session cannot read team membership (the panel treats it as a non-member)'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.series), 2, 'an MCP session reads the series of its workspace'
);

-- Taslak RPC'leri çalışır.
INSERT INTO ids SELECT 'ms', (public.create_series('MCP''nin açtığı seri', '{"kind":"event"}'::jsonb)).id;
SELECT extensions.is(
  (public.update_series((SELECT id FROM ids WHERE k = 'ms'), '{"theme":"MCP teması"}'::jsonb)).theme,
  'MCP teması', 'an MCP session updates a series'
);
INSERT INTO ids SELECT 'mrq', (public.create_topic_request(
  'köprüler', '[{"title":"MCP önerisi bir"}]'::jsonb, (SELECT id FROM ids WHERE k = 'ms'), 'event'
)).id;
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.add_topic_suggestions(
    (SELECT id FROM ids WHERE k = 'mrq'), '[{"title":"MCP önerisi iki"}]'::jsonb)),
  2, 'an MCP session adds topic suggestions'
);
INSERT INTO ids SELECT 'mep', (public.pick_topic_suggestion(
  (SELECT id FROM public.topic_suggestions WHERE title = 'MCP önerisi bir')
)).id;
SELECT extensions.lives_ok(
  $$SELECT public.reject_topic_suggestion(
      (SELECT id FROM public.topic_suggestions WHERE title = 'MCP önerisi iki'), 'sonra')$$,
  'an MCP session rejects a suggestion'
);
INSERT INTO ids SELECT 'mep2', (public.create_episode('MCP''nin açtığı tekil video', 'event')).id;
SELECT extensions.is(
  (public.update_episode((SELECT id FROM ids WHERE k = 'mep'), '{"hook":"MCP kancası"}'::jsonb)).hook,
  'MCP kancası', 'an MCP session updates an episode'
);
SELECT extensions.results_eq(
  $$SELECT status, script_version FROM public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep1'), 'MCP''nin yazdığı taslak.',
      '[{"claim":"İddia","sources":[{"title":"A"},{"title":"B"}]}]'::jsonb,
      p_expected_version => 0)$$,
  $$VALUES ('script_ready'::text, 1)$$,
  'an MCP session saves a script draft'
);
INSERT INTO ids SELECT 'mj', (public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'mep'), 'explainer.script')).id;
SELECT extensions.is(
  (SELECT status FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'mj')), 'queued',
  'an MCP session enqueues a pre-approval job'
);
SELECT extensions.is(
  (public.request_cancel_job((SELECT id FROM ids WHERE k = 'mj'))).status, 'cancelled',
  'an MCP session requests cancellation'
);

SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'jr'))$$,
  '42501', 'Otomasyon oturumu yalnız ön hazırlık işini iptal edebilir; üretim işini panelden bir insan iptal eder.',
  'an MCP session cannot cancel a job that is not an explainer pre-approval job'
);
SELECT extensions.is(
  (SELECT status FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'jr')), 'queued',
  'the refused cancellation left the job queued'
);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job(gen_random_uuid())$$,
  'P0002', NULL, 'an unknown job is still reported as not found'
);

-- Onay: RPC ve doğrudan tablo yazımı reddedilir.
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 1, true)$$,
  '42501', NULL, 'an MCP session cannot approve a script'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET script_approved_at = now() WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '42501', NULL, 'nor write the approval columns directly'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'jc'), 'prepare')$$,
  '42501', NULL, 'an MCP session cannot approve a job stage'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET approved_at = now() WHERE job_id = (SELECT id FROM ids WHERE k = 'jc')$$,
  '42501', NULL, 'nor write stage approval directly'
);
RESET ROLE;
-- Trigger katmanı da reddeder (tablo izni olsaydı bile): oturum bağlamı korunarak sahibi dener.
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET script_approved_at = now(), script_approved_with_gaps = true
    WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '42501', 'Üretim makinesi oturumu onay veremez.',
  'the episode guard itself refuses approval under an MCP session'
);

-- Aynı kullanıcının insan oturumu aynı çağrıyla onaylar (ret oturum türünden; rolden değil).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.is(
  (public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 1, true)).status, 'script_approved',
  'a human session of the same user approves with the same call'
);

-- Üretim ve insana ayrılanlar.
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000c1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep1'), 'explainer.render')$$,
  '42501', 'Otomasyon oturumu üretim işi açamaz; üretimi panelden bir insan başlatır.',
  'an MCP session cannot enqueue a production job even for an approved script'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.selftest', '[{"key":"a"}]'::jsonb)$$,
  '42501', NULL, 'an MCP session cannot use the generic enqueue_job'
);
SELECT extensions.throws_ok(
  $$SELECT public.retry_job((SELECT id FROM ids WHERE k = 'mj'))$$,
  '42501', NULL, 'an MCP session cannot retry jobs'
);
SELECT extensions.throws_ok(
  $$SELECT public.archive_series((SELECT id FROM ids WHERE k = 'ms'))$$,
  '42501', NULL, 'an MCP session cannot archive a series'
);
SELECT extensions.throws_ok(
  $$SELECT public.archive_episode((SELECT id FROM ids WHERE k = 'mep2'))$$,
  '42501', NULL, 'an MCP session cannot archive an episode'
);
SELECT extensions.throws_ok(
  $$SELECT public.move_episode((SELECT id FROM ids WHERE k = 'mep2'), (SELECT id FROM ids WHERE k = 's2'))$$,
  '42501', NULL, 'an MCP session cannot move an episode'
);
SELECT extensions.throws_ok(
  $$SELECT public.register_worker('mcp-makine-olmak-istiyor', 'linux')$$,
  '42501', 'MCP oturumu üretim makinesi olarak kaydedilemez.',
  'an MCP session cannot turn itself into a production machine'
);
SELECT extensions.throws_ok(
  $$SELECT public.revoke_worker((SELECT id FROM ids WHERE k = 'w'))$$,
  '42501', NULL, 'an MCP session cannot revoke machines'
);
SELECT extensions.throws_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w'))$$,
  '42501', NULL, 'an MCP session cannot speak for the member''s own machine'
);
SELECT extensions.throws_ok(
  $$SELECT public.claim_job((SELECT id FROM ids WHERE k = 'w'))$$,
  '42501', NULL, 'an MCP session cannot claim jobs'
);
SELECT extensions.throws_ok(
  $$SELECT public.release_job((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jr'))$$,
  '42501', NULL, 'an MCP session cannot release jobs'
);
SELECT extensions.throws_ok(
  $$SELECT * FROM public.list_mcp_sessions()$$,
  '42501', NULL, 'an MCP session cannot list MCP sessions'
);
SELECT extensions.throws_ok(
  $$SELECT public.revoke_mcp_session('5e570000-0000-4000-8000-0000000000c1')$$,
  '42501', NULL, 'an MCP session cannot revoke MCP sessions'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.assets (kind, storage_path) VALUES ('generated', 'mcp/dogrudan.png')$$,
  '42501', NULL, 'an MCP session cannot write tables directly'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.team_members (user_id, role) VALUES ('f2410000-0000-4000-8000-000000000003', 'owner')$$,
  '42501', NULL, 'an MCP session cannot change the team'
);
SELECT extensions.ok(
  NOT public.can_write_production_object(
    (SELECT a FROM ws)::text || '/' || (SELECT id FROM ids WHERE k = 'jc')::text || '/x.json'),
  'an MCP session cannot write production files'
);
SELECT extensions.results_eq(
  $$SELECT (SELECT count(*)::integer FROM public.production_workers),
      (SELECT script_approved_at IS NOT NULL FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1'))$$,
  $$VALUES (1, true)$$,
  'the refused calls left no machine behind and did not touch the human approval'
);


-- ── Onaylanmış iş otomasyon oturumuna kilitlidir ────────────────────────────
-- ep1 (seri s1) artık onaylı. İnsan üretim işi açar (jp).
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e2"}', true);
INSERT INTO ids SELECT 'jp', (public.enqueue_episode_job(
  (SELECT id FROM ids WHERE k = 'ep1'), 'explainer.render', ARRAY['render.hyperframes']
)).id;
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000c1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'jp'))$$,
  '42501', NULL, 'an MCP session cannot cancel a production job a human started'
);
SELECT extensions.throws_ok(
  $$SELECT public.update_episode((SELECT id FROM ids WHERE k = 'ep1'), '{"params":{"duration":5}}'::jsonb)$$,
  '42501', 'Senaryosu onaylanmış ya da üretimi süren bölümü (ve serisini) otomasyon oturumu değiştiremez; panelden bir insan yapar.',
  'an MCP session cannot change production settings of an approved episode'
);
SELECT extensions.throws_ok(
  $$SELECT public.update_episode((SELECT id FROM ids WHERE k = 'ep1'), '{"hook":"sonradan"}'::jsonb)$$,
  '42501', NULL, 'nor any other field of an approved episode'
);
SELECT extensions.throws_ok(
  $$SELECT public.update_series((SELECT id FROM ids WHERE k = 's1'), '{"voice_name":"tr-TR-EmelNeural"}'::jsonb)$$,
  '42501', NULL, 'an MCP session cannot change the defaults of a series that has an approved episode'
);
SELECT extensions.is(
  (public.update_episode((SELECT id FROM ids WHERE k = 'mep2'), '{"hook":"taslak kanca"}'::jsonb)).hook,
  'taslak kanca', 'an MCP session still updates an unapproved episode'
);
SELECT extensions.is(
  (public.update_series((SELECT id FROM ids WHERE k = 'ms'), '{"theme":"yine MCP"}'::jsonb)).theme,
  'yine MCP', 'and a series without approved episodes'
);
-- İnsan oturumu etkilenmez; üretim işini de insan iptal eder.
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.is(
  (public.update_episode((SELECT id FROM ids WHERE k = 'ep1'), '{"hook":"insan kancası"}'::jsonb)).hook,
  'insan kancası', 'a human session still updates an approved episode'
);
SELECT extensions.lives_ok(
  $$SELECT public.update_series((SELECT id FROM ids WHERE k = 's1'), '{"theme":"insan teması"}'::jsonb)$$,
  'a human session still updates the series'
);
SELECT extensions.is(
  (public.request_cancel_job((SELECT id FROM ids WHERE k = 'jp'))).status, 'cancelled',
  'a human session cancels the production job'
);

-- ── Makine oturumu ve viewer ────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e9"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.register_mcp_session('makine')$$,
  '42501', NULL, 'a machine session cannot become an MCP session'
);
SELECT extensions.results_eq(
  $$SELECT public.can_draft(), public.current_team_role()::text$$, $$VALUES (false, 'viewer'::text)$$,
  'a machine session still cannot draft'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Makine serisi')$$, '42501', NULL,
  'a machine session is still refused by drafting RPCs'
);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'jc'))$$, '42501', NULL,
  'a machine session still cannot cancel jobs'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'mep'), 'explainer.script')$$, '42501', NULL,
  'a machine session still cannot enqueue episode jobs'
);

SELECT set_config('request.jwt.claim.sub', 'f2410000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000003","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e3"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.register_mcp_session('viewer')$$,
  '42501', NULL, 'a viewer cannot register an MCP session (unsupported in v1)'
);
SELECT extensions.results_eq(
  $$SELECT public.can_draft(), (SELECT count(*)::integer FROM public.list_mcp_sessions())$$,
  $$VALUES (false, 0)$$,
  'a viewer cannot draft and sees no MCP sessions of others'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Viewer serisi')$$, '42501', NULL, 'a viewer is still refused by drafting RPCs'
);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.register_mcp_session('oturumsuz')$$,
  '42501', NULL, 'registration needs a member with a session id'
);

-- ── Başka çalışma alanı ─────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f2420000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2420000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000cb"}', true);
SELECT extensions.ok(public.register_mcp_session('B istemcisi'), 'the owner of workspace B registers an MCP session');
SELECT extensions.results_eq(
  $$SELECT (SELECT count(*)::integer FROM public.series) + (SELECT count(*)::integer FROM public.episodes)
      + (SELECT count(*)::integer FROM public.jobs), public.current_workspace_id() = (SELECT b FROM ws)$$,
  $$VALUES (0, true)$$,
  'an MCP session of workspace B reads nothing of workspace A'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep2'), 'ele geçirildi')$$,
  'P0002', NULL, 'it cannot save a script in workspace A'
);
SELECT extensions.throws_ok(
  $$SELECT public.update_series((SELECT id FROM ids WHERE k = 's1'), '{"theme":"ele geçirildi"}'::jsonb)$$,
  'P0002', NULL, 'nor update a series of workspace A'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep2'), 'explainer.script')$$,
  'P0002', NULL, 'nor enqueue a job for an episode of workspace A'
);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'jc'))$$,
  'P0002', NULL, 'nor cancel a job of workspace A'
);
SELECT extensions.is(
  (public.create_series('B''nin serisi', '{"kind":"event"}'::jsonb)).workspace_id, (SELECT b FROM ws),
  'its drafts land in its own workspace'
);
-- B'nin insan owner'ı A'nın MCP oturumlarını göremez, kaldıramaz.
SELECT set_config('request.jwt.claims',
  '{"sub":"f2420000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000b1"}', true);
SELECT extensions.results_eq(
  $$SELECT session_id, client_name, active FROM public.list_mcp_sessions()$$,
  $$VALUES ('5e570000-0000-4000-8000-0000000000cb'::uuid, 'B istemcisi'::text, true)$$,
  'the owner of workspace B lists only the MCP sessions of workspace B'
);
SELECT extensions.throws_ok(
  $$SELECT public.revoke_mcp_session('5e570000-0000-4000-8000-0000000000c1')$$,
  'P0002', NULL, 'and cannot revoke an MCP session of workspace A'
);

-- ── Listeleme ve yetki kaldırma ─────────────────────────────────────────────
-- Owner'ın da bir MCP oturumu olsun.
SELECT set_config('request.jwt.claim.sub', 'f2410000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000c2"}', true);
SELECT extensions.ok(public.register_mcp_session('Owner istemcisi'), 'the owner registers an MCP session');
SELECT extensions.results_eq(
  $$SELECT public.can_manage_team(), public.can_draft()$$, $$VALUES (false, true)$$,
  'an owner''s MCP session cannot manage the team but drafts'
);

SELECT set_config('request.jwt.claim.sub', 'f2410000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.results_eq(
  $$SELECT session_id FROM public.list_mcp_sessions()$$,
  $$VALUES ('5e570000-0000-4000-8000-0000000000c1'::uuid)$$,
  'an editor lists only the own MCP sessions'
);
SELECT extensions.throws_ok(
  $$SELECT public.revoke_mcp_session('5e570000-0000-4000-8000-0000000000c2')$$,
  'P0002', NULL, 'an editor cannot revoke the owner''s MCP session'
);

SELECT set_config('request.jwt.claim.sub', 'f2410000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e1"}', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.list_mcp_sessions() WHERE active), 2,
  'the owner lists every MCP session of the workspace'
);
SELECT extensions.ok(
  public.revoke_mcp_session('5e570000-0000-4000-8000-0000000000c1'), 'the owner revokes the editor''s MCP session'
);
SELECT extensions.results_eq(
  $$SELECT active, revoked_at IS NOT NULL FROM public.list_mcp_sessions()
    WHERE session_id = '5e570000-0000-4000-8000-0000000000c1'$$,
  $$VALUES (false, true)$$,
  'the revoked session is listed as inactive'
);
RESET ROLE;
SELECT extensions.is(
  (SELECT count(*)::integer FROM auth.sessions WHERE id = '5e570000-0000-4000-8000-0000000000c1'), 0,
  'revoking deletes the Auth session (the refresh token dies)'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f2410000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000c1"}', true);
SELECT extensions.results_eq(
  $$SELECT public.current_team_role() IS NULL, public.current_workspace_id() IS NULL, public.can_draft(),
      (SELECT count(*)::integer FROM public.series) + (SELECT count(*)::integer FROM public.episodes)$$,
  $$VALUES (true, true, false, 0)$$,
  'a revoked MCP session is no longer a member: it reads nothing and cannot draft'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Kaldırılmış')$$, '42501', NULL, 'a revoked MCP session cannot write drafts'
);
SELECT extensions.throws_ok(
  $$SELECT public.register_mcp_session('yeniden')$$, '42501', NULL,
  'a revoked MCP session cannot register again (it cannot restore its own access)'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep2'), 2, true)$$, '42501', NULL,
  'and still cannot approve'
);

-- ── release_job ─────────────────────────────────────────────────────────────
-- Makine oturumu (e9) işi alır, aşamayı başlatır ve kapanırken bırakır.
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e9"}', true);
SELECT extensions.results_eq(
  $$SELECT id FROM public.claim_job((SELECT id FROM ids WHERE k = 'w'))$$,
  $$SELECT id FROM ids WHERE k = 'jc'$$,
  'the machine claims the oldest job'
);
SELECT extensions.throws_ok(
  $$SELECT public.release_job((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jr'))$$,
  '55000', NULL, 'a machine cannot release a job it does not hold'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jc'), 'prepare')$$,
  'the machine starts the stage'
);
SELECT extensions.results_eq(
  $$SELECT status, attempts::integer, lease_expires_at IS NULL, run_after <= now()
    FROM public.release_job((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jc'))$$,
  $$VALUES ('queued'::text, 0, true, true)$$,
  'release_job returns the job to the queue without consuming an attempt'
);
SELECT extensions.results_eq(
  $$SELECT status, attempts::integer FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'jc')$$,
  $$VALUES ('pending'::text, 0)$$,
  'the running stage goes back to pending, attempts untouched'
);
SELECT extensions.throws_ok(
  $$SELECT public.release_job((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jc'))$$,
  '55000', NULL, 'a released job cannot be released twice'
);
SELECT extensions.results_eq(
  $$SELECT id FROM public.claim_job((SELECT id FROM ids WHERE k = 'w'))$$,
  $$SELECT id FROM ids WHERE k = 'jc'$$,
  'the released job is claimable again at once'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jc'), 'prepare')$$,
  'and its stage restarts'
);
-- İnsan iptal ister; makine bırakınca iş iptal olur.
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.release_job((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jc'))$$,
  '42501', NULL, 'a human session of the same user cannot release for the machine'
);
SELECT extensions.lives_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'jc'))$$, 'a human requests cancellation'
);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2410000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000e9"}', true);
SELECT extensions.is(
  (public.release_job((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jc'))).status,
  'cancelled', 'releasing a job whose cancellation was requested cancels it'
);
-- Başka alan: B'nin owner'ı A'nın makinesi adına bırakamaz.
SELECT set_config('request.jwt.claim.sub', 'f2420000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"f2420000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e570000-0000-4000-8000-0000000000b1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.release_job((SELECT id FROM ids WHERE k = 'w'), (SELECT id FROM ids WHERE k = 'jr'))$$,
  'P0002', NULL, 'another workspace cannot release through a machine of workspace A'
);
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
