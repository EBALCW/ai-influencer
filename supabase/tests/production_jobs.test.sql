-- Ortak üretim işi modeli (#201, migration 20261115100000_production_jobs.sql).
--
-- Kapsam: yapı ve izinler · roller (viewer salt okur) · makine kaydı ve oturum bağı · iş alma
-- (yetenek, kira, çift alma yok, dolan kira) · aşama akışı · onay kapısı · durum makinesi
-- (geçerli/geçersiz geçişler) · hata ve yeniden deneme · iptal · iki çalışma alanı yalıtımı.
--
-- Kimlik: oturum `request.jwt.claim.sub` (auth.uid) + `request.jwt.claims` (session_id) ile
-- verilir. Bütün test tek transaction olduğundan now() sabittir; kira dolması kolon geri
-- alınarak canlandırılır.
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
  ('d2010000-0000-4000-8000-000000000001'::uuid, 'job-a-owner@example.invalid'),
  ('d2010000-0000-4000-8000-000000000002'::uuid, 'job-a-editor@example.invalid'),
  ('d2010000-0000-4000-8000-000000000003'::uuid, 'job-a-viewer@example.invalid'),
  ('d2010000-0000-4000-8000-000000000004'::uuid, 'job-a-machine@example.invalid'),
  ('d2010000-0000-4000-8000-000000000005'::uuid, 'job-outsider@example.invalid'),
  ('e2010000-0000-4000-8000-000000000001'::uuid, 'job-b-owner@example.invalid')
) AS u (id, email);

-- Tek alan varken üyeler varsayılan alana (A) düşer.
INSERT INTO public.team_members (user_id, role) VALUES
  ('d2010000-0000-4000-8000-000000000001', 'owner'),
  ('d2010000-0000-4000-8000-000000000002', 'editor'),
  ('d2010000-0000-4000-8000-000000000003', 'viewer'),
  ('d2010000-0000-4000-8000-000000000004', 'editor');
INSERT INTO public.clip_sources (id, video_id, video_url, channel_name, title, duration_seconds, permission_status, permission_ref)
VALUES ('d2020000-0000-4000-8000-000000000001', 'jobAAAAAAA1', 'https://www.youtube.com/watch?v=jobAAAAAAA1',
  'İş Kanalı', 'A yayını', 600, 'granted', 'IZIN-JOB-A');
INSERT INTO public.assets (id, kind, storage_path, mime_type)
VALUES ('d2030000-0000-4000-8000-000000000001', 'final_video', 'job-test/a-final.mp4', 'video/mp4');

CREATE TEMP TABLE ws ON COMMIT DROP AS SELECT id AS a, NULL::uuid AS b FROM public.workspaces;
UPDATE ws SET b = private.create_workspace_for_user('e2010000-0000-4000-8000-000000000001', 'İş alanı B');
INSERT INTO public.clip_sources (id, video_id, video_url, channel_name, title, permission_status, permission_ref, workspace_id)
SELECT 'e2020000-0000-4000-8000-000000000001', 'jobBBBBBBB1', 'https://www.youtube.com/watch?v=jobBBBBBBB1',
  'B Kanalı', 'B yayını', 'granted', 'IZIN-JOB-B', b FROM ws;
INSERT INTO public.assets (id, kind, storage_path, mime_type, workspace_id)
SELECT 'e2030000-0000-4000-8000-000000000001', 'final_video', 'job-test/b-final.mp4', 'video/mp4', b FROM ws;

-- RPC'lerin döndürdüğü kimlikler (authenticated rolüyle de yazılıp okunur).
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
GRANT SELECT ON ws TO authenticated;
GRANT SELECT, INSERT ON ids TO authenticated;

-- ── Yapı ve izinler ─────────────────────────────────────────────────────────
SELECT extensions.is(
  ARRAY(
    SELECT t FROM unnest(ARRAY['production_workers', 'jobs', 'job_stages', 'job_assets']) AS t
    WHERE NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass)
      OR NOT has_table_privilege('authenticated', 'public.' || t, 'SELECT')
      OR has_table_privilege('authenticated', 'public.' || t, 'INSERT')
      OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
      OR has_table_privilege('authenticated', 'public.' || t, 'DELETE')
      OR has_table_privilege('anon', 'public.' || t, 'SELECT')
  ),
  ARRAY[]::text[],
  'job tables: RLS on, clients may only SELECT, anon nothing'
);
SELECT extensions.is(
  ARRAY(
    SELECT p.oid::regprocedure::text FROM pg_proc p
    WHERE p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace)
      AND p.proname IN (
        'enqueue_job', 'retry_job', 'request_cancel_job', 'approve_job_stage', 'attach_job_asset',
        'register_worker', 'worker_heartbeat', 'revoke_worker', 'claim_job', 'start_stage',
        'report_progress', 'complete_stage', 'fail_stage', 'acknowledge_cancel'
      )
      AND (
        NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
        OR NOT p.proconfig @> ARRAY['search_path=""']
        OR p.prosecdef <> (p.pronamespace = 'internal'::regnamespace)
      )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'job RPCs: public INVOKER wrapper + internal DEFINER core, empty search_path, authenticated only'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM pg_proc p
   WHERE p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace)
     AND p.proname IN (
       'enqueue_job', 'retry_job', 'request_cancel_job', 'approve_job_stage', 'attach_job_asset',
       'register_worker', 'worker_heartbeat', 'revoke_worker', 'claim_job', 'start_stage',
       'report_progress', 'complete_stage', 'fail_stage', 'acknowledge_cancel'
     )),
  28, 'every job RPC exists once as a wrapper and once as a core'
);
SELECT extensions.is(
  ARRAY(
    SELECT p.proname::text FROM pg_proc p
    WHERE p.pronamespace = 'private'::regnamespace
      AND p.proname IN (
        'current_session_id', 'is_worker_session', 'require_worker', 'jobs_guard',
        'job_stages_guard', 'lease_interval', 'job_progress', 'skip_open_stages', 'create_job',
        'advance_job', 'job_for_worker', 'reclaim_expired_jobs'
      )
      AND (
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
        OR NOT p.proconfig @> ARRAY['search_path=""']
      )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'private job helpers are closed to every API role and pin search_path'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'private.worker_sessions', 'SELECT')
  AND NOT has_table_privilege('service_role', 'private.worker_sessions', 'SELECT'),
  'worker session registry is not readable by API roles'
);
SELECT extensions.ok(
  pg_get_functiondef('internal.claim_job(uuid, integer)'::regprocedure) ILIKE '%FOR UPDATE SKIP LOCKED%'
  AND pg_get_functiondef('private.reclaim_expired_jobs(uuid)'::regprocedure) ILIKE '%FOR UPDATE SKIP LOCKED%',
  'claim and reclaim use FOR UPDATE SKIP LOCKED'
);
SELECT extensions.results_eq(
  $$SELECT schedule, command NOT LIKE '%http%' AND command NOT LIKE '%secret%'
    FROM cron.job WHERE jobname = 'reclaim-production-jobs'$$,
  $$VALUES ('* * * * *'::text, true)$$,
  'lease reclaim is scheduled every minute without network calls or secrets'
);

