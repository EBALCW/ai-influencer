-- #56 Bildirim ve uyarı sistemi: üreticiler, tekilleştirme, kişi başı okundu, ayarlar ve push.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(61);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
  ('e5000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alert-owner@example.invalid', '', now(), now()),
  ('e5000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'alert-editor@example.invalid', '', now(), now()),
  ('e5000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'alert-viewer@example.invalid', '', now(), now()),
  ('e5000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'alert-outsider@example.invalid', '', now(), now());
INSERT INTO public.team_members (user_id, role) VALUES
  ('e5000000-0000-4000-8000-000000000001', 'owner'),
  ('e5000000-0000-4000-8000-000000000002', 'editor'),
  ('e5000000-0000-4000-8000-000000000003', 'viewer');

INSERT INTO public.influencers (id, name, slug)
VALUES ('e5100000-0000-4000-8000-000000000001', 'Alert fixture', 'alert-fixture');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle) VALUES
  ('e5200000-0000-4000-8000-000000000001', 'e5100000-0000-4000-8000-000000000001', 'instagram', 'alert-fixture');

-- ── Yapı ────────────────────────────────────────────────────────────────────
SELECT extensions.ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class
   WHERE oid IN ('public.alert_reads'::regclass, 'public.notification_settings'::regclass)),
  'alert_reads and notification_settings have RLS enabled'
);
SELECT extensions.ok(
  NOT has_schema_privilege('authenticated', 'private', 'USAGE')
  AND NOT has_schema_privilege('anon', 'private', 'USAGE'),
  'API roles cannot use the private schema (alert producers)'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.mark_alerts_read(uuid[])', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.unread_alert_count()', 'EXECUTE'),
  'anon cannot execute alert RPCs'
);
SELECT extensions.ok(
  (SELECT bool_and(NOT prosecdef) FROM pg_proc
   WHERE oid IN ('public.mark_alerts_read(uuid[])'::regprocedure, 'public.unread_alert_count()'::regprocedure)),
  'panel alert RPCs are SECURITY INVOKER'
);
SELECT extensions.ok(
  (SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=""']) FROM pg_proc
   WHERE pronamespace = 'private'::regnamespace
     AND proname IN ('raise_alert', 'raise_scheduled_alerts', 'raise_token_alerts', 'alerts_push',
                     'metric_snapshots_viral_alert', 'account_snapshots_milestone_alert',
                     'social_accounts_alerts', 'generations_failed_alert')),
  'alert producers are SECURITY DEFINER with an empty search_path'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM cron.job WHERE jobname = 'raise-scheduled-alerts'),
  1, 'scheduled alert job is registered in pg_cron'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notification_settings), 1, 'notification_settings has a single default row'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.alerts (type) VALUES ('made_up_type')$$,
  '23514', NULL, 'unknown alert types are rejected'
);

-- ── Tekilleştirme ───────────────────────────────────────────────────────────
SELECT extensions.ok(
  private.raise_alert('sync_failed', 'e5100000-0000-4000-8000-000000000001', '{}'::jsonb, 'test:dedupe'),
  'first alert for an event is written'
);
SELECT extensions.ok(
  NOT private.raise_alert('sync_failed', 'e5100000-0000-4000-8000-000000000001', '{}'::jsonb, 'test:dedupe'),
  'same event again is skipped'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE dedupe_key = 'test:dedupe'), 1, 'one alert per dedupe_key'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.alerts (type, dedupe_key) VALUES ('sync_failed', 'test:dedupe')$$,
  '23505', NULL, 'dedupe_key is unique even for direct inserts'
);
SELECT set_config('test.alert_id', (SELECT id::text FROM public.alerts WHERE dedupe_key = 'test:dedupe'), true);

