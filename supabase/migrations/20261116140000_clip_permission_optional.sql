-- Yayıncı klipleri (#254): yazılı izin şartı kalktı; atıf zorunlu, kaldırma isteği işareti.
--
-- Karar (ürün sahibi, 16 Kasım 2026; docs/compliance.md → "Yayıncı klipleri"):
-- * İzin durumu artık bilgidir: `pending` = izin alınmadı, `granted` = izin alındı (referans yine
--   zorunlu), `denied` = yayıncı reddetti. Yalnız `denied` engeller: o kaynağa yeni klip eklenemez
--   ve klipleri içerik backlog'una aktarılamaz (23514, HINT `clip_permission_denied`).
-- * Atıf zorunlu: kaynakta kanal adı (zaten NOT NULL) ve kanal bağlantısı bulunur. Bağlantı artık
--   yalnız YouTube değil, herhangi bir http/https adresidir (yayıncının asıl kanalı başka bir
--   platformda olabilir); uzunluk sınırı (300) aynı kalır.
--   Mevcut satırlar: kanal bağlantısı başka bir kolondan türetilemez (video adresi kanalı
--   içermez), bu yüzden kolon NULL kabul etmeye devam eder ve eski satırlar olduğu gibi kalır.
--   Kural trigger'da uygulanır: yeni kaynak bağlantısız eklenemez, var olan bağlantı silinemez
--   (23514, HINT `clip_attribution_required`). Bağlantısı olmayan eski kaynak düzenlenebilir
--   (ör. "reddedildi" işaretlemek engellenmez) ama bağlantı girilene kadar klibi aktarılamaz.
--   CHECK ... NOT VALID yerine trigger seçildi: NOT VALID kısıtı eski satırın HER güncellemesini
--   (izin işaretleme dahil) reddederdi.
-- * İçerik kartının `source_license` alanı: izin alındıysa eskisi gibi
--   "yazılı izin – kısıtlı depoda: <ref>", alınmadıysa "izin alınmadı · atıf: <kanal> <bağlantı>".
-- * Kaldırma isteği: `clips.takedown_requested_at` (+ `takedown_note`). Owner/editor işaretler
--   (mevcut yazma policy'si); zamanı sunucu yazar. İşaretli klip backlog'a aktarılamaz, kartına
--   yeni yayın işi açılamaz (23514, HINT `clip_takedown_requested`). Kuyruktaki mevcut yayın
--   işleri otomatik iptal edilmez; panel kullanıcıyı içerik kartına yönlendirir.
-- Çalışma alanı düzeni (workspace_id, aa_set_workspace, RESTRICTIVE policy'ler) ve yetkiler
-- değişmez; yeni kolonlar başka tabloya FK içermez.

-- ── 1) Kolonlar ve kısıtlar ────────────────────────────────────────────────
ALTER TABLE public.clip_sources DROP CONSTRAINT clip_sources_channel_url_check;
ALTER TABLE public.clip_sources
  ADD CONSTRAINT clip_sources_channel_url_check
  CHECK (channel_url ~ '^https?://[^\s]+$' AND length(channel_url) <= 300);
COMMENT ON COLUMN public.clip_sources.channel_url IS
  'Yayıncının herkese açık kanal bağlantısı (http/https). Atıf için zorunlu; yalnız #254 öncesi satırlarda boş olabilir.';
COMMENT ON COLUMN public.clip_sources.permission_ref IS
  'Kısıtlı depodaki izin belgesinin kısa referansı. E-posta, ad veya yazışma YAZILMAZ. granted iken zorunlu; izin alınmadıysa boş.';

ALTER TABLE public.clips
  ADD COLUMN takedown_requested_at timestamptz,
  ADD COLUMN takedown_note text NOT NULL DEFAULT ''
    CHECK (length(takedown_note) <= 1000 AND takedown_note !~ '[^\s@]+@[^\s@]+\.[^\s@]+');
COMMENT ON COLUMN public.clips.takedown_requested_at IS
  'Yayıncı ya da platform kaldırma istedi (docs/compliance.md). Doluyken aktarım ve yeni yayın işi engellenir. Zamanı trigger yazar.';
COMMENT ON COLUMN public.clips.takedown_note IS
  'Kaldırma isteğiyle ilgili kısa not. E-posta, ad veya yazışma YAZILMAZ.';

-- ── 2) Kaynak doğrulaması: atıf zorunlu ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_clip_source()
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

  -- Atıf: yeni kaynakta kanal bağlantısı zorunlu; var olan bağlantı silinemez. #254 öncesinden
  -- kalan bağlantısız satır güncellenebilir (aktarım ayrıca engellenir).
  IF NEW.channel_url IS NULL AND (TG_OP = 'INSERT' OR OLD.channel_url IS NOT NULL) THEN
    RAISE EXCEPTION 'Atıf için kanal bağlantısı gerekli.'
      USING ERRCODE = '23514', HINT = 'clip_attribution_required';
  END IF;

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

-- ── 3) Klip doğrulaması ────────────────────────────────────────────────────
-- Reddedilmiş kaynağa yeni klip eklenmez. Kart bağlamak (RPC ile ya da doğrudan UPDATE ile):
-- kaldırma isteği yoksa, kaynak reddedilmemişse ve atıf tamsa mümkündür; izin şart değildir.
CREATE OR REPLACE FUNCTION public.validate_clip()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  src public.clip_sources%ROWTYPE;
  item_influencer uuid;
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.hook := nullif(btrim(NEW.hook), '');
  NEW.notes := btrim(NEW.notes);
  NEW.takedown_note := btrim(NEW.takedown_note);
  IF TG_OP = 'UPDATE' AND NEW.source_id IS DISTINCT FROM OLD.source_id THEN
    RAISE EXCEPTION 'Klibin kaynağı değiştirilemez.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO src FROM public.clip_sources WHERE id = NEW.source_id;

  IF TG_OP = 'INSERT' AND src.permission_status = 'denied' THEN
    RAISE EXCEPTION 'Yayıncı izni reddetti; bu kaynaktan klip kullanılamaz.'
      USING ERRCODE = '23514', HINT = 'clip_permission_denied';
  END IF;

  IF src.duration_seconds IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.end_seconds IS DISTINCT FROM OLD.end_seconds)
    AND NEW.end_seconds > src.duration_seconds THEN
    RAISE EXCEPTION 'Klip bitişi video süresini aşamaz.'
      USING ERRCODE = '23514', HINT = 'clip_out_of_range';
  END IF;

  -- Kaldırma isteği zamanı istemciden alınmaz: ilk işaretlemede sunucu saati, sonrasında değişmez.
  IF NEW.takedown_requested_at IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.takedown_requested_at IS NOT NULL THEN
      NEW.takedown_requested_at := OLD.takedown_requested_at;
    ELSIF auth.uid() IS NOT NULL THEN
      NEW.takedown_requested_at := now();
    END IF;
  END IF;

  IF NEW.content_item_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.content_item_id IS DISTINCT FROM OLD.content_item_id) THEN
    IF NEW.takedown_requested_at IS NOT NULL THEN
      RAISE EXCEPTION 'Bu klip için kaldırma isteği var; backlog’a aktarılamaz.'
        USING ERRCODE = '23514', HINT = 'clip_takedown_requested';
    END IF;
    IF src.permission_status = 'denied' THEN
      RAISE EXCEPTION 'Yayıncı izni reddetti; bu kaynaktan klip kullanılamaz.'
        USING ERRCODE = '23514', HINT = 'clip_permission_denied';
    END IF;
    IF src.channel_url IS NULL THEN
      RAISE EXCEPTION 'Atıf için kaynağa kanal bağlantısı ekleyin.'
        USING ERRCODE = '23514', HINT = 'clip_attribution_required';
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

