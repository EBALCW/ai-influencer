-- Anlatım modülü: seri ve tekil video modeli (#216, migration 20261115120000_explainer_series.sql).
--
-- Kapsam: yapı ve izinler · roller (viewer salt okur) · seri · istek ve öneriler · seçim ve
-- numaralama · tekil video · senaryo sürümleri · senaryo onayı (insan oturumu, sürüm, kaynak
-- eksiği) · değişiklikte onayın silinmesi · üretim kapısı ve dondurulan parametreler · bölüm
-- durumunun işten türemesi · benzer konu · taşıma ve arşiv · iki çalışma alanı yalıtımı.
--
-- Kimlik: oturum `request.jwt.claim.sub` (auth.uid) + `request.jwt.claims` (session_id) ile verilir.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();

-- ── Fixture ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT u.id, 'authenticated', 'authenticated', u.email, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
FROM (VALUES
  ('d2160000-0000-4000-8000-000000000001'::uuid, 'exp-a-owner@example.invalid'),
  ('d2160000-0000-4000-8000-000000000002'::uuid, 'exp-a-editor@example.invalid'),
  ('d2160000-0000-4000-8000-000000000003'::uuid, 'exp-a-viewer@example.invalid'),
  ('d2160000-0000-4000-8000-000000000004'::uuid, 'exp-a-machine@example.invalid'),
  ('d2160000-0000-4000-8000-000000000005'::uuid, 'exp-outsider@example.invalid'),
  ('e2160000-0000-4000-8000-000000000001'::uuid, 'exp-b-owner@example.invalid')
) AS u (id, email);

-- Tek alan varken üyeler varsayılan alana (A) düşer.
INSERT INTO public.team_members (user_id, role) VALUES
  ('d2160000-0000-4000-8000-000000000001', 'owner'),
  ('d2160000-0000-4000-8000-000000000002', 'editor'),
  ('d2160000-0000-4000-8000-000000000003', 'viewer'),
  ('d2160000-0000-4000-8000-000000000004', 'editor');

CREATE TEMP TABLE ws ON COMMIT DROP AS SELECT id AS a, NULL::uuid AS b FROM public.workspaces;
UPDATE ws SET b = private.create_workspace_for_user('e2160000-0000-4000-8000-000000000001', 'Anlatım alanı B');

-- RPC'lerin döndürdüğü kimlikler (authenticated rolüyle de yazılıp okunur).
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
GRANT SELECT ON ws TO authenticated;
GRANT SELECT, INSERT ON ids TO authenticated;

-- Bir çağrının SQLSTATE'i (hata yoksa 'ok'). Toplu rol/yalıtım denemelerinde kullanılır.
CREATE FUNCTION pg_temp.sqlstate_of(p_sql text) RETURNS text
LANGUAGE plpgsql AS $fn$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

-- ── Yapı ve izinler ─────────────────────────────────────────────────────────
SELECT extensions.is(
  ARRAY(
    SELECT t FROM unnest(ARRAY['series', 'topic_requests', 'topic_suggestions', 'episodes', 'episode_script_versions']) AS t
    WHERE NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass)
      OR NOT has_table_privilege('authenticated', 'public.' || t, 'SELECT')
      OR has_table_privilege('authenticated', 'public.' || t, 'INSERT')
      OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
      OR has_table_privilege('authenticated', 'public.' || t, 'DELETE')
      OR has_table_privilege('anon', 'public.' || t, 'SELECT')
  ),
  ARRAY[]::text[],
  'explainer tables: RLS on, clients may only SELECT, anon nothing'
);
SELECT extensions.is(
  ARRAY(
    SELECT p.oid::regprocedure::text FROM pg_proc p
    WHERE p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace)
      AND p.proname IN (
        'create_series', 'update_series', 'archive_series', 'create_topic_request',
        'add_topic_suggestions', 'pick_topic_suggestion', 'reject_topic_suggestion',
        'create_episode', 'update_episode', 'move_episode', 'archive_episode',
        'save_episode_script', 'approve_episode_script', 'enqueue_episode_job', 'retry_job'
      )
      AND (
        NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
        OR NOT p.proconfig @> ARRAY['search_path=""']
        OR p.prosecdef <> (p.pronamespace = 'internal'::regnamespace)
      )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'explainer RPCs: public INVOKER wrapper + internal DEFINER core, empty search_path, authenticated only'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM pg_proc p
   WHERE p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace)
     AND p.proname IN (
       'create_series', 'update_series', 'archive_series', 'create_topic_request',
       'add_topic_suggestions', 'pick_topic_suggestion', 'reject_topic_suggestion',
       'create_episode', 'update_episode', 'move_episode', 'archive_episode',
       'save_episode_script', 'approve_episode_script', 'enqueue_episode_job'
     )),
  28, 'every explainer RPC exists once as a wrapper and once as a core'
);
SELECT extensions.is(
  ARRAY(
    SELECT p.oid::regprocedure::text FROM pg_proc p
    WHERE p.pronamespace = 'private'::regnamespace
      AND p.proname IN (
        'explainer_pre_approval_kinds', 'explainer_job_stages',
        'explainer_pre_approval_capabilities_ok', 'job_stages_explainer_rules', 'require_explainer_writer', 'assert_patch', 'sources_valid',
        'fact_notes_unsourced', 'episode_status', 'episode_has_open_job', 'episodes_guard',
        'episodes_record_version', 'episode_script_versions_guard', 'topic_suggestions_sync_series',
        'jobs_episode_gate', 'refresh_episode_status', 'jobs_sync_episode', 'create_job',
        'next_episode_number', 'create_episode_row', 'insert_topic_suggestions'
      )
      AND (
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
        OR NOT p.proconfig @> ARRAY['search_path=""']
      )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'private explainer helpers are closed to every API role and pin search_path'
);
SELECT extensions.ok(
  (SELECT NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
     AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
     AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
   FROM pg_proc p WHERE p.oid = 'public.find_similar_topics(text, integer, uuid)'::regprocedure),
  'find_similar_topics is SECURITY INVOKER (RLS applies) and open to authenticated only'
);
SELECT extensions.ok(
  pg_get_functiondef('private.next_episode_number(uuid, uuid)'::regprocedure)
    ILIKE '%SET next_episode_number = next_episode_number + 1%'
  AND pg_get_functiondef('private.jobs_episode_gate()'::regprocedure) ILIKE '%FOR UPDATE%',
  'episode numbers come from a row-locking counter update; the gate locks the episode'
);
SELECT extensions.is(
  internal.topic_key('  PLANÖR: Motorsuz, nasıl UÇAR?  İIŞĞÜÖÇ ışğüöç '),
  'planor motorsuz nasil ucar iisguoc isguoc',
  'topic_key folds Turkish letters, case and punctuation'
);
SELECT extensions.is(
  private.explainer_pre_approval_kinds(), ARRAY['explainer.topics', 'explainer.script'],
  'only research and drafting kinds may run without an approved script'
);

-- ── Seri ────────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;

-- Editor (insan oturumu).
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e2"}', true);

INSERT INTO ids
SELECT 's1', (public.create_series(
  '  Nasıl Çalışır?  ',
  '{"theme":"Mekanizmalar","kind":"how_it_works","visual_route":"hyperframes","style_key":"blueprint-01",
    "voice_provider":"edge-tts","voice_name":"tr-TR-AhmetNeural","voice_rate":"+8%",
    "caption_style":{"max_words":6},"default_params":{"duration":60,"fps":30}}'::jsonb
)).id;
SELECT extensions.results_eq(
  $$SELECT name, theme, kind, visual_route, style_key, voice_provider, voice_name, voice_rate,
      caption_style, language, default_params, status, next_episode_number, workspace_id, created_by
    FROM public.series WHERE id = (SELECT id FROM ids WHERE k = 's1')$$,
  $$SELECT 'Nasıl Çalışır?'::text, 'Mekanizmalar'::text, 'how_it_works'::text, 'hyperframes'::text,
      'blueprint-01'::text, 'edge-tts'::text, 'tr-TR-AhmetNeural'::text, '+8%'::text,
      '{"max_words":6}'::jsonb, 'tr'::text, '{"duration":60,"fps":30}'::jsonb, 'active'::text, 1, a,
      'd2160000-0000-4000-8000-000000000002'::uuid FROM ws$$,
  'editor creates a series: trimmed name, settings stored, own workspace, created_by from the session'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('NASIL çalışır')$$,
  '23505', NULL, 'series names are unique per workspace (case, Turkish letters and punctuation ignored)'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Yeni', '{"workspace_id":"00000000-0000-4000-8000-000000000000"}'::jsonb)$$,
  '22023', NULL, 'unknown settings (e.g. a client-supplied workspace_id) are rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Yeni', '[1]'::jsonb)$$, '22023', NULL, 'settings must be an object'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Yeni', '{"visual_route":"veo"}'::jsonb)$$,
  '23514', NULL, 'unknown visual route is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Yeni', '{"kind":"vlog"}'::jsonb)$$, '23514', NULL, 'unknown kind is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Yeni', '{"voice_rate":"hızlı"}'::jsonb)$$,
  '23514', NULL, 'voice rate format is enforced'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Yeni', jsonb_build_object('default_params', jsonb_build_object('x', repeat('a', 17000))))$$,
  '23514', NULL, 'default params are bounded (16 KB)'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('   ')$$, '23514', NULL, 'series name cannot be blank'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series(repeat('a', 121))$$, '23514', NULL, 'series name is bounded'
);
SELECT extensions.results_eq(
  $$SELECT name, theme, voice_rate, caption_style, kind
    FROM public.update_series((SELECT id FROM ids WHERE k = 's1'),
      '{"theme":"Makineler ve doğa","voice_rate":null,"caption_style":{"max_words":5}}'::jsonb)$$,
  $$VALUES ('Nasıl Çalışır?'::text, 'Makineler ve doğa'::text, NULL::text, '{"max_words":5}'::jsonb, 'how_it_works'::text)$$,
  'update_series changes only the given fields; null clears an optional one'
);
SELECT extensions.throws_ok(
  $$SELECT public.update_series((SELECT id FROM ids WHERE k = 's1'), '{"status":"archived"}'::jsonb)$$,
  '22023', NULL, 'status is not a patchable field'
);
SELECT extensions.throws_ok(
  $$SELECT public.update_series((SELECT id FROM ids WHERE k = 's1'), '{"next_episode_number":99}'::jsonb)$$,
  '22023', NULL, 'the episode counter is not a patchable field'
);
SELECT extensions.throws_ok(
  $$SELECT public.update_series(gen_random_uuid(), '{"theme":"x"}'::jsonb)$$,
  'P0002', NULL, 'unknown series is not found'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.series (name) VALUES ('Doğrudan')$$, '42501', NULL, 'editor cannot insert series directly'
);
SELECT extensions.throws_ok(
  $$UPDATE public.series SET next_episode_number = 50$$, '42501', NULL, 'editor cannot update series directly'
);
SELECT extensions.throws_ok(
  $$DELETE FROM public.series$$, '42501', NULL, 'editor cannot delete series directly'
);

