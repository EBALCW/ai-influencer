-- Persona düzenleme ve versiyon geçmişi (#44).
--
-- Kurallar:
-- * Her kayıt yeni bir satırdır. Eski persona satırlarının içeriği değiştirilemez;
--   UPDATE ile sadece is_current true -> false yapılabilir (RPC'nin kendisi yapar).
-- * Geri alma da yeni bir versiyon oluşturur (restored_from_version ile işaretlenir),
--   geçmiş silinmez ve doğrusal kalır.
-- * Versiyon numarası ve is_current tek transaction'da, influencer satırı kilitlenerek
--   hesaplanır. Aynı anda iki kayıt gelirse ikincisi bekler ve bir sonraki numarayı alır.
-- * Fonksiyonlar SECURITY INVOKER: çağıranın RLS'i uygulanır (viewer yazamaz,
--   ekip dışı göremez). Değiştiren kişi created_by trigger'ından (auth.uid()) gelir.

ALTER TABLE public.influencer_personas
  ADD COLUMN change_note text NOT NULL DEFAULT ''
    CHECK (length(change_note) <= 500),
  -- Görünüm alanları (saç, ten, yüz, imza aksesuar …). #43 wizard'ı da bu kolonu kullanır.
  ADD COLUMN appearance jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(appearance) = 'object'),
  ADD COLUMN restored_from_version integer
    CHECK (restored_from_version IS NULL OR restored_from_version > 0);

COMMENT ON COLUMN public.influencer_personas.change_note IS 'Bu versiyonda neyin neden değiştiği (en fazla 500 karakter).';
COMMENT ON COLUMN public.influencer_personas.appearance IS 'Karakterin görünüm alanları; prompt şablonları bu değerlerden üretilir.';
COMMENT ON COLUMN public.influencer_personas.restored_from_version IS 'Geri alma ile oluşturulduysa kaynağı olan versiyon numarası.';

CREATE FUNCTION public.prevent_persona_content_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.influencer_id IS DISTINCT FROM OLD.influencer_id
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.bio IS DISTINCT FROM OLD.bio
    OR NEW.personality IS DISTINCT FROM OLD.personality
    OR NEW.tone IS DISTINCT FROM OLD.tone
    OR NEW.audience IS DISTINCT FROM OLD.audience
    OR NEW.hook_traits IS DISTINCT FROM OLD.hook_traits
    OR NEW.appearance IS DISTINCT FROM OLD.appearance
    OR NEW.change_note IS DISTINCT FROM OLD.change_note
    OR NEW.restored_from_version IS DISTINCT FROM OLD.restored_from_version
  THEN
    RAISE EXCEPTION 'Persona versiyonları değiştirilemez; yeni versiyon oluşturun.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.is_current AND NOT OLD.is_current THEN
    RAISE EXCEPTION 'Eski bir versiyon güncel yapılamaz; geri alma yeni versiyon oluşturur.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER influencer_personas_prevent_content_update
  BEFORE UPDATE ON public.influencer_personas
  FOR EACH ROW EXECUTE FUNCTION public.prevent_persona_content_update();

-- Geçmiş editor tarafından silinemez (sadece owner). Influencer silindiğinde
-- ON DELETE CASCADE yine çalışır: referans bütünlüğü işlemleri RLS'e takılmaz.
CREATE POLICY influencer_personas_delete_owner_only ON public.influencer_personas
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.can_manage_team());

CREATE FUNCTION public.create_persona_version(
  p_influencer_id uuid,
  p_bio text,
  p_tone text,
  p_personality jsonb,
  p_audience jsonb,
  p_hook_traits text[],
  p_appearance jsonb,
  p_change_note text DEFAULT '',
  p_restored_from_version integer DEFAULT NULL
)
RETURNS public.influencer_personas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  next_version integer;
  created public.influencer_personas;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Persona düzenlemek için editor yetkisi gerekir.'
      USING ERRCODE = '42501';
  END IF;

  -- Influencer başına seri hale getirir. RLS (UPDATE politikası) altında satır
  -- görünmüyorsa kilit alınamaz ve kayıt yok sayılır.
  PERFORM 1 FROM public.influencers WHERE id = p_influencer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Influencer bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(max(version), 0) + 1 INTO next_version
  FROM public.influencer_personas
  WHERE influencer_id = p_influencer_id;

  UPDATE public.influencer_personas
  SET is_current = false
  WHERE influencer_id = p_influencer_id AND is_current;

  INSERT INTO public.influencer_personas (
    influencer_id, version, bio, tone, personality, audience, hook_traits,
    appearance, change_note, restored_from_version, is_current
  )
  VALUES (
    p_influencer_id, next_version, coalesce(p_bio, ''), coalesce(p_tone, ''),
    coalesce(p_personality, '{}'::jsonb), coalesce(p_audience, '{}'::jsonb),
    coalesce(p_hook_traits, '{}'::text[]), coalesce(p_appearance, '{}'::jsonb),
    coalesce(p_change_note, ''), p_restored_from_version, true
  )
  RETURNING * INTO created;

  RETURN created;
END;
$$;

CREATE FUNCTION public.restore_persona_version(
  p_influencer_id uuid,
  p_version integer,
  p_change_note text DEFAULT ''
)
RETURNS public.influencer_personas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  source public.influencer_personas;
BEGIN
  SELECT * INTO source
  FROM public.influencer_personas
  WHERE influencer_id = p_influencer_id AND version = p_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Geri alınacak versiyon bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  RETURN public.create_persona_version(
    p_influencer_id,
    source.bio,
    source.tone,
    source.personality,
    source.audience,
    source.hook_traits,
    source.appearance,
    coalesce(nullif(trim(p_change_note), ''), format('v%s geri alındı', p_version)),
    p_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_persona_version(uuid, text, text, jsonb, jsonb, text[], jsonb, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_persona_version(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_persona_version(uuid, text, text, jsonb, jsonb, text[], jsonb, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_persona_version(uuid, integer, text) TO authenticated;
