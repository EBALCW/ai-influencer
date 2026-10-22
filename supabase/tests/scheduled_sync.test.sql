-- #53 Zamanlanmış senkronizasyon: due_snapshots zamanlaması, target_hours idempotency,
-- sync_runs RLS + uyarı, manuel tetikleme yetkisi/kısıtlaması, pg_cron işleri.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(52);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
  ('a5300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sync-owner@example.invalid', '', now(), now()),
  ('a5300000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sync-editor@example.invalid', '', now(), now()),
  ('a5300000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sync-viewer@example.invalid', '', now(), now()),
  ('a5300000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'sync-outsider@example.invalid', '', now(), now());
INSERT INTO public.team_members (user_id, role) VALUES
  ('a5300000-0000-4000-8000-000000000001', 'owner'),
  ('a5300000-0000-4000-8000-000000000002', 'editor'),
  ('a5300000-0000-4000-8000-000000000003', 'viewer');

INSERT INTO public.influencers (id, name, slug)
VALUES ('a5310000-0000-4000-8000-000000000001', 'Sync fixture', 'sync-fixture');
-- a1: bağlı (token_ref var), a2: iptal edilmiş, a3: bağlı değil (token yok), a4: viral testi
INSERT INTO public.social_accounts (id, influencer_id, platform, handle, external_id, token_ref, status) VALUES
  ('a5320000-0000-4000-8000-000000000001', 'a5310000-0000-4000-8000-000000000001', 'instagram', 'sync-a1', 'ext-a1', 'ref-a1', 'active'),
  ('a5320000-0000-4000-8000-000000000002', 'a5310000-0000-4000-8000-000000000001', 'youtube', 'sync-a2', 'ext-a2', 'ref-a2', 'revoked'),
  ('a5320000-0000-4000-8000-000000000003', 'a5310000-0000-4000-8000-000000000001', 'tiktok', 'sync-a3', 'ext-a3', NULL, 'active'),
  ('a5320000-0000-4000-8000-000000000004', 'a5310000-0000-4000-8000-000000000001', 'youtube', 'sync-a4', 'ext-a4', 'ref-a4', 'active');

-- Sabit referans zamanı T = 2026-01-10 12:00 UTC (testler now()'a bağlı değil).
INSERT INTO public.posts (id, account_id, external_id, published_at) VALUES
  ('a5330000-0000-4000-8000-000000000001', 'a5320000-0000-4000-8000-000000000001', 'p1', '2026-01-10 12:00:00+00'),
  ('a5330000-0000-4000-8000-000000000002', 'a5320000-0000-4000-8000-000000000001', NULL, '2026-01-10 12:00:00+00'),
  ('a5330000-0000-4000-8000-000000000003', 'a5320000-0000-4000-8000-000000000002', 'p3', '2026-01-10 12:00:00+00'),
  ('a5330000-0000-4000-8000-000000000004', 'a5320000-0000-4000-8000-000000000003', 'p4', '2026-01-10 12:00:00+00');

CREATE TEMP TABLE fixture_posts ON COMMIT DROP AS
  SELECT id FROM public.posts WHERE id::text LIKE 'a5330000-%';
GRANT SELECT ON fixture_posts TO service_role;

-- ── Yapı ────────────────────────────────────────────────────────────────────
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sync_runs'::regclass),
  'sync_runs has RLS enabled'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM pg_constraint WHERE conname IN (
    'posts_account_external_id_key', 'social_accounts_platform_external_id_key',
    'metric_snapshots_post_target_hours_key') AND contype = 'u'),
  3, 'upsert targets are plain UNIQUE constraints (supabase-js onConflict works)'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.posts (account_id, external_id) VALUES ('a5320000-0000-4000-8000-000000000001', 'p1')$$,
  '23505', NULL, 'posts stay unique per (account_id, external_id)'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.posts (account_id, external_id) VALUES
    ('a5320000-0000-4000-8000-000000000001', NULL), ('a5320000-0000-4000-8000-000000000001', NULL)$$,
  'posts without external_id still do not conflict'
);
SELECT extensions.is(
  (SELECT array_agg(jobname ORDER BY jobname) FROM cron.job WHERE jobname LIKE 'sync-%'),
  ARRAY['sync-accounts', 'sync-maintenance', 'sync-metrics', 'sync-posts']::text[],
  'sync jobs are registered in pg_cron'
);
SELECT extensions.is(
  (SELECT schedule FROM cron.job WHERE jobname = 'sync-metrics'), '*/15 * * * *',
  'metric snapshots are checked every 15 minutes'
);
SELECT extensions.ok(
  (SELECT bool_and(command NOT LIKE '%http%' AND command NOT LIKE '%secret%') FROM cron.job WHERE jobname LIKE 'sync-%'),
  'cron commands contain no URL or secret'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.due_snapshots(timestamptz, integer, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.due_snapshots(timestamptz, integer, uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.due_snapshots(timestamptz, integer, uuid)', 'EXECUTE'),
  'due_snapshots is only callable by service_role'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.request_sync(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.request_sync(uuid)', 'EXECUTE'),
  'request_sync is callable by signed-in users only'
);
SELECT extensions.ok(
  (SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=""']) FROM pg_proc
   WHERE oid IN ('public.request_sync(uuid)'::regprocedure, 'private.invoke_sync(text, uuid)'::regprocedure,
                 'private.maintain_sync_runs(timestamptz)'::regprocedure, 'private.sync_runs_failed_alert()'::regprocedure)),
  'sync definer functions use an empty search_path'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'private.sync_requests', 'SELECT'),
  'manual request log is not readable by API roles'
);

-- ── due_snapshots: 1s/5s/24s/72s/7g, ±15 dk ─────────────────────────────────
CREATE FUNCTION pg_temp.due_targets(p_at timestamptz)
RETURNS integer[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(d.target_hours::integer ORDER BY d.target_hours), '{}')
  FROM public.due_snapshots(p_at) d WHERE d.post_id IN (SELECT id FROM fixture_posts)
$$;

SELECT extensions.is(pg_temp.due_targets('2026-01-10 12:59:00+00'), '{}'::integer[], 'nothing due before 1 hour');
SELECT extensions.is(pg_temp.due_targets('2026-01-10 13:00:00+00'), ARRAY[1], '1h snapshot due exactly at 1 hour');
SELECT extensions.is(pg_temp.due_targets('2026-01-10 13:14:00+00'), ARRAY[1], '1h snapshot still due within the 15 min cron tolerance');
SELECT extensions.is(pg_temp.due_targets('2026-01-10 14:00:00+00'), '{}'::integer[], 'missed 1h window is not mislabeled later');
SELECT extensions.is(pg_temp.due_targets('2026-01-10 17:10:00+00'), ARRAY[5], '5h snapshot due');
SELECT extensions.is(pg_temp.due_targets('2026-01-11 12:15:00+00'), ARRAY[24], '24h snapshot due');
SELECT extensions.is(pg_temp.due_targets('2026-01-13 12:00:00+00'), ARRAY[72], '72h snapshot due');
SELECT extensions.is(pg_temp.due_targets('2026-01-17 12:05:00+00'), ARRAY[168], '7 day snapshot due');
SELECT extensions.is(pg_temp.due_targets('2026-01-18 21:00:00+00'), '{}'::integer[], 'nothing due after the last window');
SELECT extensions.results_eq(
  $$SELECT post_id, account_id, external_id, due_at FROM public.due_snapshots('2026-01-10 13:05:00+00')
    WHERE post_id IN (SELECT id FROM fixture_posts)$$,
  $$VALUES ('a5330000-0000-4000-8000-000000000001'::uuid, 'a5320000-0000-4000-8000-000000000001'::uuid,
            'p1'::text, '2026-01-10 13:00:00+00'::timestamptz)$$,
  'only connected accounts with external ids are due (revoked, tokenless and id-less skipped)'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.due_snapshots('2026-01-10 13:05:00+00', 500, 'a5320000-0000-4000-8000-000000000004')),
  0, 'account filter limits the due list'
);

-- Snapshot yazılınca o hedef artık due değil; aynı hedef ikinci kez yazılamaz.
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, target_hours, views)
VALUES ('a5330000-0000-4000-8000-000000000001', '2026-01-10 13:05:00+00', 1.08, 1, 40);
SELECT extensions.is(pg_temp.due_targets('2026-01-10 13:10:00+00'), '{}'::integer[], 'captured target is no longer due');
SELECT extensions.throws_ok(
  $$INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, target_hours, views)
    VALUES ('a5330000-0000-4000-8000-000000000001', '2026-01-10 13:20:00+00', 1.33, 1, 41)$$,
  '23505', NULL, 'same post + target_hours cannot be written twice (cron re-run/late run)'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.metric_snapshots (post_id, captured_at, views) VALUES
    ('a5330000-0000-4000-8000-000000000001', '2026-01-10 15:00:00+00', 50),
    ('a5330000-0000-4000-8000-000000000001', '2026-01-10 16:00:00+00', 60)$$,
  'ad-hoc snapshots (target_hours NULL) are not limited'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.metric_snapshots (post_id, captured_at, target_hours) VALUES
    ('a5330000-0000-4000-8000-000000000001', '2026-01-10 18:00:00+00', 6)$$,
  '23514', NULL, 'unknown target_hours is rejected'
);