-- ── 4) "Backlog'a aktar" ───────────────────────────────────────────────────
-- Öncekiyle aynı sözleşme; izin koşulu değişti:
--   23514 HINT clip_permission_denied (yayıncı reddetti) · clip_attribution_required (kanal
--   bağlantısı yok) · clip_takedown_requested (kaldırma isteği var)
-- Kartın lisans/izin alanı izin durumunu ve atfı taşır.
CREATE OR REPLACE FUNCTION public.push_clip_to_backlog(
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
  IF c.takedown_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bu klip için kaldırma isteği var; backlog’a aktarılamaz.'
      USING ERRCODE = '23514', HINT = 'clip_takedown_requested';
  END IF;
  IF s.permission_status = 'denied' THEN
    RAISE EXCEPTION 'Yayıncı izni reddetti; bu kaynaktan klip kullanılamaz.'
      USING ERRCODE = '23514', HINT = 'clip_permission_denied';
  END IF;
  IF s.channel_url IS NULL THEN
    RAISE EXCEPTION 'Atıf için kaynağa kanal bağlantısı ekleyin.'
      USING ERRCODE = '23514', HINT = 'clip_attribution_required';
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
    left(CASE WHEN s.permission_status = 'granted'
      THEN 'yazılı izin – kısıtlı depoda: ' || s.permission_ref
      ELSE 'izin alınmadı · atıf: ' || s.channel_name || ' ' || s.channel_url
    END, 500),
    left(concat_ws(E'\n',
      'Yayıncı klibinden aktarıldı (' || s.platform || ').',
      'Kaynak video: ' || s.title,
      'Atıf: ' || s.channel_name || ' ' || s.channel_url,
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

-- ── 5) Kaldırma isteği olan klibin kartına yayın işi açılamaz ───────────────
-- Trigger adı alfabetik olarak publish_jobs_prepare'den önce gelir: kaldırma isteği diğer yayın
-- ön koşullarından önce bildirilir. SECURITY DEFINER (private, boş search_path): kontrol çağıranın
-- clips üzerindeki okuma yetkisine bağlı kalmaz. Klip ile kart aynı çalışma alanındadır
-- (clips → content_items FK'si aa_set_workspace ile denetlenir), ayrıca alan filtresi gerekmez.
CREATE FUNCTION private.publish_jobs_clip_takedown()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clips c
    WHERE c.content_item_id = NEW.content_item_id AND c.takedown_requested_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Bu içeriğin klibi için kaldırma isteği var; yayınlanamaz.'
      USING ERRCODE = '23514', HINT = 'clip_takedown_requested';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.publish_jobs_clip_takedown() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER publish_jobs_a_clip_takedown
  BEFORE INSERT ON public.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION private.publish_jobs_clip_takedown();
