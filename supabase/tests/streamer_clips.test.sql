BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(47);

-- Fixture (postgres rolüyle, RLS dışında). Seed'deki demo kaynaklardan bağımsız.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('9c000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'cl-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9c000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'cl-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9c000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cl-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('9c000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'cl-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role)
VALUES
  ('9c000000-0000-4000-8000-000000000001', 'owner'),
  ('9c000000-0000-4000-8000-000000000002', 'viewer'),
  ('9c000000-0000-4000-8000-000000000003', 'editor');
INSERT INTO public.influencers (id, name, slug)
VALUES
  ('c5000000-0000-4000-8000-000000000001', 'Klip Test', 'clip-test'),
  ('c5000000-0000-4000-8000-000000000002', 'Klip Diğer', 'clip-other');
INSERT INTO public.clip_sources (id, video_id, video_url, channel_name, title, duration_seconds, permission_status, permission_ref)
VALUES
  ('c6000000-0000-4000-8000-000000000001', 'tapGranted1', 'https://www.youtube.com/watch?v=tapGranted1', 'Test Kanalı A', 'İzinli yayın', 600, 'granted', 'IZIN-TEST-001'),
  ('c6000000-0000-4000-8000-000000000002', 'tapPending1', 'https://www.youtube.com/watch?v=tapPending1', 'Test Kanalı B', 'İzin bekleyen yayın', NULL, 'pending', '');
INSERT INTO public.clips (id, source_id, influencer_id, title, hook, start_seconds, end_seconds, status)
VALUES
  ('c7000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', NULL, 'İzinli klip', 'Kanca', 90, 150, 'candidate'),
  ('c7000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000001', 'İzinsiz klip', NULL, 0, 30, 'candidate'),
  ('c7000000-0000-4000-8000-000000000003', 'c6000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'Elenmiş klip', NULL, 200, 230, 'rejected'),
  ('c7000000-0000-4000-8000-000000000004', 'c6000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'İkinci izinli klip', NULL, 300, 360, 'rendered');

SELECT extensions.ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.clip_sources'::regclass, 'public.clips'::regclass)),
  'clip_sources and clips have row-level security enabled'
);
SELECT extensions.ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.push_clip_to_backlog(uuid, uuid)'::regprocedure),
  'push_clip_to_backlog is SECURITY INVOKER (caller RLS applies)'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.clip_sources', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.clips', 'SELECT'),
  'anon has no table privilege on clip tables'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.push_clip_to_backlog(uuid, uuid)', 'EXECUTE'),
  'anon cannot execute push_clip_to_backlog'
);

SET LOCAL ROLE authenticated;

-- Ekip dışı kullanıcı -------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000004', true);
SELECT extensions.is_empty($$SELECT 1 FROM public.clip_sources$$, 'outsider sees no clip sources');
SELECT extensions.is_empty($$SELECT 1 FROM public.clips$$, 'outsider sees no clips');
SELECT extensions.throws_ok(
  $$INSERT INTO public.clip_sources (video_id, video_url, channel_name, title)
    VALUES ('tapOutsider', 'https://www.youtube.com/watch?v=tapOutsider', 'X', 'Y')$$,
  '42501', NULL, 'outsider cannot insert clip sources'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'outsider cannot push to backlog'
);

-- Viewer: salt okur ---------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000002', true);
SELECT extensions.ok(
  (SELECT count(*) FROM public.clip_sources WHERE id::text LIKE 'c6000000%') = 2
    AND (SELECT count(*) FROM public.clips WHERE id::text LIKE 'c7000000%') = 4,
  'viewer reads clip sources and clips'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clips (source_id, title, start_seconds, end_seconds)
    VALUES ('c6000000-0000-4000-8000-000000000001', 'Viewer', 0, 10)$$,
  '42501', NULL, 'viewer cannot insert clips'
);
SELECT extensions.is_empty(
  $$UPDATE public.clip_sources SET permission_status = 'granted', permission_ref = 'VIEWER'
    WHERE id = 'c6000000-0000-4000-8000-000000000002' RETURNING 1$$,
  'viewer cannot grant permission'
);
SELECT extensions.is_empty(
  $$UPDATE public.clips SET status = 'approved' WHERE id = 'c7000000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer cannot update clips'
);
SELECT extensions.is_empty(
  $$DELETE FROM public.clip_sources WHERE id = 'c6000000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer cannot delete clip sources'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'viewer cannot push to backlog'
);

