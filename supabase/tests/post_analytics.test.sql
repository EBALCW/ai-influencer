BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(38);

-- Fixture (postgres rolüyle, RLS dışında). Seed'deki demo kayıtlardan bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('92000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pa-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pa-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pa-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pa-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('92000000-0000-4000-8000-000000000001', 'owner'),
  ('92000000-0000-4000-8000-000000000002', 'viewer'),
  ('92000000-0000-4000-8000-000000000003', 'editor');

INSERT INTO public.influencers (id, name, slug)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'Analitik Test', 'analytics-test'),
  ('b1000000-0000-4000-8000-000000000002', 'Analitik Diğer', 'analytics-other');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle)
VALUES
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'instagram', 'pa_ig'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'instagram', 'pa_other');

INSERT INTO public.content_items (id, influencer_id, title, format, hook_type)
VALUES ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Soru kancası', 'short_video', 'soru');
INSERT INTO public.prompts (id, influencer_id, category, key, title, body)
VALUES ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'video2video', 'pa', 'Analitik prompt', 'Bir video');
INSERT INTO public.generations (id, influencer_id, prompt_id, tool, type)
VALUES ('b5000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'mock', 'video');
INSERT INTO public.content_item_assets (content_item_id, generation_id)
VALUES ('b3000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001');

-- B1..B4: kıyas grubu (13:00 İstanbul = öğleden sonra). T: incelenen post (06:00 = sabah).
-- B5: T'den SONRA yayınlandı, kıyas grubuna girmemeli.
INSERT INTO public.posts (id, account_id, content_item_id, published_at, duration_s)
VALUES
  ('b6000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', '2026-09-01T10:00:00Z', NULL),
  ('b6000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', '2026-09-02T10:00:00Z', NULL),
  ('b6000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', NULL, '2026-09-03T10:00:00Z', NULL),
  ('b6000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000001', NULL, '2026-09-04T10:00:00Z', NULL),
  ('b6000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000001', NULL, '2026-09-06T10:00:00Z', NULL),
  ('b6000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', '2026-09-05T03:00:00Z', 12);

INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, views)
VALUES
  -- 1 sa: 10, 20, 30 -> medyan 20 (tek sayı)
  ('b6000000-0000-4000-8000-000000000001', '2026-09-01T11:00:00Z', 1, 10),
  ('b6000000-0000-4000-8000-000000000002', '2026-09-02T11:00:00Z', 1, 20),
  ('b6000000-0000-4000-8000-000000000003', '2026-09-03T11:00:00Z', 1, 30),
  -- 24 sa: 100, 200, 300, 1000 -> medyan 250 (çift sayı), ortalama 400
  ('b6000000-0000-4000-8000-000000000001', '2026-09-02T10:00:00Z', 24, 100),
  ('b6000000-0000-4000-8000-000000000002', '2026-09-03T10:00:00Z', 24, 200),
  ('b6000000-0000-4000-8000-000000000003', '2026-09-04T10:00:00Z', 24, 300),
  ('b6000000-0000-4000-8000-000000000004', '2026-09-05T10:00:00Z', 24, 1000),
  ('b6000000-0000-4000-8000-000000000005', '2026-09-07T10:00:00Z', 24, 9999),
  -- T: 1.5 sa, saat bilgisi olmayan 5.5 sa (captured_at'ten), pencere dışı 23 sa, 25 sa
  ('b6000000-0000-4000-8000-000000000010', '2026-09-05T04:30:00Z', 1.5, 5),
  ('b6000000-0000-4000-8000-000000000010', '2026-09-05T08:30:00Z', NULL, 8),
  ('b6000000-0000-4000-8000-000000000010', '2026-09-06T02:00:00Z', 23, 40),
  ('b6000000-0000-4000-8000-000000000010', '2026-09-06T04:00:00Z', 25, 50);

SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.learnings'::regclass),
  'learnings has row-level security enabled'
);
SELECT extensions.ok(
  NOT (SELECT bool_or(prosecdef) FROM pg_proc WHERE oid IN (
    'public.post_analytics(uuid, integer)'::regprocedure,
    'public.post_segments(text, integer)'::regprocedure,
    'public.post_checkpoint_views(uuid[])'::regprocedure
  )),
  'analytics functions are SECURITY INVOKER (RLS of the caller applies)'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.post_analytics(uuid, integer)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.post_segments(text, integer)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.post_checkpoint_views(uuid[])', 'EXECUTE'),
  'anon cannot execute analytics functions'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.learnings', 'SELECT'),
  'anon has no access to learnings'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);

