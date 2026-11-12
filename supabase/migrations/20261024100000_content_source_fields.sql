-- #145 İçerik kartında yapılandırılmış kaynak alanları (video-to-video) ve
-- #22 takibi: yeni check-list maddesi (3–5 hashtag / caption) ve "puanlayan ≠ üreten" kuralı.
--
-- Kararlar:
-- * v2v içerik = içeriğe `generations.mode = 'video_to_video'` olan bir üretim ya da böyle bir
--   üretimin çıktı asset'i bağlı (`content_is_v2v`). Kart formatı serbest metindir, ölçüt olarak
--   kullanılmaz.
-- * Kaynak alanları: `source_type` (own · stock · open_license · third_party · NULL = v2v değil /
--   girilmedi), `source_owner` (herkese açık hesap/kanal adı veya stok sağlayıcı; kişisel veri
--   yazılmaz), `source_license` (lisans adı/no ya da kısıtlı depodaki izin belgesinin referansı).
--   own dışındaki türlerde sahip ve lisans zorunludur (CHECK; docs/compliance.md tercih sırası).
-- * `source_checked_at` / `source_checked_by` istemciden alınmaz: kaynak alanları değiştiğinde
--   trigger oturumdaki kullanıcıyı ve zamanı yazar (service role yazımında verilen değer korunur).
-- * v2v içerikte `source_type` boşsa kart Planlandı/Yayında olamaz, yayın işi açılamaz ve planlı
--   karta v2v üretimi bağlanamaz (23514, HINT `source_missing`).
-- * Puanlayan: `checklist_scored_by`, iki puandan biri veya yayın kararı değiştiğinde oturumdaki
--   kullanıcıya sabitlenir (istemci yazamaz). Üreten = `assignee_id`, atanmamışsa `created_by`.
--   Puanlayan üretenle aynıysa kart planlanamaz ve yayın işi açılamaz (HINT `scorer_is_producer`).
--   Oturumsuz (service role / seed / bu migration öncesi) puanlamada puanlayan bilinmez; kural
--   uygulanmaz.
-- * Yeni madde `engagement_hashtags`: content_checklist_ready() 25 madde ister.
-- * Geçiş: zaten Planlandı/Yayında olan kart; check-list, sorumlu ve kaynak alanları değişmeden
--   güncellenirse (ör. complete_publish_job, post eşleştirme, saat değişikliği) yeni kurallar
--   yeniden denetlenmez. Böylece eski kartların yayın tamamlama işlemi kırılmaz.
-- * Mevcut notlardaki `[Kaynak]` bloğu (docs/compliance.md) geçerliyse alanlara taşınır; not
--   silinmez.

-- ── 1) Alanlar ─────────────────────────────────────────────────────────────
CREATE TYPE public.content_source_type AS ENUM ('own', 'stock', 'open_license', 'third_party');

ALTER TABLE public.content_items
  ADD COLUMN source_type public.content_source_type,
  ADD COLUMN source_owner text NOT NULL DEFAULT '' CHECK (length(source_owner) <= 200),
  ADD COLUMN source_license text NOT NULL DEFAULT '' CHECK (length(source_license) <= 500),
  ADD COLUMN source_checked_at timestamptz,
  ADD COLUMN source_checked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN checklist_scored_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT content_items_source_details_required CHECK (
    source_type IS NULL OR source_type = 'own'
    OR (length(btrim(source_owner)) > 0 AND length(btrim(source_license)) > 0)
  );

COMMENT ON COLUMN public.content_items.source_type IS
  'v2v kaynak türü (#145): own | stock | open_license | third_party. NULL: v2v değil veya girilmedi.';
COMMENT ON COLUMN public.content_items.source_owner IS
  'Kaynağın herkese açık hesap/kanal adı veya stok sağlayıcı. Kişisel veri yazılmaz. own dışında zorunlu.';
COMMENT ON COLUMN public.content_items.source_license IS
  'Lisans adı/no veya kısıtlı depodaki izin belgesinin referansı. own dışında zorunlu.';
COMMENT ON COLUMN public.content_items.source_checked_at IS 'Kaynak alanlarının son kaydı. Trigger yazar.';
COMMENT ON COLUMN public.content_items.source_checked_by IS 'Kaynak alanlarını son kaydeden kullanıcı. Trigger yazar.';
COMMENT ON COLUMN public.content_items.checklist_scored_by IS
  'Puanları veya yayın kararını son değiştiren kullanıcı (#22). Trigger yazar; üretenle aynıysa planlanamaz.';

