-- İçerik üretim akışı ve hesap bazlı yayın takvimi (#57).
ALTER TABLE public.content_items
  ADD COLUMN source_url text NOT NULL DEFAULT '' CHECK (source_url = '' OR (source_url ~ '^https?://' AND length(source_url) <= 2000)),
  ADD COLUMN source_views bigint CHECK (source_views >= 0),
  ADD COLUMN viral_reason text NOT NULL DEFAULT '' CHECK (length(viral_reason) <= 3000),
  ADD COLUMN adaptation_score smallint CHECK (adaptation_score BETWEEN 1 AND 5),
  ADD COLUMN assignee_id uuid REFERENCES public.team_members(user_id) ON DELETE SET NULL,
  ADD COLUMN target_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
  ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Istanbul';

CREATE TABLE public.content_item_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES public.generations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (num_nonnulls(asset_id, generation_id) = 1),
  UNIQUE (content_item_id, asset_id),
  UNIQUE (content_item_id, generation_id)
);
CREATE TABLE public.posting_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  local_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Istanbul',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (account_id, weekday, local_time, timezone)
);
CREATE INDEX content_items_account_schedule_idx ON public.content_items(target_account_id, scheduled_at);
CREATE INDEX content_item_assets_content_idx ON public.content_item_assets(content_item_id);
CREATE INDEX posts_content_item_idx ON public.posts(content_item_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_item_assets', 'posting_slots'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_team_member())', t || '_team_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_write_data()) WITH CHECK (public.can_write_data())', t || '_team_write', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_set_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_created_by()', t || '_set_created_by', t);
  END LOOP;
END;
$$;
REVOKE ALL ON public.content_item_assets, public.posting_slots FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_item_assets, public.posting_slots TO authenticated;

-- templates/pre-publish-checklist.md: 5 bölüm, 24 madde, iki puan.
CREATE FUNCTION public.content_checklist_ready(p_checklist jsonb)
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
        'engagement_reason','engagement_caption','engagement_honesty',
        'quality_format','quality_anatomy','quality_text','quality_silent','quality_audio','quality_cover',
        'ai_disclosure','ai_identity','ai_consent','ai_claims','ai_brands',
        'commercial_disclosure','commercial_tool','commercial_rights','commercial_engagement','commercial_minor'
      ]) AS key WHERE (p_checklist->'items'->key) IS DISTINCT FROM 'true'::jsonb
    ), false);
$$;

CREATE FUNCTION public.validate_content_pipeline()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
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
  IF NEW.stage IN ('scheduled', 'published') THEN
    IF NOT public.content_checklist_ready(NEW.checklist) THEN
      RAISE EXCEPTION 'Planlamak için tüm yayın öncesi kontrolleri tamamlayın ve iki puanı en az 3 yapın.' USING ERRCODE = '23514';
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
CREATE TRIGGER content_items_validate_pipeline BEFORE INSERT OR UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_content_pipeline();
CREATE TRIGGER posting_slots_validate_timezone BEFORE INSERT OR UPDATE ON public.posting_slots
  FOR EACH ROW EXECUTE FUNCTION public.validate_content_pipeline();

CREATE FUNCTION public.validate_content_media()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE owner_id uuid; media_owner uuid;
BEGIN
  SELECT influencer_id INTO owner_id FROM public.content_items WHERE id = NEW.content_item_id;
  IF NEW.asset_id IS NOT NULL THEN
    SELECT influencer_id INTO media_owner FROM public.assets WHERE id = NEW.asset_id;
  ELSE
    SELECT influencer_id INTO media_owner FROM public.generations WHERE id = NEW.generation_id;
  END IF;
  IF owner_id IS NULL OR media_owner IS DISTINCT FROM owner_id THEN
    RAISE EXCEPTION 'Medya içerikle aynı influencer’a ait olmalı.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER content_item_assets_validate BEFORE INSERT OR UPDATE ON public.content_item_assets
  FOR EACH ROW EXECUTE FUNCTION public.validate_content_media();

CREATE FUNCTION public.validate_content_post()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.content_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.content_items c JOIN public.social_accounts a ON a.id = NEW.account_id
    WHERE c.id = NEW.content_item_id AND c.influencer_id = a.influencer_id
      AND (c.target_account_id IS NULL OR c.target_account_id = a.id)
  ) THEN
    RAISE EXCEPTION 'Post ve içerik aynı hedef hesaba ait olmalı.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER posts_validate_content BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.validate_content_post();

