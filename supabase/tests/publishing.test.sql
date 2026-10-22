BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(40);

-- Fixture (postgres rolüyle, RLS dışında). Seed'den bağımsız.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
  ('95800000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pub-editor@example.invalid', '', now(), now()),
  ('95800000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pub-viewer@example.invalid', '', now(), now()),
  ('95800000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pub-outsider@example.invalid', '', now(), now());
INSERT INTO public.team_members (user_id, role) VALUES
  ('95800000-0000-4000-8000-000000000001', 'editor'),
  ('95800000-0000-4000-8000-000000000002', 'viewer');

INSERT INTO public.influencers (id, name, slug) VALUES
  ('d5800000-0000-4000-8000-000000000001', 'Publish fixture', 'publish-fixture');
-- Bağlı (token_ref dolu) YouTube ve Instagram; bağlı olmayan ikinci Instagram; TikTok.
INSERT INTO public.social_accounts (id, influencer_id, platform, handle, external_id, status, token_ref) VALUES
  ('d5810000-0000-4000-8000-000000000001', 'd5800000-0000-4000-8000-000000000001', 'youtube', 'pub-yt', 'pub-yt-channel', 'active', 'vault-ref-yt'),
  ('d5810000-0000-4000-8000-000000000002', 'd5800000-0000-4000-8000-000000000001', 'instagram', 'pub-ig', 'pub-ig-user', 'active', 'vault-ref-ig'),
  ('d5810000-0000-4000-8000-000000000003', 'd5800000-0000-4000-8000-000000000001', 'instagram', 'pub-ig-off', NULL, 'pending', NULL),
  ('d5810000-0000-4000-8000-000000000004', 'd5800000-0000-4000-8000-000000000001', 'tiktok', 'pub-tt', NULL, 'active', 'vault-ref-tt');
INSERT INTO public.assets (id, influencer_id, kind, storage_path, mime_type) VALUES
  ('d5820000-0000-4000-8000-000000000001', 'd5800000-0000-4000-8000-000000000001', 'final_video', 'd5800000-0000-4000-8000-000000000001/final-1.mp4', 'video/mp4'),
  ('d5820000-0000-4000-8000-000000000002', 'd5800000-0000-4000-8000-000000000001', 'reference', 'd5800000-0000-4000-8000-000000000001/ref.png', 'image/png');

SELECT set_config('test.ready', jsonb_build_object('items',
  (SELECT jsonb_object_agg(key, true) FROM unnest(ARRAY[
  'hook_opening','hook_character','hook_pacing','hook_payoff','hook_loop',
  'engagement_reason','engagement_caption','engagement_honesty',
  'quality_format','quality_anatomy','quality_text','quality_silent','quality_audio','quality_cover',
  'ai_disclosure','ai_identity','ai_consent','ai_claims','ai_brands',
  'commercial_disclosure','commercial_tool','commercial_rights','commercial_engagement','commercial_minor'
  ]) AS key), 'hookScore', 4, 'engagementScore', 4, 'decision', 'ready')::text, true);

-- 1 hazır (YouTube), 2 check-list eksik, 3 yalnız AI etiketi eksik, 4 final video yok,
-- 5 bağlı olmayan hesap, 6 marka anlaşmalı (Instagram), 7 TikTok, 8 hedef hesap yok.
INSERT INTO public.content_items (id, influencer_id, title, checklist, target_account_id) VALUES
  ('d5830000-0000-4000-8000-000000000001', 'd5800000-0000-4000-8000-000000000001', 'Hazır', current_setting('test.ready')::jsonb, 'd5810000-0000-4000-8000-000000000001'),
  ('d5830000-0000-4000-8000-000000000002', 'd5800000-0000-4000-8000-000000000001', 'Eksik', '{"items":{"ai_disclosure":true}}', 'd5810000-0000-4000-8000-000000000001'),
  ('d5830000-0000-4000-8000-000000000003', 'd5800000-0000-4000-8000-000000000001', 'AI etiketi yok', jsonb_set(current_setting('test.ready')::jsonb, '{items,ai_disclosure}', 'false'), 'd5810000-0000-4000-8000-000000000001'),
  ('d5830000-0000-4000-8000-000000000004', 'd5800000-0000-4000-8000-000000000001', 'Video yok', current_setting('test.ready')::jsonb, 'd5810000-0000-4000-8000-000000000001'),
  ('d5830000-0000-4000-8000-000000000005', 'd5800000-0000-4000-8000-000000000001', 'Bağlı değil', current_setting('test.ready')::jsonb, 'd5810000-0000-4000-8000-000000000003'),
  ('d5830000-0000-4000-8000-000000000006', 'd5800000-0000-4000-8000-000000000001', 'Sponsorlu', current_setting('test.ready')::jsonb, 'd5810000-0000-4000-8000-000000000002'),
  ('d5830000-0000-4000-8000-000000000007', 'd5800000-0000-4000-8000-000000000001', 'TikTok', current_setting('test.ready')::jsonb, 'd5810000-0000-4000-8000-000000000004'),
  ('d5830000-0000-4000-8000-000000000008', 'd5800000-0000-4000-8000-000000000001', 'Hesapsız', current_setting('test.ready')::jsonb, NULL);