-- ── İstek ve öneriler ───────────────────────────────────────────────────────
INSERT INTO ids
SELECT 'rq1', (public.create_topic_request(
  '  havacılıkla ilgili video fikri  ',
  '[
    {"title":"Planör motorsuz nasıl saatlerce uçar?","summary":"Planör çekilir, sonra süzülür.",
     "hook":"Bu uçağın motoru yok.","visual_idea":"kanat kesiti; süzülme üçgeni","kind":"how_it_works",
     "evidence_level":"proven","evidence_detail":{"views":900000,"median":200000,"samples":8},
     "source_candidates":[{"title":"NASA Glenn Gliders","primary":true},{"title":"FAI rekor listesi"}]},
    {"title":"Mağarada 17 gün: Tham Luang kurtarması","kind":"event","evidence_level":"format_example",
     "sensitivity_note":"can kaybı var; saygılı anlatım"},
    {"title":"Uçak kanadı kaldırma kuvvetini nasıl üretir?"}
  ]'::jsonb,
  (SELECT id FROM ids WHERE k = 's1')
)).id;
SELECT extensions.results_eq(
  $$SELECT prompt, kind, language, series_id, workspace_id, created_by
    FROM public.topic_requests WHERE id = (SELECT id FROM ids WHERE k = 'rq1')$$,
  $$SELECT 'havacılıkla ilgili video fikri'::text, 'how_it_works'::text, 'tr'::text,
      (SELECT id FROM ids WHERE k = 's1'), a, 'd2160000-0000-4000-8000-000000000002'::uuid FROM ws$$,
  'the request keeps the short prompt; kind and language default from the series'
);
SELECT extensions.results_eq(
  $$SELECT position::integer, title, kind, evidence_level, status, series_id,
      jsonb_array_length(source_candidates), sensitivity_note, title_key
    FROM public.topic_suggestions WHERE request_id = (SELECT id FROM ids WHERE k = 'rq1') ORDER BY position$$,
  $$SELECT * FROM (VALUES
      (1, 'Planör motorsuz nasıl saatlerce uçar?'::text, 'how_it_works'::text, 'proven'::text, 'new'::text,
       (SELECT id FROM ids WHERE k = 's1'), 2, NULL::text, 'planor motorsuz nasil saatlerce ucar'::text),
      (2, 'Mağarada 17 gün: Tham Luang kurtarması', 'event', 'format_example', 'new',
       (SELECT id FROM ids WHERE k = 's1'), 0, 'can kaybı var; saygılı anlatım', 'magarada 17 gun tham luang kurtarmasi'),
      (3, 'Uçak kanadı kaldırma kuvvetini nasıl üretir?', 'how_it_works', 'original', 'new',
       (SELECT id FROM ids WHERE k = 's1'), 0, NULL, 'ucak kanadi kaldirma kuvvetini nasil uretir')
    ) AS v$$,
  'suggestions are stored in order with defaults (kind from the request, evidence original) and the series copy'
);
INSERT INTO ids SELECT 'sg' || s.position, s.id FROM public.topic_suggestions s
WHERE s.request_id = (SELECT id FROM ids WHERE k = 'rq1');

SELECT extensions.is(
  (SELECT count(*)::integer FROM public.add_topic_suggestions(
    (SELECT id FROM ids WHERE k = 'rq1'), '[{"title":"Helikopter nasıl havada asılı kalır?"}]'::jsonb)),
  4, 'add_topic_suggestions appends to the batch and returns the whole batch'
);
SELECT extensions.is(
  (SELECT position::integer FROM public.topic_suggestions WHERE title = 'Helikopter nasıl havada asılı kalır?'),
  4, 'appended suggestions continue the numbering'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'),
      (SELECT jsonb_agg(jsonb_build_object('title', 'Konu ' || g)) FROM generate_series(1, 17) g))$$,
  '22023', NULL, 'a request holds at most 20 suggestions'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'), '[{"title":"x","status":"picked"}]'::jsonb)$$,
  '22023', NULL, 'unknown suggestion fields (e.g. status) are rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'), '{"title":"x"}'::jsonb)$$,
  '22023', NULL, 'suggestions must be an array'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'), '[{"title":"x","kind":"vlog"}]'::jsonb)$$,
  '23514', NULL, 'unknown suggestion kind is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'), '[{"title":"x","evidence_level":"viral"}]'::jsonb)$$,
  '23514', NULL, 'unknown evidence level is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'),
      jsonb_build_array(jsonb_build_object('title', 'x', 'source_candidates',
        (SELECT jsonb_agg(jsonb_build_object('title', 'k' || g)) FROM generate_series(1, 11) g))))$$,
  '23514', NULL, 'source candidates are bounded (10)'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'),
      '[{"title":"x","source_candidates":[{"title":"t","url":"javascript:alert(1)"}]}]'::jsonb)$$,
  '22023', NULL, 'a source candidate address must be http(s)'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'), '[{"title":"x","source_candidates":["NASA"]}]'::jsonb)$$,
  '22023', NULL, 'source candidates must be objects'
);
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'), '[{"summary":"başlık yok"}]'::jsonb)$$,
  '23502', NULL, 'a suggestion needs a title'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_topic_request('   ')$$, '23514', NULL, 'the prompt cannot be blank'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_topic_request('seri yok', '[]'::jsonb, gen_random_uuid())$$,
  'P0002', NULL, 'a request for an unknown series is not found'
);
-- Serisiz, türü belirsiz istek: önerinin kendi türü olmalı.
INSERT INTO ids SELECT 'rq2', (public.create_topic_request('ilginç mühendislik')).id;
SELECT extensions.throws_ok(
  $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq2'), '[{"title":"Türü yok"}]'::jsonb)$$,
  '23502', NULL, 'without a series or request kind the suggestion must state its kind'
);
INSERT INTO ids
SELECT 'sgx', s.id FROM public.add_topic_suggestions(
  (SELECT id FROM ids WHERE k = 'rq2'), '[{"title":"Köprü neden çökmez?","kind":"how_it_works"}]'::jsonb) s;
