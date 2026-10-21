BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(24);

-- Fixture (postgres rolüyle, RLS dışında). Seed'deki demo kayıtlardan bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('92000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'persona-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'persona-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'persona-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'persona-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('92000000-0000-4000-8000-000000000001', 'owner'),
  ('92000000-0000-4000-8000-000000000002', 'editor'),
  ('92000000-0000-4000-8000-000000000003', 'viewer');
INSERT INTO public.influencers (id, name, slug, status)
VALUES ('b1000000-0000-4000-8000-000000000001', 'Persona Test', 'persona-test', 'active');

SELECT extensions.ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.create_persona_version(uuid, text, text, jsonb, jsonb, text[], jsonb, text, integer, text[])'::regprocedure),
  'create_persona_version is SECURITY INVOKER'
);
SELECT extensions.ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.restore_persona_version(uuid, integer, text)'::regprocedure),
  'restore_persona_version is SECURITY INVOKER'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.create_persona_version(uuid, text, text, jsonb, jsonb, text[], jsonb, text, integer, text[])', 'EXECUTE'),
  'anon cannot execute create_persona_version'
);

-- Editor: iki kayıt + bir geri alma
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);

SELECT extensions.is(
  (public.create_persona_version('b1000000-0000-4000-8000-000000000001', 'İlk bio', 'samimi', '{"adjectives":["meraklı"]}', '{}', ARRAY['mavi saç'], '{}', 'ilk sürüm', NULL, ARRAY['Bugün buradayım, ya sen?'])).version,
  1,
  'first save creates v1'
);
SELECT extensions.is(
  (public.create_persona_version('b1000000-0000-4000-8000-000000000001', 'İkinci bio', 'esprili', '{}', '{}', ARRAY[]::text[], '{"hair":"mavi"}', 'ton değişti')).version,
  2,
  'second save creates v2 (version computed in the database)'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' AND is_current),
  1,
  'exactly one current version after consecutive saves'
);
SELECT extensions.is(
  (SELECT version FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' AND is_current),
  2,
  'latest version is current'
);
SELECT extensions.is(
  (SELECT bio FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' AND version = 1),
  'İlk bio',
  'v1 content is preserved in history'
);
SELECT extensions.is(
  (SELECT created_by FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' AND version = 2),
  '92000000-0000-4000-8000-000000000002'::uuid,
  'created_by comes from auth.uid(), not the client'
);

SELECT extensions.is(
  (SELECT sample_captions FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' AND version = 1),
  ARRAY['Bugün buradayım, ya sen?']::text[],
  'sample captions are saved as part of the persona version'
);

SELECT extensions.results_eq(
  $$SELECT r.version, r.bio, r.tone, r.hook_traits, r.restored_from_version, r.change_note
    FROM public.restore_persona_version('b1000000-0000-4000-8000-000000000001', 1) r$$,
  $$VALUES (3, 'İlk bio'::text, 'samimi'::text, ARRAY['mavi saç']::text[], 1, 'v1 geri alındı'::text)$$,
  'restore creates v3 with v1 content and a default note'
);
SELECT extensions.is(
  (SELECT sample_captions FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' AND version = 3),
  ARRAY['Bugün buradayım, ya sen?']::text[],
  'restore preserves sample captions from the source version'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001'),
  3,
  'restore keeps v1 and v2 (history is linear, nothing deleted)'
);

SELECT extensions.throws_ok(
  $$UPDATE public.influencer_personas SET bio = 'Gizlice değişti' WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' AND version = 1$$,
  '42501', NULL,
  'existing version content cannot be updated'
);
SELECT extensions.throws_ok(
  $$UPDATE public.influencer_personas SET is_current = true WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' AND version = 1$$,
  '42501', NULL,
  'an old version cannot be made current directly'
);
SELECT extensions.is_empty(
  $$DELETE FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' RETURNING id$$,
  'editor cannot delete persona history'
);
SELECT extensions.throws_ok(
  $$SELECT public.restore_persona_version('b1000000-0000-4000-8000-000000000001', 99)$$,
  'P0002', NULL,
  'restoring a missing version fails'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_persona_version('b1000000-0000-4000-8000-0000000000ff', '', '', '{}', '{}', '{}', '{}')$$,
  'P0002', NULL,
  'saving for a missing influencer fails'
);

-- Viewer: okur, yazamaz
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000003', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001'),
  3,
  'viewer can read persona history'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_persona_version('b1000000-0000-4000-8000-000000000001', 'viewer', '', '{}', '{}', '{}', '{}')$$,
  '42501', NULL,
  'viewer cannot create a version'
);
SELECT extensions.throws_ok(
  $$SELECT public.restore_persona_version('b1000000-0000-4000-8000-000000000001', 1)$$,
  '42501', NULL,
  'viewer cannot restore a version'
);
SELECT extensions.is_empty(
  $$UPDATE public.influencer_personas SET is_current = false WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001' RETURNING id$$,
  'viewer cannot touch is_current'
);

-- Ekip dışı: görmez, yazamaz
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000004', true);
SELECT extensions.is_empty(
  $$SELECT id FROM public.influencer_personas WHERE influencer_id = 'b1000000-0000-4000-8000-000000000001'$$,
  'outsider cannot read persona history'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_persona_version('b1000000-0000-4000-8000-000000000001', 'x', '', '{}', '{}', '{}', '{}')$$,
  '42501', NULL,
  'outsider cannot create a version'
);

SELECT * FROM extensions.finish();
ROLLBACK;