INSERT INTO public.content_item_assets (content_item_id, asset_id)
SELECT c, 'd5820000-0000-4000-8000-000000000001'::uuid FROM unnest(ARRAY[
  'd5830000-0000-4000-8000-000000000001', 'd5830000-0000-4000-8000-000000000002',
  'd5830000-0000-4000-8000-000000000003', 'd5830000-0000-4000-8000-000000000005',
  'd5830000-0000-4000-8000-000000000006', 'd5830000-0000-4000-8000-000000000007'
]::uuid[]) AS c;
INSERT INTO public.content_item_assets (content_item_id, asset_id) VALUES
  ('d5830000-0000-4000-8000-000000000004', 'd5820000-0000-4000-8000-000000000002');
INSERT INTO public.brands (id, name) VALUES ('d5840000-0000-4000-8000-000000000001', 'Publish Brand Fixture');
INSERT INTO public.brand_deals (id, brand_id, influencer_id) VALUES
  ('d5850000-0000-4000-8000-000000000001', 'd5840000-0000-4000-8000-000000000001', 'd5800000-0000-4000-8000-000000000001');
INSERT INTO public.brand_deal_content_items (brand_deal_id, content_item_id) VALUES
  ('d5850000-0000-4000-8000-000000000001', 'd5830000-0000-4000-8000-000000000006');

-- ── Yapı ────────────────────────────────────────────────────────────────────
SELECT extensions.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.publish_jobs'::regclass), 'publish_jobs has RLS enabled');
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.claim_publish_jobs(integer, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.complete_publish_job(uuid, text, text, timestamptz, numeric, boolean)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.claim_publish_jobs(integer, integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.complete_publish_job(uuid, text, text, timestamptz, numeric, boolean)', 'EXECUTE'),
  'worker RPCs are executable only by service_role'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.enqueue_publish_job(uuid, text, text, text[], timestamptz)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.cancel_publish_job(uuid)', 'EXECUTE')
  AND NOT has_table_privilege('anon', 'public.publish_jobs', 'SELECT'),
  'anon has no access to publishing'
);
SELECT extensions.ok(
  NOT has_column_privilege('authenticated', 'public.publish_jobs', 'provider_upload_url', 'SELECT')
  AND has_column_privilege('authenticated', 'public.publish_jobs', 'status', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.publish_jobs', 'DELETE'),
  'upload session URL is hidden from API roles and job history cannot be deleted'
);
SELECT extensions.ok(
  pg_get_functiondef('public.claim_publish_jobs(integer, integer)'::regprocedure) ILIKE '%FOR UPDATE SKIP LOCKED%',
  'claim uses FOR UPDATE SKIP LOCKED'
);
SELECT extensions.is((SELECT count(*)::integer FROM cron.job WHERE jobname = 'publish-scheduled'), 1, 'publish worker is registered in pg_cron');
SELECT extensions.is(private.invoke_publish_worker(), NULL::bigint, 'without Vault secrets the cron call is a no-op');
SELECT extensions.is(private.alert_push_title('publish_failed'), 'Yayınlanamadı', 'publish_failed has a push title');

-- ── Viewer ve ekip dışı ─────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000001', 'Başlık')$$,
  '42501', NULL, 'viewer cannot enqueue a publish job'
);

-- ── Editor: yayın öncesi zorunlu kontroller ─────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-000000000001', true);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000002', 'Başlık')$$,
  '23514', 'Yayın öncesi kontrol listesi tamamlanmadı.', 'incomplete checklist blocks publishing'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000003', 'Başlık')$$,
  '23514', 'Yayın öncesi “AI etiketi” maddesi işaretlenmeli.', 'missing AI label (#32) blocks publishing'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000004', 'Başlık')$$,
  '23514', 'İçeriğe bağlı bir final video gerekli.', 'missing final_video asset blocks publishing'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000005', 'Başlık')$$,
  '23514', 'Hedef hesap bağlı değil; önce hesabı bağlayın.', 'unconnected account blocks publishing'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000007', 'Başlık')$$,
  '23514', 'Bu platform için otomatik yayın yok.', 'unsupported platform blocks publishing'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000008', 'Başlık')$$,
  '23514', 'Önce hedef hesap seçin.', 'missing target account blocks publishing'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.publish_jobs), 0, 'blocked requests leave no job behind'
);

