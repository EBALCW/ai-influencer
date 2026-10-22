BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(39);

-- Fixture (postgres rolüyle, RLS dışında). Seed'den bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('95000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'cost-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('95000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'cost-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('95000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cost-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('95000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'cost-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('95000000-0000-4000-8000-000000000001', 'owner'),
  ('95000000-0000-4000-8000-000000000002', 'editor'),
  ('95000000-0000-4000-8000-000000000003', 'viewer');

INSERT INTO public.influencers (id, name, slug, status)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'Cost A', 'cost-a', 'active'),
  ('b1000000-0000-4000-8000-000000000002', 'Cost B', 'cost-b', 'active'),
  ('b1000000-0000-4000-8000-000000000003', 'Cost Budget', 'cost-budget', 'active');

-- 1 USD = 40 TRY (2026-08-01'den itibaren)
INSERT INTO public.exchange_rates (currency, base_currency, rate, valid_on)
VALUES ('USD', 'TRY', 40, '2026-08-01');
INSERT INTO public.credit_rates (tool, currency, rate_per_credit, valid_from)
VALUES
  ('higgsfield', 'USD', 0.05, '2026-08-01'),
  ('higgsfield', 'USD', 0.06, '2026-09-01');

-- Influencer A: 2 video (Ağustos), 4 üretim (1 başarısız)
INSERT INTO public.social_accounts (id, influencer_id, platform, handle)
VALUES ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'instagram', 'cost_a_ig');
INSERT INTO public.posts (id, account_id, published_at)
VALUES
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', '2026-08-10T10:00:00Z'),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', '2026-08-20T10:00:00Z'),
  ('b3000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', '2026-07-20T10:00:00Z'); -- dönem dışı
-- İzlenme: her postun EN SON değeri -> 2000 + 3000 = 5000
INSERT INTO public.metric_snapshots (post_id, captured_at, views)
VALUES
  ('b3000000-0000-4000-8000-000000000001', '2026-08-10T11:00:00Z', 1000),
  ('b3000000-0000-4000-8000-000000000001', '2026-08-12T11:00:00Z', 2000),
  ('b3000000-0000-4000-8000-000000000002', '2026-08-21T11:00:00Z', 3000),
  ('b3000000-0000-4000-8000-000000000003', '2026-07-21T11:00:00Z', 9999);

-- Bu test maliyet kayıtlarını elle kurar; otomatik üretim maliyeti (generation_costs.test.sql)
-- fixture sırasında kapatılır ki toplamlar sabit kalsın.
ALTER TABLE public.generations DISABLE TRIGGER generations_record_cost;
INSERT INTO public.generations (id, influencer_id, tool, type, status, credits, created_at)
VALUES
  ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'higgsfield', 'video', 'succeeded', 20, '2026-08-05T10:00:00Z'),
  ('b4000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'higgsfield', 'video', 'succeeded', 20, '2026-08-06T10:00:00Z'),
  ('b4000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'succeeded', 5, '2026-08-07T10:00:00Z'),
  ('b4000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'higgsfield', 'video', 'failed', 12.5, '2026-08-08T10:00:00Z');
ALTER TABLE public.generations ENABLE TRIGGER generations_record_cost;

-- A: 10 USD + 400 TRY (= 10 USD) + 2 USD (başarısız üretimin kredisi) = 22 USD
INSERT INTO public.costs (influencer_id, category, amount, currency, incurred_on, generation_id, credits)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'subscription', 10, 'USD', '2026-08-01', NULL, NULL),
  ('b1000000-0000-4000-8000-000000000001', 'tool', 400, 'TRY', '2026-08-15', NULL, NULL),
  ('b1000000-0000-4000-8000-000000000001', 'credits', 2, 'USD', '2026-08-08', 'b4000000-0000-4000-8000-000000000004', 12.5),
  -- B: kuru olmayan para birimi
  ('b1000000-0000-4000-8000-000000000002', 'tool', 5, 'EUR', '2026-08-03', NULL, NULL);

-- ── Yapı ve yetkiler ─────────────────────────────────────────────
SELECT extensions.ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class
   WHERE oid IN ('public.budgets'::regclass, 'public.exchange_rates'::regclass, 'public.credit_rates'::regclass)),
  'budgets, exchange_rates and credit_rates have RLS enabled'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.cost_summary(date, date, char, uuid)', 'EXECUTE'),
  'anon cannot execute cost_summary'
);
SELECT extensions.ok(
  NOT (SELECT bool_or(prosecdef) FROM pg_proc
       WHERE proname IN ('fx_rate', 'cost_entries_converted', 'cost_summary', 'cost_daily',
                         'cost_by_category', 'budget_status', 'raise_budget_alerts', 'credits_to_money')
         AND pronamespace = 'public'::regnamespace),
  'cost functions are SECURITY INVOKER (caller RLS applies)'
);
SELECT extensions.ok(
  'ai_api' = ANY (enum_range(NULL::public.cost_category)::text[]),
  'cost_category has ai_api'
);

