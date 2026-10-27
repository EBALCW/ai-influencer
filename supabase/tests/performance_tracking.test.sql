BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(37);

-- Fixture (postgres rolüyle, RLS dışında). Seed'deki demo kayıtlardan bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('97000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pt-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('97000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pt-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('97000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pt-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('97000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pt-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('97000000-0000-4000-8000-000000000001', 'owner'),
  ('97000000-0000-4000-8000-000000000002', 'viewer'),
  ('97000000-0000-4000-8000-000000000003', 'editor');

INSERT INTO public.influencers (id, name, slug)
VALUES ('d1000000-0000-4000-8000-000000000001', 'Performans Test', 'performance-test');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle)
VALUES
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'instagram', 'pt_ig'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'tiktok', 'pt_tt');
INSERT INTO public.content_items (id, influencer_id, title, format, hook_type, checklist)
VALUES ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001',
  'Merak kancası', 'meme', 'merak', '{"hookScore":4,"engagementScore":3}');

-- Instagram: B1..B4 kıyas (24 sa 100/200/300/1000), T incelenen (13:00 İstanbul), L T'den sonra.
-- TikTok: X başka hesap; T'nin kıyasına girmemeli.
INSERT INTO public.posts (id, account_id, content_item_id, caption, published_at, duration_s, sound_type)
VALUES
  ('d6000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', NULL, 'B1', '2026-09-01T10:00:00Z', 8, NULL),
  ('d6000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', NULL, 'B2', '2026-09-02T10:00:00Z', 8, NULL),
  ('d6000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000001', NULL, 'B3', '2026-09-03T10:00:00Z', 8, NULL),
  ('d6000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000001', NULL, 'B4', '2026-09-04T10:00:00Z', 8, NULL),
  ('d6000000-0000-4000-8000-000000000010', 'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'T', '2026-09-05T10:00:00Z', 20, 'trend'),
  ('d6000000-0000-4000-8000-000000000011', 'd2000000-0000-4000-8000-000000000001', NULL, 'L', '2026-09-06T10:00:00Z', 8, NULL),
  ('d6000000-0000-4000-8000-000000000020', 'd2000000-0000-4000-8000-000000000002', NULL, 'X', '2026-09-04T12:00:00Z', 8, NULL);

INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, views, likes, comments, shares, saves, avg_watch_time_s)
VALUES
  ('d6000000-0000-4000-8000-000000000001', '2026-09-02T10:00:00Z', 24, 100, 0, 0, 0, 0, NULL),
  ('d6000000-0000-4000-8000-000000000002', '2026-09-03T10:00:00Z', 24, 200, 0, 0, 0, 0, NULL),
  ('d6000000-0000-4000-8000-000000000003', '2026-09-04T10:00:00Z', 24, 300, 0, 0, 0, 0, NULL),
  ('d6000000-0000-4000-8000-000000000004', '2026-09-05T10:00:00Z', 24, 1000, 0, 0, 0, 0, NULL),
  ('d6000000-0000-4000-8000-000000000020', '2026-09-05T12:00:00Z', 24, 99999, 0, 0, 0, 0, NULL),
  ('d6000000-0000-4000-8000-000000000011', '2026-09-07T10:00:00Z', 24, 5, 0, 0, 0, 0, NULL),
  -- T: 1 sa 120, 5 sa 260, 24 sa 900 (son ölçüm, etkileşim ile)
  ('d6000000-0000-4000-8000-000000000010', '2026-09-05T11:00:00Z', 1, 120, 0, 0, 0, 0, NULL),
  ('d6000000-0000-4000-8000-000000000010', '2026-09-05T15:00:00Z', 5, 260, 0, 0, 0, 0, NULL),
  ('d6000000-0000-4000-8000-000000000010', '2026-09-06T10:00:00Z', 24, 900, 60, 10, 20, 30, 9);