-- ── Editor: kuyruğa ekleme ──────────────────────────────────────────────────
SELECT set_config('test.job1', public.enqueue_publish_job(
  'd5830000-0000-4000-8000-000000000001', '  Short başlık  ', 'Açıklama', ARRAY['ai', 'shorts'])::text, true);
SELECT extensions.results_eq(
  $$SELECT status::text, platform::text, title, attempts::integer, paid_partnership, created_by
    FROM public.publish_jobs WHERE id = current_setting('test.job1')::uuid$$,
  $$VALUES ('queued'::text, 'youtube'::text, 'Short başlık'::text, 0, false, '95800000-0000-4000-8000-000000000001'::uuid)$$,
  'enqueued job is queued with platform derived from the account'
);
SELECT extensions.results_eq(
  $$SELECT stage::text, scheduled_at IS NOT NULL FROM public.content_items WHERE id = 'd5830000-0000-4000-8000-000000000001'$$,
  $$VALUES ('scheduled'::text, true)$$,
  'content card moves to scheduled in the same transaction'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000001', 'Tekrar')$$,
  '23505', 'Bu içerik için açık veya yayınlanmış bir iş zaten var.', 'a second open job for the same content + account is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.publish_jobs (content_item_id, account_id, asset_id, platform, title)
    VALUES ('d5830000-0000-4000-8000-000000000001', 'd5810000-0000-4000-8000-000000000001',
            'd5820000-0000-4000-8000-000000000001', 'youtube', 'Doğrudan')$$,
  '23505', NULL, 'unique index also blocks a direct second insert'
);

-- Doğrudan INSERT: worker alanları sıfırlanır, ücretli ortaklık trigger'da hesaplanır.
INSERT INTO public.publish_jobs (content_item_id, account_id, asset_id, platform, title, status, attempts, external_id, paid_partnership, scheduled_for)
VALUES ('d5830000-0000-4000-8000-000000000006', 'd5810000-0000-4000-8000-000000000002',
        'd5820000-0000-4000-8000-000000000001', 'youtube', 'Sponsorlu', 'published', 9, 'spoof', false, '2030-01-01T09:00:00Z');
SELECT extensions.results_eq(
  $$SELECT status::text, platform::text, attempts::integer, external_id, paid_partnership, next_attempt_at = scheduled_for
    FROM public.publish_jobs WHERE content_item_id = 'd5830000-0000-4000-8000-000000000006'$$,
  $$VALUES ('queued'::text, 'instagram'::text, 0, NULL::text, true, true)$$,
  'client cannot spoof worker columns; brand-deal content is flagged as paid partnership'
);
SELECT extensions.throws_ok(
  $$UPDATE public.publish_jobs SET attempts = 3 WHERE id = current_setting('test.job1')::uuid$$,
  '42501', NULL, 'editor cannot change worker columns'
);
SELECT extensions.throws_ok(
  $$UPDATE public.publish_jobs SET status = 'published' WHERE id = current_setting('test.job1')::uuid$$,
  '42501', NULL, 'editor cannot mark a job published'
);

