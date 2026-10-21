BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(21);

SELECT extensions.has_table('public', 'influencers');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.influencers'::regclass),
  'influencers has row-level security enabled'
);
SELECT extensions.is((SELECT count(*)::integer FROM public.influencers), 1, 'seed creates one demo influencer');
SELECT extensions.is((SELECT count(*)::integer FROM public.social_accounts), 2, 'seed creates two demo social accounts');
SELECT extensions.is((SELECT count(*)::integer FROM public.posts), 10, 'seed creates ten demo posts');
SELECT extensions.ok(public.is_initial_owner_setup(), 'empty workspace allows first-owner setup');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('90000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
SELECT extensions.lives_ok(
  $$INSERT INTO public.team_members (user_id, role) VALUES (auth.uid(), 'owner')$$,
  'first authenticated user can bootstrap as owner'
);
SELECT extensions.is(public.can_manage_team(), true, 'owner can manage team membership');
SELECT extensions.lives_ok(
  $$INSERT INTO public.team_members (user_id, role) VALUES ('90000000-0000-4000-8000-000000000002', 'viewer')$$,
  'owner can add a viewer'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.team_members (user_id, role) VALUES ('90000000-0000-4000-8000-000000000003', 'editor')$$,
  'owner can add an editor'
);

SELECT set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
SELECT extensions.is(public.is_team_member(), true, 'viewer is recognized as a team member');
SELECT extensions.is(public.can_write_data(), false, 'viewer is read-only');
SELECT extensions.is((SELECT count(*)::integer FROM public.influencers), 1, 'viewer can read team data');
SELECT extensions.throws_ok(
  $$INSERT INTO public.influencers (name, slug) VALUES ('Blocked Creator', 'blocked-creator')$$,
  '42501', NULL,
  'viewer cannot insert team data'
);

SELECT set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
SELECT extensions.is(public.is_team_member(), false, 'uninvited user is not a team member');
SELECT extensions.is((SELECT count(*)::integer FROM public.influencers), 0, 'uninvited user cannot read team data');

SELECT set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
SELECT extensions.is(public.can_write_data(), true, 'editor can write team data');
SELECT extensions.lives_ok(
  $$INSERT INTO public.influencers (name, slug) VALUES ('Editor Test Creator', 'editor-test-creator')$$,
  'editor can insert team data'
);

SELECT set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.team_members WHERE role = 'owner'),
  1,
  'workspace keeps an owner member'
);
SELECT extensions.throws_ok(
  $$DELETE FROM public.team_members WHERE user_id = auth.uid()$$,
  '23514', NULL,
  'the last owner cannot remove their own membership'
);
SELECT extensions.is(
  has_table_privilege('anon', 'public.influencers', 'SELECT'),
  false,
  'anonymous role has no direct table read grant'
);

SELECT * FROM extensions.finish();
ROLLBACK;
