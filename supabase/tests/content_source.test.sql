-- #145 v2v kaynak alanları ve #22 check-list takibi (hashtag maddesi, puanlayan ≠ üreten).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(36);

-- Fixture (postgres rolüyle, RLS dışında).
INSERT INTO auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) VALUES
 ('96450000-0000-4000-8000-000000000001','authenticated','authenticated','src-producer@example.invalid','',now(),now()),
 ('96450000-0000-4000-8000-000000000002','authenticated','authenticated','src-reviewer@example.invalid','',now(),now()),
 ('96450000-0000-4000-8000-000000000003','authenticated','authenticated','src-viewer@example.invalid','',now(),now()),
 ('96450000-0000-4000-8000-000000000004','authenticated','authenticated','src-outsider@example.invalid','',now(),now());
INSERT INTO public.team_members(user_id,role) VALUES
 ('96450000-0000-4000-8000-000000000001','editor'),
 ('96450000-0000-4000-8000-000000000002','editor'),
 ('96450000-0000-4000-8000-000000000003','viewer');
INSERT INTO public.influencers(id,name,slug) VALUES
 ('e1450000-0000-4000-8000-000000000001','Source fixture','source-fixture');
INSERT INTO public.social_accounts(id,influencer_id,platform,handle,external_id,status,token_ref) VALUES
 ('e2450000-0000-4000-8000-000000000001','e1450000-0000-4000-8000-000000000001','instagram','src-ig','src-ig-user','active','vault-ref-src');
INSERT INTO public.assets(id,influencer_id,kind,storage_path,mime_type) VALUES
 ('e3450000-0000-4000-8000-000000000001','e1450000-0000-4000-8000-000000000001','final_video','e1450000-0000-4000-8000-000000000001/final.mp4','video/mp4'),
 ('e3450000-0000-4000-8000-000000000002','e1450000-0000-4000-8000-000000000001','generated','e1450000-0000-4000-8000-000000000001/v2v-out.mp4','video/mp4');
INSERT INTO public.generations(id,influencer_id,tool,type,mode,status,output_asset_id) VALUES
 ('e4450000-0000-4000-8000-000000000001','e1450000-0000-4000-8000-000000000001','mock','video','video_to_video','succeeded','e3450000-0000-4000-8000-000000000002'),
 ('e4450000-0000-4000-8000-000000000002','e1450000-0000-4000-8000-000000000001','mock','video','image_to_video','succeeded',NULL);

SELECT set_config('test.ready', jsonb_build_object('items',
 (SELECT jsonb_object_agg(key,true) FROM unnest(ARRAY[
 'hook_opening','hook_character','hook_pacing','hook_payoff','hook_loop',
 'engagement_reason','engagement_caption','engagement_hashtags','engagement_honesty',
 'quality_format','quality_anatomy','quality_text','quality_silent','quality_audio','quality_cover',
 'ai_disclosure','ai_identity','ai_consent','ai_claims','ai_brands',
 'commercial_disclosure','commercial_tool','commercial_rights','commercial_engagement','commercial_minor'
 ]) AS key), 'hookScore',4,'engagementScore',4,'decision','ready')::text,true);