-- #55 kontrol noktası: target_hours'lu satır pencere dışında alınmış olsa da o noktaya sayılır.
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, target_hours, views)
VALUES ('a5330000-0000-4000-8000-000000000001', '2026-01-11 19:00:00+00', 31, 24, 500);
SELECT extensions.results_eq(
  $$SELECT target_hours, views FROM public.post_checkpoint_views(ARRAY['a5330000-0000-4000-8000-000000000001'::uuid])
    ORDER BY target_hours$$,
  $$VALUES (1, 40::bigint), (24, 500::bigint)$$,
  'post_checkpoint_views prefers scheduled snapshots and keeps the window rule for ad-hoc rows'
);

-- #56 viral: zamanlanmış 1. saat snapshot'ı (hours > 1) da viral kuralını tetikler.
INSERT INTO public.posts (id, account_id, external_id, published_at) VALUES
  ('a5340000-0000-4000-8000-000000000001', 'a5320000-0000-4000-8000-000000000004', 'v1', '2026-01-01 10:00:00+00'),
  ('a5340000-0000-4000-8000-000000000002', 'a5320000-0000-4000-8000-000000000004', 'v2', '2026-01-02 10:00:00+00'),
  ('a5340000-0000-4000-8000-000000000003', 'a5320000-0000-4000-8000-000000000004', 'v3', '2026-01-03 10:00:00+00'),
  ('a5340000-0000-4000-8000-000000000004', 'a5320000-0000-4000-8000-000000000004', 'v4', '2026-01-04 10:00:00+00');
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, target_hours, views) VALUES
  ('a5340000-0000-4000-8000-000000000001', '2026-01-01 11:05:00+00', 1.08, 1, 100),
  ('a5340000-0000-4000-8000-000000000002', '2026-01-02 11:05:00+00', 1.08, 1, 100),
  ('a5340000-0000-4000-8000-000000000003', '2026-01-03 11:05:00+00', 1.08, 1, 100),
  ('a5340000-0000-4000-8000-000000000004', '2026-01-04 11:05:00+00', 1.08, 1, 1000);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE dedupe_key = 'viral_post:a5340000-0000-4000-8000-000000000004'),
  1, 'scheduled 1h snapshot raises the viral alert'
);

