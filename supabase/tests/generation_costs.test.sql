BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(29);

-- Fixture (postgres rolüyle, RLS dışında). Seed'den bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('97000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'gc-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('97000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'gc-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('97000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'gc-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('97000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'gc-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('97000000-0000-4000-8000-000000000001', 'owner'),
  ('97000000-0000-4000-8000-000000000002', 'editor'),
  ('97000000-0000-4000-8000-000000000003', 'viewer');

INSERT INTO public.influencers (id, name, slug, status)
VALUES ('f1000000-0000-4000-8000-000000000001', 'Gen Cost', 'gen-cost', 'active');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle)
VALUES ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'instagram', 'gen_cost_ig');
INSERT INTO public.content_items (id, influencer_id, title)
VALUES ('f3000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Bağlı video');
INSERT INTO public.assets (id, influencer_id, kind, storage_path)
VALUES ('f4000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'reference', 'f1000000-0000-4000-8000-000000000001/out.png');

-- 1 kredi = 0.05 USD; 1 USD = 40 TRY
INSERT INTO public.credit_rates (tool, currency, rate_per_credit, valid_from)
VALUES ('higgsfield', 'USD', 0.05, '2026-08-01');
INSERT INTO public.exchange_rates (currency, base_currency, rate, valid_on)
VALUES ('USD', 'TRY', 40, '2026-08-01');

-- ── Yapı ─────────────────────────────────────────────────────────
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.costs'::regclass
          AND contype = 'u' AND conname = 'costs_generation_id_key'),
  'costs.generation_id is unique'
);
SELECT extensions.ok(
  NOT (SELECT bool_or(prosecdef) FROM pg_proc
       WHERE proname IN ('post_cost', 'record_generation_costs') AND pronamespace = 'public'::regnamespace),
  'post_cost and record_generation_costs are SECURITY INVOKER'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.post_cost(uuid, char)', 'EXECUTE'),
  'anon cannot execute post_cost'
);

-- ── Editor üretimi ilerletir; maliyet trigger ile yazılır ────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true);