-- ── Roller: viewer ve ekip dışı ─────────────────────────────────────────────
SET LOCAL ROLE authenticated;

-- Editor (insan oturumu) bir iş açar: script (onaylı) → voice → render, ffmpeg ister. Örnek iş klip
-- modülündedir: anlatım işlerinin aşamaları sunucuda sabittir (#216, explainer_series.test.sql).
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
INSERT INTO ids
SELECT 'j1', (public.enqueue_job(
  'clip', 'clip.cut',
  '[{"key":"script","requires_approval":true},{"key":"voice"},{"key":"render"}]'::jsonb,
  '{"topic":"planör"}'::jsonb, ARRAY['ffmpeg']
)).id;
SELECT extensions.results_eq(
  $$SELECT status, current_stage, progress::integer, attempts::integer, params ->> 'topic',
      workspace_id, created_by, worker_id IS NULL AND lease_expires_at IS NULL
    FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  $$SELECT 'queued'::text, 'script'::text, 0, 0, 'planör'::text, a,
      'd2010000-0000-4000-8000-000000000002'::uuid, true FROM ws$$,
  'editor enqueues a job: queued at the first stage, in the own workspace, created_by from the session'
);
SELECT extensions.results_eq(
  $$SELECT seq::integer, key, status, requires_approval, approved_at IS NULL
    FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') ORDER BY seq$$,
  $$VALUES (1, 'script'::text, 'pending'::text, true, true),
           (2, 'voice'::text, 'pending'::text, false, true),
           (3, 'render'::text, 'pending'::text, false, true)$$,
  'stages are created in order, pending and unapproved'
);
-- Yalnız hyperframes'i olan makinenin alabileceği ikinci iş.
INSERT INTO ids
SELECT 'jcap', (public.enqueue_job(
  'clip', 'clip.cut', '[{"key":"render"}]'::jsonb, '{}'::jsonb, ARRAY['hyperframes']
)).id;

SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '{"key":"a"}'::jsonb)$$,
  '22023', NULL, 'stages must be an array'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[]'::jsonb)$$,
  '22023', NULL, 'at least one stage is required'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut',
      (SELECT jsonb_agg(jsonb_build_object('key', 's' || g)) FROM generate_series(1, 21) g))$$,
  '22023', NULL, 'at most 20 stages'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"},{"key":"a"}]'::jsonb)$$,
  '22023', NULL, 'stage keys must be unique'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a","requires_approval":"yes"}]'::jsonb)$$,
  '22023', NULL, 'requires_approval must be a boolean'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb, '{}'::jsonb, '{}', 'yok')$$,
  '22023', NULL, 'stop_at must name one of the stages'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('explainer', 'clip.cut', '[{"key":"a"}]'::jsonb)$$,
  '23514', NULL, 'kind must belong to the module'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('podcast', 'podcast.mix', '[{"key":"a"}]'::jsonb)$$,
  '23514', NULL, 'unknown module is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"Bad Key"}]'::jsonb)$$,
  '23514', NULL, 'stage key format is enforced'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb,
      jsonb_build_object('x', repeat('a', 70000)))$$,
  '23514', NULL, 'params are bounded (64 KB)'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb, '[1]'::jsonb)$$,
  '23514', NULL, 'params must be a JSON object'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb, '{}'::jsonb, ARRAY['Bad Cap'])$$,
  '23514', NULL, 'capability names are validated'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb, '{}'::jsonb, '{}', NULL, NULL, 99)$$,
  '23514', NULL, 'max_attempts is bounded'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET status = 'succeeded'$$,
  '42501', NULL, 'editor cannot update jobs directly'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET approved_at = now()$$,
  '42501', NULL, 'editor cannot write approval columns directly'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.jobs (module, kind) VALUES ('clip', 'clip.cut')$$,
  '42501', NULL, 'editor cannot insert jobs directly'
);
SELECT extensions.throws_ok(
  $$DELETE FROM public.jobs$$, '42501', NULL, 'editor cannot delete jobs directly'
);

-- Viewer: okur, yazamaz.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000003","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e3"}', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.jobs), 2, 'viewer reads the jobs of the own workspace'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.job_stages), 4, 'viewer reads the stages'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb)$$,
  '42501', NULL, 'viewer cannot enqueue'
);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'j1'))$$,
  '42501', NULL, 'viewer cannot cancel'
);
SELECT extensions.throws_ok(
  $$SELECT public.register_worker('viewer-mac', 'darwin')$$,
  '42501', NULL, 'viewer cannot register a machine'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.jobs (module, kind) VALUES ('clip', 'clip.cut')$$,
  '42501', NULL, 'viewer cannot insert jobs directly'
);

-- Ekip dışı kullanıcı.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000005', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000005","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e5"}', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.jobs) + (SELECT count(*)::integer FROM public.job_stages), 0,
  'a non-member sees no jobs'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb)$$,
  '42501', NULL, 'a non-member cannot enqueue'
);

