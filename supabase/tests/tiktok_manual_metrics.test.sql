-- #52 TikTok toplayıcı + elle metrik girişi: account_snapshots.total_likes,
-- metric_snapshots.source, record_manual_metrics() yetki/çakışma kuralları ve
-- elle girilen noktanın sync'te ezilmemesi.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(26);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
  ('a5240000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'tt-editor@example.invalid', '', now(), now()),
  ('a5240000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'tt-viewer@example.invalid', '', now(), now()),
  ('a5240000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'tt-outsider@example.invalid', '', now(), now());
INSERT INTO public.team_members (user_id, role) VALUES
  ('a5240000-0000-4000-8000-000000000001', 'editor'),
  ('a5240000-0000-4000-8000-000000000002', 'viewer');

INSERT INTO public.influencers (id, name, slug)
VALUES ('a5241000-0000-4000-8000-000000000001', 'TikTok fixture', 'tiktok-fixture');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle, external_id, token_ref, status) VALUES
  ('a5242000-0000-4000-8000-000000000001', 'a5241000-0000-4000-8000-000000000001', 'tiktok', '@tt-fixture', 'open-id-fixture', 'ref-tt', 'active');
-- p1: elle girilecek; p2: aynı noktada API ölçümü var; p3: yayın zamanı yok; p4: yeni yayın (gelecek nokta)
INSERT INTO public.posts (id, account_id, external_id, published_at) VALUES
  ('a5243000-0000-4000-8000-000000000001', 'a5242000-0000-4000-8000-000000000001', 'v1', '2026-01-10 12:00:00+00'),
  ('a5243000-0000-4000-8000-000000000002', 'a5242000-0000-4000-8000-000000000001', 'v2', '2026-01-10 12:00:00+00'),
  ('a5243000-0000-4000-8000-000000000003', 'a5242000-0000-4000-8000-000000000001', NULL, NULL),
  ('a5243000-0000-4000-8000-000000000004', 'a5242000-0000-4000-8000-000000000001', 'v4', now() - interval '30 minutes');
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, target_hours, views, likes, comments, shares, saves)
VALUES ('a5243000-0000-4000-8000-000000000002', '2026-01-11 12:05:00+00', 24.08, 24, 5000, 400, 20, 10, 0);

-- ── Yapı ────────────────────────────────────────────────────────────────────
SELECT extensions.has_column('public', 'account_snapshots', 'total_likes', 'account_snapshots has total_likes');
SELECT extensions.lives_ok(
  $$INSERT INTO public.account_snapshots (account_id, captured_at, followers, media_count, total_likes)
    VALUES ('a5242000-0000-4000-8000-000000000001', '2026-01-10 00:00:00+00', 12840, 64, 456789)$$,
  'TikTok account snapshot with total likes is stored'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.account_snapshots (account_id, captured_at, followers, total_likes)
    VALUES ('a5242000-0000-4000-8000-000000000001', '2026-01-11 00:00:00+00', 1, -1)$$,
  '23514', NULL, 'negative total_likes is rejected'
);
SELECT extensions.is(
  (SELECT column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'metric_snapshots' AND column_name = 'source'),
  '''api''::text', 'metric_snapshots.source defaults to api'
);
SELECT extensions.ok(
  (SELECT source IN ('api') FROM public.metric_snapshots WHERE post_id = 'a5243000-0000-4000-8000-000000000002'),
  'collector rows get the default source'
);
SELECT extensions.throws_ok(
  $$UPDATE public.metric_snapshots SET source = 'excel' WHERE post_id = 'a5243000-0000-4000-8000-000000000002'$$,
  '23514', NULL, 'unknown source is rejected'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.record_manual_metrics(uuid, bigint, bigint, bigint, bigint, smallint, bigint, bigint, numeric, numeric)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.record_manual_metrics(uuid, bigint, bigint, bigint, bigint, smallint, bigint, bigint, numeric, numeric)', 'EXECUTE'),
  'record_manual_metrics: anon cannot execute, authenticated can'
);

SET LOCAL ROLE authenticated;

-- ── Viewer ve ekip dışı yazamaz ─────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'a5240000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a5243000-0000-4000-8000-000000000001', 100, 10, 1, 1, 24::smallint)$$,
  '42501', NULL, 'viewer cannot record manual metrics'
);
SELECT set_config('request.jwt.claim.sub', 'a5240000-0000-4000-8000-000000000003', true);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a5243000-0000-4000-8000-000000000001', 100, 10, 1, 1, 24::smallint)$$,
  '42501', NULL, 'outsider cannot record manual metrics'
);

-- ── Editor ──────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'a5240000-0000-4000-8000-000000000001', true);
SELECT extensions.is(
  (public.record_manual_metrics('a5243000-0000-4000-8000-000000000001', 1200, 90, 7, 3, 24::smallint, NULL, NULL, 8.5, 0.42))->>'status',
  'created', 'editor records a manual 24 h checkpoint'
);
SELECT extensions.results_eq(
  $$SELECT source, target_hours::int, captured_at, hours_since_publish, views, saves, avg_watch_time_s, completion_rate, created_by
    FROM public.metric_snapshots WHERE post_id = 'a5243000-0000-4000-8000-000000000001'$$,
  $$VALUES ('manual'::text, 24, '2026-01-11 12:00:00+00'::timestamptz, 24.00::numeric(10,2), 1200::bigint, 0::bigint,
     8.500::numeric(10,3), 0.42000::numeric(6,5), 'a5240000-0000-4000-8000-000000000001'::uuid)$$,
  'manual row sits at published_at + target, source manual, created_by from session'
);
SELECT extensions.is(
  (SELECT raw_payload->'_unmeasured' FROM public.metric_snapshots WHERE post_id = 'a5243000-0000-4000-8000-000000000001'),
  '["saves"]'::jsonb, 'blank saves is stored as 0 and marked unmeasured'
);
SELECT extensions.is(
  (public.record_manual_metrics('a5243000-0000-4000-8000-000000000001', 1300, 95, 8, 4, 24::smallint, 2))->>'status',
  'updated', 'a manual checkpoint can be corrected'
);
SELECT extensions.results_eq(
  $$SELECT count(*)::int, max(views), max(saves) FROM public.metric_snapshots WHERE post_id = 'a5243000-0000-4000-8000-000000000001'$$,
  $$VALUES (1, 1300::bigint, 2::bigint)$$,
  'correction updates the same row (no duplicate)'
);
SELECT extensions.is(
  (public.record_manual_metrics('a5243000-0000-4000-8000-000000000002', 1, 1, 1, 1, 24::smallint))->>'status',
  'conflict', 'manual entry does not overwrite an API checkpoint'
);
SELECT extensions.results_eq(
  $$SELECT views, source FROM public.metric_snapshots WHERE post_id = 'a5243000-0000-4000-8000-000000000002'$$,
  $$VALUES (5000::bigint, 'api'::text)$$,
  'API checkpoint is unchanged after conflict'
);
SELECT extensions.is(
  (public.record_manual_metrics('a5243000-0000-4000-8000-000000000002', 6000, 450, 25, 12, NULL))->>'status',
  'created', 'ad-hoc manual measurement (no checkpoint) is always added'
);
SELECT extensions.ok(
  (SELECT target_hours IS NULL AND source = 'manual' AND hours_since_publish > 24
     FROM public.metric_snapshots WHERE post_id = 'a5243000-0000-4000-8000-000000000002' AND target_hours IS NULL),
  'ad-hoc manual row has no checkpoint and real elapsed hours'
);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a5243000-0000-4000-8000-000000000001', 1, 1, 1, 1, 6::smallint)$$,
  '22023', NULL, 'invalid checkpoint is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a5243000-0000-4000-8000-000000000003', 1, 1, 1, 1, 1::smallint)$$,
  '22023', NULL, 'checkpoint needs a published post'
);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a5243000-0000-4000-8000-000000000004', 1, 1, 1, 1, 24::smallint)$$,
  '22023', NULL, 'future checkpoint is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a5243000-0000-4000-8000-0000000000ff', 1, 1, 1, 1, 24::smallint)$$,
  'P0002', NULL, 'missing post is reported'
);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a5243000-0000-4000-8000-000000000001', -1, 1, 1, 1, 1::smallint)$$,
  '23514', NULL, 'negative counter is rejected by the table check'
);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a5243000-0000-4000-8000-000000000001', 1, 1, 1, 1, 1::smallint, NULL, NULL, NULL, 1.5)$$,
  '23514', NULL, 'completion rate above 1 is rejected'
);

RESET ROLE;

-- ── Sync elle girilen noktayı ezmez ─────────────────────────────────────────
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.due_snapshots('2026-01-11 12:15:00+00', 500, 'a5242000-0000-4000-8000-000000000001')
    WHERE post_id = 'a5243000-0000-4000-8000-000000000001' AND target_hours = 24
  ),
  'manually measured checkpoint is not due for the collector'
);
-- Orkestratör (supabase-store) ile aynı yazım: ON CONFLICT (post_id, target_hours) DO NOTHING.
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, target_hours, views, likes, comments, shares, saves)
VALUES ('a5243000-0000-4000-8000-000000000001', '2026-01-11 12:10:00+00', 24.17, 24, 99999, 1, 1, 1, 1)
ON CONFLICT (post_id, target_hours) DO NOTHING;
SELECT extensions.results_eq(
  $$SELECT views, source FROM public.metric_snapshots WHERE post_id = 'a5243000-0000-4000-8000-000000000001' AND target_hours = 24$$,
  $$VALUES (1300::bigint, 'manual'::text)$$,
  'collector write does not overwrite the manual checkpoint'
);

SELECT * FROM extensions.finish();
ROLLBACK;
