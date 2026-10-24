BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(34);

-- Fixture (postgres rolüyle, RLS dışında). Seed'deki demo trendlerden bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('9b000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'tr-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9b000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'tr-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9b000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'tr-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9b000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'tr-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('9b000000-0000-4000-8000-000000000001', 'owner'),
  ('9b000000-0000-4000-8000-000000000002', 'viewer'),
  ('9b000000-0000-4000-8000-000000000003', 'editor');
INSERT INTO public.influencers (id, name, slug)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'Trend Test', 'trend-test'),
  ('c1000000-0000-4000-8000-000000000002', 'Trend Diğer', 'trend-other');
INSERT INTO public.trends (id, influencer_id, url, platform, format, why_viral, adaptation_idea, adaptation_score, views, status)
VALUES
  ('c2000000-0000-4000-8000-000000000001', NULL, 'https://example.invalid/t/global', 'instagram', 'pov', 'Kanca', 'Sabah POV', 5, 1000, 'shortlisted'),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'https://example.invalid/t/specific', 'tiktok', 'dance', '', '', 3, NULL, 'new'),
  ('c2000000-0000-4000-8000-000000000003', NULL, 'https://example.invalid/t/rejected', 'youtube', 'meme', 'Telif', '', 1, 10, 'rejected');

SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.trends'::regclass),
  'trends has row-level security enabled'
);
SELECT extensions.ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.push_trend_to_backlog(uuid, uuid, text)'::regprocedure),
  'push_trend_to_backlog is SECURITY INVOKER (caller RLS applies)'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.trends', 'SELECT'),
  'anon has no table privilege on trends'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.push_trend_to_backlog(uuid, uuid, text)', 'EXECUTE'),
  'anon cannot execute push_trend_to_backlog'
);

SET LOCAL ROLE authenticated;

-- Ekip dışı kullanıcı -------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000004', true);
SELECT extensions.is_empty($$SELECT 1 FROM public.trends$$, 'outsider sees no trends');
SELECT extensions.throws_ok(
  $$INSERT INTO public.trends (url) VALUES ('https://example.invalid/t/outsider')$$,
  '42501', NULL, 'outsider cannot insert trends'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'outsider cannot push to backlog'
);

-- Viewer: salt okur ---------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000002', true);
SELECT extensions.ok(
  (SELECT count(*) FROM public.trends WHERE id::text LIKE 'c2000000%') = 3,
  'viewer reads trends'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.trends (url) VALUES ('https://example.invalid/t/viewer')$$,
  '42501', NULL, 'viewer cannot insert trends'
);
SELECT extensions.is_empty(
  $$UPDATE public.trends SET status = 'rejected' WHERE id = 'c2000000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer cannot update trends'
);
SELECT extensions.is_empty(
  $$DELETE FROM public.trends WHERE id = 'c2000000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer cannot delete trends'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'viewer cannot push to backlog'
);

-- Editor: yazma, kurallar ---------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000003', true);
SELECT extensions.lives_ok(
  $$INSERT INTO public.trends (id, url, created_by, why_viral) VALUES
    ('c2000000-0000-4000-8000-000000000010', 'https://example.invalid/t/new', '9b000000-0000-4000-8000-000000000001', '  boşluklu  ')$$,
  'editor inserts a trend'
);
SELECT extensions.is(
  (SELECT created_by FROM public.trends WHERE id = 'c2000000-0000-4000-8000-000000000010'),
  '9b000000-0000-4000-8000-000000000003'::uuid,
  'created_by comes from auth.uid(), not from the client'
);
SELECT extensions.is(
  (SELECT why_viral || '|' || status || '|' || source || '|' || format FROM public.trends WHERE id = 'c2000000-0000-4000-8000-000000000010'),
  'boşluklu|new|manual|other',
  'text is trimmed and defaults apply'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.trends (url) VALUES ('https://example.invalid/t/global')$$,
  '23505', NULL, 'same link twice in the global scope is rejected'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.trends (influencer_id, url) VALUES ('c1000000-0000-4000-8000-000000000002', 'https://example.invalid/t/global')$$,
  'same link may be archived for a specific influencer'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.trends (url) VALUES ('javascript:alert(1)')$$,
  '23514', NULL, 'non-http link is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.trends (url, adaptation_score) VALUES ('https://example.invalid/t/s6', 6)$$,
  '23514', NULL, 'adaptation score above 5 is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.trends (url, status) VALUES ('https://example.invalid/t/st', 'archived')$$,
  '23514', NULL, 'unknown status is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.trends (url, format) VALUES ('https://example.invalid/t/fmt', 'dans')$$,
  '23514', NULL, 'format must be a dictionary key'
);