-- ── Makine kaydı ve oturum bağı ─────────────────────────────────────────────
-- Makine kullanıcısı (editor) w1 oturumundan kaydolur.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT extensions.throws_ok(
  $$SELECT public.register_worker('mac-1', 'darwin')$$,
  '42501', NULL, 'a machine cannot register without a session id claim'
);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.register_worker('mac-1', 'amiga')$$,
  '23514', NULL, 'unknown platform is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.register_worker('mac-1', 'darwin', '0.1.0', ARRAY['Not Valid'])$$,
  '23514', NULL, 'machine capability names are validated'
);
INSERT INTO ids SELECT 'w1', (public.register_worker('  mac-1 ', 'darwin', '0.1.0', ARRAY['ffmpeg', 'blender'])).id;
SELECT extensions.results_eq(
  $$SELECT name, platform, capabilities, user_id, workspace_id, revoked_at IS NULL
    FROM public.production_workers WHERE id = (SELECT id FROM ids WHERE k = 'w1')$$,
  $$SELECT 'mac-1'::text, 'darwin'::text, ARRAY['ffmpeg', 'blender'],
      'd2010000-0000-4000-8000-000000000004'::uuid, a, true FROM ws$$,
  'machine is registered for the calling member in the own workspace (name trimmed)'
);
SELECT extensions.is(
  (public.register_worker('mac-1', 'darwin', '0.1.1', ARRAY['ffmpeg', 'blender'])).id,
  (SELECT id FROM ids WHERE k = 'w1'),
  'registering the same name again updates the row instead of duplicating it'
);
SELECT extensions.is(
  (public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w1'), ARRAY['ffmpeg', 'blender', 'yt-dlp'])).capabilities,
  ARRAY['ffmpeg', 'blender', 'yt-dlp'], 'heartbeat refreshes capabilities'
);
SELECT extensions.is(
  (public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w1'))).capabilities,
  ARRAY['ffmpeg', 'blender', 'yt-dlp'], 'heartbeat without capabilities keeps them'
);
SELECT extensions.throws_ok(
  $$UPDATE public.production_workers SET capabilities = ARRAY['hyperframes']$$,
  '42501', NULL, 'machine rows cannot be edited directly'
);

-- Aynı kullanıcının kayıtsız başka oturumu makine adına konuşamaz.
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000ff"}', true);
SELECT extensions.throws_ok(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  '42501', NULL, 'machine RPCs require the session registered for that machine'
);
-- Başka üyenin makinesi bulunamaz.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.throws_ok(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  'P0002', NULL, 'a member cannot act as another member''s machine'
);

-- ── İş alma: yetenek, kira, çift alma yok ───────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.results_eq(
  $$SELECT id, status, worker_id, lease_expires_at = now() + interval '120 seconds', started_at IS NOT NULL
    FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  $$SELECT (SELECT id FROM ids WHERE k = 'j1'), 'running'::text, (SELECT id FROM ids WHERE k = 'w1'), true, true$$,
  'claim returns the job whose capabilities the machine covers, running with a lease'
);
SELECT extensions.is_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  'no double claim, and a job needing a missing capability is not handed out'
);
SELECT extensions.is(
  (SELECT status FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'jcap')), 'queued',
  'the job with an unmet capability stays queued'
);

-- İkinci makine (w2 oturumu) hyperframes ile kaydolur ve o işi alır.
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a2"}', true);
INSERT INTO ids SELECT 'w2', (public.register_worker('win-1', 'win32', '0.1.0', ARRAY['ffmpeg', 'hyperframes'])).id;
SELECT extensions.results_eq(
  $$SELECT id, lease_expires_at = now() + interval '30 seconds'
    FROM public.claim_job((SELECT id FROM ids WHERE k = 'w2'), 5)$$,
  $$SELECT (SELECT id FROM ids WHERE k = 'jcap'), true$$,
  'the capable machine claims the remaining job; lease seconds are clamped to at least 30'
);
SELECT extensions.throws_ok(
  $$SELECT public.report_progress((SELECT id FROM ids WHERE k = 'w2'), (SELECT id FROM ids WHERE k = 'j1'), 10)$$,
  '55000', NULL, 'a machine cannot report on a job leased to another machine'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_stage((SELECT id FROM ids WHERE k = 'w2'), (SELECT id FROM ids WHERE k = 'j1'), 'script')$$,
  '55000', NULL, 'a machine cannot complete a stage of a job leased to another machine'
);

-- ── Aşama akışı ─────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'voice')$$,
  '55000', NULL, 'stages cannot be started out of order'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'script')$$,
  '55000', NULL, 'a stage that is not running cannot be completed'
);
SELECT extensions.is(
  (public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'script', 300)).lease_expires_at,
  now() + interval '300 seconds', 'starting a stage extends the lease'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'script')$$,
  'starting an already running stage again is idempotent'
);
SELECT extensions.results_eq(
  $$SELECT progress::integer, cancel_requested_at IS NULL, lease_expires_at = now() + interval '900 seconds'
    FROM public.report_progress((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'),
      40, repeat('ç', 600), 5000)$$,
  $$VALUES (13, true, true)$$,
  'progress: job progress is the stage average; lease seconds are clamped to at most 900'
);
SELECT extensions.results_eq(
  $$SELECT status, progress::integer, length(detail), started_at IS NOT NULL
    FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'script'$$,
  $$VALUES ('running'::text, 40, 500, true)$$,
  'stage progress and a truncated detail are stored'
);
SELECT extensions.is(
  (public.report_progress((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 250)).progress::integer,
  33, 'progress above 100 is clamped'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'script',
      jsonb_build_object('x', repeat('a', 9000)))$$,
  '23514', NULL, 'stage output is bounded (8 KB)'
);
SELECT extensions.results_eq(
  $$SELECT status, current_stage, lease_expires_at IS NULL, finished_at IS NULL
    FROM public.complete_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'script',
      '{"words":120}'::jsonb)$$,
  $$VALUES ('awaiting_approval'::text, 'script'::text, true, true)$$,
  'completing an approval stage parks the job in awaiting_approval and releases the lease'
);

-- ── Onay kapısı ─────────────────────────────────────────────────────────────
SELECT extensions.throws_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'voice')$$,
  '55000', NULL, 'the machine cannot start the next stage while approval is pending'
);
SELECT extensions.is_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  'a job awaiting approval cannot be claimed'
);
-- Makine oturumu editor rolünde olsa da onay veremez.
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'j1'), 'script')$$,
  '42501', NULL, 'a registered machine session cannot approve (even with an editor role)'
);
-- Viewer onay veremez.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000003","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e3"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'j1'), 'script')$$,
  '42501', NULL, 'viewer cannot approve'
);
-- Oturum kimliği olmayan çağrı onay veremez (güvenli taraf).
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'j1'), 'script')$$,
  '42501', NULL, 'approval without a session id claim is rejected'
);

