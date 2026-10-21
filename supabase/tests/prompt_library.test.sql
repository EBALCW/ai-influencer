BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(20);

-- Fixture (postgres rolüyle, RLS dışında). Seed'deki demo kayıtlardan bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('92000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'prompt-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'prompt-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'prompt-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('92000000-0000-4000-8000-000000000001', 'editor'),
  ('92000000-0000-4000-8000-000000000002', 'viewer');
INSERT INTO public.influencers (id, name, slug, status)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'Prompt Test A', 'prompt-test-a', 'active'),
  ('b1000000-0000-4000-8000-000000000002', 'Prompt Test B', 'prompt-test-b', 'active');

-- Yapı ve yetki
SELECT extensions.ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.create_prompt_version(public.prompt_category, text, text, text, text, jsonb, uuid, text)'::regprocedure),
  'create_prompt_version is SECURITY INVOKER (caller RLS applies)'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.create_prompt_version(public.prompt_category, text, text, text, text, jsonb, uuid, text)', 'EXECUTE'),
  'anon cannot execute create_prompt_version'
);
SELECT extensions.ok(
  (SELECT 'security_invoker=true' = ANY (reloptions) FROM pg_class WHERE oid = 'public.prompt_stats'::regclass),
  'prompt_stats is a security_invoker view'
);
SELECT extensions.ok(
  (SELECT 'security_invoker=true' = ANY (reloptions) FROM pg_class WHERE oid = 'public.prompt_lineages'::regclass),
  'prompt_lineages is a security_invoker view'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.prompt_stats', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.prompt_stats', 'INSERT'),
  'prompt_stats: no anon access, authenticated is read-only'
);

-- Editor: versiyonlama
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);

SELECT extensions.is(
  (SELECT version FROM public.create_prompt_version('caption', 'gunluk', 'Günlük caption', 'Konu: {{konu}}')),
  1,
  'first version of a new lineage is v1'
);
SELECT extensions.is(
  (SELECT version FROM public.create_prompt_version('caption', 'gunluk', 'Günlük caption', 'Konu: {{konu}} · ton: {{ton}}', '', '{}'::jsonb, NULL, 'ton eklendi')),
  2,
  'same scope + category + key creates the next version'
);
SELECT extensions.is(
  (SELECT version FROM public.create_prompt_version('caption', 'gunluk', 'A için caption', 'A: {{konu}}', '', '{}'::jsonb, 'b1000000-0000-4000-8000-000000000001')),
  1,
  'same key in an influencer scope is a separate lineage (v1)'
);
SELECT extensions.is(
  (SELECT version FROM public.create_prompt_version('caption', 'baska', 'Başka caption', 'Metin')),
  1,
  'a different key in the same scope + category is a separate lineage'
);
SELECT extensions.is(
  (SELECT version_count FROM public.prompt_lineages WHERE influencer_id IS NULL AND category = 'caption' AND key = 'gunluk'),
  2,
  'prompt_lineages returns the latest version with the version count'
);

SELECT extensions.throws_ok(
  $$UPDATE public.prompts SET body = 'değişti' WHERE key = 'gunluk' AND version = 1 AND influencer_id IS NULL$$,
  '23514', NULL,
  'content of an existing version cannot be changed'
);
SELECT extensions.results_eq(
  $$UPDATE public.prompts SET rating = 4 WHERE key = 'gunluk' AND version = 2 AND influencer_id IS NULL RETURNING rating$$,
  $$VALUES (4.0::numeric(2, 1))$$,
  'editor can rate a version'
);
SELECT extensions.throws_ok(
  $$UPDATE public.prompts SET rating = 0 WHERE key = 'gunluk' AND version = 2 AND influencer_id IS NULL$$,
  '23514', NULL,
  'rating below 1 is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_prompt_version('caption', 'Gecersiz Key', 'X', 'Metin')$$,
  '23514', NULL,
  'key must be a lowercase slug'
);

-- Başarı oranı fixture'ı (postgres rolüyle)
RESET ROLE;
INSERT INTO public.generations (influencer_id, prompt_id, tool, type, status, credits)
SELECT 'b1000000-0000-4000-8000-000000000001', p.id, 'mock', 'image', s.status::public.generation_status, s.credits
FROM public.prompts p
CROSS JOIN (VALUES ('succeeded', 2.0), ('succeeded', 4.0), ('failed', 1.0), ('queued', NULL), ('cancelled', NULL)) AS s (status, credits)
WHERE p.influencer_id IS NULL AND p.key = 'gunluk' AND p.version = 2;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
SELECT extensions.results_eq(
  $$SELECT s.total, s.succeeded, s.failed, s.pending, s.success_rate, s.avg_credits
    FROM public.prompt_stats s JOIN public.prompts p ON p.id = s.prompt_id
    WHERE p.influencer_id IS NULL AND p.key = 'gunluk' AND p.version = 2$$,
  $$VALUES (5, 2, 1, 1, 0.6667::numeric, 3.0000::numeric)$$,
  'stats: success rate = succeeded / (succeeded + failed); avg credits of succeeded only'
);
SELECT extensions.ok(
  (SELECT s.success_rate IS NULL AND s.total = 0
   FROM public.prompt_stats s JOIN public.prompts p ON p.id = s.prompt_id
   WHERE p.key = 'baska'),
  'a version without finished generations has no success rate (not 0%)'
);

-- Viewer: okur, yazamaz
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
SELECT extensions.ok(
  (SELECT count(*) FROM public.prompts) >= 4,
  'viewer can read prompts'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_prompt_version('caption', 'viewer-denemesi', 'X', 'Metin')$$,
  '42501', NULL,
  'viewer cannot create a prompt version'
);
SELECT extensions.is_empty(
  $$UPDATE public.prompts SET rating = 5 WHERE key = 'gunluk' RETURNING id$$,
  'viewer cannot rate (0 rows updated)'
);

-- Ekip dışı: hiçbir şey görmez
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000003', true);
SELECT extensions.ok(
  (SELECT count(*) FROM public.prompts) = 0
    AND (SELECT count(*) FROM public.prompt_stats) = 0
    AND (SELECT count(*) FROM public.prompt_lineages) = 0,
  'outsider sees no prompts, stats or lineages'
);

SELECT * FROM extensions.finish();
ROLLBACK;
