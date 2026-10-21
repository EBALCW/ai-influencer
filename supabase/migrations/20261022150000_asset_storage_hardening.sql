-- Medya kütüphanesi sertleştirmesi (#45 incelemesi)
--
-- 1) Storage'a yazma artık sadece var olan bir influencer'ın klasörüne yapılabilir
--    (`<influencer_id>/<dosya>`). Önceki politikalar `assets` bucket'ında herhangi bir yola
--    yazmaya izin veriyordu (kök dizin, uydurma klasörler).
-- 2) `assets` satırı yalnızca kendi influencer klasöründeki dosyaları gösterebilir;
--    bir kayıt başka bir influencer'ın dosyasına işaret edemez.

CREATE FUNCTION public.asset_object_in_influencer_folder(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(array_length(storage.foldername(object_name), 1), 0) = 1
    AND EXISTS (
      SELECT 1
      FROM public.influencers AS i
      WHERE i.id::text = (storage.foldername(object_name))[1]
    );
$$;

COMMENT ON FUNCTION public.asset_object_in_influencer_folder(text) IS
  'Storage nesnesi tam olarak bir seviye derinlikte ve var olan bir influencer klasöründe mi? RLS ile çalışır (çağıran influencer''ı görebilmeli).';

DROP POLICY assets_storage_team_insert ON storage.objects;
CREATE POLICY assets_storage_team_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assets'
    AND public.can_write_data()
    AND public.asset_object_in_influencer_folder(name)
  );

DROP POLICY assets_storage_team_update ON storage.objects;
CREATE POLICY assets_storage_team_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'assets' AND public.can_write_data())
  WITH CHECK (
    bucket_id = 'assets'
    AND public.can_write_data()
    AND public.asset_object_in_influencer_folder(name)
  );

ALTER TABLE public.assets
  ADD CONSTRAINT assets_paths_in_influencer_folder CHECK (
    influencer_id IS NULL
    OR (
      storage_path LIKE influencer_id::text || '/%'
      AND (
        thumbnail_path IS NULL
        OR thumbnail_path LIKE influencer_id::text || '/%'
      )
    )
  );
