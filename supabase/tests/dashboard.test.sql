BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(28);
INSERT INTO auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) VALUES
 ('97000000-0000-4000-8000-000000000001','authenticated','authenticated','dash-viewer@example.invalid','',now(),now()),
 ('97000000-0000-4000-8000-000000000002','authenticated','authenticated','dash-outsider@example.invalid','',now(),now());
INSERT INTO public.team_members(user_id,role) VALUES ('97000000-0000-4000-8000-000000000001','viewer');
INSERT INTO public.influencers(id,name,slug) VALUES ('f1000000-0000-4000-8000-000000000001','Dashboard fixture','dashboard-fixture');
INSERT INTO public.social_accounts(id,influencer_id,platform,handle) VALUES
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','instagram','dash-ig'),
 ('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','youtube','dash-yt');
INSERT INTO public.content_items(id,influencer_id,title) VALUES ('f4000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Same content');
INSERT INTO public.posts(id,account_id,published_at,content_item_id) VALUES
 ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','2026-11-01T00:00Z',NULL),
 ('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','2026-11-04T00:00Z','f4000000-0000-4000-8000-000000000001'),
 ('f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000002','2026-11-04T00:00Z','f4000000-0000-4000-8000-000000000001');
INSERT INTO public.metric_snapshots(post_id,captured_at,hours_since_publish,views,likes) VALUES
 ('f3000000-0000-4000-8000-000000000001','2026-11-02T00:00Z',24,100,10),
 ('f3000000-0000-4000-8000-000000000001','2026-11-03T12:00Z',60,300,30),
 ('f3000000-0000-4000-8000-000000000001','2026-11-03T23:00Z',71,250,25),
 ('f3000000-0000-4000-8000-000000000001','2026-11-04T23:00Z',95,450,45),
 ('f3000000-0000-4000-8000-000000000002','2026-11-05T00:00Z',24,90,9),
 ('f3000000-0000-4000-8000-000000000002','2026-11-05T02:00Z',26,99,10),
 ('f3000000-0000-4000-8000-000000000003','2026-11-05T00:00Z',24,200,20),
 ('f3000000-0000-4000-8000-000000000003','2026-11-06T00:00Z',48,9999,999);
INSERT INTO public.account_snapshots(account_id,captured_at,followers) VALUES
 ('f2000000-0000-4000-8000-000000000001','2026-11-03T00:00Z',100),
 ('f2000000-0000-4000-8000-000000000001','2026-11-05T00:00Z',130),
 ('f2000000-0000-4000-8000-000000000002','2026-11-03T00:00Z',50),
 ('f2000000-0000-4000-8000-000000000002','2026-11-05T00:00Z',40);
INSERT INTO public.costs(influencer_id,category,amount,currency,incurred_on) VALUES
 ('f1000000-0000-4000-8000-000000000001','other',20,'USD','2026-11-04'),
 ('f1000000-0000-4000-8000-000000000001','other',600,'TRY','2026-11-04');
SELECT extensions.ok(NOT has_function_privilege('anon','public.dashboard_overview(date,date,text,public.social_platform)','EXECUTE'),'anon cannot execute');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000001',true);
SELECT extensions.is((public.dashboard_overview('2026-10-01','2026-10-10','demo-creator')->>'views')::integer,20140,'seed views match SQL total');
SELECT extensions.is((public.dashboard_overview('2026-10-01','2026-10-10','demo-creator')->>'published')::integer,10,'seed has ten published posts');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->>'followers')::integer,170,'latest follower totals, no future snapshot');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->>'followerChange')::integer,20,'baseline follower change');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->>'views')::integer,649,'latest daily readings, baseline difference, new posts and future excluded');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture','instagram')->>'views')::integer,449,'platform filter applies to totals');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->>'published')::integer,2,'old post excluded from published count');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->>'engagementViews')::integer,299,'engagement uses cohort latest snapshots');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->'daily'->0->>'views')::integer,150,'daily chart uses last reading, not highest reading');
SELECT extensions.is(jsonb_array_length(public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->'costs'),2,'currencies remain separate');
SELECT extensions.is(public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->'costs'->1->>'perVideo','10.0000','USD cost divided by two posts');
SELECT extensions.is(public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture','instagram')->'costs','[]'::jsonb,'unattributable platform costs are not invented');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->'best'->0->>'views')::integer,200,'24h ranking uses target snapshot');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->'worst'->0->>'views')::integer,90,'24h ranking chooses first snapshot in window');
SELECT extensions.is(jsonb_array_length(public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->'comparisons'),1,'same content compares platforms');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->>'pendingCount')::integer,1,'pending content included');
SELECT extensions.is(public.dashboard_overview('2026-11-03','2026-11-05','unknown')->'validInfluencer','false'::jsonb,'unknown influencer cannot fall back to all');
SELECT extensions.throws_ok($$ SELECT public.dashboard_overview('2026-11-05','2026-11-03') $$,'22023',NULL,'reversed period rejected');
SELECT extensions.throws_ok($$ SELECT public.dashboard_overview('2025-01-01','2026-11-03') $$,'22023',NULL,'unbounded period rejected');
RESET ROLE;
INSERT INTO public.posts(id,account_id,published_at) SELECT md5('dashboard-post-'||n)::uuid,'f2000000-0000-4000-8000-000000000001','2026-11-04T00:00Z' FROM generate_series(1,1001) n;
INSERT INTO public.metric_snapshots(post_id,captured_at,views) SELECT md5('dashboard-post-'||n)::uuid,'2026-11-05T00:00Z',1 FROM generate_series(1,1001) n;
SET LOCAL ROLE authenticated;
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->>'views')::integer,1650,'aggregates beyond 1000 rows');
RESET ROLE;
INSERT INTO public.social_accounts(id,influencer_id,platform,handle) VALUES
 ('f2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001','tiktok','dash-missing');
INSERT INTO public.posts(id,account_id,published_at) VALUES
 ('f3000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000003','2026-10-01T00:00Z');
INSERT INTO public.metric_snapshots(post_id,captured_at,views) VALUES
 ('f3000000-0000-4000-8000-000000000004','2026-11-03T12:00Z',400),
 ('f3000000-0000-4000-8000-000000000004','2026-11-04T12:00Z',350),
 ('f3000000-0000-4000-8000-000000000004','2026-11-05T12:00Z',500);
INSERT INTO public.content_items(influencer_id,title,scheduled_at,target_account_id) VALUES
 ('f1000000-0000-4000-8000-000000000001','Today fixture',now(),'f2000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture','tiktok')->>'views')::integer,150,'missing baseline excluded and negative daily deltas clamped');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture','tiktok')->>'postsWithoutBaseline')::integer,1,'missing baseline coverage explicit');
SELECT extensions.is(public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture','tiktok')->'followers','null'::jsonb,'missing follower measurements are not zero');
SELECT extensions.is(public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture','tiktok')->'best','[]'::jsonb,'missing target-hour measurements not ranked');
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture','tiktok')->>'todayCount')::integer,1,'today plan is Istanbul date and keeps platform filter');
SELECT set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000002',true);
SELECT extensions.is((public.dashboard_overview('2026-11-03','2026-11-05')->>'accounts')::integer,0,'outsider cannot read aggregate data');
SELECT extensions.is(public.dashboard_overview('2026-11-03','2026-11-05','dashboard-fixture')->'validInfluencer','false'::jsonb,'outsider cannot resolve influencer');
SELECT * FROM extensions.finish();
ROLLBACK;