-- ── Üreticiler ──────────────────────────────────────────────────────────────
-- Senkronizasyon hatası (sunucu/sync işi status = error yazar)
UPDATE public.social_accounts SET status = 'error' WHERE id = 'e5200000-0000-4000-8000-000000000001';
SELECT extensions.results_eq(
  $$SELECT type, influencer_id, payload ->> 'platform' FROM public.alerts
    WHERE type = 'sync_failed' AND payload ->> 'account_id' = 'e5200000-0000-4000-8000-000000000001'$$,
  $$VALUES ('sync_failed'::text, 'e5100000-0000-4000-8000-000000000001'::uuid, 'instagram'::text)$$,
  'sync error raises a sync_failed alert'
);
UPDATE public.social_accounts SET status = 'active' WHERE id = 'e5200000-0000-4000-8000-000000000001';
UPDATE public.social_accounts SET status = 'error' WHERE id = 'e5200000-0000-4000-8000-000000000001';
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts
   WHERE type = 'sync_failed' AND payload ->> 'account_id' = 'e5200000-0000-4000-8000-000000000001'),
  1, 'repeated sync errors on the same day raise a single alert'
);

-- Token süresi doluyor
UPDATE public.social_accounts SET status = 'active', token_expires_at = now() + interval '3 days'
WHERE id = 'e5200000-0000-4000-8000-000000000001';
SELECT extensions.results_eq(
  $$SELECT (payload ->> 'days_left')::integer FROM public.alerts
    WHERE type = 'token_expiring' AND payload ->> 'account_id' = 'e5200000-0000-4000-8000-000000000001'$$,
  $$VALUES (3)$$,
  'token expiring within the threshold raises token_expiring'
);
SELECT private.raise_scheduled_alerts();
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts
   WHERE type = 'token_expiring' AND payload ->> 'account_id' = 'e5200000-0000-4000-8000-000000000001'),
  1, 'scheduled run does not duplicate the token alert'
);
UPDATE public.social_accounts SET token_expires_at = now() + interval '30 days'
WHERE id = 'e5200000-0000-4000-8000-000000000001';
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts
   WHERE type = 'token_expiring' AND payload ->> 'account_id' = 'e5200000-0000-4000-8000-000000000001'),
  1, 'token far from expiry does not raise an alert'
);

-- Takipçi kilometre taşı (ilk snapshot temel alınır)
INSERT INTO public.account_snapshots (account_id, captured_at, followers)
VALUES ('e5200000-0000-4000-8000-000000000001', now() - interval '2 days', 900);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts
   WHERE type = 'follower_milestone' AND payload ->> 'account_id' = 'e5200000-0000-4000-8000-000000000001'),
  0, 'first snapshot is the baseline, no milestone alert'
);
INSERT INTO public.account_snapshots (account_id, captured_at, followers)
VALUES ('e5200000-0000-4000-8000-000000000001', now() - interval '1 day', 1200);
SELECT extensions.results_eq(
  $$SELECT (payload ->> 'milestone')::integer, (payload ->> 'followers')::integer FROM public.alerts
    WHERE type = 'follower_milestone' AND payload ->> 'account_id' = 'e5200000-0000-4000-8000-000000000001'$$,
  $$VALUES (1000, 1200)$$,
  'crossing 1000 followers raises follower_milestone'
);
INSERT INTO public.account_snapshots (account_id, captured_at, followers)
VALUES ('e5200000-0000-4000-8000-000000000001', now(), 1300);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts
   WHERE type = 'follower_milestone' AND payload ->> 'account_id' = 'e5200000-0000-4000-8000-000000000001'),
  1, 'growth without a new milestone does not alert'
);

