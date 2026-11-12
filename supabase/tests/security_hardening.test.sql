-- Güvenlik sertleştirmesi (20261024120000): kuyruk dışı üretim, uyarı yazımı, push sınırı,
-- project_url, pg_net kuyruğu ve public SECURITY DEFINER sarmalayıcıları.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(30);

-- Fixture (postgres rolüyle, RLS dışında). Seed'den bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('9c000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sh-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9c000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sh-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9c000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sh-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('9c000000-0000-4000-8000-000000000001', 'owner'),
  ('9c000000-0000-4000-8000-000000000002', 'editor'),
  ('9c000000-0000-4000-8000-000000000003', 'viewer');
INSERT INTO public.influencers (id, name, slug, status) VALUES
  ('9c100000-0000-4000-8000-000000000001', 'Hardening One', 'hardening-one', 'active');

-- ── Yapı: INVOKER sarmalayıcı + internal DEFINER çekirdek ───────────────────
SELECT extensions.ok(
  (SELECT bool_and(NOT prosecdef) FROM pg_proc
   WHERE oid IN ('public.cancel_generation(uuid)'::regprocedure, 'public.request_sync(uuid)'::regprocedure)),
  'public cancel_generation and request_sync are SECURITY INVOKER'
);
SELECT extensions.ok(
  (SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=""']) FROM pg_proc
   WHERE oid IN ('internal.cancel_generation(uuid)'::regprocedure, 'internal.request_sync(uuid)'::regprocedure)),
  'internal cores are SECURITY DEFINER with an empty search_path'
);
SELECT extensions.ok(
  NOT has_schema_privilege('anon', 'internal', 'USAGE')
  AND NOT has_function_privilege('anon', 'internal.cancel_generation(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'internal.request_sync(uuid)', 'EXECUTE'),
  'anon cannot reach the internal cores'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.cancel_generation(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.request_sync(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.cancel_generation(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.request_sync(uuid)', 'EXECUTE'),
  'wrapper grants are unchanged (authenticated yes, anon no)'
);
SELECT extensions.ok(
  NOT has_schema_privilege('authenticated', 'private', 'USAGE'),
  'private schema stays closed to API roles'
);
SELECT extensions.ok(
  to_regprocedure('public.raise_budget_alerts(date)') IS NULL
  AND to_regprocedure('public.costs_check_budgets()') IS NULL,
  'budget alert producer is no longer a public (invoker) function'
);

-- ── pg_net ──────────────────────────────────────────────────────────────────
-- net.* tablolarının sahibi platform rolü (supabase_admin) ve PUBLIC'e verdiği izni migration
-- rolü geri alamaz (migration denemesi platform izin verirse etkili olur). Savunma: net şeması
-- PostgREST'e açık değil ve hiçbir public fonksiyon/görünüm onu okumuyor; sır okuyan ve istek
-- kuyruğa alan yardımcılar API rollerine kapalı.
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_depend d
    JOIN pg_rewrite rw ON rw.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
    JOIN pg_class v ON v.oid = rw.ev_class
    JOIN pg_class t ON t.oid = d.refobjid AND d.refclassid = 'pg_class'::regclass
    WHERE v.relnamespace = 'public'::regnamespace AND t.relnamespace = 'net'::regnamespace
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace)
      AND p.prosrc ~* '\mnet\.'
  ),
  'no public view or API function reads or calls the pg_net schema'
);

-- ── project_url: https, yerel adresler hariç ────────────────────────────────
SELECT extensions.ok(
  private.valid_project_url('https://abcd.supabase.co')
  AND private.valid_project_url('https://abcd.supabase.co:443'),
  'https project_url is accepted'
);
SELECT extensions.ok(
  private.valid_project_url('http://kong:8000')
  AND private.valid_project_url('http://localhost:54321')
  AND private.valid_project_url('http://127.0.0.1:54321')
  AND private.valid_project_url('http://host.docker.internal:54321'),
  'http is accepted only for local development hosts'
);
SELECT extensions.ok(
  NOT private.valid_project_url('http://abcd.supabase.co')
  AND NOT private.valid_project_url('http://kong.example.com')
  AND NOT private.valid_project_url('https://abcd.supabase.co/path')
  AND NOT private.valid_project_url('ftp://abcd.supabase.co')
  AND NOT private.valid_project_url(NULL),
  'plain http to a remote host, paths and other schemes are rejected'
);

-- ── Üretim: kuyruk dışı yazım yok ───────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000002', true); -- editor

SELECT extensions.throws_ok(
  $$INSERT INTO public.generations (influencer_id, tool, type, status, credits)
    VALUES ('9c100000-0000-4000-8000-000000000001', 'fake', 'image', 'succeeded', 0)$$,
  '42501', NULL, 'editor cannot INSERT a generation directly'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.generations (influencer_id, tool, type, params)
    VALUES ('9c100000-0000-4000-8000-000000000001', 'fake', 'image',
            jsonb_build_object('budget_override_by', '9c000000-0000-4000-8000-000000000001'))$$,
  '42501', NULL, 'editor cannot forge an owner budget approval with a direct INSERT'
);
SELECT extensions.ok(
  current_setting('app.enqueue_generation', true) IS DISTINCT FROM 'on',
  'no enqueue flag is set outside the RPC'
);
SELECT extensions.results_eq(
  $$SELECT status::text, credits, params ? 'budget_override_by', params ->> 'prompt'
    FROM public.enqueue_generation(
      '9c100000-0000-4000-8000-000000000001', 'image', 'fake',
      jsonb_build_object('prompt', 'p', 'budget_override_by', '9c000000-0000-4000-8000-000000000001'))$$,
  $$VALUES ('queued'::text, NULL::numeric, false, 'p'::text)$$,
  'enqueue works and drops a client-supplied budget_override_by'
);
SELECT extensions.is(
  COALESCE(current_setting('app.enqueue_generation', true), ''), '',
  'enqueue flag is cleared right after the insert'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.generations (influencer_id, tool, type)
    VALUES ('9c100000-0000-4000-8000-000000000001', 'fake', 'image')$$,
  '42501', NULL, 'a direct INSERT after an enqueue in the same transaction is still rejected'
);
SELECT extensions.throws_ok(
  $$UPDATE public.generations SET status = 'succeeded'
    WHERE influencer_id = '9c100000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'editor cannot change the status of a generation'
);
SELECT extensions.throws_ok(
  $$UPDATE public.generations SET credits = 0
    WHERE influencer_id = '9c100000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'editor cannot change credits'
);
SELECT extensions.throws_ok(
  $$UPDATE public.generations SET created_at = now() - interval '2 months'
    WHERE influencer_id = '9c100000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'editor cannot move a generation to another budget month'
);
SELECT extensions.is(
  (SELECT (public.cancel_generation(id)).status::text FROM public.generations
   WHERE influencer_id = '9c100000-0000-4000-8000-000000000001' LIMIT 1),
  'cancelled', 'cancel_generation still works through the invoker wrapper'
);
SELECT extensions.throws_ok(
  $$UPDATE public.generations SET status = 'queued'
    WHERE influencer_id = '9c100000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'a cancelled generation cannot be put back into the queue directly'
);

-- ── Uyarılar: tarayıcı yazamaz, bütçe uyarısı sunucuda yazılır ───────────────
SELECT extensions.throws_ok(
  $$INSERT INTO public.alerts (type, payload) VALUES ('sync_failed', '{}')$$,
  '42501', NULL, 'editor cannot create alerts from the browser'
);
SELECT set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000001', true); -- owner
INSERT INTO public.budgets (influencer_id, month, amount, currency)
VALUES ('9c100000-0000-4000-8000-000000000001', '2026-07-01', 10, 'USD');
SELECT set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000002', true); -- editor
INSERT INTO public.costs (influencer_id, category, amount, currency, incurred_on)
VALUES ('9c100000-0000-4000-8000-000000000001', 'other', 11, 'USD', '2026-07-10');
SELECT extensions.results_eq(
  $$SELECT type FROM public.alerts
    WHERE influencer_id = '9c100000-0000-4000-8000-000000000001' AND payload ->> 'month' = '2026-07'
    ORDER BY type$$,
  $$VALUES ('budget_exceeded'::text)$$,
  'editor cost entry still raises budget alerts (written server side)'
);
SELECT extensions.throws_ok(
  $$SELECT private.http_post('https://example.invalid', '{}'::jsonb, '{}'::jsonb)$$,
  '42501', NULL, 'signed-in user cannot queue HTTP requests through the private helper'
);
RESET ROLE;

-- ── Push: kanal başına 10 dakikada en çok 20 ────────────────────────────────
UPDATE public.notification_settings SET push_ntfy = true, push_telegram = true, push_email = false;
SELECT vault.create_secret('https://ntfy.example.invalid/ai-alerts', 'notify_ntfy_url');
SELECT vault.create_secret('123456:fixture-bot', 'notify_telegram_bot_token');
SELECT vault.create_secret('-100123', 'notify_telegram_chat_id');
DELETE FROM private.alert_push_log;
INSERT INTO private.alert_push_log (channel) SELECT 'ntfy' FROM generate_series(1, private.alert_push_limit() - 1);

CREATE TEMP TABLE push_before ON COMMIT DROP AS SELECT count(*) AS n FROM net.http_request_queue;
SELECT private.raise_alert('sync_failed', NULL, '{}'::jsonb, 'test:rate-1');
SELECT extensions.is(
  (SELECT count(*) FROM net.http_request_queue) - (SELECT n FROM push_before), 2::bigint,
  'below the limit every configured channel is pushed'
);
SELECT extensions.results_eq(
  $$SELECT channel, count(*)::integer FROM private.alert_push_log GROUP BY channel ORDER BY channel$$,
  $$VALUES ('ntfy'::text, private.alert_push_limit()), ('telegram'::text, 1)$$,
  'each push is counted per channel'
);

TRUNCATE push_before;
INSERT INTO push_before SELECT count(*) FROM net.http_request_queue;
SELECT private.raise_alert('sync_failed', NULL, '{}'::jsonb, 'test:rate-2');
SELECT extensions.is(
  (SELECT count(*) FROM net.http_request_queue) - (SELECT n FROM push_before), 1::bigint,
  'a channel at its limit is skipped; other channels still push'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE dedupe_key = 'test:rate-2'), 1,
  'rate limited push does not block the alert itself'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'private.alert_push_log', 'SELECT'),
  'push log is not readable by API roles'
);

-- ── Uzak http project_url ile worker çağrılmaz ──────────────────────────────
SELECT vault.create_secret('http://abcd.supabase.co', 'project_url');
SELECT vault.create_secret('fixture-cron-secret', 'cron_secret');
-- Zamanı gelmiş iş var: URL denetimi olmasa worker çağrılırdı.
INSERT INTO public.generations (influencer_id, tool, type)
VALUES ('9c100000-0000-4000-8000-000000000001', 'fake', 'image');
SELECT extensions.ok(
  private.invoke_generation_worker() IS NULL
  AND private.invoke_publish_worker() IS NULL
  AND private.invoke_comments('fetch') IS NULL
  AND private.invoke_sync('metrics') IS NULL,
  'plain http to a remote project_url is never called'
);

SELECT * FROM extensions.finish();
ROLLBACK;
