BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(44);

-- Fixture (postgres rolüyle, RLS dışında). Seed'den bağımsız.
-- Hafta: 2026-09-07 (pazartesi) – 2026-09-13 (pazar), Europe/Istanbul (UTC+3)
--   başlangıç = 2026-09-06T21:00Z, bitiş = 2026-09-13T21:00Z
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('96000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'report-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('96000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'report-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('96000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'report-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('96000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'report-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('96000000-0000-4000-8000-000000000001', 'owner'),
  ('96000000-0000-4000-8000-000000000002', 'editor'),
  ('96000000-0000-4000-8000-000000000003', 'viewer');

INSERT INTO public.influencers (id, name, slug, status)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'Rapor A', 'rapor-a', 'active'),
  ('c1000000-0000-4000-8000-000000000002', 'Rapor B', 'rapor-b', 'paused'),
  ('c1000000-0000-4000-8000-000000000003', 'Rapor Taslak', 'rapor-taslak', 'draft');

INSERT INTO public.social_accounts (id, influencer_id, platform, handle)
VALUES ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'instagram', 'rapor_a_ig');

-- Takipçi: başlangıçtan önce 1000, hafta sonunda 1150, hafta bittikten sonra 9999 (sayılmaz)
INSERT INTO public.account_snapshots (account_id, captured_at, followers)
VALUES
  ('c2000000-0000-4000-8000-000000000001', '2026-09-06T20:00:00Z', 1000),
  ('c2000000-0000-4000-8000-000000000001', '2026-09-13T20:00:00Z', 1150),
  ('c2000000-0000-4000-8000-000000000001', '2026-09-14T10:00:00Z', 9999);

INSERT INTO public.posts (id, account_id, caption, published_at)
VALUES
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Haftanın en iyisi', '2026-09-08T10:00:00Z'),
  -- Pazar 23:30 Türkiye: bu haftaya dahil
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'Pazar gecesi', '2026-09-13T20:30:00Z'),
  -- Pazartesi 00:30 Türkiye: sonraki hafta
  ('c3000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000001', 'Pazartesi gecesi', '2026-09-13T21:30:00Z'),
  -- Önceki hafta yayınlanmış, başlangıç ölçümü var: artış sayılır
  ('c3000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000001', 'Eski post', '2026-09-01T10:00:00Z'),
  -- Önceki ay yayınlanmış, başlangıç ölçümü yok: artış uydurulmaz
  ('c3000000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000001', 'Ölçümsüz eski post', '2026-08-20T10:00:00Z');

INSERT INTO public.metric_snapshots (post_id, captured_at, views, likes, comments, shares, saves)
VALUES
  ('c3000000-0000-4000-8000-000000000001', '2026-09-08T12:00:00Z', 100, 10, 1, 1, 1),
  ('c3000000-0000-4000-8000-000000000001', '2026-09-12T12:00:00Z', 1000, 50, 5, 3, 2),
  ('c3000000-0000-4000-8000-000000000002', '2026-09-13T20:45:00Z', 500, 20, 0, 0, 0),
  ('c3000000-0000-4000-8000-000000000003', '2026-09-13T22:00:00Z', 7777, 0, 0, 0, 0),
  ('c3000000-0000-4000-8000-000000000004', '2026-09-06T12:00:00Z', 2000, 0, 0, 0, 0),
  ('c3000000-0000-4000-8000-000000000004', '2026-09-10T12:00:00Z', 2300, 0, 0, 0, 0),
  ('c3000000-0000-4000-8000-000000000005', '2026-09-10T12:00:00Z', 400, 0, 0, 0, 0);

INSERT INTO public.costs (influencer_id, category, amount, currency, incurred_on)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'subscription', 10, 'USD', '2026-09-07'),
  ('c1000000-0000-4000-8000-000000000001', 'tool', 5, 'USD', '2026-09-13'),
  ('c1000000-0000-4000-8000-000000000001', 'tool', 100, 'USD', '2026-09-14');

INSERT INTO public.content_items (influencer_id, title, stage, scheduled_at)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'Gelecek hafta videosu', 'idea', '2026-09-15T09:00:00Z'),
  ('c1000000-0000-4000-8000-000000000001', 'İki hafta sonrası', 'idea', '2026-09-25T09:00:00Z');