-- Viral eşik: ilk saatte hesap ortalamasının 3 katı (editor'ün yazdığı snapshot, uyarıyı sunucu üretir)
INSERT INTO public.posts (id, account_id, published_at) VALUES
  ('e5300000-0000-4000-8000-000000000001', 'e5200000-0000-4000-8000-000000000001', now() - interval '4 days'),
  ('e5300000-0000-4000-8000-000000000002', 'e5200000-0000-4000-8000-000000000001', now() - interval '3 days'),
  ('e5300000-0000-4000-8000-000000000003', 'e5200000-0000-4000-8000-000000000001', now() - interval '2 days'),
  ('e5300000-0000-4000-8000-000000000004', 'e5200000-0000-4000-8000-000000000001', now() - interval '2 hours');
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, views) VALUES
  ('e5300000-0000-4000-8000-000000000001', now() - interval '4 days' + interval '1 hour', 1, 100),
  ('e5300000-0000-4000-8000-000000000002', now() - interval '3 days' + interval '1 hour', 1, 100),
  ('e5300000-0000-4000-8000-000000000003', now() - interval '2 days' + interval '1 hour', 1, 100);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e5000000-0000-4000-8000-000000000002', true); -- editor
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, views)
VALUES ('e5300000-0000-4000-8000-000000000004', now() - interval '90 minutes', 0.5, 299);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts
   WHERE type = 'viral_post' AND payload ->> 'post_id' = 'e5300000-0000-4000-8000-000000000004'),
  0, 'below 3x the account first-hour average is not viral'
);
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, views)
VALUES ('e5300000-0000-4000-8000-000000000004', now() - interval '60 minutes', 1, 300);
SELECT extensions.results_eq(
  $$SELECT (payload ->> 'views')::integer, (payload ->> 'baseline')::integer FROM public.alerts
    WHERE type = 'viral_post' AND payload ->> 'post_id' = 'e5300000-0000-4000-8000-000000000004'$$,
  $$VALUES (300, 100)$$,
  'reaching 3x the first-hour average raises viral_post (written server side for the editor)'
);
INSERT INTO public.metric_snapshots (post_id, captured_at, hours_since_publish, views)
VALUES ('e5300000-0000-4000-8000-000000000004', now() - interval '59 minutes', 1, 500);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts
   WHERE type = 'viral_post' AND payload ->> 'post_id' = 'e5300000-0000-4000-8000-000000000004'),
  1, 'later snapshots of the same viral post do not duplicate'
);

-- Başarısız üretim (durumu worker yazar)
RESET ROLE;
INSERT INTO public.generations (id, influencer_id, tool, type, status)
VALUES ('e5400000-0000-4000-8000-000000000001', 'e5100000-0000-4000-8000-000000000001', 'mock', 'image', 'failed');
SET LOCAL ROLE authenticated;
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts
   WHERE type = 'generation_failed' AND payload ->> 'generation_id' = 'e5400000-0000-4000-8000-000000000001'),
  1, 'failed generation raises generation_failed'
);
SELECT extensions.throws_ok(
  $$SELECT private.raise_alert('sync_failed', NULL, '{}'::jsonb, 'test:browser')$$,
  '42501', NULL, 'editor cannot call alert producers directly'
);
RESET ROLE;

-- Yayın saati geldi ama içerik hazır değil (pg_cron işi)
INSERT INTO public.content_items (id, influencer_id, title, stage, scheduled_at) VALUES
  ('e5500000-0000-4000-8000-000000000001', 'e5100000-0000-4000-8000-000000000001', 'Hazır olmayan', 'production', now() - interval '10 minutes'),
  ('e5500000-0000-4000-8000-000000000002', 'e5100000-0000-4000-8000-000000000001', 'Gelecek', 'idea', now() + interval '1 day');
SELECT private.raise_scheduled_alerts();
SELECT extensions.results_eq(
  $$SELECT payload ->> 'content_item_id', payload ->> 'stage' FROM public.alerts WHERE type = 'content_not_ready'
    AND influencer_id = 'e5100000-0000-4000-8000-000000000001'$$,
  $$VALUES ('e5500000-0000-4000-8000-000000000001'::text, 'production'::text)$$,
  'due content that is not ready raises content_not_ready (future content does not)'
);
SELECT private.raise_scheduled_alerts();
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE type = 'content_not_ready'
   AND influencer_id = 'e5100000-0000-4000-8000-000000000001'),
  1, 'scheduled run is idempotent'
);
SELECT extensions.ok(
  (SELECT count(DISTINCT type) FROM public.alerts WHERE influencer_id = 'e5100000-0000-4000-8000-000000000001') >= 6,
  'six different alert types are produced by the database'
);

