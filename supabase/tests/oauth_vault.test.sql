BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(43);

INSERT INTO auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) VALUES
 ('95000000-0000-4000-8000-000000000001','authenticated','authenticated','vault-editor@example.invalid','',now(),now()),
 ('95000000-0000-4000-8000-000000000002','authenticated','authenticated','vault-viewer@example.invalid','',now(),now()),
 ('95000000-0000-4000-8000-000000000003','authenticated','authenticated','vault-outsider@example.invalid','',now(),now());
INSERT INTO public.team_members(user_id,role) VALUES
 ('95000000-0000-4000-8000-000000000001','editor'), ('95000000-0000-4000-8000-000000000002','viewer');
INSERT INTO public.influencers(id,name,slug) VALUES
 ('d1000000-0000-4000-8000-000000000001','Vault fixture','vault-fixture');
INSERT INTO public.social_accounts(id,influencer_id,platform,handle) VALUES
 ('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','instagram','vault-fixture'),
 ('d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','youtube','vault-fixture-youtube');
INSERT INTO public.posts(id,account_id,published_at) VALUES
 ('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',now());

SELECT extensions.ok(NOT has_function_privilege('anon','public.store_social_token(uuid,jsonb,timestamptz)','EXECUTE'), 'anon cannot store');
SELECT extensions.ok(NOT has_function_privilege('authenticated','public.store_social_token(uuid,jsonb,timestamptz)','EXECUTE'), 'team cannot store');
SELECT extensions.ok(NOT has_function_privilege('authenticated','public.read_social_token(uuid)','EXECUTE'), 'team cannot read');
SELECT extensions.ok(NOT has_function_privilege('authenticated','public.delete_social_token(uuid)','EXECUTE'), 'team cannot delete');
SELECT extensions.ok(NOT has_function_privilege('anon','public.read_social_token(uuid)','EXECUTE'), 'anon cannot read');
SELECT extensions.ok(NOT has_function_privilege('anon','public.delete_social_token(uuid)','EXECUTE'), 'anon cannot delete');
SELECT extensions.ok(has_function_privilege('service_role','public.store_social_token(uuid,jsonb,timestamptz)','EXECUTE'), 'service can store');
SELECT extensions.ok(has_function_privilege('service_role','public.read_social_token(uuid)','EXECUTE'), 'service can read');
SELECT extensions.ok(has_function_privilege('service_role','public.delete_social_token(uuid)','EXECUTE'), 'service can delete');
SELECT extensions.ok((SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=""']) FROM pg_proc
  WHERE oid IN ('public.store_social_token(uuid,jsonb,timestamptz)'::regprocedure,
    'public.read_social_token(uuid)'::regprocedure,'public.delete_social_token(uuid)'::regprocedure)), 'RPCs have fixed search_path');

SET LOCAL ROLE service_role;
SELECT extensions.throws_ok($$ SELECT * FROM vault.decrypted_secrets $$,'42501',NULL,'service cannot bypass RPC to read raw Vault');
SELECT extensions.throws_ok($$ SELECT public.store_social_token('d2000000-0000-4000-8000-000000000001','{}') $$,'22023',NULL,'missing access token rejected');
SELECT extensions.throws_ok($$ SELECT public.store_social_token('d2000000-0000-4000-8000-000000000001','{"access_token":123}') $$,'22023',NULL,'numeric token rejected');
SELECT extensions.throws_ok($$ SELECT public.store_social_token('d2000000-0000-4000-8000-000000000001','{"access_token":"fixture","unexpected":"data"}') $$,'22023',NULL,'unknown provider payload not stored');
SELECT extensions.throws_ok($$ SELECT public.store_social_token('d2000000-0000-4000-8000-000000000001','{"access_token":"fixture","refresh_token":null}') $$,'22023',NULL,'null refresh token rejected');
SELECT extensions.throws_ok($$ SELECT public.store_social_token('d2000000-0000-4000-8000-000000000001','{"access_token":"fixture"}',now()-interval '1 minute') $$,'22023',NULL,'expired token rejected');
SELECT extensions.throws_ok($$ SELECT public.store_social_token('d2000000-0000-4000-8000-000000000001','{"access_token":"fixture"}','infinity') $$,'22023',NULL,'infinite expiry rejected');
SELECT extensions.throws_ok($$ SELECT public.store_social_token('00000000-0000-4000-8000-000000000000','{"access_token":"fixture"}') $$,'P0002',NULL,'unknown account rejected');
SELECT set_config('test.secret_id',public.store_social_token('d2000000-0000-4000-8000-000000000001',
 '{"access_token":"fixture-access-v1","refresh_token":"fixture-refresh-v1","token_type":"Bearer"}',now()+interval '1 hour')::text,true);
SELECT extensions.is((SELECT token_ref FROM public.social_accounts WHERE id='d2000000-0000-4000-8000-000000000001'),current_setting('test.secret_id'),'account holds only UUID reference');
SELECT extensions.is((SELECT status::text FROM public.social_accounts WHERE id='d2000000-0000-4000-8000-000000000001'),'active','store activates account');
SELECT extensions.is(public.read_social_token('d2000000-0000-4000-8000-000000000001')->>'access_token','fixture-access-v1','service reads decrypted access token');
SELECT extensions.is(public.store_social_token('d2000000-0000-4000-8000-000000000001',
 '{"access_token":"fixture-access-v2","refresh_token":"fixture-refresh-v2"}',now()+interval '2 hours')::text,current_setting('test.secret_id'),'rotation reuses the same secret');