-- Trigger düzeyi: service role / postgres doğrudan yazsa da kapı aşılamaz.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET status = 'queued', current_stage = 'voice' WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  '42501', NULL, 'database: an unapproved job cannot go back to the queue for the next stage'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET status = 'succeeded' WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  '42501', NULL, 'database: an unapproved job cannot be marked succeeded'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET status = 'running'
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'voice'$$,
  '42501', NULL, 'database: the stage after an unapproved approval stage cannot start'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET approved_at = now(), approved_by = 'd2010000-0000-4000-8000-000000000001'
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'script'$$,
  '42501', NULL, 'database: approval columns cannot be written without a human member session'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET approved_by = 'd2010000-0000-4000-8000-000000000001'
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'script'$$,
  '42501', NULL, 'database: approved_by cannot be forged on its own'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET approved_at = now()
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'voice'$$,
  '55000', NULL, 'database: a stage that does not require approval (or is unfinished) cannot be approved'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET requires_approval = false
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'script'$$,
  '55000', NULL, 'database: the approval requirement of a stage cannot be removed'
);

-- Editor (insan oturumu) yanlış aşamayı onaylayamaz, doğru aşamayı onaylar.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'j1'), 'voice')$$,
  '55000', NULL, 'only the stage that is awaiting approval can be approved'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'jcap'), 'render')$$,
  '55000', NULL, 'a running job has nothing to approve'
);
SELECT extensions.results_eq(
  $$SELECT status, current_stage, progress::integer
    FROM public.approve_job_stage((SELECT id FROM ids WHERE k = 'j1'), 'script')$$,
  $$VALUES ('queued'::text, 'voice'::text, 33)$$,
  'editor approves: the job returns to the queue at the next stage'
);
SELECT extensions.results_eq(
  $$SELECT approved_by, approved_at = now(), output ->> 'words'
    FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'script'$$,
  $$VALUES ('d2010000-0000-4000-8000-000000000002'::uuid, true, '120'::text)$$,
  'approval records the approver from the session, never from the client'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'j1'), 'script')$$,
  '55000', NULL, 'a stage cannot be approved twice'
);
RESET ROLE;
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET approved_at = NULL
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'script'$$,
  '55000', NULL, 'database: a given approval cannot be withdrawn'
);

-- ── Dolan kira: geri alma, deneme sayısı, max_attempts ──────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.results_eq(
  $$SELECT id, current_stage FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  $$SELECT (SELECT id FROM ids WHERE k = 'j1'), 'voice'::text$$,
  'after approval the job is claimable again at the next stage'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'voice')$$,
  'the stage after an approved stage starts'
);
RESET ROLE;
UPDATE public.jobs SET lease_expires_at = now() - interval '1 second' WHERE id = (SELECT id FROM ids WHERE k = 'j1');
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$SELECT public.report_progress((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 50)$$,
  '55000', NULL, 'a machine whose lease expired can no longer report'
);
RESET ROLE;
SELECT extensions.is(private.reclaim_expired_jobs(), 1, 'reclaim picks up exactly the expired lease');
SELECT extensions.results_eq(
  $$SELECT j.status, j.attempts::integer, j.lease_expires_at IS NULL, j.error IS NOT NULL,
      s.status, s.attempts::integer
    FROM public.jobs j JOIN public.job_stages s ON s.job_id = j.id AND s.key = 'voice'
    WHERE j.id = (SELECT id FROM ids WHERE k = 'j1')$$,
  $$VALUES ('queued'::text, 1, true, true, 'pending'::text, 1)$$,
  'an expired job returns to the queue, attempts increase, the running stage is reset'
);
SELECT extensions.is(
  (SELECT status FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'jcap')), 'running',
  'a job with a live lease is left alone'
);
-- claim_job kendi alanını süpürür: kira yeniden dolunca aynı çağrı işi geri alıp yeniden verir.
SET LOCAL ROLE authenticated;
SELECT extensions.isnt_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$, 'the reclaimed job is claimed again'
);
RESET ROLE;
UPDATE public.jobs SET lease_expires_at = now() - interval '1 second' WHERE id = (SELECT id FROM ids WHERE k = 'j1');
SET LOCAL ROLE authenticated;
SELECT extensions.results_eq(
  $$SELECT id, attempts::integer FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  $$SELECT (SELECT id FROM ids WHERE k = 'j1'), 2$$,
  'claim_job reclaims expired leases of the own workspace before picking'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j1'), 'voice')$$,
  'the reset stage can be started again'
);
RESET ROLE;
UPDATE public.jobs SET lease_expires_at = now() - interval '1 second' WHERE id = (SELECT id FROM ids WHERE k = 'j1');
SELECT extensions.is(private.reclaim_expired_jobs((SELECT a FROM ws)), 1, 'third expiry is reclaimed');
SELECT extensions.results_eq(
  $$SELECT status, attempts::integer, failed_stage, error IS NOT NULL, finished_at IS NOT NULL
    FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  $$VALUES ('failed'::text, 3, 'voice'::text, true, true)$$,
  'when max_attempts is reached the job fails and records the failing stage'
);
SELECT extensions.results_eq(
  $$SELECT key, status FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') ORDER BY seq$$,
  $$VALUES ('script'::text, 'succeeded'::text), ('voice'::text, 'failed'::text), ('render'::text, 'skipped'::text)$$,
  'stage history of the failed job: done, failed, skipped'
);