CREATE FUNCTION public.content_schedule_warnings(p_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE c public.content_items; result text[] := '{}'; near_count integer; day_count integer;
BEGIN
  SELECT * INTO c FROM public.content_items WHERE id = p_id;
  IF NOT FOUND OR c.scheduled_at IS NULL OR c.target_account_id IS NULL OR c.stage NOT IN ('scheduled', 'published') THEN RETURN result; END IF;
  WITH events AS (
    SELECT scheduled_at AS at FROM public.content_items planned
      WHERE target_account_id = c.target_account_id AND stage = 'scheduled' AND id <> c.id
        AND NOT EXISTS (SELECT 1 FROM public.posts WHERE content_item_id = planned.id AND published_at IS NOT NULL)
    UNION ALL
    SELECT published_at FROM public.posts
      WHERE account_id = c.target_account_id AND content_item_id IS DISTINCT FROM c.id AND published_at IS NOT NULL
  )
  SELECT count(*) FILTER (WHERE abs(extract(epoch FROM (at - c.scheduled_at))) < 18000),
    count(*) FILTER (WHERE (at AT TIME ZONE c.timezone)::date = (c.scheduled_at AT TIME ZONE c.timezone)::date)
  INTO near_count, day_count FROM events;
  IF near_count > 0 THEN result := array_append(result, 'Aynı hesapta iki paylaşım arasında en az 5 saat olmalı.'); END IF;
  IF day_count >= 4 THEN result := array_append(result, 'Bu hesapta aynı gün 4 paylaşımdan fazla plan var.'); END IF;
  RETURN result;
END;
$$;

-- İçerik ve bağlı medya tek işlemde kaydedilir. updated_at iyimser kilittir.
CREATE FUNCTION public.save_content_item(
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
    current_row.timezone := 'Europe/Istanbul'; current_row.sort_order := 0;
  END IF;
  v := jsonb_populate_record(current_row, p_values);
  IF p_id IS NULL THEN
    INSERT INTO public.content_items(influencer_id, title, format, hook_type, stage, scheduled_at, checklist,
      source_url, source_views, viral_reason, adaptation_score, assignee_id, target_account_id, sort_order, notes, timezone)
    VALUES (v.influencer_id, v.title, v.format, v.hook_type, v.stage, v.scheduled_at, v.checklist,
      v.source_url, v.source_views, v.viral_reason, v.adaptation_score, v.assignee_id, v.target_account_id, v.sort_order, v.notes, v.timezone)
    RETURNING * INTO saved;
  ELSE
    IF v.influencer_id IS DISTINCT FROM current_row.influencer_id THEN RAISE EXCEPTION 'Influencer değiştirilemez.' USING ERRCODE = '23514'; END IF;
    UPDATE public.content_items SET title = v.title, format = v.format, hook_type = v.hook_type,
      stage = v.stage, scheduled_at = v.scheduled_at, checklist = v.checklist,
      source_url = v.source_url, source_views = v.source_views, viral_reason = v.viral_reason,
      adaptation_score = v.adaptation_score, assignee_id = v.assignee_id, target_account_id = v.target_account_id,
      sort_order = v.sort_order, notes = v.notes, timezone = v.timezone WHERE id = p_id RETURNING * INTO saved;
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

CREATE FUNCTION public.link_content_post(p_content_id uuid, p_post_id uuid)
RETURNS public.content_items LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c public.content_items; p public.posts;
BEGIN
  IF NOT public.can_write_data() THEN RAISE EXCEPTION 'Editor yetkisi gerekli.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.content_items WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'İçerik bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO p FROM public.posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF p.content_item_id IS NOT NULL AND p.content_item_id <> c.id THEN RAISE EXCEPTION 'Post başka bir içeriğe bağlı.' USING ERRCODE = '23505'; END IF;
  IF p.published_at IS NULL THEN RAISE EXCEPTION 'Post henüz yayınlanmamış.' USING ERRCODE = '23514'; END IF;
  UPDATE public.posts SET content_item_id = c.id WHERE id = p.id;
  UPDATE public.content_items SET stage = 'published', target_account_id = p.account_id, scheduled_at = p.published_at
    WHERE id = c.id RETURNING * INTO c;
  RETURN c;
END;
$$;

-- Yalnız görünen kartlar için detaylar; tüm snapshot geçmişi istemciye taşınmaz.
CREATE FUNCTION public.content_item_details(p_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'warnings', public.content_schedule_warnings(c.id),
    'asset_ids', (SELECT coalesce(jsonb_agg(asset_id) FILTER (WHERE asset_id IS NOT NULL), '[]') FROM public.content_item_assets WHERE content_item_id = c.id),
    'generation_ids', (SELECT coalesce(jsonb_agg(generation_id) FILTER (WHERE generation_id IS NOT NULL), '[]') FROM public.content_item_assets WHERE content_item_id = c.id),
    'posts', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'url', p.url, 'views', m.views)), '[]')
      FROM public.posts p LEFT JOIN LATERAL (
        SELECT views FROM public.metric_snapshots WHERE post_id = p.id ORDER BY captured_at DESC, id DESC LIMIT 1
      ) m ON true WHERE p.content_item_id = c.id)
  )), '[]') FROM public.content_items c WHERE c.id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION public.content_checklist_ready(jsonb), public.content_schedule_warnings(uuid),
  public.save_content_item(uuid,jsonb,uuid[],uuid[],timestamptz), public.link_content_post(uuid,uuid),
  public.content_item_details(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_checklist_ready(jsonb), public.content_schedule_warnings(uuid),
  public.save_content_item(uuid,jsonb,uuid[],uuid[],timestamptz), public.link_content_post(uuid,uuid),
  public.content_item_details(uuid[]) TO authenticated;
