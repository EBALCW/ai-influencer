-- Persona örnek caption'larını versiyonlu biçimde sakla (#43).
-- RPC imzası genişletilir; geri yükleme kaynak versiyonun caption'larını da taşır.

CREATE FUNCTION public.valid_sample_captions(p_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(cardinality(p_values), 0) <= 10
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p_values, '{}'::text[])) AS item
      WHERE item IS NULL OR length(item) = 0 OR length(item) > 2200
    );
$$;

ALTER TABLE public.influencer_personas
  ADD COLUMN sample_captions text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (public.valid_sample_captions(sample_captions));

COMMENT ON COLUMN public.influencer_personas.sample_captions IS
  'Persona tonunu örnekleyen en fazla 10 caption; her biri en fazla 2.200 karakter.';

CREATE OR REPLACE FUNCTION public.prevent_persona_content_update()
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
    OR NEW.sample_captions IS DISTINCT FROM OLD.sample_captions
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

-- restore_persona_version bağlı olduğu eski RPC ile birlikte yeniden oluşturulur.
DROP FUNCTION public.restore_persona_version(uuid, integer, text);
DROP FUNCTION public.create_persona_version(uuid, text, text, jsonb, jsonb, text[], jsonb, text, integer);

CREATE FUNCTION public.create_persona_version(
  p_influencer_id uuid,
  p_bio text,
  p_tone text,
  p_personality jsonb,
  p_audience jsonb,
  p_hook_traits text[],
  p_appearance jsonb,
  p_change_note text DEFAULT '',
  p_restored_from_version integer DEFAULT NULL,
  p_sample_captions text[] DEFAULT '{}'::text[]
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
    appearance, sample_captions, change_note, restored_from_version, is_current
  )
  VALUES (
    p_influencer_id, next_version, coalesce(p_bio, ''), coalesce(p_tone, ''),
    coalesce(p_personality, '{}'::jsonb), coalesce(p_audience, '{}'::jsonb),
    coalesce(p_hook_traits, '{}'::text[]), coalesce(p_appearance, '{}'::jsonb),
    coalesce(p_sample_captions, '{}'::text[]), coalesce(p_change_note, ''),
    p_restored_from_version, true
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
    p_version,
    source.sample_captions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.valid_sample_captions(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valid_sample_captions(text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.create_persona_version(uuid, text, text, jsonb, jsonb, text[], jsonb, text, integer, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_persona_version(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_persona_version(uuid, text, text, jsonb, jsonb, text[], jsonb, text, integer, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_persona_version(uuid, integer, text) TO authenticated;