-- ── Durum makinesi: geçersiz geçişler veritabanında reddedilir ──────────────
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET status = 'queued' WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  '55000', NULL, 'failed is final: failed → queued is rejected'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET status = 'succeeded' WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  '55000', NULL, 'failed → succeeded is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.jobs (module, kind, status, workspace_id)
    SELECT 'clip', 'clip.cut', 'succeeded', a FROM ws$$,
  '55000', NULL, 'a job cannot be inserted in a non-queued state'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET params = '{"topic":"değişti"}' WHERE id = (SELECT id FROM ids WHERE k = 'jcap')$$,
  '55000', NULL, 'frozen params cannot be changed'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET stop_at = 'render', max_attempts = 9 WHERE id = (SELECT id FROM ids WHERE k = 'jcap')$$,
  '55000', NULL, 'stop_at and max_attempts cannot be changed'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET status = 'succeeded' WHERE id = (SELECT id FROM ids WHERE k = 'jcap')$$,
  '55000', NULL, 'running → succeeded with unfinished stages is rejected'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET status = 'awaiting_approval' WHERE id = (SELECT id FROM ids WHERE k = 'jcap')$$,
  '55000', NULL, 'running → awaiting_approval without a finished approval stage is rejected'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET status = 'succeeded'
    WHERE job_id = (SELECT id FROM ids WHERE k = 'jcap') AND key = 'render'$$,
  '55000', NULL, 'stage: pending → succeeded is rejected'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET status = 'pending'
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'script'$$,
  '55000', NULL, 'stage: succeeded is final'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET key = 'baska'
    WHERE job_id = (SELECT id FROM ids WHERE k = 'jcap') AND key = 'render'$$,
  '55000', NULL, 'stage definition cannot be changed'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.job_stages (job_id, seq, key, status)
    VALUES ((SELECT id FROM ids WHERE k = 'jcap'), 2, 'extra', 'succeeded')$$,
  '55000', NULL, 'a stage cannot be inserted as already finished'
);

-- ── Yeniden deneme ──────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000003","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e3"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.retry_job((SELECT id FROM ids WHERE k = 'j1'))$$, '42501', NULL, 'viewer cannot retry'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.retry_job((SELECT id FROM ids WHERE k = 'jcap'))$$,
  '55000', NULL, 'only failed or cancelled jobs can be retried'
);
INSERT INTO ids SELECT 'j1r', (public.retry_job((SELECT id FROM ids WHERE k = 'j1'))).id;
SELECT extensions.results_eq(
  $$SELECT status, retry_of, kind, params ->> 'topic', required_capabilities, attempts::integer, current_stage
    FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j1r')$$,
  $$SELECT 'queued'::text, (SELECT id FROM ids WHERE k = 'j1'), 'clip.cut'::text, 'planör'::text,
      ARRAY['ffmpeg'], 0, 'script'::text$$,
  'retry opens a NEW queued job linked with retry_of and the same frozen definition'
);
SELECT extensions.results_eq(
  $$SELECT key, status, requires_approval, approved_at IS NULL
    FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'j1r') ORDER BY seq$$,
  $$VALUES ('script'::text, 'pending'::text, true, true),
           ('voice'::text, 'pending'::text, false, true),
           ('render'::text, 'pending'::text, false, true)$$,
  'the retried job starts over; approvals are not inherited'
);
SELECT extensions.is(
  (SELECT status FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j1')), 'failed',
  'the original job is left untouched'
);

-- ── İptal ───────────────────────────────────────────────────────────────────
SELECT extensions.results_eq(
  $$SELECT status, cancel_requested_at IS NOT NULL, finished_at IS NOT NULL
    FROM public.request_cancel_job((SELECT id FROM ids WHERE k = 'j1r'))$$,
  $$VALUES ('cancelled'::text, true, true)$$,
  'a queued job is cancelled immediately'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.job_stages
   WHERE job_id = (SELECT id FROM ids WHERE k = 'j1r') AND status = 'skipped'),
  3, 'stages of a cancelled job are skipped'
);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'j1r'))$$,
  '55000', NULL, 'a finished job cannot be cancelled'
);

-- Çalışan iş: istek yazılır, makine görür ve kapatır. Aşamalar: a → b, stop_at yok.
INSERT INTO ids
SELECT 'j4', (public.enqueue_job('clip', 'clip.cut', '[{"key":"a"},{"key":"b"}]'::jsonb, '{}'::jsonb, '{}', NULL,
  'd2020000-0000-4000-8000-000000000001')).id;