-- ── Kur ve kredi ─────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000003', true); -- viewer okuyabilir

SELECT extensions.is(public.fx_rate('USD', 'USD', '2026-08-15'), 1::numeric, 'same currency rate is 1');
SELECT extensions.is(public.fx_rate('USD', 'TRY', '2026-08-15'), 40::numeric, 'direct rate');
SELECT extensions.is(round(public.fx_rate('TRY', 'USD', '2026-08-15'), 6), 0.025::numeric, 'inverse rate');
SELECT extensions.is(public.fx_rate('USD', 'TRY', '2026-07-31'), NULL, 'no rate before valid_on');
SELECT extensions.is(public.fx_rate('EUR', 'USD', '2026-08-15'), NULL, 'unknown pair is NULL');

SELECT extensions.results_eq(
  $$SELECT amount, currency FROM public.credits_to_money('higgsfield', 100, '2026-08-15')$$,
  $$VALUES (5.0000::numeric, 'USD'::char(3))$$,
  'credits_to_money uses the price valid on that day'
);
SELECT extensions.results_eq(
  $$SELECT amount FROM public.credits_to_money('higgsfield', 100, '2026-09-02')$$,
  $$VALUES (6.0000::numeric)$$,
  'credits_to_money picks the newer price after valid_from'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.credits_to_money('higgsfield', 100, '2026-07-01')$$,
  'credits_to_money returns nothing without a price'
);

-- ── Özet metrikler (A, Ağustos, USD) ─────────────────────────────
SELECT extensions.is(
  (SELECT total FROM public.cost_summary('2026-08-01', '2026-08-31', 'USD', 'b1000000-0000-4000-8000-000000000001')),
  22.0000::numeric, 'total converts TRY with the rate of incurred_on (10 + 400/40 + 2)'
);
SELECT extensions.is(
  (SELECT total FROM public.cost_summary('2026-08-01', '2026-08-31', 'TRY', 'b1000000-0000-4000-8000-000000000001')),
  880.0000::numeric, 'same records in TRY'
);
SELECT extensions.results_eq(
  $$SELECT video_count, views, cost_per_video, cost_per_1000_views
    FROM public.cost_summary('2026-08-01', '2026-08-31', 'USD', 'b1000000-0000-4000-8000-000000000001')$$,
  $$VALUES (2, 5000::bigint, 11.0000::numeric, 4.4000::numeric)$$,
  'cost per video and per 1000 views use posts published in the period and their latest views'
);
SELECT extensions.results_eq(
  $$SELECT generation_count, failed_generation_count, failed_ratio, failed_credits, failed_cost
    FROM public.cost_summary('2026-08-01', '2026-08-31', 'USD', 'b1000000-0000-4000-8000-000000000001')$$,
  $$VALUES (4, 1, 0.2500::numeric, 12.5000::numeric, 2.0000::numeric)$$,
  'failed generations are counted and their cost is reported separately'
);
SELECT extensions.results_eq(
  $$SELECT total, missing_rate_count, cost_per_video
    FROM public.cost_summary('2026-08-01', '2026-08-31', 'USD', 'b1000000-0000-4000-8000-000000000002')$$,
  $$VALUES (NULL::numeric, 1, NULL::numeric)$$,
  'missing exchange rate -> total is NULL instead of a wrong sum'
);
SELECT extensions.results_eq(
  $$SELECT day, total FROM public.cost_daily('2026-08-01', '2026-08-31', 'USD', 'b1000000-0000-4000-8000-000000000001')$$,
  $$VALUES ('2026-08-01'::date, 10.0000::numeric), ('2026-08-08'::date, 2.0000::numeric), ('2026-08-15'::date, 10.0000::numeric)$$,
  'cost_daily groups by incurred_on'
);
SELECT extensions.results_eq(
  $$SELECT category::text, total FROM public.cost_by_category('2026-08-01', '2026-08-31', 'USD', 'b1000000-0000-4000-8000-000000000001') ORDER BY 1$$,
  $$VALUES ('credits', 2.0000::numeric), ('subscription', 10.0000::numeric), ('tool', 10.0000::numeric)$$,
  'cost_by_category'
);

-- ── Viewer yazamaz ───────────────────────────────────────────────
SELECT extensions.throws_ok(
  $$INSERT INTO public.costs (influencer_id, category, amount) VALUES ('b1000000-0000-4000-8000-000000000001', 'other', 1)$$,
  '42501', NULL, 'viewer cannot insert costs'
);
SELECT extensions.is_empty(
  $$UPDATE public.costs SET amount = 0 WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer update on costs affects 0 rows'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.budgets (month, amount) VALUES ('2026-10-01', 10)$$,
  '42501', NULL, 'viewer cannot insert budgets'
);

