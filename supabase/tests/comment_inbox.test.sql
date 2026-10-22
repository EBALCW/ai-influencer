-- #61 Yorum gelen kutusu: comments tekilleştirme ve türetilmiş alanlar, RLS (ekip dışı,
-- viewer salt okur, editor yalnız durum/lead), yanıt kuyruğu idempotency, gönderim → replied,
-- sync_runs işleri, pg_net çağrısı, bakım ve pg_cron.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(48);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
  ('a6100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'inbox-owner@example.invalid', '', now(), now()),
  ('a6100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'inbox-editor@example.invalid', '', now(), now()),
  ('a6100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'inbox-viewer@example.invalid', '', now(), now()),
  ('a6100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'inbox-outsider@example.invalid', '', now(), now());
INSERT INTO public.team_members (user_id, role) VALUES
  ('a6100000-0000-4000-8000-000000000001', 'owner'),
  ('a6100000-0000-4000-8000-000000000002', 'editor'),
  ('a6100000-0000-4000-8000-000000000003', 'viewer');

INSERT INTO public.influencers (id, name, slug) VALUES
  ('a6110000-0000-4000-8000-000000000001', 'Inbox fixture', 'inbox-fixture'),
  ('a6110000-0000-4000-8000-000000000002', 'Inbox other', 'inbox-other');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle, external_id, token_ref, status) VALUES
  ('a6120000-0000-4000-8000-000000000001', 'a6110000-0000-4000-8000-000000000001', 'youtube', 'inbox-yt', 'UCinbox', 'ref-yt', 'active'),
  ('a6120000-0000-4000-8000-000000000002', 'a6110000-0000-4000-8000-000000000001', 'instagram', 'inbox-ig', 'iginbox', 'ref-ig', 'active');
INSERT INTO public.posts (id, account_id, external_id, published_at) VALUES
  ('a6130000-0000-4000-8000-000000000001', 'a6120000-0000-4000-8000-000000000001', 'vid-1', now() - interval '2 days'),
  ('a6130000-0000-4000-8000-000000000002', 'a6120000-0000-4000-8000-000000000002', 'media-1', now() - interval '1 day');
INSERT INTO public.brands (id, name) VALUES ('a6140000-0000-4000-8000-000000000001', 'Inbox marka fixture');
INSERT INTO public.brand_deals (id, brand_id, influencer_id) VALUES
  ('a6150000-0000-4000-8000-000000000001', 'a6140000-0000-4000-8000-000000000001', 'a6110000-0000-4000-8000-000000000001'),
  ('a6150000-0000-4000-8000-000000000002', 'a6140000-0000-4000-8000-000000000001', 'a6110000-0000-4000-8000-000000000002');

-- ── Yapı ────────────────────────────────────────────────────────────────────
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comments'::regclass),
  'comments has RLS enabled'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comment_replies'::regclass),
  'comment_replies has RLS enabled'
);
SELECT extensions.is(
  (SELECT contype::text FROM pg_constraint WHERE conname = 'comments_account_external_id_key'),
  'u', 'comments upsert target is a plain UNIQUE constraint (supabase-js onConflict works)'
);

-- ── Service role yazımı: türetilmiş alanlar ve tekilleştirme ────────────────
SET LOCAL ROLE service_role;
-- Yanlış hesap/platform verilse de posttan türetilir.
INSERT INTO public.comments (id, post_id, account_id, platform, external_id, author_name, text, published_at)
VALUES ('a6160000-0000-4000-8000-000000000001', 'a6130000-0000-4000-8000-000000000001',
        'a6120000-0000-4000-8000-000000000002', 'instagram', 'yt-c1', 'Uydurma İzleyici', 'Harika video!', now() - interval '1 day');
INSERT INTO public.comments (id, post_id, account_id, platform, external_id, author_name, text, published_at, is_brand_inquiry)
VALUES ('a6160000-0000-4000-8000-000000000002', 'a6130000-0000-4000-8000-000000000002',
        'a6120000-0000-4000-8000-000000000002', 'instagram', 'ig-c1', 'uydurma.marka', 'İş birliği için yazar mısınız?', now() - interval '3 hours', true);
RESET ROLE;

SELECT extensions.results_eq(
  $$SELECT account_id, platform::text FROM public.comments WHERE id = 'a6160000-0000-4000-8000-000000000001'$$,
  $$VALUES ('a6120000-0000-4000-8000-000000000001'::uuid, 'youtube')$$,
  'account_id and platform are derived from the post'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comments (post_id, account_id, platform, external_id, text, published_at)
    VALUES ('a6130000-0000-4000-8000-000000000001', 'a6120000-0000-4000-8000-000000000001', 'youtube', 'yt-c1', 'x', now())$$,
  '23505', NULL, 'the same comment cannot be stored twice for an account'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comments (post_id, account_id, platform, external_id, text, published_at)
    VALUES (gen_random_uuid(), 'a6120000-0000-4000-8000-000000000001', 'youtube', 'yt-orphan', 'x', now())$$,
  '23503', NULL, 'a comment needs an existing post'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comments (post_id, account_id, platform, external_id, text, published_at, status, replied_at)
    VALUES ('a6130000-0000-4000-8000-000000000001', 'a6120000-0000-4000-8000-000000000001', 'youtube', 'yt-bad', 'x', now(), 'replied', NULL)$$,
  '23514', NULL, 'replied status requires replied_at'
);

-- ── Okuma: ekip dışı hiçbir şey görmez, viewer okur ─────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a6100000-0000-4000-8000-000000000004', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.comments), 0, 'outsider cannot read comments');
SELECT extensions.is((SELECT count(*)::integer FROM public.comment_replies), 0, 'outsider cannot read replies');
SELECT extensions.is_empty(
  $$UPDATE public.comments SET status = 'read' WHERE id = 'a6160000-0000-4000-8000-000000000001' RETURNING 1$$,
  'outsider cannot change comment status'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comment_replies (comment_id, body) VALUES ('a6160000-0000-4000-8000-000000000001', 'Merhaba')$$,
  '42501', NULL, 'outsider cannot queue a reply'
);

SELECT set_config('request.jwt.claim.sub', 'a6100000-0000-4000-8000-000000000003', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.comments WHERE id::text LIKE 'a6160000-%'), 2,
  'viewer reads comments'
);
SELECT extensions.is_empty(
  $$UPDATE public.comments SET status = 'hidden' WHERE id = 'a6160000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer cannot hide a comment'
);
SELECT extensions.is_empty(
  $$UPDATE public.comments SET status = 'read' WHERE id = 'a6160000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer cannot mark a comment read'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comment_replies (comment_id, body) VALUES ('a6160000-0000-4000-8000-000000000001', 'Merhaba')$$,
  '42501', NULL, 'viewer cannot reply'
);
SELECT extensions.throws_ok(
  $$DELETE FROM public.comments WHERE id = 'a6160000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'viewer cannot delete comments'
);

-- ── Editor: yalnız durum ve lead ────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'a6100000-0000-4000-8000-000000000002', true);
SELECT extensions.results_eq(
  $$UPDATE public.comments SET status = 'read' WHERE id = 'a6160000-0000-4000-8000-000000000001' RETURNING status$$,
  $$VALUES ('read'::text)$$,
  'editor marks a comment read'
);
SELECT extensions.throws_ok(
  $$UPDATE public.comments SET text = 'değiştirildi' WHERE id = 'a6160000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'editor cannot rewrite the comment text'
);
SELECT extensions.throws_ok(
  $$UPDATE public.comments SET replied_at = now() WHERE id = 'a6160000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'editor cannot set replied_at'
);
SELECT extensions.throws_ok(
  $$UPDATE public.comments SET status = 'replied' WHERE id = 'a6160000-0000-4000-8000-000000000001'$$,
  '23514', NULL, 'editor cannot mark a comment replied without a sent reply'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comments (post_id, account_id, platform, external_id, text, published_at)
    VALUES ('a6130000-0000-4000-8000-000000000001', 'a6120000-0000-4000-8000-000000000001', 'youtube', 'yt-editor', 'x', now())$$,
  '42501', NULL, 'editor cannot insert comments (only the sync function does)'
);
SELECT extensions.throws_ok(
  $$UPDATE public.comments SET brand_deal_id = 'a6150000-0000-4000-8000-000000000002' WHERE id = 'a6160000-0000-4000-8000-000000000002'$$,
  '23514', NULL, 'a lead from another influencer cannot be linked'
);
SELECT extensions.results_eq(
  $$UPDATE public.comments SET brand_deal_id = 'a6150000-0000-4000-8000-000000000001' WHERE id = 'a6160000-0000-4000-8000-000000000002' RETURNING brand_deal_id$$,
  $$VALUES ('a6150000-0000-4000-8000-000000000001'::uuid)$$,
  'editor links a lead of the same influencer'
);

