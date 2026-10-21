BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(33);

INSERT INTO auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) VALUES
 ('94000000-0000-4000-8000-000000000001','authenticated','authenticated','content-editor@example.invalid','',now(),now()),
 ('94000000-0000-4000-8000-000000000002','authenticated','authenticated','content-viewer@example.invalid','',now(),now()),
 ('94000000-0000-4000-8000-000000000003','authenticated','authenticated','content-outsider@example.invalid','',now(),now());
INSERT INTO public.team_members(user_id,role) VALUES
 ('94000000-0000-4000-8000-000000000001','editor'), ('94000000-0000-4000-8000-000000000002','viewer');
INSERT INTO public.influencers(id,name,slug) VALUES
 ('c1000000-0000-4000-8000-000000000001','Content fixture','content-fixture'),
 ('c1000000-0000-4000-8000-000000000002','Other fixture','other-content-fixture');
INSERT INTO public.social_accounts(id,influencer_id,platform,handle) VALUES
 ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','instagram','content-fixture'),
 ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','youtube','other-content-fixture');
INSERT INTO public.assets(id,influencer_id,kind,storage_path) VALUES
 ('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','reference','content-fixture/ref.png'),
 ('c3000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','reference','other-content-fixture/ref.png');
INSERT INTO public.posts(id,account_id,published_at) VALUES
 ('c4000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','2026-11-10T12:00:00Z');
INSERT INTO public.metric_snapshots(post_id,captured_at,views) VALUES
 ('c4000000-0000-4000-8000-000000000001','2026-11-10T13:00:00Z',20),
 ('c4000000-0000-4000-8000-000000000001','2026-11-11T12:00:00Z',42);
SELECT set_config('test.ready_checklist', jsonb_build_object('items',
 (SELECT jsonb_object_agg(key,true) FROM unnest(ARRAY[
 'hook_opening','hook_character','hook_pacing','hook_payoff','hook_loop',
 'engagement_reason','engagement_caption','engagement_honesty',
 'quality_format','quality_anatomy','quality_text','quality_silent','quality_audio','quality_cover',
 'ai_disclosure','ai_identity','ai_consent','ai_claims','ai_brands',
 'commercial_disclosure','commercial_tool','commercial_rights','commercial_engagement','commercial_minor'
 ]) AS key), 'hookScore',4,'engagementScore',3,'decision','ready')::text,true);

SELECT extensions.ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.content_item_assets'::regclass), 'media table has RLS');
SELECT extensions.ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.posting_slots'::regclass), 'slots table has RLS');
SELECT extensions.ok(public.content_checklist_ready(current_setting('test.ready_checklist')::jsonb), 'complete checklist is ready');
SELECT extensions.ok(NOT public.content_checklist_ready('{}'), 'empty checklist cannot schedule');
SELECT extensions.ok(NOT public.content_checklist_ready(jsonb_set(current_setting('test.ready_checklist')::jsonb,'{items,ai_disclosure}','false')), 'AI disclosure is mandatory');
SELECT extensions.ok(NOT public.content_checklist_ready(jsonb_set(current_setting('test.ready_checklist')::jsonb,'{items,commercial_disclosure}','"true"')), 'string true cannot bypass boolean checkbox');
SELECT extensions.ok(NOT has_function_privilege('anon','public.save_content_item(uuid,jsonb,uuid[],uuid[],timestamptz)','EXECUTE'), 'anon cannot call mutation RPC');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
SELECT set_config('test.content_id',(public.save_content_item(NULL,
 '{"influencer_id":"c1000000-0000-4000-8000-000000000001","title":"İlk fikir","created_by":"94000000-0000-4000-8000-000000000002"}',
 ARRAY['c3000000-0000-4000-8000-000000000001']::uuid[])).id::text,true);
SELECT extensions.is((SELECT created_by FROM public.content_items WHERE id=current_setting('test.content_id')::uuid),
 '94000000-0000-4000-8000-000000000001'::uuid,'creator cannot be spoofed');
SELECT extensions.is((SELECT count(*)::int FROM public.content_item_assets WHERE content_item_id=current_setting('test.content_id')::uuid),1,'content and attached media saved atomically');
SELECT extensions.throws_ok($$UPDATE public.content_items SET stage='scheduled', target_account_id='c2000000-0000-4000-8000-000000000001',scheduled_at='2026-11-01T09:00:00Z' WHERE id=current_setting('test.content_id')::uuid$$,
 '23514',NULL,'direct database write cannot bypass checklist');