-- Backlog'a aktarma -----------------------------------------------------------
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('c2000000-0000-4000-8000-000000000001')$$,
  '22023', NULL, 'global trend needs a target influencer'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('c2000000-0000-4000-8000-0000000000ff', 'c1000000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'unknown trend returns P0002'
);
SELECT extensions.ok(
  public.push_trend_to_backlog('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001') IS NOT NULL,
  'editor pushes a global trend to the backlog'
);
SELECT extensions.results_eq(
  $$SELECT c.influencer_id, c.stage::text, c.title, c.source_url, c.source_views, c.viral_reason, c.adaptation_score::integer, t.status
    FROM public.trends t JOIN public.content_items c ON c.id = t.content_item_id
    WHERE t.id = 'c2000000-0000-4000-8000-000000000001'$$,
  $$VALUES ('c1000000-0000-4000-8000-000000000001'::uuid, 'idea', 'Sabah POV', 'https://example.invalid/t/global', 1000::bigint, 'Kanca', 5, 'used')$$,
  'idea card carries trend fields and the trend is marked used'
);
SELECT extensions.ok(
  (SELECT c.created_by = '9b000000-0000-4000-8000-000000000003'::uuid AND c.notes LIKE 'Trend arşivinden%'
   FROM public.trends t JOIN public.content_items c ON c.id = t.content_item_id
   WHERE t.id = 'c2000000-0000-4000-8000-000000000001'),
  'card is created as the caller and its notes point back to the trend'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001')$$,
  '23505', NULL, 'a trend cannot be pushed twice'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001')$$,
  '23514', NULL, 'rejected trend cannot be pushed'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002')$$,
  '23514', NULL, 'influencer-specific trend cannot go to another influencer'
);
SELECT extensions.ok(
  public.push_trend_to_backlog('c2000000-0000-4000-8000-000000000002', p_title => 'Özel başlık') IS NOT NULL,
  'specific trend is pushed without a target influencer'
);
SELECT extensions.is(
  (SELECT c.influencer_id FROM public.trends t JOIN public.content_items c ON c.id = t.content_item_id
   WHERE t.id = 'c2000000-0000-4000-8000-000000000002'),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'specific trend goes to its own influencer'
);
SELECT extensions.is(
  (SELECT c.title FROM public.trends t JOIN public.content_items c ON c.id = t.content_item_id
   WHERE t.id = 'c2000000-0000-4000-8000-000000000002'),
  'Özel başlık',
  'explicit title is used for the card'
);
SELECT extensions.throws_ok(
  $$UPDATE public.trends SET content_item_id = (
      SELECT content_item_id FROM public.trends WHERE id = 'c2000000-0000-4000-8000-000000000002')
    WHERE influencer_id = 'c1000000-0000-4000-8000-000000000002'$$,
  '23514', NULL, 'a trend cannot link a card of another influencer'
);

-- Kart silinince bağlantı boşalır, trend kalır.
RESET ROLE;
DELETE FROM public.content_items c USING public.trends t
WHERE t.content_item_id = c.id AND t.id = 'c2000000-0000-4000-8000-000000000001';
SELECT extensions.is(
  (SELECT content_item_id FROM public.trends WHERE id = 'c2000000-0000-4000-8000-000000000001'),
  NULL::uuid,
  'deleting the card clears the link and keeps the trend'
);

SELECT * FROM extensions.finish();
ROLLBACK;