-- ── Viewer ve ekip dışı okuma/yazma ─────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-000000000002', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.publish_jobs), 2, 'viewer can read the publish queue');
SELECT extensions.is_empty(
  $$UPDATE public.publish_jobs SET status = 'cancelled' WHERE id = current_setting('test.job1')::uuid RETURNING 1$$,
  'viewer update affects no rows'
);
SELECT extensions.throws_ok(
  $$SELECT public.cancel_publish_job(current_setting('test.job1')::uuid)$$,
  '42501', NULL, 'viewer cannot cancel'
);
SELECT set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-000000000003', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.publish_jobs), 0, 'outsider sees no publish jobs');
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000001', 'Başlık')$$,
  '42501', NULL, 'outsider cannot enqueue'
);

-- ── İptal ───────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-000000000001', true);
SELECT extensions.lives_ok(
  $$SELECT public.cancel_publish_job(current_setting('test.job1')::uuid)$$, 'editor cancels a queued job'
);
SELECT extensions.results_eq(
  $$SELECT status::text, finished_at IS NOT NULL FROM public.publish_jobs WHERE id = current_setting('test.job1')::uuid$$,
  $$VALUES ('cancelled'::text, true)$$, 'cancelled job is closed'
);
SELECT extensions.throws_ok(
  $$SELECT public.cancel_publish_job(current_setting('test.job1')::uuid)$$,
  '55000', NULL, 'only queued jobs can be cancelled'
);
SELECT set_config('test.job2', public.enqueue_publish_job('d5830000-0000-4000-8000-000000000001', 'İkinci deneme')::text, true);
SELECT extensions.ok(current_setting('test.job2') <> current_setting('test.job1'), 'after cancel a new job can be enqueued');

-- ── Worker (service_role) ───────────────────────────────────────────────────
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT extensions.is(
  (SELECT array_agg(id ORDER BY id) FROM public.claim_publish_jobs(10, 600)),
  ARRAY[current_setting('test.job2')::uuid],
  'claim takes only due jobs (future scheduled job is skipped)'
);
SELECT extensions.is(
  (SELECT status::text FROM public.publish_jobs WHERE id = current_setting('test.job2')::uuid),
  'processing', 'claimed job is processing'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.claim_publish_jobs(10, 600)), 0,
  'a concurrent second claim gets nothing while the lease is held'
);
SELECT set_config('test.post', public.complete_publish_job(
  current_setting('test.job2')::uuid, 'yt-video-1', 'https://www.youtube.com/shorts/yt-video-1', now(), 21.5, true)::text, true);
SELECT extensions.results_eq(
  $$SELECT j.status::text, j.external_id, p.content_item_id, p.account_id, p.caption
    FROM public.publish_jobs j JOIN public.posts p ON p.id = j.published_post_id
    WHERE j.id = current_setting('test.job2')::uuid$$,
  $$VALUES ('published'::text, 'yt-video-1'::text, 'd5830000-0000-4000-8000-000000000001'::uuid,
            'd5810000-0000-4000-8000-000000000001'::uuid, ''::text)$$,
  'completion writes a linked post row'
);
SELECT extensions.is(
  (SELECT stage::text FROM public.content_items WHERE id = 'd5830000-0000-4000-8000-000000000001'),
  'published', 'content card moves to published'
);
SELECT extensions.is(
  public.complete_publish_job(current_setting('test.job2')::uuid, 'yt-video-1', NULL, now())::text,
  current_setting('test.post'), 'completion is idempotent'
);

-- Hata → publish_failed uyarısı (iş başına bir kez).
UPDATE public.publish_jobs SET status = 'manual_required', error = 'Ücretli ortaklık etiketi API ile verilemiyor.'
WHERE content_item_id = 'd5830000-0000-4000-8000-000000000006';
SELECT extensions.results_eq(
  $$SELECT type, payload->>'status', payload->>'platform' FROM public.alerts
    WHERE dedupe_key = 'publish_failed:' || (SELECT id FROM public.publish_jobs WHERE content_item_id = 'd5830000-0000-4000-8000-000000000006')::text$$,
  $$VALUES ('publish_failed'::text, 'manual_required'::text, 'instagram'::text)$$,
  'manual_required raises a publish_failed alert'
);

-- Yayınlanmış içerik tekrar kuyruğa alınamaz.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-000000000001', true);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('d5830000-0000-4000-8000-000000000001', 'Üçüncü')$$,
  '23505', NULL, 'published content cannot be published twice'
);

SELECT * FROM extensions.finish();
ROLLBACK;