UPDATE public.content_items SET checklist='{"hookScore":2,"engagementScore":4}',stage='qc' WHERE id=current_setting('test.content_id')::uuid;
SELECT extensions.is((SELECT stage::text FROM public.content_items WHERE id=current_setting('test.content_id')::uuid),'edit','score below three returns card to edit');
SELECT extensions.lives_ok($$UPDATE public.content_items SET checklist=current_setting('test.ready_checklist')::jsonb,stage='scheduled',target_account_id='c2000000-0000-4000-8000-000000000001',scheduled_at='2026-11-01T09:00:00Z' WHERE id=current_setting('test.content_id')::uuid$$,'complete checklist can schedule');
SELECT extensions.throws_ok($$UPDATE public.content_items SET target_account_id='c2000000-0000-4000-8000-000000000002' WHERE id=current_setting('test.content_id')::uuid$$,'23514',NULL,'cross-influencer account rejected');
SELECT extensions.throws_ok($$INSERT INTO public.content_item_assets(content_item_id,asset_id) VALUES(current_setting('test.content_id')::uuid,'c3000000-0000-4000-8000-000000000002')$$,'23514',NULL,'cross-influencer asset rejected');
SELECT extensions.throws_ok($$SELECT public.save_content_item(current_setting('test.content_id')::uuid,'{"title":"must roll back"}',ARRAY['c3000000-0000-4000-8000-000000000002']::uuid[])$$,'23514',NULL,'invalid media rolls back the content change');
SELECT extensions.is((SELECT title FROM public.content_items WHERE id=current_setting('test.content_id')::uuid),'İlk fikir','failed atomic save preserves title');
SELECT extensions.throws_ok($$SELECT public.save_content_item(current_setting('test.content_id')::uuid,'{"title":"stale"}',NULL,NULL,'2000-01-01T00:00:00Z')$$,'40001',NULL,'stale update rejected');
SELECT extensions.lives_ok($$INSERT INTO public.posting_slots(account_id,weekday,local_time,timezone) VALUES('c2000000-0000-4000-8000-000000000001',1,'12:00','Europe/Istanbul')$$,'editor creates posting slot');
SELECT extensions.throws_ok($$INSERT INTO public.posting_slots(account_id,weekday,local_time,timezone) VALUES('c2000000-0000-4000-8000-000000000001',2,'12:00','Unknown/Zone')$$,'23514',NULL,'invalid timezone rejected');
INSERT INTO public.content_items(id,influencer_id,title,target_account_id,stage,scheduled_at,checklist) VALUES
 ('c5000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','Second','c2000000-0000-4000-8000-000000000001','scheduled','2026-11-01T14:00:00Z',current_setting('test.ready_checklist')::jsonb);
SELECT extensions.is(cardinality(public.content_schedule_warnings(current_setting('test.content_id')::uuid)),0,'exactly five hours is allowed');
UPDATE public.content_items SET scheduled_at='2026-11-01T13:59:00Z' WHERE id='c5000000-0000-4000-8000-000000000002';
SELECT extensions.is(cardinality(public.content_schedule_warnings(current_setting('test.content_id')::uuid)),1,'four hours fifty-nine minutes warns');
INSERT INTO public.content_items(influencer_id,title,target_account_id,stage,scheduled_at,checklist)
 SELECT 'c1000000-0000-4000-8000-000000000001','extra','c2000000-0000-4000-8000-000000000001','scheduled','2026-11-01T15:00:00Z'::timestamptz + n*interval '30 minutes',current_setting('test.ready_checklist')::jsonb FROM generate_series(1,3) n;
SELECT extensions.is(cardinality(public.content_schedule_warnings(current_setting('test.content_id')::uuid)),2,'fifth post on same local day warns');
SELECT extensions.lives_ok($$SELECT public.link_content_post(current_setting('test.content_id')::uuid,'c4000000-0000-4000-8000-000000000001')$$,'published post can be matched manually');
SELECT extensions.is((SELECT stage::text FROM public.content_items WHERE id=current_setting('test.content_id')::uuid),'published','matching moves content to published');
SELECT extensions.is((public.content_item_details(ARRAY[current_setting('test.content_id')::uuid])->0->'posts'->0->>'views')::bigint,42::bigint,'only latest snapshot contributes post metrics');

SELECT set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
SELECT extensions.is_empty($$UPDATE public.content_items SET title='viewer' WHERE id=current_setting('test.content_id')::uuid RETURNING id$$,'viewer cannot move or edit content');
SELECT extensions.is_empty($$UPDATE public.posting_slots SET local_time='13:00' RETURNING id$$,'viewer cannot edit slots');
SELECT extensions.throws_ok($$INSERT INTO public.content_item_assets(content_item_id,asset_id) VALUES(current_setting('test.content_id')::uuid,'c3000000-0000-4000-8000-000000000001')$$,'42501',NULL,'viewer cannot attach media');
SELECT extensions.throws_ok($$SELECT public.link_content_post(current_setting('test.content_id')::uuid,'c4000000-0000-4000-8000-000000000001')$$,'42501',NULL,'viewer cannot match post');
SELECT set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000003',true);
SELECT extensions.is_empty($$SELECT id FROM public.content_items WHERE influencer_id='c1000000-0000-4000-8000-000000000001'$$,'outsider cannot read content');
SELECT extensions.is_empty($$SELECT id FROM public.content_item_assets$$,'outsider cannot read media links');
SELECT extensions.is_empty($$SELECT id FROM public.posting_slots$$,'outsider cannot read posting slots');
SELECT extensions.is(public.content_item_details(ARRAY[current_setting('test.content_id')::uuid]),'[]'::jsonb,'details RPC respects RLS');
SELECT * FROM extensions.finish();
ROLLBACK;