-- ── RLS: viewer okur, yazamaz; okundu kişi başı ─────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e5000000-0000-4000-8000-000000000003', true); -- viewer
SELECT extensions.ok(
  (SELECT count(*) FROM public.alerts WHERE influencer_id = 'e5100000-0000-4000-8000-000000000001') >= 5,
  'viewer can read alerts'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.alerts (type, payload) VALUES ('sync_failed', '{}')$$,
  '42501', NULL, 'viewer cannot create alerts from the browser'
);
SELECT extensions.is_empty(
  $$UPDATE public.alerts SET read_at = now(), payload = '{}' RETURNING id$$,
  'viewer cannot update alert rows'
);
SELECT extensions.is_empty(
  $$DELETE FROM public.alerts RETURNING id$$,
  'viewer cannot delete alerts'
);
SELECT extensions.is(
  public.unread_alert_count(), (SELECT count(*)::integer FROM public.alerts),
  'viewer starts with every alert unread'
);
SELECT extensions.is(
  public.mark_alerts_read(ARRAY(SELECT id FROM public.alerts WHERE dedupe_key = 'test:dedupe')),
  1, 'viewer can mark one alert as read'
);
SELECT extensions.is(
  public.mark_alerts_read(ARRAY(SELECT id FROM public.alerts WHERE dedupe_key = 'test:dedupe')),
  0, 'marking the same alert again is a no-op'
);
SELECT extensions.is(
  public.unread_alert_count(), (SELECT count(*)::integer - 1 FROM public.alerts),
  'unread count drops by one'
);
INSERT INTO public.alert_reads (alert_id, user_id, read_at)
SELECT id, 'e5000000-0000-4000-8000-000000000001', '2000-01-01' FROM public.alerts WHERE type = 'generation_failed'
  AND payload ->> 'generation_id' = 'e5400000-0000-4000-8000-000000000001';
SELECT extensions.ok(
  (SELECT r.user_id = 'e5000000-0000-4000-8000-000000000003'::uuid AND r.read_at > '2000-01-02'
   FROM public.alert_reads r JOIN public.alerts a ON a.id = r.alert_id
   WHERE a.payload ->> 'generation_id' = 'e5400000-0000-4000-8000-000000000001'),
  'read owner and time are forced server side (cannot mark for another user)'
);
SELECT extensions.ok(public.mark_alerts_read() > 0, 'viewer can mark all alerts as read');
SELECT extensions.is(public.unread_alert_count(), 0, 'viewer has no unread alerts');
SELECT extensions.throws_ok(
  $$UPDATE public.alert_reads SET read_at = now()$$,
  '42501', NULL, 'read receipts cannot be edited'
);

SELECT set_config('request.jwt.claim.sub', 'e5000000-0000-4000-8000-000000000001', true); -- owner
SELECT extensions.is(
  public.unread_alert_count(), (SELECT count(*)::integer FROM public.alerts),
  'read state is per user: owner still has every alert unread'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alert_reads), 0, 'owner cannot see the viewer''s read receipts'
);

SELECT set_config('request.jwt.claim.sub', 'e5000000-0000-4000-8000-000000000002', true); -- editor
SELECT extensions.is_empty(
  $$UPDATE public.alerts SET payload = '{}' RETURNING id$$,
  'editor cannot tamper with existing alerts'
);

-- ── Ekip dışı kullanıcı hiçbir şey görmez ───────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'e5000000-0000-4000-8000-000000000004', true); -- outsider
SELECT extensions.is((SELECT count(*)::integer FROM public.alerts), 0, 'outsider cannot read alerts');
SELECT extensions.is(public.unread_alert_count(), 0, 'outsider has no unread count');
SELECT extensions.is(public.mark_alerts_read(), 0, 'outsider cannot mark alerts as read');
SELECT extensions.throws_ok(
  $$INSERT INTO public.alert_reads (alert_id) VALUES (current_setting('test.alert_id')::uuid)$$,
  '42501', NULL, 'outsider cannot mark a team alert as read'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notification_settings), 0, 'outsider cannot read notification settings'
);
SELECT extensions.is_empty(
  $$UPDATE public.notification_settings SET push_ntfy = true RETURNING id$$,
  'outsider cannot change notification settings'
);

