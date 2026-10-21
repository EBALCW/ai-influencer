BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(8);

SELECT extensions.ok(
  (SELECT NOT b.public FROM storage.buckets AS b WHERE b.id = 'assets'),
  'assets storage bucket is private'
);
SELECT extensions.has_column('public', 'assets', 'qc_checklist', 'assets store QC checklist answers');
SELECT extensions.has_check('public', 'assets', 'assets_passed_qc_complete', 'passed assets require every QC item');
SELECT extensions.ok(
  (SELECT count(*) = 1 FROM pg_constraint
   WHERE conrelid = 'public.assets'::regclass
     AND pg_get_constraintdef(oid) LIKE '%jsonb_typeof(qc_checklist)%'
     AND pg_get_constraintdef(oid) LIKE '%object%'),
  'QC checklist is constrained to JSON objects'
);
SELECT extensions.has_index('public', 'assets', 'assets_tags_gin_idx', 'asset tags have a GIN index');
SELECT extensions.ok(
  (SELECT count(*) = 4 FROM pg_policies WHERE schemaname = 'storage'
    AND tablename = 'objects' AND policyname LIKE 'assets_storage_team_%'),
  'storage.objects has team read, insert, update, and delete policies'
);
SELECT extensions.ok(
  (SELECT bool_and(qual LIKE '%is_team_member%') FROM pg_policies
    WHERE schemaname = 'storage' AND policyname = 'assets_storage_team_read'),
  'storage reads require team membership'
);
SELECT extensions.ok(
  (SELECT bool_and(coalesce(qual, '') LIKE '%can_write_data%'
    OR coalesce(with_check, '') LIKE '%can_write_data%') FROM pg_policies
    WHERE schemaname = 'storage' AND policyname LIKE 'assets_storage_team_%'
      AND policyname <> 'assets_storage_team_read'),
  'storage writes require an editor or owner role'
);

SELECT * FROM extensions.finish();
ROLLBACK;