-- ── Yapı ve yetkiler ─────────────────────────────────────────────
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reports'::regclass),
  'reports has RLS enabled'
);
SELECT extensions.results_eq(
  $$SELECT policyname::text COLLATE "default" FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' ORDER BY 1$$,
  $$VALUES ('reports_team_read'), ('reports_team_write')$$,
  'reports has team read and team write policies'
);
SELECT extensions.ok(
  NOT (SELECT bool_or(prosecdef) FROM pg_proc
       WHERE proname IN ('report_summary', 'generate_weekly_report', 'generate_weekly_reports')
         AND pronamespace = 'public'::regnamespace),
  'report functions are SECURITY INVOKER (caller RLS applies)'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.report_summary(date, date, uuid, char)', 'EXECUTE'),
  'anon cannot execute report_summary'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.generate_weekly_reports(date)', 'EXECUTE'),
  'panel users cannot run the bulk scheduled job'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.reports', 'SELECT'),
  'anon has no table privilege on reports'
);
SELECT extensions.results_eq(
  $$SELECT schedule, command FROM cron.job WHERE jobname = 'weekly-reports'$$,
  $$VALUES ('0 6 * * 1'::text, 'SELECT public.generate_weekly_reports()'::text)$$,
  'pg_cron runs the weekly job on Monday 06:00 UTC (09:00 Türkiye)'
);

-- ── Özet (viewer okuyabilir) ─────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000003', true);

SELECT extensions.is((SELECT (j ->> 'postsPublished')::integer FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s), 2,
  'posts published in the week (Sunday 23:30 TR counted, Monday 00:30 TR not)');
SELECT extensions.is((SELECT (j ->> 'views')::bigint FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s), 1800::bigint,
  'views = per-post gain within the week (1000 + 500 + 300)');
SELECT extensions.is((SELECT (j ->> 'engagement')::bigint FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s), 80::bigint,
  'engagement = likes + comments + shares + saves gained');
SELECT extensions.is((SELECT (j ->> 'engagementRate')::numeric FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s), 0.0444::numeric,
  'engagement rate = engagement / views');
SELECT extensions.is((SELECT (j ->> 'postsWithoutBaseline')::integer FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s), 1,
  'older post without a baseline snapshot is reported, not counted');
SELECT extensions.results_eq(
  $$SELECT (j -> 'followers' ->> 'start')::bigint, (j -> 'followers' ->> 'end')::bigint, (j -> 'followers' ->> 'delta')::bigint FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s$$,
  $$VALUES (1000::bigint, 1150::bigint, 150::bigint)$$,
  'follower delta uses the last snapshot before start and before end'
);
SELECT extensions.results_eq(
  $$SELECT (j -> 'cost' ->> 'total')::numeric, (j -> 'cost' ->> 'perVideo')::numeric, (j -> 'cost' ->> 'entryCount')::integer FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s$$,
  $$VALUES (15.0000::numeric, 7.5000::numeric, 2)$$,
  'cost total and cost per video for the week'
);
SELECT extensions.results_eq(
  $$SELECT x ->> 'postId' FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s, jsonb_array_elements(j -> 'topPosts') x$$,
  $$VALUES ('c3000000-0000-4000-8000-000000000001'), ('c3000000-0000-4000-8000-000000000002')$$,
  'top posts are ordered by views and only include posts of the week'
);
SELECT extensions.is((SELECT jsonb_array_length(j -> 'bottomPosts') FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s), 0,
  'bottom list does not repeat posts already in the top list');