SELECT extensions.is((SELECT (v->>'baselinePosts')::int FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa), 4,
  'baseline = same account posts published before this post (later post excluded)');
SELECT extensions.is(
  (SELECT c->>'views' FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa, jsonb_array_elements(v->'checkpoints') c WHERE c->>'hours' = '24'),
  '50', '24 h checkpoint uses the first snapshot inside [24, 30), not the 23 h one');
SELECT extensions.is(
  (SELECT (c->>'median')::numeric FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa, jsonb_array_elements(v->'checkpoints') c WHERE c->>'hours' = '24'),
  250::numeric, '24 h median of an even group is the mean of the middle two');
SELECT extensions.is(
  (SELECT (c->>'average')::numeric FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa, jsonb_array_elements(v->'checkpoints') c WHERE c->>'hours' = '24'),
  400::numeric, '24 h average of the baseline');
SELECT extensions.is(
  (SELECT (c->>'measured')::int FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa, jsonb_array_elements(v->'checkpoints') c WHERE c->>'hours' = '24'),
  4, '24 h baseline counts only measured posts');
SELECT extensions.is(
  (SELECT (c->>'median')::numeric FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa, jsonb_array_elements(v->'checkpoints') c WHERE c->>'hours' = '1'),
  20::numeric, '1 h median of an odd group is the middle value');
SELECT extensions.is(
  (SELECT c->>'views' FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa, jsonb_array_elements(v->'checkpoints') c WHERE c->>'hours' = '1'),
  '5', '1 h checkpoint of the post');
SELECT extensions.is(
  (SELECT c->>'views' FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa, jsonb_array_elements(v->'checkpoints') c WHERE c->>'hours' = '5'),
  '8', 'missing hours_since_publish is derived from captured_at - published_at');
SELECT extensions.ok(
  (SELECT c->'views' = 'null'::jsonb AND (c->>'measured')::int = 0 FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa, jsonb_array_elements(v->'checkpoints') c WHERE c->>'hours' = '168'),
  'unmeasured checkpoint is null, never zero');
SELECT extensions.is((SELECT jsonb_array_length(v->'snapshots') FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa), 4, 'timeline lists every snapshot');
SELECT extensions.is((SELECT v->'content'->>'hookType' FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa), 'soru', 'linked content card is returned');
SELECT extensions.is((SELECT v->'prompts'->0->>'title' FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa), 'Analitik prompt',
  'prompt is resolved through content_item_assets -> generations');
SELECT extensions.is((SELECT v->'influencer'->>'slug' FROM (SELECT public.post_analytics('b6000000-0000-4000-8000-000000000010') AS v) pa), 'analytics-test', 'influencer of the post');
SELECT extensions.ok(public.post_analytics(gen_random_uuid()) IS NULL, 'unknown post returns NULL');

SELECT extensions.is((SELECT (v->'overall'->>'median')::numeric FROM (SELECT public.post_segments('analytics-test', 24) AS v) seg), 250::numeric,
  'overall 24 h median across the influencer posts');
SELECT extensions.is(
  (SELECT count(DISTINCT s->>'dimension')::int FROM (SELECT public.post_segments('analytics-test', 24) AS v) seg, jsonb_array_elements(v->'segments') s),
  5, 'segments cover hook type, format, publish hour, duration and platform');
SELECT extensions.is(
  (SELECT (s->>'median')::numeric FROM (SELECT public.post_segments('analytics-test', 24) AS v) seg, jsonb_array_elements(v->'segments') s
   WHERE s->>'dimension' = 'hook_type' AND s->>'key' = 'soru'),
  100::numeric, 'hook type segment median');
SELECT extensions.is(
  (SELECT (s->>'posts')::int FROM (SELECT public.post_segments('analytics-test', 24) AS v) seg, jsonb_array_elements(v->'segments') s
   WHERE s->>'dimension' = 'hook_type' AND s->>'key' = ''),
  3, 'posts without content are grouped as unspecified');