-- Hata HINT'ini okumak için yardımcı (postgres rolüyle çağrılır; auth.uid() jwt ayarından okunur).
CREATE FUNCTION pg_temp.error_hint(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE h text;
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS h = PG_EXCEPTION_HINT;
  RETURN h;
END;
$$;

-- Postgres ile oluşturulan kartlar: 4 = v2v + final video (yayın işi testi), 5 = puanlayan = üreten.
INSERT INTO public.content_items(id,influencer_id,title,checklist,target_account_id,created_by,checklist_scored_by) VALUES
 ('e5450000-0000-4000-8000-000000000004','e1450000-0000-4000-8000-000000000001','Yayın v2v',current_setting('test.ready')::jsonb,'e2450000-0000-4000-8000-000000000001',NULL,NULL),
 ('e5450000-0000-4000-8000-000000000005','e1450000-0000-4000-8000-000000000001','Kendi puanı',current_setting('test.ready')::jsonb,'e2450000-0000-4000-8000-000000000001','96450000-0000-4000-8000-000000000001','96450000-0000-4000-8000-000000000001');
INSERT INTO public.content_item_assets(content_item_id,asset_id,generation_id) VALUES
 ('e5450000-0000-4000-8000-000000000004','e3450000-0000-4000-8000-000000000001',NULL),
 ('e5450000-0000-4000-8000-000000000004',NULL,'e4450000-0000-4000-8000-000000000001'),
 ('e5450000-0000-4000-8000-000000000005','e3450000-0000-4000-8000-000000000001',NULL);

-- ── Yapı ve yetki ─────────────────────────────────────────────────────────
SELECT extensions.enum_has_labels('public','content_source_type',ARRAY['own','stock','open_license','third_party']::name[],'source type enum has the four policy codes');
SELECT extensions.is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='content_items'
  AND column_name IN ('source_type','source_owner','source_license','source_checked_at','source_checked_by','checklist_scored_by')),6,'structured source and scorer columns exist');
SELECT extensions.ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.content_items'::regclass),'content_items keeps RLS');
SELECT extensions.ok(NOT has_function_privilege('anon','public.content_source_missing_ids(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.content_is_v2v(uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.content_source_missing_ids(uuid)','EXECUTE'),'anon cannot call source helpers');