-- Editor: yazma, kurallar ---------------------------------------------------
SELECT set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000003', true);
SELECT extensions.lives_ok(
  $$INSERT INTO public.clip_sources (id, video_id, video_url, channel_name, title, created_by, permission_checked_by, permission_checked_at)
    VALUES ('c6000000-0000-4000-8000-000000000010', 'tapEditor01', 'https://www.youtube.com/watch?v=tapEditor01',
      '  Test Kanalı C  ', ' Başlık ', '9c000000-0000-4000-8000-000000000001', '9c000000-0000-4000-8000-000000000001', now())$$,
  'editor inserts a clip source'
);
SELECT extensions.results_eq(
  $$SELECT created_by, channel_name, title, platform, permission_status::text, permission_checked_by, permission_checked_at
    FROM public.clip_sources WHERE id = 'c6000000-0000-4000-8000-000000000010'$$,
  $$VALUES ('9c000000-0000-4000-8000-000000000003'::uuid, 'Test Kanalı C', 'Başlık', 'youtube', 'pending', NULL::uuid, NULL::timestamptz)$$,
  'created_by comes from auth.uid(), text is trimmed, permission audit cannot be written by the client'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clip_sources (video_id, video_url, channel_name, title)
    VALUES ('tapGranted1', 'https://www.youtube.com/watch?v=tapGranted1', 'X', 'Y')$$,
  '23505', NULL, 'same video twice is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clip_sources (video_id, video_url, channel_name, title)
    VALUES ('tapNotHttps', 'http://www.youtube.com/watch?v=tapNotHttps', 'X', 'Y')$$,
  '23514', NULL, 'non-https video link is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clip_sources (video_id, video_url, channel_name, title)
    VALUES ('tapOtherSit', 'https://example.invalid/watch?v=tapOtherSit', 'X', 'Y')$$,
  '23514', NULL, 'non-YouTube video link is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clip_sources (platform, video_id, video_url, channel_name, title)
    VALUES ('twitch', 'tapPlatform', 'https://www.youtube.com/watch?v=tapPlatform', 'X', 'Y')$$,
  '23514', NULL, 'only youtube is accepted as platform'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clip_sources (video_id, video_url, channel_name, title, duration_seconds)
    VALUES ('tapDuration', 'https://www.youtube.com/watch?v=tapDuration', 'X', 'Y', 0)$$,
  '23514', NULL, 'duration must be positive'
);
SELECT extensions.throws_ok(
  $$UPDATE public.clip_sources SET permission_status = 'granted' WHERE id = 'c6000000-0000-4000-8000-000000000010'$$,
  '23514', NULL, 'granted permission needs a reference'
);
SELECT extensions.throws_ok(
  $$UPDATE public.clip_sources SET permission_ref = 'kisi@example.invalid' WHERE id = 'c6000000-0000-4000-8000-000000000010'$$,
  '23514', NULL, 'an e-mail address is not accepted as permission reference'
);
SELECT extensions.lives_ok(
  $$UPDATE public.clip_sources SET permission_status = 'granted', permission_ref = ' IZIN-TEST-010 ',
      permission_checked_by = '9c000000-0000-4000-8000-000000000001'
    WHERE id = 'c6000000-0000-4000-8000-000000000010'$$,
  'editor grants permission with a reference'
);
SELECT extensions.ok(
  (SELECT permission_ref = 'IZIN-TEST-010'
      AND permission_checked_by = '9c000000-0000-4000-8000-000000000003'::uuid
      AND permission_checked_at IS NOT NULL
   FROM public.clip_sources WHERE id = 'c6000000-0000-4000-8000-000000000010'),
  'permission check is stamped with the caller and time'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.clips (source_id, title, start_seconds, end_seconds)
    VALUES ('c6000000-0000-4000-8000-000000000001', 'Negatif', -1, 10)$$,
  '23514', NULL, 'start must not be negative'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clips (source_id, title, start_seconds, end_seconds)
    VALUES ('c6000000-0000-4000-8000-000000000001', 'Ters', 30, 30)$$,
  '23514', NULL, 'end must be after start'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clips (source_id, title, start_seconds, end_seconds)
    VALUES ('c6000000-0000-4000-8000-000000000001', 'Uzun', 0, 181)$$,
  '23514', NULL, 'a clip longer than 180 seconds is rejected'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clips (source_id, title, start_seconds, end_seconds)
    VALUES ('c6000000-0000-4000-8000-000000000001', 'Taşan', 590, 601)$$,
  '23514', NULL, 'a clip cannot end after the known video duration'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.clips (source_id, title, start_seconds, end_seconds)
    VALUES ('c6000000-0000-4000-8000-000000000002', 'Süresi bilinmeyen', 5000, 5180)$$,
  'unknown video duration does not limit the clip range (180 s is allowed)'
);
SELECT extensions.throws_ok(
  $$UPDATE public.clip_sources SET duration_seconds = 300 WHERE id = 'c6000000-0000-4000-8000-000000000001'$$,
  '23514', NULL, 'video duration cannot be shortened below an existing clip'
);
SELECT extensions.throws_ok(
  $$UPDATE public.clips SET source_id = 'c6000000-0000-4000-8000-000000000002' WHERE id = 'c7000000-0000-4000-8000-000000000001'$$,
  '23514', NULL, 'a clip cannot be moved to another source'
);

