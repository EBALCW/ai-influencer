BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(21);
INSERT INTO auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) VALUES
 ('96000000-0000-4000-8000-000000000001','authenticated','authenticated','ai-owner@example.invalid','',now(),now()),
 ('96000000-0000-4000-8000-000000000002','authenticated','authenticated','ai-editor@example.invalid','',now(),now()),
 ('96000000-0000-4000-8000-000000000003','authenticated','authenticated','ai-viewer@example.invalid','',now(),now()),
 ('96000000-0000-4000-8000-000000000004','authenticated','authenticated','ai-outsider@example.invalid','',now(),now());
INSERT INTO public.team_members(user_id,role) VALUES
 ('96000000-0000-4000-8000-000000000001','owner'),('96000000-0000-4000-8000-000000000002','editor'),('96000000-0000-4000-8000-000000000003','viewer');
INSERT INTO public.influencers(id,name,slug) VALUES ('e1000000-0000-4000-8000-000000000001','AI fixture','ai-fixture');
INSERT INTO public.social_accounts(id,influencer_id,platform,handle) VALUES ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','youtube','ai-fixture');
INSERT INTO public.posts(id,account_id,published_at) VALUES ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','2026-11-01T00:00Z');
INSERT INTO public.metric_snapshots(post_id,captured_at,views) VALUES
 ('e3000000-0000-4000-8000-000000000001','2026-11-03T00:00Z',100),
 ('e3000000-0000-4000-8000-000000000001','2026-11-07T00:00Z',300),
 ('e3000000-0000-4000-8000-000000000001','2026-11-10T00:00Z',450),
 ('e3000000-0000-4000-8000-000000000001','2026-11-12T00:00Z',1000);
INSERT INTO public.account_snapshots(account_id,captured_at,followers) VALUES
 ('e2000000-0000-4000-8000-000000000001','2026-11-03T00:00Z',50),
 ('e2000000-0000-4000-8000-000000000001','2026-11-10T00:00Z',80);
SELECT extensions.ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.app_settings'::regclass),'settings have RLS');
SELECT extensions.ok(NOT has_function_privilege('anon','public.ai_weekly_summary(uuid,timestamptz)','EXECUTE'),'anon cannot request summary');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true);
SELECT extensions.lives_ok($$ INSERT INTO public.app_settings(key,value) VALUES ('ai','{"model":"fixture"}') $$,'owner creates settings');
SELECT extensions.is((SELECT created_by::text FROM public.app_settings WHERE key='ai'),'96000000-0000-4000-8000-000000000001','settings audit uses auth user');
SELECT extensions.lives_ok($$ UPDATE public.app_settings SET value='{"model":"updated"}' WHERE key='ai' $$,'owner updates');
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000002',true);
SELECT extensions.is((SELECT count(*)::integer FROM public.app_settings),1,'editor reads');
SELECT extensions.is_empty($$ UPDATE public.app_settings SET value='{}' RETURNING key $$,'editor cannot change model or price');
SELECT extensions.throws_ok($$ INSERT INTO public.app_settings(key,value) VALUES ('ai','{}') $$,'42501',NULL,'editor cannot insert settings');
SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000003',true);
SELECT extensions.is((SELECT count(*)::integer FROM public.app_settings),1,'viewer reads');
SELECT extensions.is_empty($$ DELETE FROM public.app_settings RETURNING key $$,'viewer cannot delete settings');
SELECT extensions.is((public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001','2026-11-10T00:00Z')->>'observedViewIncrease')::integer,350,'cumulative snapshots use latest minus baseline, never sum');
SELECT extensions.is((public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001','2026-11-10T00:00Z')->>'followerChange')::integer,30,'followers use baseline difference');
SELECT extensions.is((public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001','2026-11-10T00:00Z')->>'postsPublished')::integer,0,'old posts are not counted as new');
SELECT extensions.is((public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001','2026-11-02T00:00Z')->>'postsWithViewBaseline')::integer,0,'missing baseline is explicit');
SELECT extensions.ok(public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001','2026-11-02T00:00Z')->'followerChange' = 'null'::jsonb,'missing follower baseline does not invent growth');
RESET ROLE;
INSERT INTO public.posts(id,account_id,published_at) SELECT md5('ai-post-'||n)::uuid,'e2000000-0000-4000-8000-000000000001','2026-11-01T00:00Z' FROM generate_series(1,1001) n;
INSERT INTO public.metric_snapshots(post_id,captured_at,views) SELECT md5('ai-post-'||n)::uuid,'2026-11-03T00:00Z',1 FROM generate_series(1,1001) n;
INSERT INTO public.metric_snapshots(post_id,captured_at,views) SELECT md5('ai-post-'||n)::uuid,'2026-11-10T00:00Z',2 FROM generate_series(1,1001) n;
SET LOCAL ROLE authenticated;
SELECT extensions.is((public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001','2026-11-10T00:00Z')->>'observedViewIncrease')::integer,1351,'SQL aggregation includes more than 1000 posts');
RESET ROLE;
INSERT INTO public.posts(id,account_id,published_at) VALUES ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','2026-11-09T00:00Z');
INSERT INTO public.metric_snapshots(post_id,captured_at,views) VALUES ('e3000000-0000-4000-8000-000000000002','2026-11-10T00:00Z',90);
SET LOCAL ROLE authenticated;
SELECT extensions.is((public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001','2026-11-10T00:00Z')->>'observedViewIncrease')::integer,1441,'new post starts from zero views at publication');
SELECT extensions.is((public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001','2026-11-10T00:00Z')->>'postsPublished')::integer,1,'new post counted in period');

SELECT set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000004',true);
SELECT extensions.is_empty($$ SELECT key FROM public.app_settings $$,'outsider cannot read settings');
SELECT extensions.ok(public.ai_weekly_summary('e1000000-0000-4000-8000-000000000001') IS NULL,'summary respects outsider RLS');
SELECT extensions.is_empty($$ UPDATE public.app_settings SET value='{}' RETURNING key $$,'outsider cannot modify settings');
SELECT * FROM extensions.finish();
ROLLBACK;
