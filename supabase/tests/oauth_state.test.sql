BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(13);
INSERT INTO auth.users(id,aud,role,email) VALUES
 ('96000000-0000-4000-8000-000000000001','authenticated','authenticated','oauth-editor@example.invalid'),
 ('96000000-0000-4000-8000-000000000002','authenticated','authenticated','oauth-viewer@example.invalid');
INSERT INTO public.team_members(user_id,role) VALUES
 ('96000000-0000-4000-8000-000000000001','editor'),('96000000-0000-4000-8000-000000000002','viewer');
INSERT INTO public.influencers(id,name,slug) VALUES ('e1000000-0000-4000-8000-000000000001','OAuth fixture','oauth-state-fixture');
SELECT extensions.ok(NOT has_table_privilege('authenticated','private.oauth_states','SELECT'),'client cannot read verifier');
SELECT extensions.ok(NOT has_table_privilege('service_role','private.oauth_states','SELECT'),'service must use RPC');
SELECT extensions.ok(NOT has_function_privilege('authenticated','public.oauth_state_consume(text,uuid,uuid,public.social_platform)','EXECUTE'),'client cannot consume');
SELECT extensions.ok(NOT has_function_privilege('anon','public.oauth_state_save(text,uuid,uuid,public.social_platform,text,timestamptz)','EXECUTE'),'anon cannot save');
SET LOCAL ROLE service_role;
SELECT extensions.throws_ok($$SELECT public.oauth_state_save(repeat('a',43),'96000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','youtube',repeat('v',43),now()+interval '5 minutes')$$,'42501',NULL,'viewer rejected');
SELECT extensions.throws_ok($$SELECT public.oauth_state_save(repeat('a',43),'96000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','youtube',repeat('v',43),now()+interval '20 minutes')$$,'22023',NULL,'TTL bounded');
SELECT extensions.lives_ok($$SELECT public.oauth_state_save(repeat('a',43),'96000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','youtube',repeat('v',43),now()+interval '5 minutes')$$,'editor saves');
SELECT extensions.ok(public.oauth_state_consume(repeat('a',43),'96000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','tiktok') IS NULL,'wrong platform does not consume');
SELECT extensions.ok(public.oauth_state_consume(repeat('a',43),'96000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','youtube') IS NULL,'wrong user does not consume');
SELECT extensions.is(public.oauth_state_consume(repeat('a',43),'96000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','youtube')->>'verifier',repeat('v',43),'correct callback gets verifier');
SELECT extensions.ok(public.oauth_state_consume(repeat('a',43),'96000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','youtube') IS NULL,'replay rejected');
RESET ROLE;
SELECT extensions.lives_ok($$INSERT INTO private.oauth_states VALUES(repeat('b',43),'96000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','youtube',repeat('v',43),now()-interval '1 minute')$$,'expired fixture');
SET LOCAL ROLE service_role;
SELECT extensions.ok(public.oauth_state_consume(repeat('b',43),'96000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','youtube') IS NULL,'expired state rejected');
RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