SELECT extensions.is(
  (SELECT series_id FROM public.topic_suggestions WHERE id = (SELECT id FROM ids WHERE k = 'sgx')),
  NULL::uuid, 'a request without a series yields suggestions without a series'
);

-- ── Seçim, eleme, numaralama ────────────────────────────────────────────────
INSERT INTO ids SELECT 'ep1', (public.pick_topic_suggestion((SELECT id FROM ids WHERE k = 'sg1'))).id;
SELECT extensions.results_eq(
  $$SELECT series_id, episode_number, suggestion_id, title, kind, language, summary, hook, visual_idea,
      status, script_version, workspace_id, created_by
    FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  $$SELECT (SELECT id FROM ids WHERE k = 's1'), 1, (SELECT id FROM ids WHERE k = 'sg1'),
      'Planör motorsuz nasıl saatlerce uçar?'::text, 'how_it_works'::text, 'tr'::text,
      'Planör çekilir, sonra süzülür.'::text, 'Bu uçağın motoru yok.'::text,
      'kanat kesiti; süzülme üçgeni'::text, 'draft'::text, 0, a,
      'd2160000-0000-4000-8000-000000000002'::uuid FROM ws$$,
  'picking a suggestion creates episode 1 of the series as a draft carrying the suggestion text'
);
SELECT extensions.results_eq(
  $$SELECT status, decided_by, decided_at IS NOT NULL
    FROM public.topic_suggestions WHERE id = (SELECT id FROM ids WHERE k = 'sg1')$$,
  $$VALUES ('picked'::text, 'd2160000-0000-4000-8000-000000000002'::uuid, true)$$,
  'the picked suggestion records who decided and when'
);
SELECT extensions.throws_ok(
  $$SELECT public.pick_topic_suggestion((SELECT id FROM ids WHERE k = 'sg1'))$$,
  '55000', NULL, 'a suggestion cannot be picked twice'
);
SELECT extensions.results_eq(
  $$SELECT status, rejection_reason, decided_by
    FROM public.reject_topic_suggestion((SELECT id FROM ids WHERE k = 'sg2'), '  şimdilik değil  ')$$,
  $$VALUES ('rejected'::text, 'şimdilik değil'::text, 'd2160000-0000-4000-8000-000000000002'::uuid)$$,
  'rejecting keeps the suggestion with the reason'
);
SELECT extensions.throws_ok(
  $$SELECT public.reject_topic_suggestion((SELECT id FROM ids WHERE k = 'sg2'))$$,
  '55000', NULL, 'a decided suggestion cannot be rejected again'
);
SELECT extensions.throws_ok(
  $$SELECT public.reject_topic_suggestion((SELECT id FROM ids WHERE k = 'sg1'))$$,
  '55000', NULL, 'a picked suggestion cannot be rejected'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.episodes), 1, 'rejecting creates no episode'
);
-- Elenmiş öneri sonradan seçilebilir: sıradaki numarayı alır.
INSERT INTO ids SELECT 'ep2', (public.pick_topic_suggestion((SELECT id FROM ids WHERE k = 'sg2'))).id;
SELECT extensions.results_eq(
  $$SELECT e.episode_number, e.kind, e.sensitivity_note, s.status, s.rejection_reason
    FROM public.episodes e JOIN public.topic_suggestions s ON s.id = e.suggestion_id
    WHERE e.id = (SELECT id FROM ids WHERE k = 'ep2')$$,
  $$VALUES (2, 'event'::text, 'can kaybı var; saygılı anlatım'::text, 'picked'::text, NULL::text)$$,
  'a rejected suggestion can still be picked later and becomes episode 2 with its sensitivity note'
);
-- Önerisiz bölüm: seride (tür seriden) ve tekil.
INSERT INTO ids
SELECT 'ep3', (public.create_episode('Yelkenli rüzgâra karşı nasıl gider?', NULL, (SELECT id FROM ids WHERE k = 's1'))).id;
INSERT INTO ids SELECT 'single', (public.create_episode('  Tekil: bir köprünün hikâyesi  ', 'event')).id;
SELECT extensions.results_eq(
  $$SELECT k, e.series_id IS NULL, e.episode_number, e.kind, e.title, e.suggestion_id IS NULL
    FROM public.episodes e JOIN ids ON ids.id = e.id WHERE k IN ('ep3', 'single') ORDER BY k$$,
  $$VALUES ('ep3'::text, false, 3, 'how_it_works'::text, 'Yelkenli rüzgâra karşı nasıl gider?'::text, true),
           ('single', true, NULL, 'event', 'Tekil: bir köprünün hikâyesi', true)$$,
  'episodes without a suggestion: the next number inside a series, no number and no series for a single video'
);
SELECT extensions.is(
  (SELECT next_episode_number FROM public.series WHERE id = (SELECT id FROM ids WHERE k = 's1')),
  4, 'the series counter advanced once per episode'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_episode('Türü yok')$$,
  '22023', NULL, 'a single video must state its kind'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_episode('Bilinmeyen tür', 'vlog')$$, '23514', NULL, 'unknown episode kind is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_episode('   ', 'event')$$, '23514', NULL, 'episode title cannot be blank'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_episode('Seri yok', 'event', gen_random_uuid())$$,
  'P0002', NULL, 'an episode for an unknown series is not found'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.episodes (title, kind) VALUES ('Doğrudan', 'event')$$,
  '42501', NULL, 'editor cannot insert episodes directly'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET status = 'approved'$$, '42501', NULL, 'editor cannot update episodes directly'
);
SELECT extensions.throws_ok(
  $$UPDATE public.topic_suggestions SET status = 'picked'$$,
  '42501', NULL, 'editor cannot update suggestions directly'
);

-- Numara kuralları veritabanında (service role için de).
RESET ROLE;
SELECT extensions.throws_ok(
  $$INSERT INTO public.episodes (series_id, episode_number, title, kind)
    SELECT id, 2, 'Çift numara', 'event' FROM ids WHERE k = 's1'$$,
  '23505', NULL, 'an episode number is unique inside its series'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.episodes (workspace_id, episode_number, title, kind)
    SELECT a, 1, 'Serisiz numara', 'event' FROM ws$$,
  '23514', NULL, 'an episode without a series has no number'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.episodes (series_id, title, kind) SELECT id, 'Numarasız', 'event' FROM ids WHERE k = 's1'$$,
  '23514', NULL, 'an episode inside a series must have a number'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.episodes (title, kind, script_approved_at) VALUES ('Onaylı doğar', 'event', now())$$,
  '42501', NULL, 'an episode cannot be inserted already approved, even by the service role'
);
SET LOCAL ROLE authenticated;

-- ── Viewer ve ekip dışı ─────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000003","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e3"}', true);
SELECT extensions.results_eq(
  $$SELECT (SELECT count(*)::integer FROM public.series), (SELECT count(*)::integer FROM public.topic_requests),
      (SELECT count(*)::integer FROM public.topic_suggestions), (SELECT count(*)::integer FROM public.episodes)$$,
  $$VALUES (1, 2, 5, 4)$$,
  'viewer reads series, requests, suggestions and episodes of the own workspace'
);
SELECT extensions.is(
  ARRAY(
    SELECT c.label FROM (VALUES
      ('create_series', $$SELECT public.create_series('Viewer serisi')$$),
      ('update_series', $$SELECT public.update_series((SELECT id FROM ids WHERE k = 's1'), '{"theme":"x"}'::jsonb)$$),
      ('archive_series', $$SELECT public.archive_series((SELECT id FROM ids WHERE k = 's1'))$$),
      ('create_topic_request', $$SELECT public.create_topic_request('viewer isteği')$$),
      ('add_topic_suggestions', $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'), '[{"title":"x"}]'::jsonb)$$),
      ('pick_topic_suggestion', $$SELECT public.pick_topic_suggestion((SELECT id FROM ids WHERE k = 'sg3'))$$),
      ('reject_topic_suggestion', $$SELECT public.reject_topic_suggestion((SELECT id FROM ids WHERE k = 'sg3'))$$),
      ('create_episode', $$SELECT public.create_episode('Viewer bölümü', 'event')$$),
      ('update_episode', $$SELECT public.update_episode((SELECT id FROM ids WHERE k = 'ep1'), '{"title":"x"}'::jsonb)$$),
      ('move_episode', $$SELECT public.move_episode((SELECT id FROM ids WHERE k = 'ep1'))$$),
      ('archive_episode', $$SELECT public.archive_episode((SELECT id FROM ids WHERE k = 'ep1'))$$),
      ('save_episode_script', $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'viewer metni')$$),
      ('approve_episode_script', $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 0, true)$$),
      ('enqueue_episode_job', $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep1'), 'explainer.script')$$)
    ) AS c (label, sql)
    WHERE pg_temp.sqlstate_of(c.sql) <> '42501'
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'viewer is read-only: every explainer write RPC answers 42501'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.find_similar_topics('Planör motorsuz nasıl saatlerce uçar?')),
  1, 'viewer may run the similar-topic check'
);