INSERT INTO public.generations (id, influencer_id, tool, type, status, credits, created_at)
VALUES ('f5000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'higgsfield', 'video', 'queued', 20, '2026-08-05T10:00:00Z');
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000001'),
  0, 'queued generation has no cost row'
);
UPDATE public.generations SET status = 'running' WHERE id = 'f5000000-0000-4000-8000-000000000001';
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000001'),
  0, 'running generation has no cost row'
);
UPDATE public.generations SET status = 'succeeded' WHERE id = 'f5000000-0000-4000-8000-000000000001';
SELECT extensions.results_eq(
  $$SELECT category::text, amount, currency, credits, incurred_on, influencer_id
    FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000001'$$,
  $$VALUES ('credits'::text, 1.0000::numeric, 'USD'::char(3), 20.0000::numeric, '2026-08-05'::date,
            'f1000000-0000-4000-8000-000000000001'::uuid)$$,
  'succeeded generation writes one credits cost via credits_to_money (20 x 0.05)'
);
SELECT extensions.is(
  (SELECT created_by FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000001'),
  '97000000-0000-4000-8000-000000000002'::uuid, 'auto cost is attributed to the session user'
);
UPDATE public.generations SET status = 'failed', credits = 30 WHERE id = 'f5000000-0000-4000-8000-000000000001';
UPDATE public.generations SET status = 'succeeded' WHERE id = 'f5000000-0000-4000-8000-000000000001';
SELECT extensions.results_eq(
  $$SELECT count(*)::integer, sum(amount) FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000001'$$,
  $$VALUES (1, 1.0000::numeric)$$,
  'repeated terminal updates keep exactly one row and do not overwrite it'
);

INSERT INTO public.generations (id, influencer_id, tool, type, status, credits, created_at, output_asset_id)
VALUES
  ('f5000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'higgsfield', 'video', 'failed', 10, '2026-08-06T10:00:00Z', 'f4000000-0000-4000-8000-000000000001'),
  ('f5000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'succeeded', 0, '2026-08-06T11:00:00Z', NULL),
  ('f5000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'cancelled', 5, '2026-08-06T12:00:00Z', NULL),
  ('f5000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'succeeded', NULL, '2026-08-06T13:00:00Z', NULL);
SELECT extensions.results_eq(
  $$SELECT amount, credits FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000002'$$,
  $$VALUES (0.5000::numeric, 10.0000::numeric)$$,
  'failed generation also writes its spent credits as a cost'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.costs WHERE generation_id IN (
      'f5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000004',
      'f5000000-0000-4000-8000-000000000005')$$,
  'zero / NULL credits and cancelled generations write no cost'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.costs (influencer_id, category, amount, generation_id)
    VALUES ('f1000000-0000-4000-8000-000000000001', 'credits', 9, 'f5000000-0000-4000-8000-000000000001')$$,
  '23505', NULL, 'a second cost row for the same generation is rejected'
);

-- ── Kredi fiyatı yoksa ───────────────────────────────────────────
SELECT extensions.lives_ok(
  $$INSERT INTO public.generations (id, influencer_id, tool, type, status, credits, created_at)
    VALUES
      ('f5000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000001', 'kling', 'video', 'succeeded', 10, '2026-08-07T10:00:00Z'),
      ('f5000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000001', 'kling', 'video', 'failed', 4, '2026-07-01T10:00:00Z')$$,
  'finishing a generation without a credit price does not fail'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.costs WHERE generation_id IN (
      'f5000000-0000-4000-8000-000000000006', 'f5000000-0000-4000-8000-000000000007')$$,
  'missing credit price -> no (wrong zero) cost row'
);

SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true); -- owner
INSERT INTO public.credit_rates (tool, currency, rate_per_credit, valid_from)
VALUES ('kling', 'USD', 0.1, '2026-08-01');
SELECT extensions.results_eq(
  $$SELECT amount FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000006'$$,
  $$VALUES (1.0000::numeric)$$,
  'adding the price backfills finished generations from valid_from on'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000007'$$,
  'generations before valid_from stay without a cost'
);
UPDATE public.credit_rates SET rate_per_credit = 0.2 WHERE tool = 'kling';
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000006'),
  1, 'changing the price does not duplicate backfilled rows'
);

-- ── Viewer üretim maliyeti oluşturamaz ───────────────────────────
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000003', true);
SELECT extensions.is_empty(
  $$UPDATE public.generations SET status = 'succeeded', credits = 99
    WHERE id = 'f5000000-0000-4000-8000-000000000004' RETURNING 1$$,
  'viewer cannot finish a generation (0 rows)'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.costs WHERE generation_id = 'f5000000-0000-4000-8000-000000000004'$$,
  'so no cost is written for it'
);

-- ── Post başına maliyet ──────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true); -- editor
-- İçerik: üretim 1 doğrudan, üretim 2 çıktı asset'i üzerinden bağlı
INSERT INTO public.content_item_assets (content_item_id, generation_id)
VALUES ('f3000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001');
INSERT INTO public.content_item_assets (content_item_id, asset_id)
VALUES ('f3000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001');
INSERT INTO public.posts (id, account_id, content_item_id, published_at)
VALUES
  ('f6000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', '2026-08-20T10:00:00Z'),
  ('f6000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', NULL, '2026-08-25T10:00:00Z');

SELECT extensions.results_eq(
  $$SELECT post_id, allocation, total, currency, entry_count, missing_rate_count, generation_count
    FROM public.post_cost('f6000000-0000-4000-8000-000000000001', 'USD')$$,
  $$VALUES ('f6000000-0000-4000-8000-000000000001'::uuid, 'direct'::text, 1.5000::numeric, 'USD'::char(3), 2, 0, 2)$$,
  'linked post costs the sum of its content item''s generations (direct + via output asset)'
);
SELECT extensions.is(
  (SELECT total FROM public.post_cost('f6000000-0000-4000-8000-000000000001', 'TRY')),
  60.0000::numeric, 'post cost converts to the requested currency'
);
SELECT extensions.results_eq(
  $$SELECT total, missing_rate_count FROM public.post_cost('f6000000-0000-4000-8000-000000000001', 'EUR')$$,
  $$VALUES (NULL::numeric, 2)$$,
  'missing exchange rate -> NULL total instead of a wrong sum'
);
-- Ağustos: 1 + 0.5 + 1 (kling) = 2.5 USD, 2 video -> 1.25
SELECT extensions.results_eq(
  $$SELECT allocation, total, entry_count, missing_rate_count, generation_count
    FROM public.post_cost('f6000000-0000-4000-8000-000000000002', 'USD')$$,
  $$VALUES ('average'::text, 1.2500::numeric, 3, 0, 0)$$,
  'post without linked generations falls back to the period average per video'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.post_cost('00000000-0000-4000-8000-00000000dead', 'USD')$$,
  'unknown post -> no row'
);

-- ── AI API maliyeti (recordAiUsage ile aynı insert) ──────────────
SELECT extensions.lives_ok(
  $$INSERT INTO public.costs (influencer_id, category, description, amount, currency, incurred_on)
    VALUES ('f1000000-0000-4000-8000-000000000001', 'ai_api', 'claude · 1000 giriş / 1000 çıkış token', 0.024, 'USD', '2026-09-01')$$,
  'editor can record an ai_api cost (recordAiUsage)'
);
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000003', true); -- viewer
SELECT extensions.throws_ok(
  $$INSERT INTO public.costs (influencer_id, category, amount) VALUES ('f1000000-0000-4000-8000-000000000001', 'ai_api', 1)$$,
  '42501', NULL, 'viewer cannot record an ai_api cost'
);
SELECT extensions.is(
  (SELECT allocation FROM public.post_cost('f6000000-0000-4000-8000-000000000001', 'USD')),
  'direct', 'viewer can read post cost'
);

-- ── Ekip dışı hiçbir şey görmez ──────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000004', true);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.post_cost('f6000000-0000-4000-8000-000000000001', 'USD')$$,
  'outsider gets no post cost (linked post)'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.post_cost('f6000000-0000-4000-8000-000000000002', 'USD')$$,
  'outsider gets no post cost (average fallback)'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.costs WHERE generation_id IS NOT NULL$$,
  'outsider sees no generation costs'
);

SELECT * FROM extensions.finish();
ROLLBACK;