SELECT extensions.is(
  (SELECT clip_source_id FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j4')),
  'd2020000-0000-4000-8000-000000000001'::uuid, 'a clip job is linked to its source'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.results_eq(
  $$SELECT id FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  $$SELECT id FROM ids WHERE k = 'j4'$$, 'machine claims the clip job'
);
SELECT extensions.throws_ok(
  $$SELECT public.acknowledge_cancel((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j4'))$$,
  '55000', NULL, 'a machine cannot cancel a job nobody asked to cancel'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j4'), 'a')$$,
  'machine starts the first stage'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.results_eq(
  $$SELECT status, cancel_requested_at IS NOT NULL
    FROM public.request_cancel_job((SELECT id FROM ids WHERE k = 'j4'))$$,
  $$VALUES ('running'::text, true)$$,
  'cancelling a running job only records the request'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.is(
  (public.report_progress((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j4'), 20)).cancel_requested_at IS NOT NULL,
  true, 'the machine sees the cancel request on its next progress call'
);
SELECT extensions.results_eq(
  $$SELECT status, finished_at IS NOT NULL, lease_expires_at IS NULL
    FROM public.acknowledge_cancel((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j4'))$$,
  $$VALUES ('cancelled'::text, true, true)$$,
  'the machine acknowledges: the job is cancelled'
);
SELECT extensions.results_eq(
  $$SELECT key, status FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'j4') ORDER BY seq$$,
  $$VALUES ('a'::text, 'skipped'::text), ('b'::text, 'skipped'::text)$$,
  'open stages of the cancelled job are skipped'
);
SELECT extensions.throws_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j4'), 'b')$$,
  '55000', NULL, 'a cancelled job accepts no more work'
);

-- Onay bekleyen iş anında iptal olur; iptal istenmiş işte biten aşama işi ilerletmez.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
INSERT INTO ids
SELECT 'j5', (public.enqueue_job('clip', 'clip.cut', '[{"key":"s","requires_approval":true},{"key":"t"}]'::jsonb)).id;
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.results_eq(
  $$SELECT id FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  $$SELECT id FROM ids WHERE k = 'j5'$$, 'machine claims j5'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j5'), 's')$$,
  'machine starts j5.s'
);
SELECT extensions.is(
  (public.complete_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j5'), 's')).status,
  'awaiting_approval', 'j5 waits for approval'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.is(
  (public.request_cancel_job((SELECT id FROM ids WHERE k = 'j5'))).status, 'cancelled',
  'a job awaiting approval is cancelled immediately'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'j5'), 's')$$,
  '55000', NULL, 'a cancelled job can no longer be approved'
);

INSERT INTO ids SELECT 'j6', (public.enqueue_job('clip', 'clip.cut', '[{"key":"s"},{"key":"t"}]'::jsonb)).id;
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.isnt_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$, 'machine claims j6'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j6'), 's')$$,
  'machine starts j6.s'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.lives_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'j6'))$$, 'editor asks to cancel j6'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j6'), 's')$$,
  '55000', NULL, 'no stage starts once cancellation was requested'
);
SELECT extensions.is(
  (public.complete_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j6'), 's')).status,
  'cancelled', 'finishing a stage after a cancel request cancels the job instead of advancing it'
);

-- Kirası dolan ve iptali istenmiş iş geri almada iptal olur (makine yanıt vermese de).
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
INSERT INTO ids SELECT 'j7', (public.enqueue_job('clip', 'clip.cut', '[{"key":"s"}]'::jsonb)).id;
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.isnt_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$, 'machine claims j7'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.lives_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'j7'))$$, 'editor asks to cancel j7'
);
RESET ROLE;
UPDATE public.jobs SET lease_expires_at = now() - interval '1 second' WHERE id = (SELECT id FROM ids WHERE k = 'j7');
SELECT extensions.is(private.reclaim_expired_jobs(), 1, 'the silent machine''s job is reclaimed');
SELECT extensions.is(
  (SELECT status FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j7')), 'cancelled',
  'an expired job with a cancel request is cancelled, not requeued'
);

-- ── Tam akış: stop_at ile tamamlanma ────────────────────────────────────────
SET LOCAL ROLE authenticated;
INSERT INTO ids
SELECT 'j2', (public.enqueue_job(
  'clip', 'clip.cut',
  '[{"key":"research"},{"key":"script","requires_approval":true},{"key":"render"}]'::jsonb,
  '{}'::jsonb, '{}', 'script'
)).id;
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.results_eq(
  $$SELECT id FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  $$SELECT id FROM ids WHERE k = 'j2'$$, 'machine claims j2'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j2'), 'research')$$,
  'machine starts j2.research'
);
SELECT extensions.results_eq(
  $$SELECT status, current_stage, worker_id, progress::integer
    FROM public.complete_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j2'), 'research')$$,
  $$SELECT 'running'::text, 'script'::text, (SELECT id FROM ids WHERE k = 'w1'), 33$$,
  'a stage without approval advances on the same machine'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j2'), 'script')$$,
  'machine starts j2.script'
);
SELECT extensions.is(
  (public.complete_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j2'), 'script')).status,
  'awaiting_approval', 'j2 waits for approval at its stop_at stage'
);
-- Owner da onaylayabilir.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e1"}', true);
SELECT extensions.results_eq(
  $$SELECT status, progress::integer, finished_at IS NOT NULL, lease_expires_at IS NULL
    FROM public.approve_job_stage((SELECT id FROM ids WHERE k = 'j2'), 'script')$$,
  $$VALUES ('succeeded'::text, 100, true, true)$$,
  'approving the stop_at stage completes the job'
);
SELECT extensions.results_eq(
  $$SELECT key, status, approved_by FROM public.job_stages
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j2') ORDER BY seq$$,
  $$VALUES ('research'::text, 'succeeded'::text, NULL::uuid),
           ('script'::text, 'succeeded'::text, 'd2010000-0000-4000-8000-000000000001'::uuid),
           ('render'::text, 'skipped'::text, NULL::uuid)$$,
  'stages after stop_at are skipped; the approver is the owner'
);
SELECT extensions.throws_ok(
  $$SELECT public.retry_job((SELECT id FROM ids WHERE k = 'j2'))$$,
  '55000', NULL, 'a succeeded job cannot be retried'
);

-- ── Hata ve geçici hata ─────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
INSERT INTO ids
SELECT 'j3', (public.enqueue_job('clip', 'clip.cut', '[{"key":"cut"},{"key":"burn"}]'::jsonb, '{}'::jsonb, '{}', NULL, NULL, 2)).id;
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.isnt_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$, 'machine claims j3'
);
SELECT extensions.throws_ok(
  $$SELECT public.fail_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j3'), 'cut', 'erken')$$,
  '55000', NULL, 'a stage that was never started cannot be failed'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j3'), 'cut')$$,
  'machine starts j3.cut'
);
SELECT extensions.results_eq(
  $$SELECT status, attempts::integer, length(error), run_after = now() + interval '30 seconds', failed_stage IS NULL
    FROM public.fail_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j3'), 'cut',
      repeat('x', 3000), true)$$,
  $$VALUES ('queued'::text, 1, 2000, true, true)$$,
  'a retryable failure requeues the job with a backoff; the error text is truncated'
);
SELECT extensions.results_eq(
  $$SELECT status, attempts::integer, length(error) FROM public.job_stages
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j3') AND key = 'cut'$$,
  $$VALUES ('pending'::text, 1, 2000)$$,
  'the failed stage is reset for the next attempt'
);
SELECT extensions.is_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  'a job in backoff is not claimable before run_after'
);
RESET ROLE;
UPDATE public.jobs SET run_after = now() WHERE id = (SELECT id FROM ids WHERE k = 'j3');
SET LOCAL ROLE authenticated;
SELECT extensions.isnt_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$, 'after the backoff the job is claimed again'
);
SELECT extensions.lives_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j3'), 'cut')$$,
  'machine restarts j3.cut'
);
SELECT extensions.results_eq(
  $$SELECT status, attempts::integer, failed_stage, error, finished_at IS NOT NULL
    FROM public.fail_stage((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'j3'), 'cut',
      '  ffmpeg çöktü  ', true)$$,
  $$VALUES ('failed'::text, 2, 'cut'::text, 'ffmpeg çöktü'::text, true)$$,
  'when attempts are exhausted even a retryable failure fails the job at that stage'
);
SELECT extensions.results_eq(
  $$SELECT key, status FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'j3') ORDER BY seq$$,
  $$VALUES ('cut'::text, 'failed'::text), ('burn'::text, 'skipped'::text)$$,
  'stage history records the failing stage'
);

