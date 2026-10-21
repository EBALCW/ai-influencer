-- Private storage for influencer assets. Metadata remains in public.assets;
-- objects are never exposed through public URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets', 'assets', false, 104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.assets
  ADD COLUMN qc_checklist jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(qc_checklist) = 'object'),
  ADD CONSTRAINT assets_passed_qc_complete CHECK (
    qc_status <> 'passed' OR qc_checklist @> '{
      "hand_finger_count": true, "hand_finger_length": true,
      "hand_arm_connection": true, "body_proportions": true,
      "body_symmetry": true, "face_eye_symmetry": true,
      "face_gaze": true, "face_teeth_ears": true, "face_identity": true,
      "hair_consistency": true, "hair_background": true,
      "skin_texture": true, "skin_plastic": true,
      "clothing_melt": true, "clothing_symmetry": true,
      "clothing_text": true, "background_objects": true,
      "background_text": true, "background_perspective": true,
      "video_face_flicker": true, "video_hands": true,
      "video_objects": true, "video_lip_sync": true
    }'::jsonb
  );

CREATE INDEX assets_tags_gin_idx ON public.assets USING gin (tags);

CREATE POLICY assets_storage_team_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assets' AND public.is_team_member());

CREATE POLICY assets_storage_team_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets' AND public.can_write_data());

CREATE POLICY assets_storage_team_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'assets' AND public.can_write_data())
  WITH CHECK (bucket_id = 'assets' AND public.can_write_data());

CREATE POLICY assets_storage_team_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'assets' AND public.can_write_data());

COMMENT ON COLUMN public.assets.qc_checklist IS
  'QC checklist answers for this file, stored as a JSON object.';