-- ── Editor maliyet girer, ayar değiştiremez ──────────────────────
SELECT set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$INSERT INTO public.budgets (month, amount) VALUES ('2026-10-01', 10)$$,
  '42501', NULL, 'editor cannot insert budgets'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.exchange_rates (currency, base_currency, rate, valid_on) VALUES ('EUR', 'USD', 1.1, '2026-08-01')$$,
  '42501', NULL, 'editor cannot insert exchange rates'
);
SELECT extensions.is_empty(
  $$UPDATE public.credit_rates SET rate_per_credit = 0 RETURNING 1$$,
  'editor update on credit_rates affects 0 rows'
);

-- ── Owner bütçe tanımlar; uyarılar tekrarsız ve sunucuda üretilir ──
SELECT set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
SELECT extensions.lives_ok(
  $$INSERT INTO public.budgets (influencer_id, month, amount, currency, warn_ratio)
    VALUES ('b1000000-0000-4000-8000-000000000003', '2026-09-01', 100, 'USD', 0.8)$$,
  'owner can insert a budget'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.budgets (influencer_id, month, amount) VALUES ('b1000000-0000-4000-8000-000000000003', '2026-09-01', 50)$$,
  '23505', NULL, 'one budget per influencer and month'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.budgets (month, amount) VALUES ('2026-09-01', 1000)$$,
  'owner can insert a team-wide budget (influencer_id NULL)'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.budgets (month, amount) VALUES ('2026-09-01', 2000)$$,
  '23505', NULL, 'one team-wide budget per month'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.budgets (month, amount) VALUES ('2026-09-15', 10)$$,
  '23514', NULL, 'budget month must be the first day of a month'
);

SELECT set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true); -- editor
INSERT INTO public.costs (influencer_id, category, amount, currency, incurred_on)
VALUES ('b1000000-0000-4000-8000-000000000003', 'credits', 79.99, 'USD', '2026-09-10');
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE payload ->> 'month' = '2026-09'),
  0, 'no alert at 79.99%'
);
INSERT INTO public.costs (influencer_id, category, amount, currency, incurred_on)
VALUES ('b1000000-0000-4000-8000-000000000003', 'credits', 0.01, 'USD', '2026-09-11');
SELECT extensions.results_eq(
  $$SELECT type, influencer_id FROM public.alerts WHERE payload ->> 'month' = '2026-09'$$,
  $$VALUES ('budget_warning'::text, 'b1000000-0000-4000-8000-000000000003'::uuid)$$,
  'warning at exactly 80% (written by the editor''s insert, server side)'
);
INSERT INTO public.costs (influencer_id, category, amount, currency, incurred_on)
VALUES ('b1000000-0000-4000-8000-000000000003', 'credits', 5, 'USD', '2026-09-12');
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE payload ->> 'month' = '2026-09'),
  1, 'warning is not repeated for the same budget and month'
);
INSERT INTO public.costs (influencer_id, category, amount, currency, incurred_on)
VALUES ('b1000000-0000-4000-8000-000000000003', 'credits', 20, 'USD', '2026-09-13');
SELECT extensions.results_eq(
  $$SELECT type FROM public.alerts WHERE payload ->> 'month' = '2026-09' ORDER BY type$$,
  $$VALUES ('budget_exceeded'::text), ('budget_warning'::text)$$,
  'exceeding 100% adds a single budget_exceeded alert'
);
SELECT extensions.results_eq(
  $$SELECT spent, ratio FROM public.budget_status('2026-09-20') WHERE influencer_id = 'b1000000-0000-4000-8000-000000000003'$$,
  $$VALUES (105.0000::numeric, 1.0500::numeric)$$,
  'budget_status converts and sums the month'
);
SELECT extensions.results_eq(
  $$SELECT spent FROM public.budget_status('2026-09-01') WHERE influencer_id IS NULL$$,
  $$VALUES (105.0000::numeric)$$,
  'team-wide budget counts every influencer'
);

-- ── Ekip dışı hiçbir şey görmez ──────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000004', true);
SELECT extensions.is_empty($$SELECT 1 FROM public.costs$$, 'outsider sees no costs');
SELECT extensions.is_empty($$SELECT 1 FROM public.budgets$$, 'outsider sees no budgets');
SELECT extensions.is(
  (SELECT entry_count FROM public.cost_summary('2026-08-01', '2026-08-31', 'USD', NULL)),
  0, 'outsider summary is empty'
);

SELECT * FROM extensions.finish();
ROLLBACK;