-- ── sync_runs: yetki ────────────────────────────────────────────────────────
SET LOCAL ROLE service_role;
INSERT INTO public.sync_runs (id, job, platform, account_id) VALUES
  ('a5350000-0000-4000-8000-000000000001', 'metrics', 'instagram', 'a5320000-0000-4000-8000-000000000001');
UPDATE public.sync_runs SET status = 'succeeded', processed_count = 3
WHERE id = 'a5350000-0000-4000-8000-000000000001';
RESET ROLE;
SELECT extensions.ok(
  (SELECT finished_at IS NOT NULL FROM public.sync_runs WHERE id = 'a5350000-0000-4000-8000-000000000001'),
  'closing a run stamps finished_at with the database clock'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.sync_runs (job, status) VALUES ('metrics', 'bogus')$$,
  '23514', NULL, 'unknown run status is rejected'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a5300000-0000-4000-8000-000000000003', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.sync_runs WHERE id = 'a5350000-0000-4000-8000-000000000001'),
  1, 'viewer reads the sync log'
);
SELECT set_config('request.jwt.claim.sub', 'a5300000-0000-4000-8000-000000000004', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.sync_runs), 0, 'outsider sees no sync runs'
);
SELECT set_config('request.jwt.claim.sub', 'a5300000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$INSERT INTO public.sync_runs (job) VALUES ('manual')$$,
  '42501', NULL, 'editor cannot write sync runs (service role only)'
);
SELECT extensions.throws_ok(
  $$UPDATE public.sync_runs SET status = 'failed'$$,
  '42501', NULL, 'editor cannot alter sync runs'
);
SELECT extensions.throws_ok(
  $$DELETE FROM public.sync_runs$$,
  '42501', NULL, 'editor cannot delete sync runs'
);
SELECT set_config('request.jwt.claim.sub', 'a5300000-0000-4000-8000-000000000001', true);
SELECT extensions.throws_ok(
  $$INSERT INTO public.sync_runs (job) VALUES ('manual')$$,
  '42501', NULL, 'owner cannot write sync runs either'
);
RESET ROLE;

