-- Yayıncı klipleri (#173): kaynak video + izin kaydı ve klip adayları → içerik backlog'u (#57).
--
-- Kararlar:
-- * `clip_sources` bir yayıncı videosudur (şimdilik yalnız YouTube). `video_url` kanonik biçimde
--   tutulur (`https://www.youtube.com/watch?v=<video_id>`); panel girilen linki bu biçime çevirir.
--   Böylece aynı video farklı link biçimleriyle iki kez eklenemez.
-- * İzin: `permission_status` (pending · granted · denied) ve `permission_ref`. Referans, ekibin
--   erişimi kısıtlı deposundaki izin belgesini gösteren KISA bir koddur (docs/compliance.md →
--   "Kaynak içerik"). İzin yazışması, izin verenin adı veya e-postası buraya YAZILMAZ; e-posta
--   biçimindeki değer CHECK ile reddedilir. `granted` için referans zorunludur.
-- * `permission_checked_at` / `permission_checked_by` istemciden alınmaz: izin durumu veya
--   referans değiştiğinde trigger oturumdaki kullanıcıyı ve zamanı yazar.
-- * `clips` kaynağın bir zaman aralığıdır (en fazla 180 sn). Kaynak süresi biliniyorsa bitiş onu
--   aşamaz (trigger). Video dosyası panele yüklenmez; kesim komut satırından yapılır (#172).
-- * Backlog bağlantısı `clips.content_item_id` üzerindedir (content_items'a kolon eklenmez).
--   Kart bağlamak (RPC ile ya da doğrudan UPDATE ile) kaynağın izni `granted` değilse reddedilir.
--   İzin sonradan geri alınırsa aktarılmış kartlara dokunulmaz; yalnız yeni aktarım engellenir.

CREATE TYPE public.clip_permission_status AS ENUM ('pending', 'granted', 'denied');
CREATE TYPE public.clip_status AS ENUM ('candidate', 'approved', 'rendered', 'rejected');

-- ── 1) Kaynak videolar ─────────────────────────────────────────────────────
CREATE TABLE public.clip_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'youtube' CHECK (platform IN ('youtube')),
  video_id text NOT NULL CHECK (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_url text NOT NULL UNIQUE
    CHECK (video_url = 'https://www.youtube.com/watch?v=' || video_id),
  channel_name text NOT NULL CHECK (length(btrim(channel_name)) BETWEEN 1 AND 200),
  channel_url text
    CHECK (channel_url ~ '^https://(www\.|m\.)?youtube\.com/[^\s]+$' AND length(channel_url) <= 300),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  duration_seconds integer CHECK (duration_seconds > 0 AND duration_seconds <= 172800),
  permission_status public.clip_permission_status NOT NULL DEFAULT 'pending',
  permission_ref text NOT NULL DEFAULT ''
    CHECK (length(permission_ref) <= 200 AND permission_ref !~ '[^\s@]+@[^\s@]+\.[^\s@]+'),
  permission_checked_at timestamptz,
  permission_checked_by uuid REFERENCES public.team_members (user_id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT clip_sources_granted_needs_ref
    CHECK (permission_status <> 'granted' OR length(btrim(permission_ref)) > 0)
);
CREATE INDEX clip_sources_permission_idx ON public.clip_sources (permission_status, created_at DESC);

COMMENT ON COLUMN public.clip_sources.permission_ref IS
  'Kısıtlı depodaki izin belgesinin kısa referansı. E-posta, ad veya yazışma YAZILMAZ. granted iken zorunlu.';
COMMENT ON COLUMN public.clip_sources.permission_checked_at IS 'İzin durumunun/referansının son kaydı. Trigger yazar.';
COMMENT ON COLUMN public.clip_sources.permission_checked_by IS 'İzin durumunu son kaydeden ekip üyesi. Trigger yazar.';
COMMENT ON COLUMN public.clip_sources.channel_name IS 'Herkese açık kanal adı. Kişisel veri yazılmaz.';

-- ── 2) Klip adayları ───────────────────────────────────────────────────────
CREATE TABLE public.clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.clip_sources (id) ON DELETE CASCADE,
  -- NULL = henüz bir karaktere atanmadı; aktarımda hedef influencer verilir.
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  hook text CHECK (length(hook) <= 500),
  start_seconds integer NOT NULL CHECK (start_seconds >= 0),
  end_seconds integer NOT NULL,
  status public.clip_status NOT NULL DEFAULT 'candidate',
  content_item_id uuid REFERENCES public.content_items (id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT clips_range_valid
    CHECK (end_seconds > start_seconds AND end_seconds - start_seconds <= 180)
);
CREATE INDEX clips_source_idx ON public.clips (source_id, start_seconds);
CREATE INDEX clips_influencer_idx ON public.clips (influencer_id);
CREATE UNIQUE INDEX clips_content_item_idx ON public.clips (content_item_id) WHERE content_item_id IS NOT NULL;

-- ── 3) RLS: ekip okur, owner/editor yazar (trends ile aynı kalıp) ───────────
ALTER TABLE public.clip_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY clip_sources_team_read ON public.clip_sources
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY clip_sources_team_write ON public.clip_sources
  FOR ALL TO authenticated USING (public.can_write_data()) WITH CHECK (public.can_write_data());
CREATE TRIGGER clip_sources_set_updated_at BEFORE UPDATE ON public.clip_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clip_sources_set_created_by BEFORE INSERT OR UPDATE ON public.clip_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
REVOKE ALL ON public.clip_sources FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clip_sources TO authenticated;

ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY clips_team_read ON public.clips
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY clips_team_write ON public.clips
  FOR ALL TO authenticated USING (public.can_write_data()) WITH CHECK (public.can_write_data());
CREATE TRIGGER clips_set_updated_at BEFORE UPDATE ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clips_set_created_by BEFORE INSERT OR UPDATE ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
REVOKE ALL ON public.clips FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clips TO authenticated;

-- ── 4) Doğrulama trigger'ları ──────────────────────────────────────────────
-- Kaynak: metinleri kırpar, izin kaydını (kim/ne zaman) sunucuda yazar, süre mevcut klipleri
-- dışarıda bırakacak şekilde kısaltılamaz.
CREATE FUNCTION public.validate_clip_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  permission_changed boolean;
BEGIN
  NEW.channel_name := btrim(NEW.channel_name);
  NEW.channel_url := nullif(btrim(NEW.channel_url), '');
  NEW.title := btrim(NEW.title);
  NEW.permission_ref := btrim(NEW.permission_ref);
  NEW.notes := btrim(NEW.notes);

  IF TG_OP = 'INSERT' THEN
    permission_changed := NEW.permission_status <> 'pending' OR NEW.permission_ref <> '';
  ELSE
    permission_changed := ROW(NEW.permission_status, NEW.permission_ref)
      IS DISTINCT FROM ROW(OLD.permission_status, OLD.permission_ref);
  END IF;
  IF uid IS NOT NULL THEN
    IF permission_changed THEN
      NEW.permission_checked_at := now();
      -- Ekip üyesi değilse RLS zaten yazımı reddeder; FK için yine de denetle.
      NEW.permission_checked_by := (SELECT user_id FROM public.team_members WHERE user_id = uid);
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.permission_checked_at := OLD.permission_checked_at;
      NEW.permission_checked_by := OLD.permission_checked_by;
    ELSE
      NEW.permission_checked_at := NULL;
      NEW.permission_checked_by := NULL;
    END IF;
  ELSIF permission_changed AND NEW.permission_checked_at IS NULL THEN
    -- Oturumsuz yazım (service role / seed): verilen değer korunur, yoksa şimdi.
    NEW.permission_checked_at := now();
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.duration_seconds IS NOT NULL
    AND NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds
    AND EXISTS (
      SELECT 1 FROM public.clips c WHERE c.source_id = NEW.id AND c.end_seconds > NEW.duration_seconds
    ) THEN
    RAISE EXCEPTION 'Video süresi mevcut kliplerin bitişinden kısa olamaz.'
      USING ERRCODE = '23514', HINT = 'clip_out_of_range';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clip_sources_validate BEFORE INSERT OR UPDATE ON public.clip_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_clip_source();