-- ── Check-list: yeni madde ────────────────────────────────────────────────
SELECT extensions.ok(public.content_checklist_ready(current_setting('test.ready')::jsonb),'25-item checklist is ready');
SELECT extensions.ok(NOT public.content_checklist_ready(current_setting('test.ready')::jsonb #- '{items,engagement_hashtags}'),'hashtag/caption item is mandatory');
SELECT extensions.ok(NOT public.content_checklist_ready(jsonb_set(current_setting('test.ready')::jsonb,'{items,engagement_hashtags}','false')),'unticked hashtag item blocks');

-- ── Kaynak alanı kısıtları ────────────────────────────────────────────────
SELECT extensions.throws_ok($$INSERT INTO public.content_items(influencer_id,title,source_type,source_owner) VALUES('e1450000-0000-4000-8000-000000000001','x','third_party','@kanal')$$,
 '23514',NULL,'third_party requires a license/permission reference');
SELECT extensions.throws_ok($$INSERT INTO public.content_items(influencer_id,title,source_type,source_license) VALUES('e1450000-0000-4000-8000-000000000001','x','stock','Lisans 123')$$,
 '23514',NULL,'stock requires an owner/provider');
SELECT extensions.lives_ok($$INSERT INTO public.content_items(influencer_id,title,source_type) VALUES('e1450000-0000-4000-8000-000000000001','own ok','own')$$,
 'own reference needs no owner or license');
SELECT extensions.ok((SELECT source_checked_at IS NOT NULL FROM public.content_items WHERE title='own ok'),'service-role source write gets a check timestamp');

-- ── Puanlayan ≠ üreten (#22) ──────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','96450000-0000-4000-8000-000000000001',true);
SELECT set_config('test.c1',(public.save_content_item(NULL,jsonb_build_object(
 'influencer_id','e1450000-0000-4000-8000-000000000001','title','Normal kart','stage','edit',
 'checklist',current_setting('test.ready')::jsonb,'target_account_id','e2450000-0000-4000-8000-000000000001',
 'scheduled_at','2026-12-01T09:00:00Z','checklist_scored_by','96450000-0000-4000-8000-000000000002'))).id::text,true);
SELECT extensions.is((SELECT checklist_scored_by FROM public.content_items WHERE id=current_setting('test.c1')::uuid),
 '96450000-0000-4000-8000-000000000001'::uuid,'scorer is recorded from the session, not the payload');
SELECT extensions.throws_ok($$UPDATE public.content_items SET stage='scheduled' WHERE id=current_setting('test.c1')::uuid$$,
 '23514','Puanlayan kişi üreten kişiden farklı olmalı; puanları ve yayın kararını başka bir ekip üyesi kaydetmeli.','producer cannot schedule their own scoring');
UPDATE public.content_items SET checklist_scored_by='96450000-0000-4000-8000-000000000002' WHERE id=current_setting('test.c1')::uuid;
SELECT extensions.is((SELECT checklist_scored_by FROM public.content_items WHERE id=current_setting('test.c1')::uuid),
 '96450000-0000-4000-8000-000000000001'::uuid,'scorer column cannot be spoofed directly');
SELECT set_config('request.jwt.claim.sub','96450000-0000-4000-8000-000000000002',true);
UPDATE public.content_items SET title='Başlık düzeltme' WHERE id=current_setting('test.c1')::uuid;
SELECT extensions.is((SELECT checklist_scored_by FROM public.content_items WHERE id=current_setting('test.c1')::uuid),
 '96450000-0000-4000-8000-000000000001'::uuid,'editing other fields does not change the scorer');
UPDATE public.content_items SET checklist=jsonb_set(checklist,'{hookScore}','5') WHERE id=current_setting('test.c1')::uuid;
SELECT extensions.is((SELECT checklist_scored_by FROM public.content_items WHERE id=current_setting('test.c1')::uuid),
 '96450000-0000-4000-8000-000000000002'::uuid,'second team member becomes the scorer when re-scoring');
SELECT extensions.lives_ok($$UPDATE public.content_items SET stage='scheduled' WHERE id=current_setting('test.c1')::uuid$$,'scored by someone else, the card can be scheduled');
SELECT extensions.throws_ok($$UPDATE public.content_items SET assignee_id='96450000-0000-4000-8000-000000000002' WHERE id=current_setting('test.c1')::uuid$$,
 '23514',NULL,'assigning the scorer as producer of a scheduled card is rejected');

-- ── v2v kaynak zorunluluğu (#145) ─────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub','96450000-0000-4000-8000-000000000001',true);
SELECT set_config('test.c2',(public.save_content_item(NULL,jsonb_build_object(
 'influencer_id','e1450000-0000-4000-8000-000000000001','title','V2V kart','stage','edit',
 'checklist',jsonb_set(current_setting('test.ready')::jsonb,'{decision}','"review"'),'target_account_id','e2450000-0000-4000-8000-000000000001',
 'scheduled_at','2026-12-02T09:00:00Z'),NULL,ARRAY['e4450000-0000-4000-8000-000000000001']::uuid[])).id::text,true);
SELECT set_config('request.jwt.claim.sub','96450000-0000-4000-8000-000000000002',true);
UPDATE public.content_items SET checklist=current_setting('test.ready')::jsonb WHERE id=current_setting('test.c2')::uuid;
SELECT extensions.ok(public.content_is_v2v(current_setting('test.c2')::uuid) AND NOT public.content_is_v2v(current_setting('test.c1')::uuid),'v2v is detected from linked generation mode');
SELECT extensions.throws_ok($$UPDATE public.content_items SET stage='scheduled' WHERE id=current_setting('test.c2')::uuid$$,
 '23514','Video-to-video içerikte kaynak bilgisi (tür, sahip, lisans/izin) kaydedilmeden planlama veya yayın yapılamaz.','v2v without source cannot be scheduled');
SELECT extensions.is((public.content_item_details(ARRAY[current_setting('test.c2')::uuid])->0->>'source_missing')::boolean,true,'details flag missing v2v source');
SELECT extensions.ok(current_setting('test.c2')::uuid = ANY(public.content_source_missing_ids('e1450000-0000-4000-8000-000000000001'))
  AND NOT current_setting('test.c1')::uuid = ANY(public.content_source_missing_ids()),'missing-source filter lists only v2v cards without source');
UPDATE public.content_items SET source_type='third_party',source_owner='@public.channel',source_license='izin: depo/2026-12-001',
 source_checked_by='96450000-0000-4000-8000-000000000003' WHERE id=current_setting('test.c2')::uuid;
SELECT extensions.ok((SELECT source_checked_by='96450000-0000-4000-8000-000000000002' AND source_checked_at IS NOT NULL FROM public.content_items WHERE id=current_setting('test.c2')::uuid),
 'source check is stamped with the session user, not the payload');
SELECT extensions.lives_ok($$UPDATE public.content_items SET stage='scheduled' WHERE id=current_setting('test.c2')::uuid$$,'v2v with source can be scheduled');
SELECT extensions.throws_ok($$UPDATE public.content_items SET source_type=NULL,source_owner='',source_license='' WHERE id=current_setting('test.c2')::uuid$$,
 '23514',NULL,'source cannot be cleared on a scheduled v2v card');
SELECT extensions.throws_ok($$INSERT INTO public.content_item_assets(content_item_id,generation_id) VALUES(current_setting('test.c1')::uuid,'e4450000-0000-4000-8000-000000000001')$$,
 '23514',NULL,'v2v generation cannot be linked to a scheduled card without source');
SELECT extensions.throws_ok($$INSERT INTO public.content_item_assets(content_item_id,asset_id) VALUES(current_setting('test.c1')::uuid,'e3450000-0000-4000-8000-000000000002')$$,
 '23514',NULL,'v2v output asset counts as v2v as well');
SELECT extensions.lives_ok($$INSERT INTO public.content_item_assets(content_item_id,generation_id) VALUES(current_setting('test.c1')::uuid,'e4450000-0000-4000-8000-000000000002')$$,
 'non-v2v generation can still be linked');

-- ── Yayın işi (#58) ───────────────────────────────────────────────────────
SELECT extensions.throws_ok($$SELECT public.enqueue_publish_job('e5450000-0000-4000-8000-000000000004','Başlık')$$,
 '23514','Video-to-video içerikte kaynak bilgisi (tür, sahip, lisans/izin) kaydedilmeden planlama veya yayın yapılamaz.','publish job is blocked for v2v without source');
SELECT extensions.throws_ok($$SELECT public.enqueue_publish_job('e5450000-0000-4000-8000-000000000005','Başlık')$$,
 '23514','Puanlayan kişi üreten kişiden farklı olmalı; puanları ve yayın kararını başka bir ekip üyesi kaydetmeli.','publish job is blocked when scorer is the producer');

-- ── Viewer ve ekip dışı (RLS değişmedi) ───────────────────────────────────
SELECT set_config('request.jwt.claim.sub','96450000-0000-4000-8000-000000000003',true);
SELECT extensions.is_empty($$UPDATE public.content_items SET source_type='own' WHERE id=current_setting('test.c2')::uuid RETURNING id$$,'viewer cannot edit source fields');
SELECT extensions.ok((SELECT source_type='third_party' FROM public.content_items WHERE id=current_setting('test.c2')::uuid),'viewer can read source fields');
SELECT set_config('request.jwt.claim.sub','96450000-0000-4000-8000-000000000004',true);
SELECT extensions.is(public.content_source_missing_ids(),'{}'::uuid[],'outsider sees no missing-source cards');

-- ── HINT'ler (makine okunur neden) ────────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','96450000-0000-4000-8000-000000000001',true);
SELECT extensions.is(pg_temp.error_hint($$SELECT public.enqueue_publish_job('e5450000-0000-4000-8000-000000000004','Başlık')$$),'source_missing','source block has HINT source_missing');
SELECT extensions.is(pg_temp.error_hint($$SELECT public.enqueue_publish_job('e5450000-0000-4000-8000-000000000005','Başlık')$$),'scorer_is_producer','scorer block has HINT scorer_is_producer');
UPDATE public.content_items SET source_type='own' WHERE id='e5450000-0000-4000-8000-000000000004';
SELECT extensions.lives_ok($$SELECT public.enqueue_publish_job('e5450000-0000-4000-8000-000000000004','Başlık')$$,'v2v with source can be queued for publishing');

SELECT * FROM extensions.finish();
ROLLBACK;