-- ── Başarısız iş → sync_failed uyarısı (hesap/gün başına bir) ─────────────────
SET LOCAL ROLE service_role;
INSERT INTO public.sync_runs (id, job, platform, account_id) VALUES
  ('a5350000-0000-4000-8000-000000000002', 'posts', 'instagram', 'a5320000-0000-4000-8000-000000000001'),
  ('a5350000-0000-4000-8000-000000000003', 'accounts', 'instagram', 'a5320000-0000-4000-8000-000000000001');
UPDATE public.sync_runs SET status = 'failed', error = 'PermanentError: 400'
WHERE id = 'a5350000-0000-4000-8000-000000000002';
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT influencer_id, payload ->> 'platform', payload ->> 'job', payload ->> 'sync_run_id' FROM public.alerts
    WHERE dedupe_key = 'sync_failed:a5320000-0000-4000-8000-000000000001:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')$$,
  $$VALUES ('a5310000-0000-4000-8000-000000000001'::uuid, 'instagram'::text, 'posts'::text,
            'a5350000-0000-4000-8000-000000000002'::text)$$,
  'failed run raises a sync_failed alert'
);
SET LOCAL ROLE service_role;
UPDATE public.sync_runs SET status = 'failed' WHERE id = 'a5350000-0000-4000-8000-000000000003';
UPDATE public.social_accounts SET status = 'error' WHERE id = 'a5320000-0000-4000-8000-000000000001';
RESET ROLE;
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE type = 'sync_failed'
   AND payload ->> 'account_id' = 'a5320000-0000-4000-8000-000000000001'),
  1, 'repeated failures and token error on the same day raise one alert'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE dedupe_key LIKE 'sync_failed:a5320000-0000-4000-8000-000000000004:%'),
  0, 'successful runs raise no alert'
);
UPDATE public.social_accounts SET status = 'active' WHERE id = 'a5320000-0000-4000-8000-000000000001';

