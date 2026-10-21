BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(9);

-- Fixture (postgres rolüyle, RLS dışında). Seed'deki demo kayıtlardan bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'stats-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'stats-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES ('91000000-0000-4000-8000-000000000001', 'owner');

INSERT INTO public.influencers (id, name, slug, status)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'Stats Test', 'stats-test', 'active'),
  ('a1000000-0000-4000-8000-000000000002', 'Hesapsız', 'stats-no-accounts', 'draft');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle)
VALUES
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'instagram', 'stats_ig'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'youtube', 'stats_yt');

-- Takipçi: her hesabın EN SON snapshot'ı toplanır -> 150 + 50 = 200
INSERT INTO public.account_snapshots (account_id, captured_at, followers)
VALUES
  ('a2000000-0000-4000-8000-000000000001', now() - interval '2 days', 100),
  ('a2000000-0000-4000-8000-000000000001', now() - interval '1 day', 150),
  ('a2000000-0000-4000-8000-000000000002', now() - interval '1 day', 50);

INSERT INTO public.posts (id, account_id)
VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001'), -- eski post
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002'), -- 7 gün içinde yeni post
  ('a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001'), -- sayaç sıfırlanmış
  ('a3000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001'); -- snapshot'ı yok

-- İzlenme (kümülatif): eski post 1500 - 1200 = 300; yeni post 400; sıfırlanan 0 -> toplam 700
INSERT INTO public.metric_snapshots (post_id, captured_at, views)
VALUES
  ('a3000000-0000-4000-8000-000000000001', now() - interval '10 days', 1000),
  ('a3000000-0000-4000-8000-000000000001', now() - interval '8 days', 1200),
  ('a3000000-0000-4000-8000-000000000001', now() - interval '1 day', 1500),
  ('a3000000-0000-4000-8000-000000000002', now() - interval '2 days', 400),
  ('a3000000-0000-4000-8000-000000000003', now() - interval '8 days', 500),
  ('a3000000-0000-4000-8000-000000000003', now() - interval '1 day', 100);

SELECT extensions.ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.influencer_list_stats(uuid[], timestamptz)'::regprocedure),
  'influencer_list_stats is SECURITY INVOKER (RLS of the caller applies)'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.influencer_list_stats(uuid[], timestamptz)', 'EXECUTE'),
  'anon cannot execute influencer_list_stats'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

SELECT extensions.is(
  (SELECT followers FROM public.influencer_list_stats(ARRAY['a1000000-0000-4000-8000-000000000001'::uuid])),
  200::bigint,
  'followers = sum of the latest snapshot of each account'
);
SELECT extensions.is(
  (SELECT views_7d FROM public.influencer_list_stats(ARRAY['a1000000-0000-4000-8000-000000000001'::uuid])),
  700::bigint,
  'views_7d uses cumulative deltas: old post 300 + new post 400 + reset counter 0'
);
SELECT extensions.is(
  (SELECT platforms FROM public.influencer_list_stats(ARRAY['a1000000-0000-4000-8000-000000000001'::uuid])),
  ARRAY['instagram', 'youtube']::text[],
  'platforms are distinct and sorted'
);
SELECT extensions.results_eq(
  $$SELECT platforms, followers, views_7d FROM public.influencer_list_stats(ARRAY['a1000000-0000-4000-8000-000000000002'::uuid])$$,
  $$VALUES (ARRAY[]::text[], 0::bigint, 0::bigint)$$,
  'influencer without accounts returns a zero row instead of disappearing'
);
SELECT extensions.ok(
  (SELECT count(*) FROM public.influencer_list_stats()) >= 2,
  'NULL id list returns every visible influencer'
);
SELECT extensions.is(
  (SELECT views_7d FROM public.influencer_list_stats(
    ARRAY['a1000000-0000-4000-8000-000000000001'::uuid], now() - interval '9 days')),
  1000::bigint,
  'p_since moves the baseline: old 1500-1000, new 400, reset post has no baseline before 9 days so 100'
);

SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
SELECT extensions.is_empty(
  $$SELECT * FROM public.influencer_list_stats()$$,
  'outsider sees no rows (RLS applies through SECURITY INVOKER)'
);

SELECT * FROM extensions.finish();
ROLLBACK;