-- ── Yanıt kuyruğu ───────────────────────────────────────────────────────────
SELECT extensions.lives_ok(
  $$INSERT INTO public.comment_replies (id, comment_id, body)
    VALUES ('a6170000-0000-4000-8000-000000000001', 'a6160000-0000-4000-8000-000000000001', 'Teşekkürler!')$$,
  'editor queues a reply'
);
SELECT extensions.results_eq(
  $$SELECT status, attempts::integer, created_by FROM public.comment_replies WHERE id = 'a6170000-0000-4000-8000-000000000001'$$,
  $$VALUES ('queued'::text, 0, 'a6100000-0000-4000-8000-000000000002'::uuid)$$,
  'reply starts queued and records the requester'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comment_replies (comment_id, body) VALUES ('a6160000-0000-4000-8000-000000000001', 'Teşekkürler!')$$,
  '23505', NULL, 'a second click on the same comment does not queue a second reply'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comment_replies (comment_id, body, status) VALUES ('a6160000-0000-4000-8000-000000000002', 'x', 'sent')$$,
  '42501', NULL, 'editor cannot insert a reply as already sent'
);
SELECT extensions.throws_ok(
  $$UPDATE public.comment_replies SET status = 'sent' WHERE id = 'a6170000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'editor cannot change the reply status (only the function does)'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comment_replies (comment_id, body) VALUES ('a6160000-0000-4000-8000-000000000002', '   ')$$,
  '23514', NULL, 'empty reply is rejected'
);
SELECT extensions.throws_ok(
  format($$INSERT INTO public.comment_replies (comment_id, body) VALUES ('a6160000-0000-4000-8000-000000000002', %L)$$, repeat('a', 1001)),
  '23514', NULL, 'reply longer than 1000 characters is rejected'
);
RESET ROLE;