-- ── Ayarlar: ekip okur, owner/editor yazar ──────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'e5000000-0000-4000-8000-000000000003', true); -- viewer
SELECT extensions.is((SELECT count(*)::integer FROM public.notification_settings), 1, 'viewer can read settings');
SELECT extensions.is_empty(
  $$UPDATE public.notification_settings SET viral_multiplier = 5 RETURNING id$$,
  'viewer cannot change settings'
);
SELECT set_config('request.jwt.claim.sub', 'e5000000-0000-4000-8000-000000000002', true); -- editor
SELECT extensions.results_eq(
  $$UPDATE public.notification_settings SET viral_multiplier = 4, token_expiry_days = 10 RETURNING viral_multiplier, token_expiry_days$$,
  $$VALUES (4.00::numeric, 10)$$,
  'editor can change thresholds'
);
SELECT extensions.throws_ok(
  $$UPDATE public.notification_settings SET viral_multiplier = 0$$,
  '23514', NULL, 'invalid threshold is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.notification_settings (id) VALUES (true)$$,
  '42501', NULL, 'settings rows cannot be added from the browser'
);
RESET ROLE;

-- ── Push kanalları ──────────────────────────────────────────────────────────
UPDATE public.notification_settings SET push_ntfy = false, push_telegram = false, push_email = false;
SELECT extensions.is(
  (SELECT count(*)::integer FROM private.alert_push_requests('sync_failed')), 0,
  'no request when channels are off'
);
UPDATE public.notification_settings SET push_ntfy = true, push_telegram = true, push_email = true;
SELECT extensions.is(
  (SELECT count(*)::integer FROM private.alert_push_requests('sync_failed')), 0,
  'enabled channels without Vault secrets are skipped'
);
SELECT vault.create_secret('https://ntfy.example.invalid/ai-alerts', 'notify_ntfy_url');
SELECT vault.create_secret('123456:fixture-bot', 'notify_telegram_bot_token');
SELECT vault.create_secret('-100123', 'notify_telegram_chat_id');
SELECT extensions.results_eq(
  $$SELECT channel, url, body ->> 'topic' FROM private.alert_push_requests('viral_post') ORDER BY channel$$,
  $$VALUES ('ntfy'::text, 'https://ntfy.example.invalid'::text, 'ai-alerts'::text),
           ('telegram'::text, 'https://api.telegram.org/bot123456:fixture-bot/sendMessage'::text, NULL::text)$$,
  'configured channels produce requests (email skipped without its secrets)'
);
SELECT extensions.ok(
  (SELECT bool_and(body::text NOT LIKE '%Alert fixture%') FROM private.alert_push_requests('viral_post')),
  'push body carries no names, only the alert title'
);

CREATE TEMP TABLE queue_before ON COMMIT DROP AS SELECT count(*) AS n FROM net.http_request_queue;
SELECT private.raise_alert('sync_failed', NULL, '{}'::jsonb, 'test:push');
SELECT extensions.is(
  (SELECT count(*) FROM net.http_request_queue) - (SELECT n FROM queue_before), 2::bigint,
  'new alert queues one async request per configured channel'
);

-- Kanal hatası uyarı yazımını bozmaz
CREATE OR REPLACE FUNCTION private.http_post(p_url text, p_headers jsonb, p_body jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'webhook failed with 500';
END;
$$;
SELECT extensions.lives_ok(
  $$SELECT private.raise_alert('sync_failed', NULL, '{}'::jsonb, 'test:push-failure')$$,
  'a failing push channel does not block alert creation'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE dedupe_key = 'test:push-failure'), 1,
  'alert is stored even when every channel fails'
);

SELECT * FROM extensions.finish();
ROLLBACK;
