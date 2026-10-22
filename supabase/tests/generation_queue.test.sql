BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(43);

-- Fixture (postgres rolüyle, RLS dışında). Seed'den bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('98000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'gq-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('98000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'gq-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('98000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'gq-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('98000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'gq-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('98000000-0000-4000-8000-000000000001', 'owner'),
  ('98000000-0000-4000-8000-000000000002', 'editor'),
  ('98000000-0000-4000-8000-000000000003', 'viewer');

INSERT INTO public.influencers (id, name, slug, status) VALUES
  ('a8000000-0000-4000-8000-000000000001', 'Queue One', 'queue-one', 'active'),
  ('a8000000-0000-4000-8000-000000000002', 'Queue Two', 'queue-two', 'active');
INSERT INTO public.assets (id, influencer_id, kind, storage_path, mime_type) VALUES
  ('a8100000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'reference', 'a8000000-0000-4000-8000-000000000001/ref.png', 'image/png'),
  ('a8100000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000002', 'reference', 'a8000000-0000-4000-8000-000000000002/ref.png', 'image/png');

-- ── Yapı ─────────────────────────────────────────────────────────
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.generation_worker_status'::regclass),
  'generation_worker_status has RLS enabled'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.claim_generations(text[], integer, integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.claim_generations(text[], integer, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.complete_generation(uuid, text, text, bigint, numeric)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.claim_generations(text[], integer, integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.complete_generation(uuid, text, text, bigint, numeric)', 'EXECUTE'),
  'worker RPCs are executable only by service_role'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.enqueue_generation(uuid, public.generation_type, text, jsonb, text, uuid, uuid[], boolean, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.cancel_generation(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.retry_generation(uuid, boolean)', 'EXECUTE'),
  'anon cannot execute queue RPCs'
);
SELECT extensions.ok(
  pg_get_functiondef('public.claim_generations(text[], integer, integer)'::regprocedure) ILIKE '%FOR UPDATE SKIP LOCKED%',
  'claim uses FOR UPDATE SKIP LOCKED'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM cron.job WHERE jobname = 'process-generations'),
  1, 'worker job is registered in pg_cron'
);
SELECT extensions.ok(
  NOT has_schema_privilege('authenticated', 'private', 'USAGE'),
  'private schema stays closed to API roles'
);
SELECT extensions.is(private.invoke_generation_worker(), NULL::bigint, 'without Vault secrets the cron call is a no-op');

-- ── Editor kuyruğa ekler ─────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000002', true);

SELECT extensions.lives_ok(
  $$SELECT public.enqueue_generation(
      'a8000000-0000-4000-8000-000000000001', 'image', 'fake', '{"prompt": "p1"}'::jsonb,
      NULL, NULL, ARRAY['a8100000-0000-4000-8000-000000000001']::uuid[])$$,
  'editor can enqueue a generation'
);
SELECT extensions.results_eq(
  $$SELECT status::text, mode, attempts::integer, progress::integer, params ->> 'prompt'
    FROM public.generations WHERE influencer_id = 'a8000000-0000-4000-8000-000000000001'$$,
  $$VALUES ('queued'::text, 'text_to_image'::text, 0, 0, 'p1'::text)$$,
  'enqueued row is queued with derived mode and zeroed worker columns'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_generation(
      'a8000000-0000-4000-8000-000000000001', 'image', 'fake', '{}'::jsonb,
      NULL, NULL, ARRAY['a8100000-0000-4000-8000-000000000002']::uuid[])$$,
  '23514', NULL, 'reference assets of another influencer are rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_generation('a8000000-0000-4000-8000-000000000001', 'image', 'fake', '{}'::jsonb, 'image_to_video')$$,
  '23514', NULL, 'mode must match type'
);
SELECT extensions.lives_ok(
  $$SELECT public.enqueue_generation('a8000000-0000-4000-8000-000000000001', 'video', 'fake', '{}'::jsonb, 'video_to_video')$$,
  'video_to_video enqueue works'
);

-- İstemci worker kolonlarını yazamaz
INSERT INTO public.generations (id, influencer_id, tool, type, provider_job_id, attempts, progress, next_run_at)
VALUES ('a8200000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'fake', 'image', 'forged', 9, 99, now() + interval '1 year');
SELECT extensions.results_eq(
  $$SELECT provider_job_id, attempts::integer, progress::integer, next_run_at <= now()
    FROM public.generations WHERE id = 'a8200000-0000-4000-8000-000000000001'$$,
  $$VALUES (NULL::text, 0, 0, true)$$,
  'client INSERT resets worker columns'
);
SELECT extensions.throws_ok(
  $$UPDATE public.generations SET provider_job_id = 'x' WHERE id = 'a8200000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'client cannot update worker columns'
);

-- ── Viewer ve ekip dışı ──────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000003', true);
SELECT extensions.ok(
  (SELECT count(*) FROM public.generations WHERE influencer_id = 'a8000000-0000-4000-8000-000000000001') >= 3,
  'viewer can read the queue'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_generation('a8000000-0000-4000-8000-000000000001', 'image', 'fake', '{}'::jsonb)$$,
  '42501', NULL, 'viewer cannot enqueue'
);
SELECT extensions.throws_ok(
  $$SELECT public.cancel_generation('a8200000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'viewer cannot cancel'
);
SELECT extensions.throws_ok(
  $$SELECT public.retry_generation('a8200000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'viewer cannot retry'
);
SELECT extensions.is_empty(
  $$UPDATE public.generations SET status = 'cancelled' WHERE id = 'a8200000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer cannot update a generation directly'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.generation_worker_status (id, providers) VALUES (true, ARRAY['forged'])$$,
  '42501', NULL, 'viewer cannot write worker status'
);

SELECT set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000004', true);
SELECT extensions.is_empty($$SELECT 1 FROM public.generations$$, 'non-team user sees no generations');
SELECT extensions.is_empty($$SELECT 1 FROM public.generation_worker_status$$, 'non-team user sees no worker status');
SELECT extensions.throws_ok(
  $$SELECT public.cancel_generation('a8200000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'non-team user cannot cancel'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_generation('a8000000-0000-4000-8000-000000000001', 'image', 'fake', '{}'::jsonb)$$,
  '42501', NULL, 'non-team user cannot enqueue'
);
RESET ROLE;

-- ── Worker: claim (kira + SKIP LOCKED), tamamla ──────────────────
SET LOCAL ROLE service_role;
-- Worker'ın oturumu yok (auth.uid() NULL)
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.claim_generations(ARRAY['other'], 10, 60)),
  0, 'claim ignores tools that are not configured'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.claim_generations(ARRAY['fake'], 2, 60)),
  2, 'claim respects the limit'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.claim_generations(ARRAY['fake'], 10, 60)),
  1, 'already claimed rows are leased and not handed out again'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.claim_generations(ARRAY['fake'], 10, 60)),
  0, 'nothing left to claim while leases are active'
);

UPDATE public.generations SET status = 'running', provider_job_id = 'job-1', started_at = now() - interval '1 minute'
WHERE id = 'a8200000-0000-4000-8000-000000000001';
SELECT extensions.lives_ok(
  $$SELECT public.complete_generation('a8200000-0000-4000-8000-000000000001',
      'a8000000-0000-4000-8000-000000000001/generated-a8200000-0000-4000-8000-000000000001.png', 'image/png', 1234, 4)$$,
  'service role completes a generation'
);
SELECT extensions.results_eq(
  $$SELECT g.status::text, g.progress::integer, g.credits, a.kind::text, a.influencer_id, a.mime_type, g.duration_ms >= 60000
    FROM public.generations g JOIN public.assets a ON a.id = g.output_asset_id
    WHERE g.id = 'a8200000-0000-4000-8000-000000000001'$$,
  $$VALUES ('succeeded'::text, 100, 4.0000::numeric, 'generated'::text,
            'a8000000-0000-4000-8000-000000000001'::uuid, 'image/png'::text, true)$$,
  'completion links a generated asset in the influencer folder'
);
SELECT extensions.is(
  (SELECT created_by FROM public.assets WHERE storage_path = 'a8000000-0000-4000-8000-000000000001/generated-a8200000-0000-4000-8000-000000000001.png'),
  '98000000-0000-4000-8000-000000000002'::uuid, 'generated asset is attributed to the requester'
);
SELECT extensions.lives_ok(
  $$SELECT public.complete_generation('a8200000-0000-4000-8000-000000000001',
      'a8000000-0000-4000-8000-000000000001/generated-a8200000-0000-4000-8000-000000000001.png', 'image/png', 1234, 4)$$,
  'completing twice is harmless'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.assets WHERE kind = 'generated' AND influencer_id = 'a8000000-0000-4000-8000-000000000001'),
  1, 'no duplicate asset on repeated completion'
);
SELECT extensions.throws_ok(
  $$SELECT public.complete_generation(
      (SELECT id FROM public.generations WHERE mode = 'video_to_video' LIMIT 1),
      'a8000000-0000-4000-8000-000000000002/elsewhere.mp4', 'video/mp4', 1, NULL)$$,
  '23514', NULL, 'generated asset cannot point into another influencer folder'
);

-- Başarısız iş (worker yazar) -> panel yeniden dener
UPDATE public.generations SET status = 'failed', error = 'boom'
WHERE mode = 'video_to_video' AND influencer_id = 'a8000000-0000-4000-8000-000000000001';
RESET ROLE;

-- ── Editor: iptal / yeniden dene ─────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000002', true);

SELECT extensions.is(
  (SELECT (public.cancel_generation(id)).status::text FROM public.generations
   WHERE mode = 'text_to_image' AND status = 'queued' AND influencer_id = 'a8000000-0000-4000-8000-000000000001' LIMIT 1),
  'cancelled', 'editor cancels an unsubmitted job immediately'
);
SELECT extensions.throws_ok(
  $$SELECT public.cancel_generation('a8200000-0000-4000-8000-000000000001')$$,
  '55000', NULL, 'a finished job cannot be cancelled'
);
SELECT extensions.results_eq(
  $$SELECT r.status::text, r.mode, r.retry_of = o.id, r.id <> o.id
    FROM public.generations o
    CROSS JOIN LATERAL public.retry_generation(o.id) r
    WHERE o.mode = 'video_to_video' AND o.status = 'failed'$$,
  $$VALUES ('queued'::text, 'video_to_video'::text, true, true)$$,
  'retry creates a new queued row linked to the failed one'
);
SELECT extensions.is(
  (SELECT status::text FROM public.generations WHERE mode = 'video_to_video' AND retry_of IS NULL),
  'failed', 'the original failed row is left untouched'
);
SELECT extensions.throws_ok(
  $$SELECT public.retry_generation('a8200000-0000-4000-8000-000000000001')$$,
  '55000', NULL, 'a succeeded job cannot be retried'
);

-- ── Bütçe koruması ───────────────────────────────────────────────
RESET ROLE;
INSERT INTO public.budgets (influencer_id, month, amount, currency)
VALUES ('a8000000-0000-4000-8000-000000000001', date_trunc('month', current_date)::date, 10, 'USD');
INSERT INTO public.costs (influencer_id, category, amount, currency, incurred_on)
VALUES ('a8000000-0000-4000-8000-000000000001', 'credits', 12, 'USD', current_date);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_generation('a8000000-0000-4000-8000-000000000001', 'image', 'fake', '{}'::jsonb)$$,
  'P0001', 'Bu ayın bütçesi doldu; yeni üretim için owner onayı gerekli.',
  'enqueue is blocked when the monthly budget is exceeded'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_generation('a8000000-0000-4000-8000-000000000001', 'image', 'fake', '{}'::jsonb, NULL, NULL, '{}', true)$$,
  'P0001', NULL, 'editor cannot override the budget block'
);
SELECT extensions.lives_ok(
  $$SELECT public.enqueue_generation('a8000000-0000-4000-8000-000000000002', 'image', 'fake', '{}'::jsonb)$$,
  'other influencers without an exceeded budget are not blocked'
);
SELECT set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);
SELECT extensions.is(
  (SELECT (public.enqueue_generation('a8000000-0000-4000-8000-000000000001', 'image', 'fake', '{}'::jsonb, NULL, NULL, '{}', true)).params ->> 'budget_override_by'),
  '98000000-0000-4000-8000-000000000001', 'owner approval unlocks the generation and is recorded'
);
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