-- Gönderim (Edge Function, service role): yorum yanıtlandı olur.
SET LOCAL ROLE service_role;
UPDATE public.comment_replies SET status = 'sending', attempts = 1
WHERE id = 'a6170000-0000-4000-8000-000000000001' AND status = 'queued';
UPDATE public.comment_replies SET status = 'sent', sent_at = now(), external_id = 'yt-reply-1'
WHERE id = 'a6170000-0000-4000-8000-000000000001';
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT status, replied_at IS NOT NULL FROM public.comments WHERE id = 'a6160000-0000-4000-8000-000000000001'$$,
  $$VALUES ('replied'::text, true)$$,
  'a sent reply marks the comment replied'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.comment_replies (comment_id, body) VALUES ('a6160000-0000-4000-8000-000000000001', 'İkinci yanıt')$$,
  '23505', NULL, 'an already replied comment does not get a second reply'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a6100000-0000-4000-8000-000000000002', true);
SELECT extensions.results_eq(
  $$UPDATE public.comments SET status = 'hidden' WHERE id = 'a6160000-0000-4000-8000-000000000001' RETURNING status$$,
  $$VALUES ('hidden'::text)$$,
  'editor hides a replied comment'
);
SELECT extensions.results_eq(
  $$UPDATE public.comments SET status = 'read' WHERE id = 'a6160000-0000-4000-8000-000000000001' RETURNING status$$,
  $$VALUES ('replied'::text)$$,
  'unhiding a replied comment keeps it replied'
);
RESET ROLE;

-- Başarısız yanıt yeniden denemeye izin verir; upsert panel durumunu ezmez.
SET LOCAL ROLE service_role;
INSERT INTO public.comment_replies (id, comment_id, body)
VALUES ('a6170000-0000-4000-8000-000000000002', 'a6160000-0000-4000-8000-000000000002', 'İlk deneme');
UPDATE public.comment_replies SET status = 'failed', error = 'Kalıcı hata'
WHERE id = 'a6170000-0000-4000-8000-000000000002';
INSERT INTO public.comments (post_id, account_id, platform, external_id, author_name, text, published_at, like_count)
VALUES ('a6130000-0000-4000-8000-000000000002', 'a6120000-0000-4000-8000-000000000002', 'instagram', 'ig-c1',
        'uydurma.marka', 'İş birliği için yazar mısınız? (düzenlendi)', now() - interval '3 hours', 4)