-- ── 2) Notlardaki [Kaynak] bloğunu taşı (yalnız geçerli bloklar) ────────────
-- Doğrulama trigger'ı burada kapatılır: veri taşıma kart aşamasını değiştirmez ve eski kartları
-- yeni kurallarla yeniden denetlememelidir. updated_at da değişmez (iyimser kilit bozulmaz).
ALTER TABLE public.content_items
  DISABLE TRIGGER content_items_validate_pipeline,
  DISABLE TRIGGER content_items_set_updated_at;
WITH parsed AS (
  SELECT id,
    CASE substring(notes FROM '(?n)^Tür:[ \t]*(kendi|stok|acik-lisans|ucuncu-kisi)[ \t]*$')
      WHEN 'kendi' THEN 'own' WHEN 'stok' THEN 'stock'
      WHEN 'acik-lisans' THEN 'open_license' WHEN 'ucuncu-kisi' THEN 'third_party'
    END::public.content_source_type AS kind,
    left(btrim(coalesce(substring(notes FROM '(?n)^Sahip:([^\n]*)$'), '')), 200) AS owner,
    left(btrim(coalesce(substring(notes FROM '(?n)^Lisans / izin:([^\n]*)$'), '')), 500) AS license
  FROM public.content_items
  WHERE source_type IS NULL AND position('[Kaynak]' IN notes) > 0
), clean AS (
  SELECT id, kind,
    CASE WHEN position('<' IN owner) > 0 THEN '' ELSE owner END AS owner,
    CASE WHEN position('<' IN license) > 0 THEN '' ELSE license END AS license
  FROM parsed WHERE kind IS NOT NULL
)
UPDATE public.content_items c
SET source_type = clean.kind, source_owner = clean.owner, source_license = clean.license,
  source_checked_at = now()
FROM clean
WHERE c.id = clean.id
  AND (clean.kind = 'own' OR (clean.owner <> '' AND clean.license <> ''));
ALTER TABLE public.content_items
  ENABLE TRIGGER content_items_validate_pipeline,
  ENABLE TRIGGER content_items_set_updated_at;

-- ── 3) v2v tespiti ve yeni check-list maddesi ─────────────────────────────
CREATE FUNCTION public.content_is_v2v(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_item_assets l
    JOIN public.generations g ON g.id = l.generation_id
    WHERE l.content_item_id = p_id AND g.mode = 'video_to_video'
  ) OR EXISTS (
    SELECT 1 FROM public.content_item_assets l
    JOIN public.generations g ON g.output_asset_id = l.asset_id
    WHERE l.content_item_id = p_id AND g.mode = 'video_to_video'
  );
$$;

