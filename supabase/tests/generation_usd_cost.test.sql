BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(12);

-- Fixture (postgres rolüyle, RLS dışında). Seed'den bağımsız.
INSERT INTO public.influencers (id, name, slug, status)
VALUES ('f1500000-0000-4000-8000-000000000001', 'USD Cost', 'usd-cost', 'active');

-- 1 kredi = 0.05 USD (yalnız kredi yedeği için)
INSERT INTO public.credit_rates (tool, currency, rate_per_credit, valid_from)
VALUES ('higgsfield', 'USD', 0.05, '2026-08-01');

-- ── Yapı ─────────────────────────────────────────────────────────
SELECT extensions.has_column('public', 'generations', 'cost_usd', 'generations.cost_usd exists');
SELECT extensions.has_column('public', 'generations', 'estimated_cost_usd', 'generations.estimated_cost_usd exists');
SELECT extensions.throws_ok(
  $$INSERT INTO public.generations (influencer_id, tool, type, status, cost_usd)
    VALUES ('f1500000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'queued', -1)$$,
  '23514', NULL, 'negative cost_usd is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.generations (influencer_id, tool, type, status, estimated_cost_usd)
    VALUES ('f1500000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'queued', -0.5)$$,
  '23514', NULL, 'negative estimated_cost_usd is rejected'
);

-- ── Worker akışı: tahmin → çalışıyor → cost_usd → succeeded ─────
SET LOCAL ROLE service_role;
INSERT INTO public.generations (id, influencer_id, tool, type, status, estimated_cost_usd, created_at)
VALUES ('f1500000-0000-4000-8000-000000000011', 'f1500000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'running', 0.094, '2026-08-05T10:00:00Z');
UPDATE public.generations SET cost_usd = 0.094 WHERE id = 'f1500000-0000-4000-8000-000000000011';
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.costs WHERE generation_id = 'f1500000-0000-4000-8000-000000000011'$$,
  'cost_usd on a running generation writes no cost yet'
);
UPDATE public.generations SET status = 'succeeded' WHERE id = 'f1500000-0000-4000-8000-000000000011';
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT category::text, amount, currency, credits, incurred_on
    FROM public.costs WHERE generation_id = 'f1500000-0000-4000-8000-000000000011'$$,
  $$VALUES ('credits'::text, 0.0940::numeric, 'USD'::char(3), NULL::numeric, '2026-08-05'::date)$$,
  'succeeded generation with cost_usd writes a USD cost without a credit price lookup'
);

-- cost_usd kredi yedeğinden önce gelir
INSERT INTO public.generations (id, influencer_id, tool, type, status, credits, cost_usd, created_at)
VALUES ('f1500000-0000-4000-8000-000000000012', 'f1500000-0000-4000-8000-000000000001', 'higgsfield', 'video', 'succeeded', 20, 0.35, '2026-08-06T10:00:00Z');
SELECT extensions.results_eq(
  $$SELECT amount, currency, credits FROM public.costs WHERE generation_id = 'f1500000-0000-4000-8000-000000000012'$$,
  $$VALUES (0.3500::numeric, 'USD'::char(3), 20.0000::numeric)$$,
  'cost_usd wins over credits x credit price'
);

-- cost_usd yoksa eski kredi davranışı
INSERT INTO public.generations (id, influencer_id, tool, type, status, credits, created_at)
VALUES ('f1500000-0000-4000-8000-000000000013', 'f1500000-0000-4000-8000-000000000001', 'higgsfield', 'video', 'succeeded', 20, '2026-08-06T11:00:00Z');
SELECT extensions.results_eq(
  $$SELECT amount, currency FROM public.costs WHERE generation_id = 'f1500000-0000-4000-8000-000000000013'$$,
  $$VALUES (1.0000::numeric, 'USD'::char(3))$$,
  'without cost_usd the credits fallback still applies (20 x 0.05)'
);

-- Kredi fiyatı olmayan araç: cost_usd ile yine yazılır, kredi ile yazılmaz
INSERT INTO public.generations (id, influencer_id, tool, type, status, cost_usd, created_at)
VALUES ('f1500000-0000-4000-8000-000000000014', 'f1500000-0000-4000-8000-000000000001', 'unpriced-tool', 'image', 'succeeded', 0.02, '2026-08-07T10:00:00Z');
INSERT INTO public.generations (id, influencer_id, tool, type, status, credits, created_at)
VALUES ('f1500000-0000-4000-8000-000000000015', 'f1500000-0000-4000-8000-000000000001', 'unpriced-tool', 'image', 'succeeded', 5, '2026-08-07T11:00:00Z');
SELECT extensions.results_eq(
  $$SELECT generation_id, amount FROM public.costs
    WHERE generation_id IN ('f1500000-0000-4000-8000-000000000014', 'f1500000-0000-4000-8000-000000000015')$$,
  $$VALUES ('f1500000-0000-4000-8000-000000000014'::uuid, 0.0200::numeric)$$,
  'unpriced tool: cost_usd writes, credits without a price do not'
);

-- Tamamlanmış ama cost_usd sonradan girilen üretim (ör. elle düzeltme)
INSERT INTO public.generations (id, influencer_id, tool, type, status, created_at)
VALUES ('f1500000-0000-4000-8000-000000000016', 'f1500000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'succeeded', '2026-08-08T10:00:00Z');
UPDATE public.generations SET cost_usd = 0.1 WHERE id = 'f1500000-0000-4000-8000-000000000016';
SELECT extensions.results_eq(
  $$SELECT amount FROM public.costs WHERE generation_id = 'f1500000-0000-4000-8000-000000000016'$$,
  $$VALUES (0.1000::numeric)$$,
  'setting cost_usd after the generation finished writes the cost'
);
UPDATE public.generations SET cost_usd = 0.5 WHERE id = 'f1500000-0000-4000-8000-000000000016';
SELECT extensions.results_eq(
  $$SELECT count(*)::integer, sum(amount) FROM public.costs WHERE generation_id = 'f1500000-0000-4000-8000-000000000016'$$,
  $$VALUES (1, 0.1000::numeric)$$,
  'a later cost_usd change keeps exactly one row and does not overwrite it'
);

-- İptal edilen / sıfır tutarlı üretim kayıt yazmaz
INSERT INTO public.generations (id, influencer_id, tool, type, status, cost_usd, created_at)
VALUES
  ('f1500000-0000-4000-8000-000000000017', 'f1500000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'cancelled', 0.2, '2026-08-08T11:00:00Z'),
  ('f1500000-0000-4000-8000-000000000018', 'f1500000-0000-4000-8000-000000000001', 'higgsfield', 'image', 'succeeded', 0, '2026-08-08T12:00:00Z');
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.costs WHERE generation_id IN (
      'f1500000-0000-4000-8000-000000000017', 'f1500000-0000-4000-8000-000000000018')$$,
  'cancelled or zero cost_usd generations write no cost'
);

SELECT * FROM extensions.finish();
ROLLBACK;