-- ── İş varlıkları ───────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.results_eq(
  $$SELECT role, stage_key, workspace_id, created_by
    FROM public.attach_job_asset((SELECT id FROM ids WHERE k = 'j2'), 'd2030000-0000-4000-8000-000000000001', 'final', 'script')$$,
  $$SELECT 'final'::text, 'script'::text, a, 'd2010000-0000-4000-8000-000000000002'::uuid FROM ws$$,
  'editor links an asset to a job with a role'
);
SELECT extensions.lives_ok(
  $$SELECT public.attach_job_asset((SELECT id FROM ids WHERE k = 'j2'), 'd2030000-0000-4000-8000-000000000001', 'final')$$,
  'linking the same asset and role again is idempotent'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.job_assets WHERE job_id = (SELECT id FROM ids WHERE k = 'j2')), 1,
  'no duplicate link is created'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_asset((SELECT id FROM ids WHERE k = 'j2'), 'd2030000-0000-4000-8000-000000000001', 'poster')$$,
  '23514', NULL, 'unknown asset role is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_asset((SELECT id FROM ids WHERE k = 'j2'), 'd2030000-0000-4000-8000-000000000001', 'audio', 'yok')$$,
  '22023', NULL, 'the stage must belong to the job'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_asset((SELECT id FROM ids WHERE k = 'j2'), 'e2030000-0000-4000-8000-000000000001', 'final')$$,
  'P0002', NULL, 'an asset of another workspace cannot be linked'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb, '{}'::jsonb, '{}', NULL,
      'e2020000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'a job cannot be linked to another workspace''s clip source'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.job_assets (job_id, asset_id, role)
    VALUES ((SELECT id FROM ids WHERE k = 'j2'), 'd2030000-0000-4000-8000-000000000001', 'audio')$$,
  '42501', NULL, 'job assets cannot be inserted directly'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000003","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e3"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_asset((SELECT id FROM ids WHERE k = 'j2'), 'd2030000-0000-4000-8000-000000000001', 'audio')$$,
  '42501', NULL, 'viewer cannot link assets'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.job_assets), 1, 'viewer reads job assets'
);

-- ── Çalışma alanı yalıtımı (B alanı) ────────────────────────────────────────
-- A'da, herhangi bir makinenin alabileceği sıradaki bir iş bırakılır.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
INSERT INTO ids SELECT 'ja', (public.enqueue_job('clip', 'clip.cut', '[{"key":"s","requires_approval":true}]'::jsonb)).id;

SELECT set_config('request.jwt.claim.sub', 'e2010000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e2010000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000b1"}', true);
SELECT extensions.is(public.current_workspace_id(), (SELECT b FROM ws), 'B owner resolves to workspace B');
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.jobs) + (SELECT count(*)::integer FROM public.job_stages)
    + (SELECT count(*)::integer FROM public.job_assets) + (SELECT count(*)::integer FROM public.production_workers),
  0, 'workspace B sees no jobs, stages, job assets or machines of workspace A'
);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'ja'))$$,
  'P0002', NULL, 'request_cancel_job cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.retry_job((SELECT id FROM ids WHERE k = 'j1'))$$,
  'P0002', NULL, 'retry_job cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'ja'), 's')$$,
  'P0002', NULL, 'approve_job_stage cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.attach_job_asset((SELECT id FROM ids WHERE k = 'ja'), 'e2030000-0000-4000-8000-000000000001', 'input')$$,
  'P0002', NULL, 'attach_job_asset cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('clip', 'clip.cut', '[{"key":"a"}]'::jsonb, '{}'::jsonb, '{}', NULL,
      'd2020000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'enqueue_job cannot link a workspace A clip source'
);
SELECT extensions.throws_ok(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w1'))$$,
  'P0002', NULL, 'claim_job cannot use a workspace A machine'
);
SELECT extensions.throws_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w1'))$$,
  'P0002', NULL, 'worker_heartbeat cannot see a workspace A machine'
);
SELECT extensions.throws_ok(
  $$SELECT public.revoke_worker((SELECT id FROM ids WHERE k = 'w1'))$$,
  'P0002', NULL, 'revoke_worker cannot see a workspace A machine'
);

-- B kendi işini ve makinesini açar (aynı makine adı iki alanda da olabilir).
INSERT INTO ids
SELECT 'jb', (public.enqueue_job('clip', 'clip.cut', '[{"key":"cut"}]'::jsonb, '{}'::jsonb, '{}', NULL,
  'e2020000-0000-4000-8000-000000000001')).id;
SELECT extensions.is(
  (SELECT workspace_id FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'jb')), (SELECT b FROM ws),
  'a job enqueued by B lands in workspace B'
);
SELECT extensions.is(
  (SELECT count(DISTINCT workspace_id)::integer FROM public.job_stages), 1, 'its stages are in workspace B too'
);
SELECT set_config('request.jwt.claims',
  '{"sub":"e2010000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000b2"}', true);
INSERT INTO ids SELECT 'wb', (public.register_worker('mac-1', 'darwin', '0.1.0', ARRAY['ffmpeg', 'hyperframes', 'blender'])).id;
SELECT extensions.results_eq(
  $$SELECT id FROM public.claim_job((SELECT id FROM ids WHERE k = 'wb'))$$,
  $$SELECT id FROM ids WHERE k = 'jb'$$,
  'a workspace B machine claims only workspace B jobs'
);
SELECT extensions.is_empty(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'wb'))$$,
  'the queued workspace A job is never handed to a workspace B machine'
);
SELECT extensions.throws_ok(
  $$SELECT public.start_stage((SELECT id FROM ids WHERE k = 'wb'), (SELECT id FROM ids WHERE k = 'ja'), 's')$$,
  'P0002', NULL, 'start_stage cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.report_progress((SELECT id FROM ids WHERE k = 'wb'), (SELECT id FROM ids WHERE k = 'jcap'), 99)$$,
  'P0002', NULL, 'report_progress cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_stage((SELECT id FROM ids WHERE k = 'wb'), (SELECT id FROM ids WHERE k = 'jcap'), 'render')$$,
  'P0002', NULL, 'complete_stage cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.fail_stage((SELECT id FROM ids WHERE k = 'wb'), (SELECT id FROM ids WHERE k = 'jcap'), 'render', 'x')$$,
  'P0002', NULL, 'fail_stage cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.acknowledge_cancel((SELECT id FROM ids WHERE k = 'wb'), (SELECT id FROM ids WHERE k = 'jcap'))$$,
  'P0002', NULL, 'acknowledge_cancel cannot see a workspace A job'
);