-- Backlog'a aktarma -----------------------------------------------------------
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000002')$$,
  '23514', NULL, 'clip of a source without granted permission cannot be pushed'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.content_items WHERE influencer_id IN ('c5000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000002')$$,
  'rejected push creates no card'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000001')$$,
  '22023', NULL, 'unassigned clip needs a target influencer'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-0000000000ff', 'c5000000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'unknown clip returns P0002'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000003')$$,
  '23514', NULL, 'rejected clip cannot be pushed'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000004', 'c5000000-0000-4000-8000-000000000002')$$,
  '23514', NULL, 'assigned clip cannot go to another influencer'
);
SELECT extensions.ok(
  public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001') IS NOT NULL,
  'editor pushes a permitted clip to the backlog'
);
SELECT extensions.results_eq(
  $$SELECT i.influencer_id, i.stage::text, i.title, i.hook_type, i.source_url, i.source_type::text, i.source_owner, i.source_license,
      i.created_by, i.source_checked_by, c.status::text, c.influencer_id
    FROM public.clips c JOIN public.content_items i ON i.id = c.content_item_id
    WHERE c.id = 'c7000000-0000-4000-8000-000000000001'$$,
  $$VALUES ('c5000000-0000-4000-8000-000000000001'::uuid, 'idea', 'İzinli klip', 'Kanca',
      'https://www.youtube.com/watch?v=tapGranted1&t=90s', 'third_party', 'Test Kanalı A',
      'yazılı izin – kısıtlı depoda: IZIN-TEST-001',
      '9c000000-0000-4000-8000-000000000003'::uuid, '9c000000-0000-4000-8000-000000000003'::uuid,
      'approved', 'c5000000-0000-4000-8000-000000000001'::uuid)$$,
  'idea card carries third-party source fields; the clip is approved and assigned'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001')$$,
  '23505', NULL, 'a clip cannot be pushed twice'
);
SELECT extensions.throws_ok(
  $$UPDATE public.clips SET content_item_id = (
      SELECT content_item_id FROM public.clips WHERE id = 'c7000000-0000-4000-8000-000000000001')
    WHERE id = 'c7000000-0000-4000-8000-000000000002'$$,
  '23514', NULL, 'a card cannot be linked directly to a clip without permission'
);

-- İzin geri alınırsa: aktarılmış kart kalır, yeni aktarım engellenir.
SELECT extensions.lives_ok(
  $$UPDATE public.clip_sources SET permission_status = 'denied' WHERE id = 'c6000000-0000-4000-8000-000000000001'$$,
  'permission can be revoked after a push'
);
SELECT extensions.ok(
  (SELECT i.source_license = 'yazılı izin – kısıtlı depoda: IZIN-TEST-001'
   FROM public.clips c JOIN public.content_items i ON i.id = c.content_item_id
   WHERE c.id = 'c7000000-0000-4000-8000-000000000001'),
  'revoking permission leaves the already pushed card untouched'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('c7000000-0000-4000-8000-000000000004')$$,
  '23514', NULL, 'after revocation a new push is rejected'
);

-- Kart silinince bağlantı boşalır, klip kalır; kaynak silinince klipleri de silinir.
RESET ROLE;
DELETE FROM public.content_items i USING public.clips c
WHERE c.content_item_id = i.id AND c.id = 'c7000000-0000-4000-8000-000000000001';
SELECT extensions.is(
  (SELECT content_item_id FROM public.clips WHERE id = 'c7000000-0000-4000-8000-000000000001'),
  NULL::uuid,
  'deleting the card clears the link and keeps the clip'
);
DELETE FROM public.clip_sources WHERE id = 'c6000000-0000-4000-8000-000000000001';
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.clips WHERE source_id = 'c6000000-0000-4000-8000-000000000001'$$,
  'deleting a source deletes its clips'
);

SELECT * FROM extensions.finish();
ROLLBACK;