-- Klip: metinleri kırpar; aralık kaynak süresini aşamaz; kart bağlamak izin ister ve kart
-- klibin influencer'ına ait olmalıdır.
CREATE FUNCTION public.validate_clip()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  src public.clip_sources%ROWTYPE;
  item_influencer uuid;
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.hook := nullif(btrim(NEW.hook), '');
  NEW.notes := btrim(NEW.notes);
  IF TG_OP = 'UPDATE' AND NEW.source_id IS DISTINCT FROM OLD.source_id THEN
    RAISE EXCEPTION 'Klibin kaynağı değiştirilemez.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO src FROM public.clip_sources WHERE id = NEW.source_id;

  IF src.duration_seconds IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.end_seconds IS DISTINCT FROM OLD.end_seconds)
    AND NEW.end_seconds > src.duration_seconds THEN
    RAISE EXCEPTION 'Klip bitişi video süresini aşamaz.'
      USING ERRCODE = '23514', HINT = 'clip_out_of_range';
  END IF;

  IF NEW.content_item_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.content_item_id IS DISTINCT FROM OLD.content_item_id) THEN
    IF src.permission_status IS DISTINCT FROM 'granted' THEN
      RAISE EXCEPTION 'Kaynağın izni onaylanmadan klip backlog’a aktarılamaz.'
        USING ERRCODE = '23514', HINT = 'clip_permission_required';
    END IF;
    SELECT influencer_id INTO item_influencer FROM public.content_items WHERE id = NEW.content_item_id;
    IF item_influencer IS NULL
      OR (NEW.influencer_id IS NOT NULL AND item_influencer IS DISTINCT FROM NEW.influencer_id) THEN
      RAISE EXCEPTION 'İçerik kartı kliple aynı influencer’a ait olmalı.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clips_validate BEFORE INSERT OR UPDATE ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.validate_clip();