SELECT extensions.is(
  (SELECT s->>'key' FROM (SELECT public.post_segments('analytics-test', 24) AS v) seg, jsonb_array_elements(v->'segments') s
   WHERE s->>'dimension' = 'publish_hour' AND (s->>'posts')::int = 1),
  'morning', 'publish hour uses the content time zone (Europe/Istanbul)');
SELECT extensions.is(
  (SELECT s->>'key' FROM (SELECT public.post_segments('analytics-test', 24) AS v) seg, jsonb_array_elements(v->'segments') s
   WHERE s->>'dimension' = 'duration' AND (s->>'posts')::int = 1),
  'lt15', 'duration bucket');
SELECT extensions.is((SELECT (public.post_segments('olmayan-slug', 24)->>'validInfluencer')::boolean), false,
  'unknown influencer slug is reported');
SELECT extensions.throws_ok($$SELECT public.post_segments(NULL, 3)$$, '22023', NULL,
  'invalid checkpoint is rejected');

-- Viewer: okur, yazamaz
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$INSERT INTO public.learnings (post_id, body) VALUES ('b6000000-0000-4000-8000-000000000010', 'viewer notu')$$,
  '42501', NULL, 'viewer cannot add learnings');
SELECT extensions.ok(public.post_analytics('b6000000-0000-4000-8000-000000000010') IS NOT NULL,
  'viewer can read post analytics');

-- Editor: ekler; influencer post'tan, created_by oturumdan gelir
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000003', true);
INSERT INTO public.learnings (post_id, body, created_by)
VALUES ('b6000000-0000-4000-8000-000000000010', '  İlk saniyede soru iyi çalıştı  ', '92000000-0000-4000-8000-000000000001');
SELECT extensions.results_eq(
  $$SELECT influencer_id, created_by, body FROM public.learnings WHERE post_id = 'b6000000-0000-4000-8000-000000000010'$$,
  $$VALUES ('b1000000-0000-4000-8000-000000000001'::uuid, '92000000-0000-4000-8000-000000000003'::uuid, 'İlk saniyede soru iyi çalıştı'::text)$$,
  'learning takes influencer from the post, created_by from the session, body is trimmed');
SELECT extensions.throws_ok(
  $$INSERT INTO public.learnings (post_id, influencer_id, body) VALUES ('b6000000-0000-4000-8000-000000000010', 'b1000000-0000-4000-8000-000000000002', 'yanlış')$$,
  '23514', NULL, 'learning cannot point to another influencer than its post');
SELECT extensions.throws_ok(
  $$INSERT INTO public.learnings (influencer_id, body) VALUES ('b1000000-0000-4000-8000-000000000001', '   ')$$,
  '23514', NULL, 'blank learning is rejected');
SELECT extensions.lives_ok(
  $$INSERT INTO public.learnings (influencer_id, body, tags) VALUES ('b1000000-0000-4000-8000-000000000001', 'Genel not', ARRAY['kanca'])$$,
  'influencer-level learning without a post');

-- Ekip dışı kullanıcı hiçbir şey görmez
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000004', true);
SELECT extensions.ok(public.post_analytics('b6000000-0000-4000-8000-000000000010') IS NULL,
  'outsider gets no post analytics');
SELECT extensions.is((SELECT (public.post_segments(NULL, 24)->'overall'->>'posts')::int), 0,
  'outsider segments are empty');
SELECT extensions.is(
  (SELECT count(*)::int FROM public.post_checkpoint_views(ARRAY['b6000000-0000-4000-8000-000000000010'::uuid])),
  0, 'outsider gets no checkpoint views');
SELECT extensions.is((SELECT count(*)::int FROM public.learnings), 0, 'outsider cannot read learnings');
SELECT extensions.throws_ok(
  $$INSERT INTO public.learnings (influencer_id, body) VALUES ('b1000000-0000-4000-8000-000000000001', 'sızma')$$,
  '42501', NULL, 'outsider cannot add learnings');
SELECT extensions.is_empty(
  $$UPDATE public.learnings SET body = 'değişti' RETURNING id$$,
  'outsider cannot update learnings');

SELECT * FROM extensions.finish();
ROLLBACK;