-- Ekip dışı kullanıcı: hiçbir şey göremez, hiçbir şey yazamaz.
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000005', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000005","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e5"}', true);
SELECT extensions.results_eq(
  $$SELECT (SELECT count(*)::integer FROM public.series), (SELECT count(*)::integer FROM public.topic_requests),
      (SELECT count(*)::integer FROM public.topic_suggestions), (SELECT count(*)::integer FROM public.episodes),
      (SELECT count(*)::integer FROM public.find_similar_topics('Planör motorsuz nasıl saatlerce uçar?'))$$,
  $$VALUES (0, 0, 0, 0, 0)$$,
  'a user outside the team reads nothing'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_series('Dışarıdan')$$, '42501', NULL, 'a user outside the team cannot create a series'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'dışarıdan')$$,
  '42501', NULL, 'a user outside the team cannot write a script'
);

-- ── Senaryo ve sürümler ─────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e2"}', true);

SELECT extensions.results_eq(
  $$SELECT status, script_version, unsourced_claim_count, script_text, script -> 'lines' -> 0 ->> 'spoken',
      sensitivity_flags, script_approved_at IS NULL
    FROM public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep1'),
      'Bu uçağın motoru yok, yine de yüzlerce kilometre uçuyor.',
      '[{"claim":"İyi bir planör 1 km alçalırken 40-50 km yol alır",
         "sources":[{"title":"NASA Glenn Gliders","url":"https://example.invalid/nasa","primary":true},{"title":"FAI"}]},
        {"claim":"Rekor mesafe 3000 km","sources":[{"title":"FAI rekor listesi"}],"note":"ikinci kaynak aranıyor"}]'::jsonb,
      '{"lines":[{"spoken":"Bu uçağın motoru yok"}]}'::jsonb
    )$$,
  $$VALUES ('script_ready'::text, 1, 1, 'Bu uçağın motoru yok, yine de yüzlerce kilometre uçuyor.'::text,
      'Bu uçağın motoru yok'::text, '{}'::text[], true)$$,
  'saving a script: version 1, awaiting approval, one claim flagged as having fewer than two sources'
);
SELECT extensions.results_eq(
  $$SELECT version, script_text, unsourced_claim_count, approved_at IS NULL, created_by
    FROM public.episode_script_versions WHERE episode_id = (SELECT id FROM ids WHERE k = 'ep1') ORDER BY version$$,
  $$VALUES (1, 'Bu uçağın motoru yok, yine de yüzlerce kilometre uçuyor.'::text, 1, true,
      'd2160000-0000-4000-8000-000000000002'::uuid)$$,
  'every script version is recorded with its author'
);
-- Aynı içerik yeniden kaydedilirse sürüm açılmaz.
SELECT extensions.is(
  (SELECT script_version FROM public.save_episode_script(
    (SELECT id FROM ids WHERE k = 'ep1'), 'Bu uçağın motoru yok, yine de yüzlerce kilometre uçuyor.')),
  1, 'saving identical content does not open a new version'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'başka metin', NULL, NULL, NULL, NULL, 0)$$,
  '55000', NULL, 'a save based on a stale version is rejected (optimistic lock)'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'x', '{"claim":"dizi değil"}'::jsonb)$$,
  '22023', NULL, 'fact notes must be an array'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'x', '[{"sources":[]}]'::jsonb)$$,
  '22023', NULL, 'every fact note needs a claim'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'x', '[{"claim":"c","sources":"NASA"}]'::jsonb)$$,
  '22023', NULL, 'sources must be an array'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'x', '[{"claim":"c","sources":[{"primary":true}]}]'::jsonb)$$,
  '22023', NULL, 'a source needs a title or an address'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'x',
      '[{"claim":"c","sources":[{"title":"t","url":"javascript:alert(1)"}]}]'::jsonb)$$,
  '22023', NULL, 'a source address must be http(s)'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'x',
      (SELECT jsonb_agg(jsonb_build_object('claim', 'iddia ' || g)) FROM generate_series(1, 201) g))$$,
  '22023', NULL, 'fact notes are bounded (200 claims)'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), repeat('a', 20001))$$,
  '23514', NULL, 'script text is bounded (20 000 characters)'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'x', NULL,
      jsonb_build_object('blob', repeat('a', 140000)))$$,
  '23514', NULL, 'structured script is bounded (128 KB)'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'x', NULL, NULL, ARRAY['gossip'])$$,
  '23514', NULL, 'unknown sensitivity flag is rejected'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script(gen_random_uuid(), 'x')$$, 'P0002', NULL, 'unknown episode is not found'
);
SELECT extensions.is(
  (SELECT script_version FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')),
  1, 'rejected saves leave the version untouched'
);

-- ── Senaryo onayı ───────────────────────────────────────────────────────────
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 0, true)$$,
  '55000', NULL, 'approval must name the current script version'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 1)$$,
  '23514', NULL, 'a script with an under-sourced claim is not approved without acknowledging the gap'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep3'), 0, true)$$,
  '55000', NULL, 'an episode without a script cannot be approved'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script(gen_random_uuid(), 1, true)$$, 'P0002', NULL, 'unknown episode is not found'
);

-- Oturum kimliği olmayan çağrı onay veremez (güvenli taraf).
SELECT set_config('request.jwt.claims', '{"sub":"d2160000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 1, true)$$,
  '42501', NULL, 'a call without a session id cannot approve'
);

-- Makine oturumu onay veremez. Oturum, makine kaydının yazdığı kayıt defterine doğrudan eklenir
-- (kayıt / eşleme akışı #201 ve #211 testlerinin konusu).
RESET ROLE;
INSERT INTO private.worker_sessions (session_id, user_id)
VALUES ('5e560000-0000-4000-8000-0000000000ee', 'd2160000-0000-4000-8000-000000000004');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000004', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000004","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000ee"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 1, true)$$,
  '42501', NULL, 'a production machine session cannot approve a script'
);
SELECT extensions.is(
  (SELECT script_approved_at FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')),
  NULL::timestamptz, 'the refused approvals left the episode unapproved'
);

-- Kural trigger'dadır: makine oturumunun kimliğiyle gelen doğrudan yazım da reddedilir
-- (RPC çekirdeğindeki erken denetim atlanmış olsa bile).
RESET ROLE;
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET script_approved_at = now(), script_approved_with_gaps = true
    WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '42501', 'Üretim makinesi oturumu onay veremez.',
  'the trigger itself refuses an approval coming from a machine session'
);