ON CONFLICT (account_id, external_id) DO UPDATE
  SET text = EXCLUDED.text, like_count = EXCLUDED.like_count, author_name = EXCLUDED.author_name;
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT count(*)::integer, min(text), min(like_count), min(brand_deal_id::text) FROM public.comments WHERE external_id = 'ig-c1'$$,
  $$VALUES (1, 'İş birliği için yazar mısınız? (düzenlendi)', 4, 'a6150000-0000-4000-8000-000000000001')$$,
  'refetch updates text/likes without duplicating or losing the lead link'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a6100000-0000-4000-8000-000000000001', true);
SELECT extensions.lives_ok(
  $$INSERT INTO public.comment_replies (comment_id, body) VALUES ('a6160000-0000-4000-8000-000000000002', 'Yeniden deneme')$$,
  'owner can retry after a failed reply'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.comment_replies WHERE comment_id = 'a6160000-0000-4000-8000-000000000002'), 2,
  'team reads reply history'
);
RESET ROLE;

-- ── sync_runs işleri ────────────────────────────────────────────────────────
SELECT extensions.lives_ok(
  $$INSERT INTO public.sync_runs (job, platform, account_id, status, quota_units)
    VALUES ('comments', 'youtube', 'a6120000-0000-4000-8000-000000000001', 'succeeded', 3),
           ('comment_reply', 'youtube', 'a6120000-0000-4000-8000-000000000001', 'succeeded', 50)$$,
  'sync_runs accepts comments and comment_reply jobs'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.sync_runs (job) VALUES ('bogus')$$,
  '23514', NULL, 'unknown sync job is still rejected'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.sync_runs (job) VALUES ('metrics'), ('posts'), ('accounts'), ('manual')$$,
  'existing sync jobs are kept'
);

-- ── pg_net çağrısı, bakım, zamanlama ────────────────────────────────────────
SELECT extensions.is(private.invoke_comments('fetch'), NULL::bigint, 'without Vault secrets nothing is invoked');
SELECT extensions.throws_ok(
  $$SELECT private.invoke_comments('bogus')$$, '22023', NULL, 'unknown comments job is rejected'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'private.invoke_comments(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.maintain_comments(timestamptz)', 'EXECUTE'),
  'API roles cannot call the private comment functions'
);

UPDATE public.comment_replies SET status = 'sending', attempts = 1
WHERE comment_id = 'a6160000-0000-4000-8000-000000000002' AND status = 'queued';
INSERT INTO public.comments (id, post_id, account_id, platform, external_id, text, published_at)
VALUES ('a6160000-0000-4000-8000-000000000009', 'a6130000-0000-4000-8000-000000000001',
        'a6120000-0000-4000-8000-000000000001', 'youtube', 'yt-old', 'eski', now() - interval '91 days');
SELECT extensions.is(
  private.maintain_comments(now() + interval '20 minutes'), 1,
  'a reply stuck in sending is closed'
);
SELECT extensions.results_eq(
  $$SELECT status FROM public.comment_replies
    WHERE comment_id = 'a6160000-0000-4000-8000-000000000002' ORDER BY created_at DESC LIMIT 1$$,
  $$VALUES ('failed'::text)$$,
  'stuck reply becomes failed (never resent automatically)'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.comments WHERE id = 'a6160000-0000-4000-8000-000000000009'), 0,
  'comments older than 90 days are deleted'
);
SELECT extensions.is(
  (SELECT array_agg(jobname ORDER BY jobname) FROM cron.job WHERE jobname LIKE 'comments-%'),
  ARRAY['comments-fetch', 'comments-maintenance', 'comments-reply'],
  'comment jobs are registered in pg_cron'
);
SELECT extensions.ok(
  (SELECT bool_and(command NOT LIKE '%http%' AND command NOT LIKE '%secret%') FROM cron.job WHERE jobname LIKE 'comments-%'),
  'cron commands contain no URL or secret'
);

SELECT * FROM extensions.finish();
ROLLBACK;