-- Fonksiyon süre sınırında öldürülürse satır running'de kalmaz.
INSERT INTO public.sync_runs (id, job, account_id, started_at) VALUES
  ('a5350000-0000-4000-8000-000000000004', 'metrics', 'a5320000-0000-4000-8000-000000000004', now() - interval '2 hours'),
  ('a5350000-0000-4000-8000-000000000005', 'metrics', 'a5320000-0000-4000-8000-000000000004', now() - interval '10 minutes');
SELECT extensions.is(private.maintain_sync_runs(now()), 1, 'maintenance closes only stale running rows');
SELECT extensions.results_eq(
  $$SELECT status FROM public.sync_runs WHERE id IN ('a5350000-0000-4000-8000-000000000004',
    'a5350000-0000-4000-8000-000000000005') ORDER BY id$$,
  $$VALUES ('failed'::text), ('running'::text)$$,
  'stale run marked failed, fresh run untouched'
);

-- ── Edge Function çağrısı ve manuel tetikleme ─────────────────────────────────
SELECT extensions.throws_ok(
  $$SELECT private.invoke_sync('everything')$$, '22023', NULL, 'unknown job is rejected'
);
SELECT extensions.is(
  private.invoke_sync('metrics'), NULL::bigint, 'without Vault secrets the cron call is a silent no-op'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a5300000-0000-4000-8000-000000000003', true);
SELECT extensions.throws_ok(
  $$SELECT public.request_sync()$$, '42501', NULL, 'viewer cannot trigger a sync'
);
SELECT set_config('request.jwt.claim.sub', 'a5300000-0000-4000-8000-000000000004', true);
SELECT extensions.throws_ok(
  $$SELECT public.request_sync()$$, '42501', NULL, 'outsider cannot trigger a sync'
);
SELECT set_config('request.jwt.claim.sub', 'a5300000-0000-4000-8000-000000000002', true);
SELECT extensions.is(public.request_sync(), 'not_configured', 'editor gets not_configured without Vault secrets');
SELECT extensions.is(
  public.request_sync('a5320000-0000-4000-8000-000000000002'), 'not_found',
  'revoked account cannot be synced'
);
RESET ROLE;

SELECT vault.create_secret('http://kong:8000/', 'project_url');
SELECT vault.create_secret('fixture-cron-secret', 'cron_secret');
CREATE TEMP TABLE sync_queue_before ON COMMIT DROP AS SELECT coalesce(max(id), 0) AS id FROM net.http_request_queue;
GRANT SELECT ON sync_queue_before TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a5300000-0000-4000-8000-000000000002', true);
SELECT extensions.is(
  public.request_sync('a5320000-0000-4000-8000-000000000001'), 'queued', 'editor queues a manual sync'
);
SELECT extensions.is(
  public.request_sync('a5320000-0000-4000-8000-000000000001'), 'throttled', 'repeated click within 2 minutes is throttled'
);
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT url, convert_from(body, 'UTF8')::jsonb FROM net.http_request_queue
    WHERE id > (SELECT id FROM sync_queue_before)$$,
  $$VALUES ('http://kong:8000/functions/v1/sync-dispatch'::text,
            '{"job": "manual", "account_id": "a5320000-0000-4000-8000-000000000001"}'::jsonb)$$,
  'one async request to sync-dispatch with the job body'
);
SELECT extensions.is(
  (SELECT headers ->> 'x-cron-secret' FROM net.http_request_queue WHERE id > (SELECT id FROM sync_queue_before)),
  'fixture-cron-secret', 'request is authenticated with the Vault cron secret'
);
SELECT extensions.results_eq(
  $$SELECT requested_by FROM private.sync_requests$$,
  $$VALUES ('a5300000-0000-4000-8000-000000000002'::uuid)$$,
  'manual request records who triggered it'
);

SELECT * FROM extensions.finish();
ROLLBACK;