-- Doğrudan yazım: service role / postgres da onay alanlarını yazamaz.
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET script_approved_at = now(), script_approved_with_gaps = true
    WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '42501', NULL, 'approval cannot be written directly without an owner/editor session'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET script_approved_by = 'd2160000-0000-4000-8000-000000000001'
    WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '42501', NULL, 'the approver column cannot be written directly'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET script_approved_version = 1 WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '42501', NULL, 'the approved version column cannot be written directly'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episode_script_versions SET approved_at = now()
    WHERE episode_id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '42501', NULL, 'a version cannot be marked approved directly'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episode_script_versions SET script_text = 'sonradan değişti'
    WHERE episode_id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '55000', NULL, 'a recorded script version is immutable'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.episode_script_versions (episode_id, version, kind, language, script_text, fact_notes,
      unsourced_claim_count, sensitivity_flags)
    SELECT id, 9, 'event', 'tr', 'uydurma sürüm', '[]'::jsonb, 0, '{}' FROM ids WHERE k = 'ep1'$$,
  '55000', NULL, 'a version row cannot be forged'
);
-- Durum yazılamaz: hesaplanır.
UPDATE public.episodes SET status = 'approved' WHERE id = (SELECT id FROM ids WHERE k = 'ep1');
SELECT extensions.is(
  (SELECT status FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')),
  'script_ready', 'status is derived: a direct write (even by the service role) is overridden'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET published_at = now() WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '55000', NULL, 'an episode without an approved video cannot be marked published'
);
SET LOCAL ROLE authenticated;

-- Owner (insan oturumu) kaynak eksiğini bilerek onaylar.
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e1"}', true);
SELECT extensions.results_eq(
  $$SELECT status, script_approved_by, script_approved_at IS NOT NULL, script_approved_version,
      script_approved_with_gaps
    FROM public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 1, true)$$,
  $$VALUES ('script_approved'::text, 'd2160000-0000-4000-8000-000000000001'::uuid, true, 1, true)$$,
  'a human owner approves: approver and time come from the session, the gap acknowledgement is recorded'
);
SELECT extensions.results_eq(
  $$SELECT approved_by, approved_at IS NOT NULL, approved_with_gaps
    FROM public.episode_script_versions
    WHERE episode_id = (SELECT id FROM ids WHERE k = 'ep1') AND version = 1$$,
  $$VALUES ('d2160000-0000-4000-8000-000000000001'::uuid, true, true)$$,
  'the approval is recorded on the version'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 1, true)$$,
  '55000', NULL, 'an approved script cannot be approved again'
);

-- ── Değişiklik onayı siler ──────────────────────────────────────────────────
-- Başlık senaryo paketinde değildir: onay kalır.
SELECT extensions.results_eq(
  $$SELECT title, status, script_version
    FROM public.update_episode((SELECT id FROM ids WHERE k = 'ep1'), '{"title":"Planör nasıl uçar?"}'::jsonb)$$,
  $$VALUES ('Planör nasıl uçar?'::text, 'script_approved'::text, 1)$$,
  'changing the working title keeps the approval'
);
SELECT extensions.results_eq(
  $$SELECT status, script_version, script_approved_at IS NULL, script_approved_by IS NULL,
      script_approved_version IS NULL, script_approved_with_gaps, unsourced_claim_count
    FROM public.save_episode_script(
      (SELECT id FROM ids WHERE k = 'ep1'),
      'Bu uçağın motoru yok, yine de yüzlerce kilometre uçuyor. İşte nasıl.',
      '[{"claim":"İyi bir planör 1 km alçalırken 40-50 km yol alır",
         "sources":[{"title":"NASA Glenn Gliders","url":"https://example.invalid/nasa","primary":true},{"title":"FAI"}]}]'::jsonb,
      NULL, NULL, NULL, 1
    )$$,
  $$VALUES ('script_ready'::text, 2, true, true, true, false, 0)$$,
  'changing the script after approval opens version 2 and clears the approval'
);
SELECT extensions.results_eq(
  $$SELECT version, approved_at IS NOT NULL FROM public.episode_script_versions
    WHERE episode_id = (SELECT id FROM ids WHERE k = 'ep1') ORDER BY version$$,
  $$VALUES (1, true), (2, false)$$,
  'the earlier version stays in history with its approval; the new one is unapproved'
);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 1)$$,
  '55000', NULL, 'the old version can no longer be approved'
);
SELECT extensions.is(
  (SELECT status FROM public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 2)),
  'script_approved', 'a fully sourced script is approved without acknowledging gaps'
);
-- Tür, dil, hassasiyet ve kaynak notu da senaryo paketindedir.
SELECT extensions.results_eq(
  $$SELECT status, script_version, script_approved_at IS NULL
    FROM public.update_episode((SELECT id FROM ids WHERE k = 'ep1'), '{"language":"en"}'::jsonb)$$,
  $$VALUES ('script_ready'::text, 3, true)$$,
  'changing the language clears the approval'
);
SELECT extensions.is(
  (SELECT status FROM public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 3)),
  'script_approved', 're-approved after the language change'
);
SELECT extensions.results_eq(
  $$SELECT status, script_version, sensitivity_flags
    FROM public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), NULL, NULL, NULL, ARRAY['real_event'], 'gerçek rekor')$$,
  $$VALUES ('script_ready'::text, 4, ARRAY['real_event'])$$,
  'changing the sensitivity flags clears the approval'
);
SELECT extensions.is(
  (SELECT status FROM public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 4)),
  'script_approved', 're-approved after the sensitivity change'
);
-- Doğrudan yazım da (service role) onayı korurken senaryoyu değiştiremez.
RESET ROLE;
UPDATE public.episodes SET fact_notes = '[]'::jsonb WHERE id = (SELECT id FROM ids WHERE k = 'ep1');
SELECT extensions.results_eq(
  $$SELECT status, script_version, script_approved_at IS NULL FROM public.episodes
    WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  $$VALUES ('script_ready'::text, 5, true)$$,
  'a direct write that changes the fact notes also loses the approval'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 5)$$,
  '23514', NULL, 'a script with no fact notes is not approved without acknowledging the gap'
);

-- ── Üretim kapısı ───────────────────────────────────────────────────────────
-- Bölümde üstüne yazılanlar: ses ve bir parametre.
SELECT extensions.lives_ok(
  $$SELECT public.update_episode((SELECT id FROM ids WHERE k = 'ep1'),
      '{"voice_name":"tr-TR-EmelNeural","params":{"fps":24}}'::jsonb)$$,
  'overrides are saved on the episode'
);
SELECT extensions.is(
  (SELECT status FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')),
  'script_ready', 'overrides do not touch the script status'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep1'), 'explainer.render')$$,
  '42501', NULL, 'production cannot start while the script is unapproved'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep3'), 'explainer.render')$$,
  '42501', NULL, 'production cannot start for an episode without a script'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('explainer', 'explainer.render', '[{"key":"render","requires_approval":true}]'::jsonb)$$,
  '23514', NULL, 'the generic enqueue cannot open an explainer production job (no episode)'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('explainer', 'explainer.voice', '[{"key":"voice"}]'::jsonb)$$,
  '23514', NULL, 'any explainer kind outside the pre-approval list needs an episode'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep1'), 'clip.cut')$$,
  '22023', NULL, 'an episode job must be an explainer kind'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job(gen_random_uuid(), 'explainer.render')$$,
  'P0002', NULL, 'a job for an unknown episode is not found'
);
-- Tür etiketiyle kapı aşılamaz: aşamalar türün sunucudaki sabit tanımıdır, istemciden alınmaz.
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('explainer', 'explainer.script',
      '[{"key":"research"},{"key":"voice"},{"key":"render"}]'::jsonb)$$,
  '23514', NULL, 'a pre-approval kind cannot carry production stages (voice, render)'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('explainer', 'explainer.script', '[{"key":"research"},{"key":"draft"},{"key":"render"}]'::jsonb)$$,
  '23514', NULL, 'a pre-approval kind cannot get an extra stage appended'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('explainer', 'explainer.topics', '[{"key":"render"}]'::jsonb)$$,
  '23514', NULL, 'a research job cannot be a render job in disguise'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_job('explainer', 'explainer.script', '[{"key":"research"},{"key":"draft"}]'::jsonb,
      '{}'::jsonb, ARRAY['render.hyperframes'])$$,
  '23514', NULL, 'a pre-approval kind cannot require a render capability'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep1'), 'explainer.script', ARRAY['voice.edge-tts'])$$,
  '23514', NULL, 'a drafting job for an episode cannot require a voice capability'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep1'), 'explainer.voice')$$,
  '22023', NULL, 'an undefined explainer kind cannot be enqueued for an episode'
);
INSERT INTO ids
SELECT 'jgen', (public.enqueue_job('explainer', 'explainer.script', '[{"key":"research"},{"key":"draft"}]'::jsonb)).id;
SELECT extensions.results_eq(
  $$SELECT s.seq::integer, s.key, s.requires_approval
    FROM public.job_stages s WHERE s.job_id = (SELECT id FROM ids WHERE k = 'jgen') ORDER BY s.seq$$,
  $$VALUES (1, 'research'::text, false), (2, 'draft'::text, false)$$,
  'the generic enqueue still opens a drafting job when the stages are exactly the fixed definition'
);
-- Ön hazırlık işi (araştırma / taslak) onaysız bölümle açılabilir ve bölümün durumunu değiştirmez.
INSERT INTO ids
SELECT 'jdraft', (public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'ep1'), 'explainer.script')).id;
SELECT extensions.results_eq(
  $$SELECT j.status, j.episode_id, j.episode_script_version, e.status, e.params_snapshot IS NULL
    FROM public.jobs j JOIN public.episodes e ON e.id = j.episode_id
    WHERE j.id = (SELECT id FROM ids WHERE k = 'jdraft')$$,
  $$SELECT 'queued'::text, (SELECT id FROM ids WHERE k = 'ep1'), 5, 'script_ready'::text, true$$,
  'a drafting job may run before approval and leaves the episode status alone'
);
SELECT extensions.lives_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'jdraft'))$$, 'the drafting job is cancelled'
);

