-- Medya kütüphanesi yetkileri: politika metnini değil gerçek davranışı test eder.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(10);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'asset-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'asset-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'asset-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role) VALUES
  ('91000000-0000-4000-8000-000000000001', 'editor'),
  ('91000000-0000-4000-8000-000000000002', 'viewer');

CREATE TEMP TABLE t_inf ON COMMIT DROP AS
  SELECT id FROM public.influencers ORDER BY created_at LIMIT 1;
GRANT SELECT ON t_inf TO authenticated;

SET LOCAL ROLE authenticated;

-- Editor
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
SELECT extensions.lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name) SELECT 'assets', id::text || '/pgtap.png' FROM t_inf$$,
  'editor influencer klasörüne dosya yükleyebilir'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('assets', 'pgtap-root.png')$$,
  '42501', NULL,
  'editor bucket köküne dosya yükleyemez'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('assets', '00000000-0000-4000-8000-000000000000/x.png')$$,
  '42501', NULL,
  'editor var olmayan bir influencer klasörüne yükleyemez'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) SELECT 'assets', id::text || '/a/b.png' FROM t_inf$$,
  '42501', NULL,
  'editor iç içe klasöre yükleyemez'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.assets (influencer_id, kind, storage_path)
    SELECT id, 'reference', '00000000-0000-4000-8000-000000000000/x.png' FROM t_inf$$,
  '23514', NULL,
  'assets kaydı başka bir klasördeki dosyaya işaret edemez'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.assets (influencer_id, kind, storage_path, thumbnail_path)
    SELECT id, 'reference', id::text || '/pgtap.png', id::text || '/pgtap-thumb.webp' FROM t_inf$$,
  'editor kendi klasöründeki dosya için kayıt oluşturabilir'
);

-- Viewer
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'assets' AND name LIKE '%/pgtap.png'),
  1,
  'viewer dosyayı görebilir'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) SELECT 'assets', id::text || '/viewer.png' FROM t_inf$$,
  '42501', NULL,
  'viewer dosya yükleyemez'
);

-- Ekip dışı
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'assets'),
  0,
  'ekip dışı kullanıcı hiçbir dosyayı göremez'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('assets', 'outsider.png')$$,
  '42501', NULL,
  'ekip dışı kullanıcı dosya yükleyemez'
);

SELECT * FROM extensions.finish();
ROLLBACK;