SELECT extensions.is(public.read_social_token('d2000000-0000-4000-8000-000000000001')->>'refresh_token','fixture-refresh-v2','rotation replaces refresh token');
RESET ROLE;
SELECT extensions.is((SELECT count(*)::integer FROM vault.secrets WHERE name='social-token:d2000000-0000-4000-8000-000000000001'),1,'rotation leaves one encrypted secret');
SELECT extensions.ok((SELECT secret NOT LIKE '%fixture-access%' AND secret NOT LIKE '%fixture-refresh%' FROM vault.secrets WHERE id=current_setting('test.secret_id')::uuid),'stored Vault value is encrypted');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
SELECT extensions.throws_ok($$ SELECT * FROM vault.decrypted_secrets $$,'42501',NULL,'editor cannot read raw secrets');
SELECT extensions.throws_ok($$ SELECT public.read_social_token('d2000000-0000-4000-8000-000000000001') $$,'42501',NULL,'editor cannot call read RPC');
SELECT extensions.throws_ok($$ SELECT public.store_social_token('d2000000-0000-4000-8000-000000000001','{"access_token":"fixture"}') $$,'42501',NULL,'editor cannot call store RPC');
SELECT extensions.throws_ok($$ UPDATE public.social_accounts SET token_ref='fixture-plaintext' WHERE id='d2000000-0000-4000-8000-000000000001' $$,'42501',NULL,'editor cannot inject plaintext or arbitrary secret reference');
SELECT extensions.throws_ok($$ UPDATE public.social_accounts SET token_expires_at=now() WHERE id='d2000000-0000-4000-8000-000000000001' $$,'42501',NULL,'editor cannot change expiry');
SELECT extensions.throws_ok($$ UPDATE public.social_accounts SET platform='tiktok' WHERE id='d2000000-0000-4000-8000-000000000001' $$,'42501',NULL,'connected account identity cannot be reassigned by editor');
SELECT extensions.lives_ok($$ UPDATE public.social_accounts SET handle='renamed-fixture' WHERE id='d2000000-0000-4000-8000-000000000001' $$,'ordinary metadata remains editable');
SELECT extensions.throws_ok($$ INSERT INTO public.social_accounts(influencer_id,platform,handle,token_ref) VALUES ('d1000000-0000-4000-8000-000000000001','tiktok','injected','fixture-token') $$,'42501',NULL,'editor cannot insert token fields');
SELECT set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
SELECT extensions.is_empty($$ UPDATE public.social_accounts SET handle='viewer' WHERE id='d2000000-0000-4000-8000-000000000001' RETURNING id $$,'viewer cannot modify account');
SELECT set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000003',true);
SELECT extensions.is_empty($$ SELECT id FROM public.social_accounts $$,'outsider sees no accounts or references');
RESET ROLE;
-- Eski/bozuk bir referans başka hesaba ait sırrı açığa çıkaramaz veya silemez.
UPDATE public.social_accounts SET token_ref=current_setting('test.secret_id') WHERE id='d2000000-0000-4000-8000-000000000002';
SET LOCAL ROLE service_role;
SELECT extensions.ok(public.read_social_token('d2000000-0000-4000-8000-000000000002') IS NULL,'cross-account reference does not decrypt');
SELECT public.delete_social_token('d2000000-0000-4000-8000-000000000002');
SELECT extensions.is(public.read_social_token('d2000000-0000-4000-8000-000000000001')->>'access_token','fixture-access-v2','cross-account delete preserves original secret');
SELECT public.delete_social_token('d2000000-0000-4000-8000-000000000001');
SELECT extensions.ok(public.read_social_token('d2000000-0000-4000-8000-000000000001') IS NULL,'revoked account no longer decrypts');
SELECT extensions.is((SELECT status::text FROM public.social_accounts WHERE id='d2000000-0000-4000-8000-000000000001'),'revoked','disconnect marks account revoked');
SELECT extensions.is((SELECT count(*)::integer FROM public.posts WHERE account_id='d2000000-0000-4000-8000-000000000001'),1,'disconnect preserves post history');
SELECT extensions.lives_ok($$ SELECT public.delete_social_token('d2000000-0000-4000-8000-000000000001') $$,'disconnect is idempotent');
SELECT public.store_social_token('d2000000-0000-4000-8000-000000000002','{"access_token":"fixture-cleanup"}');
RESET ROLE;
SELECT extensions.is((SELECT count(*)::integer FROM vault.secrets WHERE name='social-token:d2000000-0000-4000-8000-000000000001'),0,'disconnect deletes encrypted secret');
DELETE FROM public.posts WHERE id='d3000000-0000-4000-8000-000000000001';
DELETE FROM public.influencers WHERE id='d1000000-0000-4000-8000-000000000001';
SELECT extensions.is((SELECT count(*)::integer FROM vault.secrets WHERE name='social-token:d2000000-0000-4000-8000-000000000002'),0,'account cascade cleans encrypted secret');
SELECT * FROM extensions.finish();
ROLLBACK;