SELECT extensions.is(
  (SELECT status FROM public.approve_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 5, true)),
  'script_approved', 'approved with the gap acknowledged'
);

-- Editor üretimi başlatır.
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000002","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e2"}', true);
INSERT INTO ids
SELECT 'j1', (public.enqueue_episode_job(
  (SELECT id FROM ids WHERE k = 'ep1'), 'explainer.render',
  ARRAY['render.hyperframes'], NULL, 3, '{"preview":true}'::jsonb
)).id;
SELECT extensions.results_eq(
  $$SELECT module, kind, status, episode_id, episode_script_version, clip_source_id IS NULL, workspace_id,
      required_capabilities, created_by
    FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  $$SELECT 'explainer'::text, 'explainer.render'::text, 'queued'::text, (SELECT id FROM ids WHERE k = 'ep1'), 5,
      true, a, ARRAY['render.hyperframes'], 'd2160000-0000-4000-8000-000000000002'::uuid FROM ws$$,
  'with an approved script the production job is queued and tied to the episode and its script version'
);
SELECT extensions.results_eq(
  $$SELECT seq::integer, key, requires_approval FROM public.job_stages
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') ORDER BY seq$$,
  $$VALUES (1, 'voice'::text, false), (2, 'captions'::text, false), (3, 'visuals'::text, false), (4, 'render'::text, true)$$,
  'the production stages come from the server: the last one is the video approval'
);
SELECT extensions.results_eq(
  $$SELECT params -> 'episode' ->> 'title', (params -> 'episode' ->> 'number')::integer,
      (params -> 'episode' ->> 'script_version')::integer, params -> 'episode' ->> 'language',
      params -> 'series' ->> 'name', params ->> 'visual_route', params ->> 'style_key',
      params -> 'voice', params -> 'caption_style', params -> 'params'
    FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  $$VALUES ('Planör nasıl uçar?'::text, 1, 5, 'en'::text, 'Nasıl Çalışır?'::text, 'hyperframes'::text,
      'blueprint-01'::text, '{"provider":"edge-tts","name":"tr-TR-EmelNeural","rate":null}'::jsonb,
      '{"max_words":5}'::jsonb, '{"duration":60,"fps":24,"preview":true}'::jsonb)$$,
  'params are frozen at enqueue: series default, overridden by the episode, then by the call'
);
SELECT extensions.results_eq(
  $$SELECT e.status, e.params_snapshot = j.params
    FROM public.episodes e JOIN public.jobs j ON j.episode_id = e.id
    WHERE j.id = (SELECT id FROM ids WHERE k = 'j1')$$,
  $$VALUES ('in_production'::text, true)$$,
  'the episode is in production and keeps the frozen snapshot'
);
-- Dondurma: seri ve bölüm sonradan değişse de iş değişmez.
SELECT extensions.lives_ok(
  $$SELECT public.update_series((SELECT id FROM ids WHERE k = 's1'), '{"visual_route":"skia","default_params":{"duration":90}}'::jsonb)$$,
  'series defaults change after the job was queued'
);
SELECT extensions.results_eq(
  $$SELECT params ->> 'visual_route', params -> 'params' -> 'duration'
    FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  $$VALUES ('hyperframes'::text, '60'::jsonb)$$,
  'the queued job keeps the params it was frozen with'
);
-- Üretim sürerken senaryo, onay ve arşiv kilitlidir.
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'üretim sürerken değişiklik')$$,
  '55000', NULL, 'the script cannot change while production is open'
);
SELECT extensions.throws_ok(
  $$SELECT public.update_episode((SELECT id FROM ids WHERE k = 'ep1'), '{"kind":"event"}'::jsonb)$$,
  '55000', NULL, 'the kind cannot change while production is open'
);
SELECT extensions.throws_ok(
  $$SELECT public.archive_episode((SELECT id FROM ids WHERE k = 'ep1'))$$,
  '55000', NULL, 'an episode cannot be archived while production is open'
);
SELECT extensions.throws_ok(
  $$SELECT public.move_episode((SELECT id FROM ids WHERE k = 'ep1'))$$,
  '55000', NULL, 'an episode cannot be moved once production started'
);

-- Kapı doğrudan yazımda da çalışır (service role / postgres).
RESET ROLE;
SELECT extensions.throws_ok(
  $$INSERT INTO public.jobs (module, kind, episode_id) SELECT 'explainer', 'explainer.render', id FROM ids WHERE k = 'ep2'$$,
  '42501', NULL, 'a direct insert cannot open a production job for an unapproved episode'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.jobs (module, kind) VALUES ('explainer', 'explainer.render')$$,
  '23514', NULL, 'a direct insert cannot open an explainer production job without an episode'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.jobs (module, kind, episode_id) SELECT 'clip', 'clip.cut', id FROM ids WHERE k = 'ep1'$$,
  '23514', NULL, 'only explainer jobs may own an episode'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET episode_id = (SELECT id FROM ids WHERE k = 'ep2') WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  '55000', NULL, 'a job cannot be re-pointed at another episode'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET kind = 'explainer.script' WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  '55000', NULL, 'a job''s kind cannot be changed after it was opened'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET module = 'clip', kind = 'clip.cut' WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  '55000', NULL, 'a job''s module cannot be changed after it was opened'
);
SELECT extensions.throws_ok(
  $$UPDATE public.job_stages SET requires_approval = false
    WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'render'$$,
  '55000', NULL, 'the video approval cannot be removed from a production job'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.job_stages (job_id, seq, key) SELECT id, 5, 'publish' FROM ids WHERE k = 'j1'$$,
  '23514', NULL, 'a stage cannot be added to an explainer job'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.job_stages (job_id, seq, key) SELECT id, 3, 'render' FROM ids WHERE k = 'jdraft'$$,
  '23514', NULL, 'a render stage cannot be added to a drafting job, even by the service role'
);
SELECT extensions.throws_ok(
  $$UPDATE public.jobs SET episode_script_version = 1 WHERE id = (SELECT id FROM ids WHERE k = 'j1')$$,
  '55000', NULL, 'the script version a job was opened with cannot be rewritten'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET script_approved_at = NULL WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '55000', NULL, 'the approval cannot be withdrawn while production is open'
);