-- templates/pre-publish-checklist.md: 5 bölüm, 25 madde, iki puan.
CREATE OR REPLACE FUNCTION public.content_checklist_ready(p_checklist jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(
    p_checklist->>'decision' = 'ready'
    AND p_checklist->>'hookScore' IN ('3', '4', '5')
    AND p_checklist->>'engagementScore' IN ('3', '4', '5')
    AND jsonb_typeof(p_checklist->'hookScore') = 'number'
    AND jsonb_typeof(p_checklist->'engagementScore') = 'number'
    AND NOT EXISTS (
      SELECT 1 FROM unnest(ARRAY[
        'hook_opening','hook_character','hook_pacing','hook_payoff','hook_loop',
        'engagement_reason','engagement_caption','engagement_hashtags','engagement_honesty',
        'quality_format','quality_anatomy','quality_text','quality_silent','quality_audio','quality_cover',
        'ai_disclosure','ai_identity','ai_consent','ai_claims','ai_brands',
        'commercial_disclosure','commercial_tool','commercial_rights','commercial_engagement','commercial_minor'
      ]) AS key WHERE (p_checklist->'items'->key) IS DISTINCT FROM 'true'::jsonb
    ), false);
$$;

-- ── 4) İçerik doğrulama trigger'ı (20261022130000'deki fonksiyonun yeni hali) ──
CREATE OR REPLACE FUNCTION public.validate_content_pipeline()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  score_changed boolean;
  source_changed boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Geçerli bir IANA saat dilimi seçin.' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'posting_slots' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.influencer_id IS DISTINCT FROM OLD.influencer_id THEN
    RAISE EXCEPTION 'İçeriğin influencer bilgisi değiştirilemez.' USING ERRCODE = '23514';
  END IF;
  -- Hesap silindiğinde FK'nin SET NULL işlemi kartı düzeltmeye döndürür.
  -- Bu ayrıca influencer CASCADE silmesinin trigger sırasına bağlı kalmasını önler.
  IF TG_OP = 'UPDATE' AND OLD.target_account_id IS NOT NULL AND NEW.target_account_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.social_accounts WHERE id = OLD.target_account_id) THEN
    NEW.stage := 'edit';
  END IF;
  IF NEW.target_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.social_accounts WHERE id = NEW.target_account_id AND influencer_id = NEW.influencer_id
  ) THEN
    RAISE EXCEPTION 'Hedef hesap içerikle aynı influencer’a ait olmalı.' USING ERRCODE = '23514';
  END IF;

  -- Puanlayan (#22): puan veya karar değiştiğinde oturumdaki kullanıcı. İstemci yazamaz.
  IF TG_OP = 'INSERT' THEN
    score_changed := num_nonnulls(NEW.checklist->'hookScore', NEW.checklist->'engagementScore', NEW.checklist->'decision') > 0;
  ELSE
    score_changed := ROW(NEW.checklist->'hookScore', NEW.checklist->'engagementScore', NEW.checklist->'decision')
      IS DISTINCT FROM ROW(OLD.checklist->'hookScore', OLD.checklist->'engagementScore', OLD.checklist->'decision');
  END IF;
  IF uid IS NOT NULL THEN
    NEW.checklist_scored_by := CASE
      WHEN score_changed THEN uid
      WHEN TG_OP = 'UPDATE' THEN OLD.checklist_scored_by
    END;
  END IF;

  -- Kaynak kaydı (#145): kaydeden ve zaman sunucuda yazılır.
  IF TG_OP = 'INSERT' THEN
    source_changed := NEW.source_type IS NOT NULL OR NEW.source_owner <> '' OR NEW.source_license <> '';
  ELSE
    source_changed := ROW(NEW.source_type, NEW.source_owner, NEW.source_license)
      IS DISTINCT FROM ROW(OLD.source_type, OLD.source_owner, OLD.source_license);
  END IF;
  IF NEW.source_type IS NULL AND NEW.source_owner = '' AND NEW.source_license = '' THEN
    NEW.source_checked_at := NULL;
    NEW.source_checked_by := NULL;
  ELSIF uid IS NOT NULL THEN
    IF source_changed THEN
      NEW.source_checked_at := now();
      NEW.source_checked_by := uid;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.source_checked_at := OLD.source_checked_at;
      NEW.source_checked_by := OLD.source_checked_by;
    END IF;
  ELSIF source_changed AND (TG_OP = 'INSERT' OR NEW.source_checked_at IS NOT DISTINCT FROM OLD.source_checked_at) THEN
    NEW.source_checked_at := coalesce(CASE WHEN TG_OP = 'INSERT' THEN NEW.source_checked_at END, now());
  END IF;

  IF NEW.stage IN ('scheduled', 'published') THEN
    IF TG_OP = 'INSERT' OR OLD.stage NOT IN ('scheduled', 'published')
      OR ROW(NEW.checklist, NEW.assignee_id, NEW.source_type, NEW.source_owner, NEW.source_license)
        IS DISTINCT FROM ROW(OLD.checklist, OLD.assignee_id, OLD.source_type, OLD.source_owner, OLD.source_license) THEN
      IF NOT public.content_checklist_ready(NEW.checklist) THEN
        RAISE EXCEPTION 'Planlamak için tüm yayın öncesi kontrolleri tamamlayın ve iki puanı en az 3 yapın.'
          USING ERRCODE = '23514', HINT = 'checklist_incomplete';
      END IF;
      IF NEW.checklist_scored_by IS NOT NULL AND NEW.checklist_scored_by = coalesce(NEW.assignee_id, NEW.created_by) THEN
        RAISE EXCEPTION 'Puanlayan kişi üreten kişiden farklı olmalı; puanları ve yayın kararını başka bir ekip üyesi kaydetmeli.'
          USING ERRCODE = '23514', HINT = 'scorer_is_producer';
      END IF;
      IF TG_OP = 'UPDATE' AND NEW.source_type IS NULL AND public.content_is_v2v(NEW.id) THEN
        RAISE EXCEPTION 'Video-to-video içerikte kaynak bilgisi (tür, sahip, lisans/izin) kaydedilmeden planlama veya yayın yapılamaz.'
          USING ERRCODE = '23514', HINT = 'source_missing';
      END IF;
    END IF;
    IF NEW.target_account_id IS NULL OR NEW.scheduled_at IS NULL THEN
      RAISE EXCEPTION 'Hedef hesap ve yayın zamanı gerekli.' USING ERRCODE = '23514';
    END IF;
    IF NEW.stage = 'published' AND NOT EXISTS (
      SELECT 1 FROM public.posts WHERE content_item_id = NEW.id AND account_id = NEW.target_account_id AND published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Yayında aşaması için yayınlanmış bir post eşleştirin.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.checklist->>'hookScore' IN ('1', '2') OR NEW.checklist->>'engagementScore' IN ('1', '2') THEN
    NEW.stage := 'edit';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5) Planlı karta v2v üretimi bağlama ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_content_media()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE c public.content_items; media_owner uuid;
BEGIN
  SELECT * INTO c FROM public.content_items WHERE id = NEW.content_item_id;
  IF NEW.asset_id IS NOT NULL THEN
    SELECT influencer_id INTO media_owner FROM public.assets WHERE id = NEW.asset_id;
  ELSE
    SELECT influencer_id INTO media_owner FROM public.generations WHERE id = NEW.generation_id;
  END IF;
  IF c.influencer_id IS NULL OR media_owner IS DISTINCT FROM c.influencer_id THEN
    RAISE EXCEPTION 'Medya içerikle aynı influencer’a ait olmalı.' USING ERRCODE = '23514';
  END IF;
  IF c.stage IN ('scheduled', 'published') AND c.source_type IS NULL AND EXISTS (
    SELECT 1 FROM public.generations g
    WHERE g.mode = 'video_to_video'
      AND (g.id = NEW.generation_id OR (NEW.asset_id IS NOT NULL AND g.output_asset_id = NEW.asset_id))
  ) THEN
    RAISE EXCEPTION 'Video-to-video içerikte kaynak bilgisi (tür, sahip, lisans/izin) kaydedilmeden planlama veya yayın yapılamaz.'
      USING ERRCODE = '23514', HINT = 'source_missing';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 6) Yayın işi açılırken (#58) kaynak ve puanlayan kontrolü ──────────────
-- publish_jobs_prepare'den sonra çalışır (trigger adları alfabetik); onun kontrolleri önce gelir.
CREATE FUNCTION public.publish_jobs_validate_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE c public.content_items;
BEGIN
  SELECT * INTO c FROM public.content_items WHERE id = NEW.content_item_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF c.checklist_scored_by IS NOT NULL AND c.checklist_scored_by = coalesce(c.assignee_id, c.created_by) THEN
    RAISE EXCEPTION 'Puanlayan kişi üreten kişiden farklı olmalı; puanları ve yayın kararını başka bir ekip üyesi kaydetmeli.'
      USING ERRCODE = '23514', HINT = 'scorer_is_producer';
  END IF;
  IF c.source_type IS NULL AND public.content_is_v2v(c.id) THEN
    RAISE EXCEPTION 'Video-to-video içerikte kaynak bilgisi (tür, sahip, lisans/izin) kaydedilmeden planlama veya yayın yapılamaz.'
      USING ERRCODE = '23514', HINT = 'source_missing';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_jobs_validate_review() FROM PUBLIC, anon;
CREATE TRIGGER publish_jobs_validate_review
  BEFORE INSERT ON public.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.publish_jobs_validate_review();

-- ── 7) Kaydetme RPC'si yeni alanları yazar (imza aynı) ─────────────────────
CREATE OR REPLACE FUNCTION public.save_content_item(
  p_id uuid, p_values jsonb, p_asset_ids uuid[] DEFAULT NULL,
  p_generation_ids uuid[] DEFAULT NULL, p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.content_items LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_row public.content_items; v public.content_items; saved public.content_items;
BEGIN
  IF NOT public.can_write_data() THEN RAISE EXCEPTION 'Editor yetkisi gerekli.' USING ERRCODE = '42501'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO current_row FROM public.content_items WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'İçerik bulunamadı.' USING ERRCODE = 'P0002'; END IF;
    IF p_expected_updated_at IS NOT NULL AND current_row.updated_at <> p_expected_updated_at THEN
      RAISE EXCEPTION 'İçerik başka biri tarafından değiştirildi; sayfayı yenileyin.' USING ERRCODE = '40001';
    END IF;
  ELSE
    current_row.influencer_id := (p_values->>'influencer_id')::uuid;
    current_row.format := 'short_video'; current_row.stage := 'idea'; current_row.checklist := '{}'::jsonb;
    current_row.source_url := ''; current_row.viral_reason := ''; current_row.notes := '';
    current_row.source_owner := ''; current_row.source_license := '';
    current_row.timezone := 'Europe/Istanbul'; current_row.sort_order := 0;
  END IF;
  v := jsonb_populate_record(current_row, p_values);
  IF p_id IS NULL THEN
    INSERT INTO public.content_items(influencer_id, title, format, hook_type, stage, scheduled_at, checklist,
      source_url, source_views, viral_reason, adaptation_score, assignee_id, target_account_id, sort_order, notes, timezone,
      source_type, source_owner, source_license)
    VALUES (v.influencer_id, v.title, v.format, v.hook_type, v.stage, v.scheduled_at, v.checklist,
      v.source_url, v.source_views, v.viral_reason, v.adaptation_score, v.assignee_id, v.target_account_id, v.sort_order, v.notes, v.timezone,
      v.source_type, v.source_owner, v.source_license)
    RETURNING * INTO saved;
  ELSE
    IF v.influencer_id IS DISTINCT FROM current_row.influencer_id THEN RAISE EXCEPTION 'Influencer değiştirilemez.' USING ERRCODE = '23514'; END IF;
    UPDATE public.content_items SET title = v.title, format = v.format, hook_type = v.hook_type,
      stage = v.stage, scheduled_at = v.scheduled_at, checklist = v.checklist,
      source_url = v.source_url, source_views = v.source_views, viral_reason = v.viral_reason,
      adaptation_score = v.adaptation_score, assignee_id = v.assignee_id, target_account_id = v.target_account_id,
      sort_order = v.sort_order, notes = v.notes, timezone = v.timezone,
      source_type = v.source_type, source_owner = v.source_owner, source_license = v.source_license
      WHERE id = p_id RETURNING * INTO saved;
  END IF;
  IF p_asset_ids IS NOT NULL THEN
    DELETE FROM public.content_item_assets WHERE content_item_id = saved.id AND asset_id IS NOT NULL;
    INSERT INTO public.content_item_assets(content_item_id, asset_id) SELECT saved.id, x FROM unnest(p_asset_ids) x;
  END IF;
  IF p_generation_ids IS NOT NULL THEN
    DELETE FROM public.content_item_assets WHERE content_item_id = saved.id AND generation_id IS NOT NULL;
    INSERT INTO public.content_item_assets(content_item_id, generation_id) SELECT saved.id, x FROM unnest(p_generation_ids) x;
  END IF;
  RETURN saved;
END;
$$;

-- ── 8) Kart detayı ve aylık kontrol filtresi ───────────────────────────────
CREATE OR REPLACE FUNCTION public.content_item_details(p_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'warnings', public.content_schedule_warnings(c.id),
    'asset_ids', (SELECT coalesce(jsonb_agg(asset_id) FILTER (WHERE asset_id IS NOT NULL), '[]') FROM public.content_item_assets WHERE content_item_id = c.id),
    'generation_ids', (SELECT coalesce(jsonb_agg(generation_id) FILTER (WHERE generation_id IS NOT NULL), '[]') FROM public.content_item_assets WHERE content_item_id = c.id),
    'posts', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'url', p.url, 'views', m.views)), '[]')
      FROM public.posts p LEFT JOIN LATERAL (
        SELECT views FROM public.metric_snapshots WHERE post_id = p.id ORDER BY captured_at DESC, id DESC LIMIT 1
      ) m ON true WHERE p.content_item_id = c.id),
    'v2v', v.is_v2v,
    'source_missing', v.is_v2v AND c.source_type IS NULL
  )), '[]') FROM public.content_items c
  CROSS JOIN LATERAL (SELECT public.content_is_v2v(c.id) AS is_v2v) v
  WHERE c.id = ANY(p_ids);
$$;

-- Kaynak bilgisi eksik v2v içerikler (aylık kontrol, içerik listesi filtresi). RLS geçerlidir.
CREATE FUNCTION public.content_source_missing_ids(p_influencer_id uuid DEFAULT NULL)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(array_agg(c.id ORDER BY c.created_at DESC, c.id), '{}')
  FROM public.content_items c
  WHERE c.source_type IS NULL
    AND (p_influencer_id IS NULL OR c.influencer_id = p_influencer_id)
    AND public.content_is_v2v(c.id);
$$;

REVOKE ALL ON FUNCTION public.content_is_v2v(uuid), public.content_source_missing_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_is_v2v(uuid), public.content_source_missing_ids(uuid) TO authenticated, service_role;