-- ── Şema ve yetkiler ──────────────────────────────────────────────────────
SELECT extensions.ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.post_performance(text, integer, integer)'::regprocedure),
  'post_performance is SECURITY INVOKER (RLS of the caller applies)'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.post_performance(text, integer, integer)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.post_performance(text, integer, integer)', 'EXECUTE'),
  'anon cannot execute post_performance; authenticated can'
);
SELECT extensions.has_column('public', 'posts', 'sound_type', 'posts.sound_type exists');
SELECT extensions.is(
  (SELECT column_default::text FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'actions'),
  '''{}''::text[]', 'reports.actions defaults to an empty array');
SELECT extensions.throws_ok(
  $$UPDATE public.posts SET sound_type = 'viral' WHERE id = 'd6000000-0000-4000-8000-000000000001'$$,
  '23514', NULL, 'unknown sound type is rejected');
SELECT extensions.throws_ok(
  $$INSERT INTO public.app_settings (key, value) VALUES ('other', '{}')$$,
  '23514', NULL, 'unknown app_settings key is still rejected');
SELECT extensions.ok(
  public.valid_report_actions(ARRAY['a', 'b', 'c'])
    AND public.valid_report_actions('{}'::text[])
    AND NOT public.valid_report_actions(ARRAY['a', 'b', 'c', 'd'])
    AND NOT public.valid_report_actions(ARRAY['   '])
    AND NOT public.valid_report_actions(ARRAY[repeat('x', 301)])
    AND NOT public.valid_report_actions(ARRAY[NULL::text]),
  'report actions: at most 3, each 1–300 characters, no blanks or NULLs'
);
SELECT extensions.ok(
  public.valid_analytics_settings('{"stuckViews":300,"stuckWithinHours":5,"viralMultiplier":3,"baselinePosts":10}')
    AND public.valid_analytics_settings('{"stuckViews":1,"stuckWithinHours":1,"viralMultiplier":1.5,"baselinePosts":3}')
    AND NOT public.valid_analytics_settings('{}')
    AND NOT public.valid_analytics_settings('{"stuckViews":"300","stuckWithinHours":5,"viralMultiplier":3,"baselinePosts":10}')
    AND NOT public.valid_analytics_settings('{"stuckViews":300.5,"stuckWithinHours":5,"viralMultiplier":3,"baselinePosts":10}')
    AND NOT public.valid_analytics_settings('{"stuckViews":300,"stuckWithinHours":24,"viralMultiplier":3,"baselinePosts":10}')
    AND NOT public.valid_analytics_settings('{"stuckViews":300,"stuckWithinHours":5,"viralMultiplier":1,"baselinePosts":10}')
    AND NOT public.valid_analytics_settings('{"stuckViews":300,"stuckWithinHours":5,"viralMultiplier":3,"baselinePosts":2}'),
  'analytics settings shape: numeric, stuckWithinHours 1|5, multiplier > 1, baseline 3–50'
);

-- ── Owner: eşikleri yazar ─────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
SELECT extensions.lives_ok(
  $$INSERT INTO public.app_settings (key, value)
    VALUES ('analytics', '{"stuckViews":250,"stuckWithinHours":5,"viralMultiplier":3,"baselinePosts":10}')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$,
  'owner saves analytics thresholds');
SELECT extensions.throws_ok(
  $$UPDATE public.app_settings SET value = '{"stuckViews":0}' WHERE key = 'analytics'$$,
  '23514', NULL, 'invalid analytics thresholds are rejected by CHECK');

-- ── post_performance ──────────────────────────────────────────────────────
SELECT set_config('test.pt', public.post_performance('performance-test', 10, 200)::text, true);
SELECT set_config('test.pt_k3', public.post_performance('performance-test', 3, 200)::text, true);

SELECT extensions.is((SELECT (v->>'totalPosts')::int FROM (SELECT current_setting('test.pt')::jsonb AS v) pt), 7, 'all published posts of the influencer are counted');
SELECT extensions.is(
  (SELECT array_agg(p->>'caption' ORDER BY ord) FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') WITH ORDINALITY AS e (p, ord)),
  ARRAY['L', 'T', 'X', 'B4', 'B3', 'B2', 'B1'], 'posts are listed newest first');
SELECT extensions.is((SELECT (p->>'views1')::int FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t), 120, '1 h checkpoint views');
SELECT extensions.is((SELECT (p->>'views5')::int FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t), 260, '5 h checkpoint views');
SELECT extensions.is((SELECT (p->>'views24')::int FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t), 900, '24 h checkpoint views');
SELECT extensions.is((SELECT (p->>'baselineMedian24')::numeric FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t), 250::numeric,
  'baseline = 24 h median of earlier posts on the same account (other account and later posts excluded)');
SELECT extensions.is((SELECT (p->>'baselineMeasured')::int FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t), 4, 'measured baseline posts');
SELECT extensions.is(
  (SELECT (p->>'baselineMedian24')::numeric FROM (SELECT current_setting('test.pt_k3')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p
   WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010'),
  300::numeric, 'baseline uses only the last k posts (k = 3: 200, 300, 1000)');
SELECT extensions.is((SELECT (v->>'baselinePosts')::int FROM (SELECT public.post_performance('performance-test', 1, 200) AS v) x), 3,
  'baseline size is clamped to at least 3');
SELECT extensions.ok(
  (SELECT p->'baselineMedian24' = 'null'::jsonb AND (p->>'baselineMeasured')::int = 0
   FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'caption' = 'B1'),
  'first post has no baseline (null, never zero)');
SELECT extensions.is((SELECT (p->>'checklistScore')::numeric FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t), 7::numeric,
  'checklist score = hook score + engagement score');
SELECT extensions.ok(
  (SELECT p->'checklistScore' = 'null'::jsonb FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'caption' = 'B1'),
  'post without content card has no checklist score');
SELECT extensions.is((SELECT (p->>'publishHour')::int FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t), 13, 'publish hour in the content time zone (Europe/Istanbul)');
SELECT extensions.results_eq(
  $$SELECT p->>'format', p->>'hookType', p->>'soundType', (p->>'durationS')::numeric FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t$$,
  $$VALUES ('meme'::text, 'merak'::text, 'trend'::text, 20::numeric)$$,
  'segment fields: format, hook type, sound type, duration');
SELECT extensions.results_eq(
  $$SELECT (p->'latest'->>'views')::int, (p->'latest'->>'shares')::int, (p->'latest'->>'saves')::int,
      (p->'latest'->>'avgWatchTimeS')::numeric, (p->'latest'->>'hours')::numeric FROM (SELECT p FROM (SELECT current_setting('test.pt')::jsonb AS v) pt, jsonb_array_elements(v->'posts') p WHERE p->>'id' = 'd6000000-0000-4000-8000-000000000010') t$$,
  $$VALUES (900, 20, 30, 9::numeric, 24::numeric)$$,
  'latest snapshot is returned for computed rates');
SELECT extensions.is(
  (SELECT jsonb_array_length(v->'posts') FROM (SELECT public.post_performance('performance-test', 10, 2) AS v) x), 2,
  'limit caps the listed posts');
SELECT extensions.is((SELECT (public.post_performance('olmayan-slug')->>'validInfluencer')::boolean), false,
  'unknown influencer slug is reported');

-- ── Editor: ses türü ve haftalık aksiyonlar ───────────────────────────────
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000003', true);
SELECT extensions.isnt_empty(
  $$UPDATE public.posts SET sound_type = 'original' WHERE id = 'd6000000-0000-4000-8000-000000000001' RETURNING id$$,
  'editor sets the sound type');
SELECT extensions.throws_ok(
  $$INSERT INTO public.app_settings (key, value)
    VALUES ('analytics', '{"stuckViews":1,"stuckWithinHours":1,"viralMultiplier":2,"baselinePosts":3}')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value$$,
  '42501', NULL, 'editor cannot change analytics thresholds');
SELECT public.generate_weekly_report('2026-09-07', 'd1000000-0000-4000-8000-000000000001');
SELECT extensions.isnt_empty(
  $$UPDATE public.reports SET actions = ARRAY['Merak kancasını 3 varyasyonla dene']
    WHERE influencer_id = 'd1000000-0000-4000-8000-000000000001' AND period_start = '2026-09-07' RETURNING id$$,
  'editor writes next-week actions');
SELECT extensions.throws_ok(
  $$UPDATE public.reports SET actions = ARRAY['a', 'b', 'c', 'd']
    WHERE influencer_id = 'd1000000-0000-4000-8000-000000000001'$$,
  '23514', NULL, 'more than 3 actions are rejected');
SELECT public.generate_weekly_report('2026-09-07', 'd1000000-0000-4000-8000-000000000001');
SELECT extensions.is(
  (SELECT actions FROM public.reports WHERE influencer_id = 'd1000000-0000-4000-8000-000000000001' AND period_start = '2026-09-07'),
  ARRAY['Merak kancasını 3 varyasyonla dene'], 'regenerating the report keeps the actions');

-- ── Viewer ve ekip dışı ───────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true);
SELECT extensions.is_empty(
  $$UPDATE public.posts SET sound_type = 'trend' WHERE id = 'd6000000-0000-4000-8000-000000000002' RETURNING id$$,
  'viewer cannot set the sound type');
SELECT extensions.is_empty(
  $$UPDATE public.reports SET actions = '{}' WHERE influencer_id = 'd1000000-0000-4000-8000-000000000001' RETURNING id$$,
  'viewer cannot change report actions');
SELECT extensions.is((SELECT (public.post_performance('performance-test')->>'totalPosts')::int), 7,
  'viewer can read post performance');

SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000004', true);
SELECT extensions.is((SELECT jsonb_array_length(public.post_performance(NULL)->'posts')), 0,
  'outsider sees no posts');
SELECT extensions.is_empty(
  $$UPDATE public.posts SET sound_type = 'trend' RETURNING id$$,
  'outsider cannot set the sound type');

SELECT * FROM extensions.finish();
ROLLBACK;