-- ── 5) "Backlog'a aktar" ───────────────────────────────────────────────────
-- Klipten `idea` aşamasında içerik kartı oluşturur (source_type = third_party, sahip = kanal adı,
-- lisans = izin referansı), kartı klibe bağlar; `candidate` klip `approved` olur. Tek transaction;
-- klip satırı kilitlenir (çift tıklama iki kart üretmez), kaynak satırı paylaşımlı kilitlenir
-- (aktarım sırasında izin geri alınamaz). SECURITY INVOKER: çağıranın RLS'i geçerli.
--   P0002 klip/influencer yok veya görünmüyor · 42501 viewer · 23505 zaten aktarılmış
--   23514 izin yok (HINT clip_permission_required), elenmiş klip, influencer uyuşmazlığı
--   22023 influencer seçilmemiş
CREATE FUNCTION public.push_clip_to_backlog(
  p_clip_id uuid,
  p_influencer_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  c public.clips%ROWTYPE;
  s public.clip_sources%ROWTYPE;
  v_target uuid;
  v_item_id uuid;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Editor yetkisi gerekli.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.clips WHERE id = p_clip_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klip bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO s FROM public.clip_sources WHERE id = c.source_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klip kaynağı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF c.content_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bu klip zaten backlog’a aktarıldı.' USING ERRCODE = '23505';
  END IF;
  IF s.permission_status <> 'granted' THEN
    RAISE EXCEPTION 'Kaynağın izni onaylanmadan klip backlog’a aktarılamaz.'
      USING ERRCODE = '23514', HINT = 'clip_permission_required';
  END IF;
  IF c.status = 'rejected' THEN
    RAISE EXCEPTION 'Elenmiş klip backlog’a aktarılamaz.' USING ERRCODE = '23514';
  END IF;
  IF c.influencer_id IS NOT NULL AND p_influencer_id IS NOT NULL
    AND p_influencer_id IS DISTINCT FROM c.influencer_id THEN
    RAISE EXCEPTION 'Bu klip başka bir influencer’a atanmış.' USING ERRCODE = '23514';
  END IF;
  v_target := coalesce(c.influencer_id, p_influencer_id);
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Klip için influencer seçin.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.influencers WHERE id = v_target) THEN
    RAISE EXCEPTION 'Influencer bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.content_items (
    influencer_id, title, hook_type, stage, source_url,
    source_type, source_owner, source_license, notes
  )
  VALUES (
    v_target,
    left(c.title, 200),
    nullif(left(coalesce(c.hook, ''), 200), ''),
    'idea',
    s.video_url || '&t=' || c.start_seconds || 's',
    'third_party',
    left(s.channel_name, 200),
    left('yazılı izin – kısıtlı depoda: ' || s.permission_ref, 500),
    left(concat_ws(E'\n',
      'Yayıncı klibinden aktarıldı (' || s.platform || ').',
      'Kaynak video: ' || s.title,
      'Aralık: ' || c.start_seconds || '–' || c.end_seconds || ' sn ('
        || (c.end_seconds - c.start_seconds) || ' sn)',
      'Not: ' || nullif(c.notes, '')
    ), 10000)
  )
  RETURNING id INTO v_item_id;

  UPDATE public.clips
  SET content_item_id = v_item_id,
      influencer_id = v_target,
      status = CASE WHEN status = 'candidate' THEN 'approved'::public.clip_status ELSE status END
  WHERE id = c.id;
  RETURN v_item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.push_clip_to_backlog(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_clip_to_backlog(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.validate_clip_source(), public.validate_clip() FROM PUBLIC, anon;