-- A editörü B'nin işini göremez ve dokunamaz.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'jb'))
    + (SELECT count(*)::integer FROM public.production_workers WHERE id = (SELECT id FROM ids WHERE k = 'wb')),
  0, 'workspace A does not see workspace B''s job or machine'
);
SELECT extensions.throws_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'jb'))$$,
  'P0002', NULL, 'workspace A cannot cancel a workspace B job'
);

-- Sistem düzeyi: FK'ler alan sınırını aşamaz; alan bazlı geri alma diğer alana dokunmaz.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT extensions.throws_ok(
  $$INSERT INTO public.job_assets (job_id, asset_id, role)
    VALUES ((SELECT id FROM ids WHERE k = 'ja'), 'e2030000-0000-4000-8000-000000000001', 'input')$$,
  '23514', NULL, 'even the service role cannot link a workspace B asset to a workspace A job'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET worker_id = (SELECT id FROM ids WHERE k = 'wb') WHERE id = (SELECT id FROM ids WHERE k = 'jcap')$$,
  '23514', NULL, 'a job cannot be assigned to another workspace''s machine'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.jobs (module, kind, clip_source_id, workspace_id)
    SELECT 'clip', 'clip.cut', 'd2020000-0000-4000-8000-000000000001', b FROM ws$$,
  '23514', NULL, 'a job row cannot point at another workspace''s clip source'
);
INSERT INTO public.job_stages (job_id, seq, key, workspace_id)
SELECT (SELECT id FROM ids WHERE k = 'ja'), 2, 'ek', b FROM ws;
SELECT extensions.is(
  (SELECT workspace_id FROM public.job_stages WHERE job_id = (SELECT id FROM ids WHERE k = 'ja') AND key = 'ek'),
  (SELECT a FROM ws), 'a stage always takes the workspace of its job'
);
UPDATE public.jobs SET lease_expires_at = now() - interval '1 second'
WHERE id IN ((SELECT id FROM ids WHERE k = 'jcap'), (SELECT id FROM ids WHERE k = 'jb'));
SELECT extensions.is(
  private.reclaim_expired_jobs((SELECT b FROM ws)), 1, 'workspace-scoped reclaim touches only that workspace'
);
SELECT extensions.results_eq(
  $$SELECT k, j.status FROM ids JOIN public.jobs j ON j.id = ids.id WHERE k IN ('jcap', 'jb') ORDER BY k$$,
  $$VALUES ('jb'::text, 'queued'::text), ('jcap'::text, 'running'::text)$$,
  'workspace A''s expired job is untouched by workspace B''s reclaim'
);
UPDATE public.jobs SET lease_expires_at = now() + interval '60 seconds' WHERE id = (SELECT id FROM ids WHERE k = 'jcap');

-- ── Makine yetkisini kaldırma ───────────────────────────────────────────────
SET LOCAL ROLE authenticated;
-- Editor başkasının makinesini kaldıramaz.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e2"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.revoke_worker((SELECT id FROM ids WHERE k = 'w2'))$$,
  '42501', NULL, 'an editor cannot revoke another member''s machine'
);
-- Makine oturumu hiçbir makineyi kaldıramaz.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.revoke_worker((SELECT id FROM ids WHERE k = 'w2'))$$,
  '42501', NULL, 'a machine session cannot revoke machines'
);
-- Owner kaldırır: makinenin elindeki işin kirası hemen dolar.
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000e1"}', true);
SELECT extensions.is(
  (public.revoke_worker((SELECT id FROM ids WHERE k = 'w2'))).revoked_at, now(), 'owner revokes a machine'
);
SELECT extensions.is(
  (SELECT lease_expires_at FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'jcap')), now(),
  'the revoked machine''s lease ends immediately'
);
SELECT set_config('request.jwt.claim.sub', 'd2010000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2010000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e550000-0000-4000-8000-0000000000a2"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.worker_heartbeat((SELECT id FROM ids WHERE k = 'w2'))$$,
  '42501', NULL, 'a revoked machine can no longer call machine RPCs'
);
SELECT extensions.throws_ok(
  $$SELECT * FROM public.claim_job((SELECT id FROM ids WHERE k = 'w2'))$$,
  '42501', NULL, 'a revoked machine cannot claim'
);
SELECT extensions.throws_ok(
  $$SELECT public.register_worker('win-1', 'win32')$$,
  '42501', NULL, 'a revoked machine name cannot be re-registered'
);
-- İptal edilen makinenin oturumu makine oturumu olarak kalır: onay veremez.
SELECT extensions.throws_ok(
  $$SELECT public.approve_job_stage((SELECT id FROM ids WHERE k = 'ja'), 's')$$,
  '42501', NULL, 'a session that was ever registered as a machine never approves'
);
RESET ROLE;
SELECT extensions.is(private.reclaim_expired_jobs((SELECT a FROM ws)), 1, 'the revoked machine''s job is reclaimed');
SELECT extensions.is(
  (SELECT status FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'jcap')), 'queued',
  'and goes back to the queue for another machine'
);

-- Üye ekipten çıkınca makineleri silinir; işler kalır.
DELETE FROM public.team_members WHERE user_id = 'd2010000-0000-4000-8000-000000000004';
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.production_workers
   WHERE id IN ((SELECT id FROM ids WHERE k = 'w1'), (SELECT id FROM ids WHERE k = 'w2'))),
  0, 'removing a member removes the member''s machines'
);
SELECT extensions.results_eq(
  $$SELECT status, worker_id FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j2')$$,
  $$VALUES ('succeeded'::text, NULL::uuid)$$,
  'jobs survive; the machine reference is cleared'
);

SELECT * FROM extensions.finish();
ROLLBACK;