-- Makine işi yürütür (doğrudan durum yazımıyla canlandırılır; makine RPC'leri #201 testinde).
UPDATE public.jobs SET status = 'running', lease_expires_at = now() + interval '2 minutes'
WHERE id = (SELECT id FROM ids WHERE k = 'j1');
UPDATE public.job_stages SET status = 'running' WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'voice';
UPDATE public.job_stages SET status = 'succeeded' WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'voice';
UPDATE public.job_stages SET status = 'running' WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'captions';
UPDATE public.job_stages SET status = 'succeeded' WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'captions';
UPDATE public.job_stages SET status = 'running' WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'visuals';
UPDATE public.job_stages SET status = 'succeeded' WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'visuals';
UPDATE public.jobs SET current_stage = 'render' WHERE id = (SELECT id FROM ids WHERE k = 'j1');
UPDATE public.job_stages SET status = 'running' WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'render';
SELECT extensions.is(
  (SELECT status FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')),
  'in_production', 'the episode stays in production while the job runs'
);
UPDATE public.job_stages SET status = 'succeeded' WHERE job_id = (SELECT id FROM ids WHERE k = 'j1') AND key = 'render';
UPDATE public.jobs SET status = 'awaiting_approval' WHERE id = (SELECT id FROM ids WHERE k = 'j1');
SELECT extensions.is(
  (SELECT status FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')),
  'ready_for_review', 'the episode is ready for review when the job waits for video approval'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd2160000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d2160000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000e1"}', true);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep1'), 'inceleme sırasında değişiklik')$$,
  '55000', NULL, 'the script cannot change while the video waits for review'
);
SELECT extensions.is(
  (SELECT status FROM public.approve_job_stage((SELECT id FROM ids WHERE k = 'j1'), 'render')),
  'succeeded', 'a human approves the video stage and the job completes'
);
SELECT extensions.is(
  (SELECT status FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')),
  'approved', 'the episode is approved once its production job finished with an approved final stage'
);
-- Yayın işareti yalnız onaylı bölümde (yayın akışı #234; burada service role yazımıyla).
RESET ROLE;
UPDATE public.episodes SET published_at = now() WHERE id = (SELECT id FROM ids WHERE k = 'ep1');
SELECT extensions.is(
  (SELECT status FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'ep1')),
  'published', 'an approved episode can be marked published'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET script_text = 'yayından sonra' WHERE id = (SELECT id FROM ids WHERE k = 'ep1')$$,
  '55000', NULL, 'a published episode''s script is locked'
);
SET LOCAL ROLE authenticated;

-- ── İptal, yeniden deneme, tekil video ──────────────────────────────────────
-- Tekil video (serisiz): senaryo → onay → iş; parametrelerde seri yok.
SELECT extensions.lives_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'single'), 'Köprü 1940''ta rüzgârda yıkıldı.',
      '[{"claim":"Köprü 1940''ta yıkıldı","sources":[{"title":"Resmî rapor","primary":true},{"title":"Üniversite arşivi"}]}]'::jsonb,
      NULL, ARRAY['real_event'])$$,
  'a single video gets a script without any series'
);
SELECT extensions.is(
  (SELECT status FROM public.approve_episode_script((SELECT id FROM ids WHERE k = 'single'), 1)),
  'script_approved', 'the single video''s script is approved'
);
INSERT INTO ids
SELECT 'j2', (public.enqueue_episode_job(
  (SELECT id FROM ids WHERE k = 'single'), 'explainer.render'
)).id;
SELECT extensions.results_eq(
  $$SELECT params -> 'series', params -> 'episode' -> 'number', params ->> 'visual_route', params -> 'voice',
      params -> 'caption_style', params -> 'params'
    FROM public.jobs WHERE id = (SELECT id FROM ids WHERE k = 'j2')$$,
  $$VALUES ('null'::jsonb, 'null'::jsonb, NULL::text, '{"provider":null,"name":null,"rate":null}'::jsonb,
      '{}'::jsonb, '{}'::jsonb)$$,
  'a single video is produced without a series: no number, no series defaults'
);
-- İptal: bölüm onaylı senaryoya döner; yeniden deneme bölümü taşır.
SELECT extensions.lives_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'j2'))$$, 'the queued job is cancelled'
);
SELECT extensions.is(
  (SELECT status FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'single')),
  'script_approved', 'after a cancelled job the episode is back at the approved script'
);
INSERT INTO ids SELECT 'j3', (public.retry_job((SELECT id FROM ids WHERE k = 'j2'))).id;
SELECT extensions.results_eq(
  $$SELECT j.episode_id, j.episode_script_version, j.retry_of, e.status
    FROM public.jobs j JOIN public.episodes e ON e.id = j.episode_id
    WHERE j.id = (SELECT id FROM ids WHERE k = 'j3')$$,
  $$SELECT (SELECT id FROM ids WHERE k = 'single'), 1, (SELECT id FROM ids WHERE k = 'j2'), 'in_production'::text$$,
  'retrying keeps the episode and puts it back in production'
);
SELECT extensions.lives_ok(
  $$SELECT public.request_cancel_job((SELECT id FROM ids WHERE k = 'j3'))$$, 'the retry is cancelled too'
);
-- Senaryo değişti: eski iş yeniden denenemez, yeni iş onay ister.
SELECT extensions.is(
  (SELECT status FROM public.save_episode_script((SELECT id FROM ids WHERE k = 'single'), 'Köprü 1940''ta rüzgârda yıkıldı. Neden?')),
  'script_ready', 'editing the script after a cancelled job reopens the approval'
);
SELECT extensions.throws_ok(
  $$SELECT public.retry_job((SELECT id FROM ids WHERE k = 'j3'))$$,
  '55000', NULL, 'a job frozen against an older script cannot be retried'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'single'), 'explainer.render')$$,
  '42501', NULL, 'after the change production needs a new approval'
);
SELECT extensions.is(
  (SELECT status FROM public.approve_episode_script((SELECT id FROM ids WHERE k = 'single'), 2)),
  'script_approved', 'the new version is approved'
);
-- stop_at ile kısmi iş (yalnız ses): onaylı senaryo yine şarttır; bitince bölüm "approved" olmaz.
INSERT INTO ids
SELECT 'j4', (public.enqueue_episode_job(
  (SELECT id FROM ids WHERE k = 'single'), 'explainer.render', '{}', 'voice'
)).id;
RESET ROLE;
UPDATE public.jobs SET status = 'running', lease_expires_at = now() + interval '2 minutes'
WHERE id = (SELECT id FROM ids WHERE k = 'j4');
UPDATE public.job_stages SET status = 'running' WHERE job_id = (SELECT id FROM ids WHERE k = 'j4') AND key = 'voice';
UPDATE public.job_stages SET status = 'succeeded' WHERE job_id = (SELECT id FROM ids WHERE k = 'j4') AND key = 'voice';
UPDATE public.job_stages SET status = 'skipped' WHERE job_id = (SELECT id FROM ids WHERE k = 'j4') AND key <> 'voice';
UPDATE public.jobs SET status = 'succeeded' WHERE id = (SELECT id FROM ids WHERE k = 'j4');
SELECT extensions.is(
  (SELECT status FROM public.episodes WHERE id = (SELECT id FROM ids WHERE k = 'single')),
  'script_approved', 'a partial (stop_at) job that finishes does not make the episode approved'
);
SET LOCAL ROLE authenticated;

-- ── Benzer konu ─────────────────────────────────────────────────────────────
SELECT extensions.results_eq(
  $$SELECT source, id, match, episode_number
    FROM public.find_similar_topics('  planör NASIL uçar?? ')$$,
  $$SELECT 'episode'::text, (SELECT id FROM ids WHERE k = 'ep1'), 'exact'::text, 1$$,
  'the same normalized title is an exact match'
);
SELECT extensions.results_eq(
  $$SELECT source, id, match FROM public.find_similar_topics('Uçak kanadı kaldırma kuvveti üretir mi?')$$,
  $$SELECT 'suggestion'::text, (SELECT id FROM ids WHERE k = 'sg3'), 'similar'::text$$,
  'an undecided suggestion sharing most keywords is reported as similar'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.find_similar_topics('Mağarada 17 gün: Tham Luang kurtarması')),
  1, 'a picked suggestion is reported once, as its episode'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.find_similar_topics('Tamamen başka bir konu başlığı')),
  0, 'an unrelated title has no matches'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.find_similar_topics('planör nasıl uçar', 10, (SELECT id FROM ids WHERE k = 'ep1'))),
  0, 'the episode being edited can be excluded'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.find_similar_topics('   ')), 0, 'a blank title matches nothing'
);