SELECT extensions.is((SELECT (j -> 'nextPeriod' ->> 'scheduledCount')::integer FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001') AS j) s), 1,
  'next week plan lists content scheduled in the following week');
SELECT extensions.is(
  (SELECT (public.report_summary('2026-09-14', '2026-09-20', 'c1000000-0000-4000-8000-000000000001') ->> 'postsPublished')::integer),
  1, 'Monday 00:30 TR post belongs to the next week'
);
SELECT extensions.results_eq(
  $$SELECT (j ->> 'postsPublished')::integer, (j ->> 'views')::bigint, j -> 'cost' ->> 'total', j -> 'cost' ->> 'perVideo'
    FROM (SELECT public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000002') AS j) x$$,
  $$VALUES (0, 0::bigint, '0.0000'::text, NULL::text)$$,
  'empty week: zeros and no cost per video'
);

-- Viewer yazamaz
SELECT extensions.throws_ok(
  $$SELECT public.generate_weekly_report('2026-09-07', 'c1000000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'viewer cannot generate a report'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.reports (period_start, period_end, summary) VALUES ('2026-08-31', '2026-09-06', '{}')$$,
  '42501', NULL, 'viewer cannot insert reports'
);

-- ── Editor tek tıkla rapor oluşturur ─────────────────────────────
SELECT set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000002', true);
SELECT extensions.isnt(
  public.generate_weekly_report('2026-09-07', 'c1000000-0000-4000-8000-000000000001'),
  NULL, 'editor generates a report with one call'
);

SELECT extensions.results_eq(
  $$SELECT period_end, (summary ->> 'views')::bigint, created_by FROM public.reports
    WHERE id = (SELECT id FROM public.reports WHERE influencer_id = 'c1000000-0000-4000-8000-000000000001' AND period_start = '2026-09-07')$$,
  $$VALUES ('2026-09-13'::date, 1800::bigint, '96000000-0000-4000-8000-000000000002'::uuid)$$,
  'report stores the computed summary and the creator from auth.uid()'
);
UPDATE public.reports SET ai_summary = 'Özet' WHERE id = (SELECT id FROM public.reports WHERE influencer_id = 'c1000000-0000-4000-8000-000000000001' AND period_start = '2026-09-07');
SELECT extensions.is(
  public.generate_weekly_report('2026-09-07', 'c1000000-0000-4000-8000-000000000001'),
  (SELECT id FROM public.reports WHERE influencer_id = 'c1000000-0000-4000-8000-000000000001' AND period_start = '2026-09-07'),
  'generating the same week again updates the same report'
);
SELECT extensions.is(
  (SELECT ai_summary FROM public.reports WHERE id = (SELECT id FROM public.reports WHERE influencer_id = 'c1000000-0000-4000-8000-000000000001' AND period_start = '2026-09-07')),
  'Özet', 'unchanged numbers keep the AI summary'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.reports WHERE influencer_id = 'c1000000-0000-4000-8000-000000000001'),
  1, 'no duplicate report for the same influencer and week'
);
SELECT extensions.throws_ok(
  $$SELECT public.generate_weekly_report('2026-09-08', 'c1000000-0000-4000-8000-000000000001')$$,
  '22023', NULL, 'period must start on Monday'
);
SELECT extensions.throws_ok(
  format('SELECT public.generate_weekly_report(%L, NULL)', date_trunc('week', now())::date + 14),
  '22023', NULL, 'future weeks are rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.generate_weekly_report('2026-09-07', 'c1000000-0000-4000-8000-0000000000ff')$$,
  'P0002', NULL, 'unknown influencer is rejected'
);

-- Viewer okur ama güncelleyemez/silemez (0 satır)
SELECT set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000003', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.reports), 1, 'viewer can read reports');
SELECT extensions.is_empty(
  $$UPDATE public.reports SET ai_summary = 'x' RETURNING 1$$,
  'viewer cannot update reports'
);
SELECT extensions.is_empty(
  $$DELETE FROM public.reports RETURNING 1$$,
  'viewer cannot delete reports'
);

-- ── Ekip dışı kullanıcı hiçbir şey görmez ────────────────────────
SELECT set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000004', true);
SELECT extensions.is_empty($$SELECT 1 FROM public.reports$$, 'outsider sees no reports');
SELECT extensions.is(
  public.report_summary('2026-09-07', '2026-09-13', 'c1000000-0000-4000-8000-000000000001'),
  NULL, 'outsider gets no summary for an influencer'
);
SELECT extensions.results_eq(
  $$SELECT (j ->> 'postsPublished')::integer, (j ->> 'views')::bigint, (j -> 'cost' ->> 'entryCount')::integer
    FROM (SELECT public.report_summary('2026-09-07', '2026-09-13') AS j) x$$,
  $$VALUES (0, 0::bigint, 0)$$,
  'outsider all-influencer summary contains no data'
);
SELECT extensions.throws_ok(
  $$SELECT public.generate_weekly_report('2026-09-07', NULL)$$,
  '42501', NULL, 'outsider cannot create a report'
);

-- ── Otomatik pazartesi raporu (pg_cron işi, postgres rolü) ───────
RESET ROLE;
CREATE TEMP TABLE cron_first ON COMMIT DROP AS
  SELECT public.generate_weekly_reports('2026-09-07') AS created;

SELECT extensions.ok((SELECT created FROM cron_first) >= 2,
  'scheduled run creates the all-influencer report and missing influencer reports');
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.reports WHERE influencer_id IS NULL AND period_start = '2026-09-07')
  AND EXISTS (SELECT 1 FROM public.reports WHERE influencer_id = 'c1000000-0000-4000-8000-000000000002' AND period_start = '2026-09-07'),
  'reports exist for all influencers and the paused influencer'
);
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.reports WHERE influencer_id = 'c1000000-0000-4000-8000-000000000003'),
  'draft influencers are skipped'
);
SELECT extensions.is(
  (SELECT ai_summary FROM public.reports WHERE id = (SELECT id FROM public.reports WHERE influencer_id = 'c1000000-0000-4000-8000-000000000001' AND period_start = '2026-09-07')),
  'Özet', 'scheduled run does not touch an existing report'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE type = 'weekly_report_ready' AND payload ->> 'period_start' = '2026-09-07'),
  (SELECT created FROM cron_first), 'one notification per new report'
);
SELECT extensions.is(public.generate_weekly_reports('2026-09-07'), 0,
  'second run for the same week creates nothing (idempotent)');
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE type = 'weekly_report_ready' AND payload ->> 'period_start' = '2026-09-07'),
  (SELECT created FROM cron_first), 'second run sends no duplicate notification'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.reports (influencer_id, period_start, period_end, summary) VALUES (NULL, '2026-09-07', '2026-09-13', '{}')$$,
  '23505', NULL, 'only one all-influencer report per week (NULLS NOT DISTINCT)'
);

SELECT * FROM extensions.finish();
ROLLBACK;