-- ── Taşıma ve arşiv ─────────────────────────────────────────────────────────
INSERT INTO ids SELECT 's2', (public.create_series('Olaylar', '{"kind":"event","language":"en"}'::jsonb)).id;
SELECT extensions.results_eq(
  $$SELECT series_id, episode_number, status FROM public.move_episode(
      (SELECT id FROM ids WHERE k = 'ep3'), (SELECT id FROM ids WHERE k = 's2'))$$,
  $$SELECT (SELECT id FROM ids WHERE k = 's2'), 1, 'draft'::text$$,
  'moving an episode into another series gives it that series'' next number'
);
SELECT extensions.results_eq(
  $$SELECT series_id, episode_number FROM public.move_episode((SELECT id FROM ids WHERE k = 'ep3'))$$,
  $$VALUES (NULL::uuid, NULL::integer)$$,
  'moving an episode out of its series makes it a single video without a number'
);
SELECT extensions.is(
  (SELECT episode_number FROM public.move_episode((SELECT id FROM ids WHERE k = 'ep3'), (SELECT id FROM ids WHERE k = 's1'))),
  4, 'numbers are never reused: back in the first series the episode gets number 4, not its old 3'
);
SELECT extensions.throws_ok(
  $$SELECT public.move_episode((SELECT id FROM ids WHERE k = 'ep3'), gen_random_uuid())$$,
  'P0002', NULL, 'moving into an unknown series is not found'
);
SELECT extensions.results_eq(
  $$SELECT status, archived_at IS NOT NULL FROM public.archive_episode((SELECT id FROM ids WHERE k = 'ep3'))$$,
  $$VALUES ('archived'::text, true)$$, 'an episode is archived'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep3'), 'arşivde yazı')$$,
  '55000', NULL, 'an archived episode''s script is locked'
);
SELECT extensions.results_eq(
  $$SELECT status, archived_at IS NULL FROM public.archive_episode((SELECT id FROM ids WHERE k = 'ep3'), false)$$,
  $$VALUES ('draft'::text, true)$$, 'unarchiving restores the derived status'
);
SELECT extensions.is(
  (SELECT status FROM public.archive_series((SELECT id FROM ids WHERE k = 's2'))), 'archived', 'a series is archived'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_episode('Arşivli seriye bölüm', NULL, (SELECT id FROM ids WHERE k = 's2'))$$,
  '55000', NULL, 'an archived series takes no new episodes'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_topic_request('arşivli seri', '[]'::jsonb, (SELECT id FROM ids WHERE k = 's2'))$$,
  '55000', NULL, 'an archived series takes no new requests'
);
SELECT extensions.throws_ok(
  $$SELECT public.move_episode((SELECT id FROM ids WHERE k = 'ep3'), (SELECT id FROM ids WHERE k = 's2'))$$,
  '55000', NULL, 'an episode cannot be moved into an archived series'
);
SELECT extensions.is(
  (SELECT status FROM public.archive_series((SELECT id FROM ids WHERE k = 's2'), false)), 'active',
  'a series can be reactivated'
);

-- ── Çalışma alanı yalıtımı (B alanı) ────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'e2160000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e2160000-0000-4000-8000-000000000001","role":"authenticated","session_id":"5e560000-0000-4000-8000-0000000000b1"}', true);
SELECT extensions.is(public.current_workspace_id(), (SELECT b FROM ws), 'B owner resolves to workspace B');
SELECT extensions.results_eq(
  $$SELECT (SELECT count(*)::integer FROM public.series), (SELECT count(*)::integer FROM public.topic_requests),
      (SELECT count(*)::integer FROM public.topic_suggestions), (SELECT count(*)::integer FROM public.episodes),
      (SELECT count(*)::integer FROM public.episode_script_versions),
      (SELECT count(*)::integer FROM public.jobs WHERE episode_id IS NOT NULL),
      (SELECT count(*)::integer FROM public.find_similar_topics('planör nasıl uçar'))$$,
  $$VALUES (0, 0, 0, 0, 0, 0, 0)$$,
  'workspace B sees none of workspace A''s series, requests, suggestions, episodes, versions or matches'
);
SELECT extensions.is(
  ARRAY(
    SELECT c.label FROM (VALUES
      ('update_series', $$SELECT public.update_series((SELECT id FROM ids WHERE k = 's1'), '{"theme":"B"}'::jsonb)$$),
      ('archive_series', $$SELECT public.archive_series((SELECT id FROM ids WHERE k = 's1'))$$),
      ('create_topic_request', $$SELECT public.create_topic_request('B isteği', '[]'::jsonb, (SELECT id FROM ids WHERE k = 's1'))$$),
      ('add_topic_suggestions', $$SELECT public.add_topic_suggestions((SELECT id FROM ids WHERE k = 'rq1'), '[{"title":"B","kind":"event"}]'::jsonb)$$),
      ('pick_topic_suggestion', $$SELECT public.pick_topic_suggestion((SELECT id FROM ids WHERE k = 'sg3'))$$),
      ('reject_topic_suggestion', $$SELECT public.reject_topic_suggestion((SELECT id FROM ids WHERE k = 'sg3'))$$),
      ('create_episode', $$SELECT public.create_episode('B bölümü', 'event', (SELECT id FROM ids WHERE k = 's1'))$$),
      ('update_episode', $$SELECT public.update_episode((SELECT id FROM ids WHERE k = 'ep2'), '{"title":"B"}'::jsonb)$$),
      ('move_episode', $$SELECT public.move_episode((SELECT id FROM ids WHERE k = 'ep2'))$$),
      ('archive_episode', $$SELECT public.archive_episode((SELECT id FROM ids WHERE k = 'ep2'))$$),
      ('save_episode_script', $$SELECT public.save_episode_script((SELECT id FROM ids WHERE k = 'ep2'), 'B metni')$$),
      ('approve_episode_script', $$SELECT public.approve_episode_script((SELECT id FROM ids WHERE k = 'single'), 2, true)$$),
      ('enqueue_episode_job', $$SELECT public.enqueue_episode_job((SELECT id FROM ids WHERE k = 'single'), 'explainer.render')$$),
      ('retry_job', $$SELECT public.retry_job((SELECT id FROM ids WHERE k = 'j3'))$$)
    ) AS c (label, sql)
    WHERE pg_temp.sqlstate_of(c.sql) <> 'P0002'
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'every explainer RPC answers "not found" for another workspace''s ids'
);
-- B kendi verisini A'dan bağımsız kurar: aynı seri adı, kendi numarası.
INSERT INTO ids SELECT 'bs1', (public.create_series('Nasıl Çalışır?')).id;
INSERT INTO ids SELECT 'bep1', (public.create_episode('Planör nasıl uçar?', 'how_it_works', (SELECT id FROM ids WHERE k = 'bs1'))).id;
SELECT extensions.results_eq(
  $$SELECT e.workspace_id, e.episode_number, s.workspace_id
    FROM public.episodes e JOIN public.series s ON s.id = e.series_id
    WHERE e.id = (SELECT id FROM ids WHERE k = 'bep1')$$,
  $$SELECT b, 1, b FROM ws$$,
  'workspace B has its own series with the same name and its own numbering'
);
SELECT extensions.throws_ok(
  $$SELECT public.move_episode((SELECT id FROM ids WHERE k = 'bep1'), (SELECT id FROM ids WHERE k = 's1'))$$,
  'P0002', NULL, 'a B episode cannot be moved into a workspace A series'
);
SELECT extensions.results_eq(
  $$SELECT source, id FROM public.find_similar_topics('planör nasıl uçar')$$,
  $$SELECT 'episode'::text, (SELECT id FROM ids WHERE k = 'bep1')$$,
  'the similar-topic check only sees the caller''s workspace'
);

-- FK kısıtı RLS'e bakmaz: alanlar arası bağ service role için de kurulamaz.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT extensions.throws_ok(
  $$INSERT INTO public.jobs (workspace_id, module, kind, episode_id)
    SELECT ws.b, 'explainer', 'explainer.script', ids.id FROM ws, ids WHERE ids.k = 'ep2'$$,
  '23514', NULL, 'a workspace B job cannot own a workspace A episode'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET series_id = (SELECT id FROM ids WHERE k = 's1'), episode_number = 99
    WHERE id = (SELECT id FROM ids WHERE k = 'bep1')$$,
  '23514', NULL, 'a B episode cannot be attached to a workspace A series'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET suggestion_id = (SELECT id FROM ids WHERE k = 'sg3')
    WHERE id = (SELECT id FROM ids WHERE k = 'bep1')$$,
  '23514', NULL, 'a B episode cannot be attached to a workspace A suggestion'
);
SELECT extensions.throws_ok(
  $$UPDATE public.episodes SET suggestion_id = (SELECT id FROM ids WHERE k = 'sg3')
    WHERE id = (SELECT id FROM ids WHERE k = 'ep3')$$,
  '55000', NULL, 'an episode''s suggestion link cannot be rewritten, even inside one workspace'
);
UPDATE public.topic_suggestions SET series_id = (SELECT id FROM ids WHERE k = 'bs1')
WHERE id = (SELECT id FROM ids WHERE k = 'sg3');
SELECT extensions.is(
  (SELECT series_id FROM public.topic_suggestions WHERE id = (SELECT id FROM ids WHERE k = 'sg3')),
  (SELECT id FROM ids WHERE k = 's1'),
  'a suggestion''s series always follows its request: it cannot be pointed at another workspace''s series'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.episodes WHERE workspace_id = (SELECT a FROM ws)
     AND id IN (SELECT id FROM ids WHERE k IN ('ep1', 'ep2', 'ep3', 'single'))),
  4, 'workspace A''s episodes are all still in workspace A'
);

SELECT * FROM extensions.finish();
ROLLBACK;
