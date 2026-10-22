-- Post detay, karşılaştırma, segment analizi ve öğrenim notları (#55).
--
-- Neden SQL'de: Medyan ve ortalama tüm postları istemciye çekmeden hesaplanır.
-- PostgREST `max_rows` (1000) sınırı yüzünden JS'te toplama veri büyüdükçe
-- sessizce eksik sonuç verirdi. Fonksiyonların hepsi SECURITY INVOKER:
-- çağıranın RLS'i uygulanır, ekip dışındaki kullanıcı hiçbir satır görmez.
--
-- Kontrol noktaları (#53 `target_hours` gelene kadar): her post için verilen
-- pencerede ölçülen İLK snapshot kullanılır. Pencere dışında ölçüm yoksa değer
-- NULL kalır; sıfır varsayılmaz.
--   1 sa: [1, 2)   5 sa: [5, 7)   24 sa: [24, 30)   3 gün: [72, 84)   7 gün: [168, 192)
-- Yayından bu yana geçen süre `hours_since_publish`, yoksa `captured_at - published_at`.

-- 1) Öğrenim notları --------------------------------------------------------

CREATE TABLE public.learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts (id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
CREATE INDEX learnings_post_created_at_idx ON public.learnings (post_id, created_at DESC);
CREATE INDEX learnings_influencer_created_at_idx ON public.learnings (influencer_id, created_at DESC);

ALTER TABLE public.learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY learnings_team_read ON public.learnings
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY learnings_team_write ON public.learnings
  FOR ALL TO authenticated USING (public.can_write_data()) WITH CHECK (public.can_write_data());
CREATE TRIGGER learnings_set_updated_at BEFORE UPDATE ON public.learnings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER learnings_set_created_by BEFORE INSERT OR UPDATE ON public.learnings
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
REVOKE ALL ON public.learnings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learnings TO authenticated;

-- Post'a bağlı öğrenimin influencer'ı post'un hesabından gelir; istemci farklı
-- bir influencer yazarsa reddedilir (öğrenim başka karakterin listesine sızmasın).
CREATE FUNCTION public.validate_learning()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE post_influencer uuid;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT a.influencer_id INTO post_influencer
    FROM public.posts p JOIN public.social_accounts a ON a.id = p.account_id
    WHERE p.id = NEW.post_id;
    IF NEW.influencer_id IS NULL THEN
      NEW.influencer_id := post_influencer;
    ELSIF NEW.influencer_id IS DISTINCT FROM post_influencer THEN
      RAISE EXCEPTION 'Öğrenim ve post aynı influencer’a ait olmalı.' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.body := trim(NEW.body);
  RETURN NEW;
END;
$$;
CREATE TRIGGER learnings_validate BEFORE INSERT OR UPDATE ON public.learnings
  FOR EACH ROW EXECUTE FUNCTION public.validate_learning();

-- 2) Kontrol noktası izlenmeleri ---------------------------------------------

CREATE FUNCTION public.post_checkpoint_views(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, target_hours integer, hours numeric, views bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT DISTINCT ON (s.post_id, w.target) s.post_id, w.target, round(s.hours, 2), s.views
  FROM (
    SELECT m.post_id, m.views, m.captured_at,
      coalesce(m.hours_since_publish, extract(epoch FROM m.captured_at - p.published_at) / 3600)::numeric AS hours
    FROM public.metric_snapshots m
    JOIN public.posts p ON p.id = m.post_id
    WHERE m.post_id = ANY (p_post_ids)
  ) s
  JOIN (VALUES (1, 1, 2), (5, 5, 7), (24, 24, 30), (72, 72, 84), (168, 168, 192)) AS w (target, lo, hi)
    ON s.hours >= w.lo AND s.hours < w.hi
  ORDER BY s.post_id, w.target, s.hours, s.captured_at;
$$;

-- 3) Post detayı + aynı hesabın son N postuna göre kıyas ----------------------

CREATE FUNCTION public.post_analytics(p_post_id uuid, p_baseline_posts integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  p record;
  n integer := least(greatest(coalesce(p_baseline_posts, 20), 3), 100);
  baseline_ids uuid[];
  result jsonb;
BEGIN
  SELECT po.id, po.caption, po.url, po.published_at, po.duration_s, po.is_short, po.external_id,
    po.account_id, po.content_item_id, a.platform, a.handle, i.id AS influencer_id, i.slug, i.name
  INTO p
  FROM public.posts po
  JOIN public.social_accounts a ON a.id = po.account_id
  JOIN public.influencers i ON i.id = a.influencer_id
  WHERE po.id = p_post_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Kıyas grubu: aynı hesabın bu posttan ÖNCE yayınlanan son n postu.
  baseline_ids := ARRAY(
    SELECT bp.id FROM public.posts bp
    WHERE bp.account_id = p.account_id AND bp.id <> p.id AND bp.published_at IS NOT NULL
      AND (p.published_at IS NULL OR bp.published_at < p.published_at)
    ORDER BY bp.published_at DESC, bp.id DESC
    LIMIT n
  );

  WITH cp AS MATERIALIZED (
    SELECT * FROM public.post_checkpoint_views(baseline_ids || p.id)
  ), snaps AS (
    SELECT * FROM (
      SELECT m.captured_at, m.views, m.reach, m.likes, m.comments, m.shares, m.saves,
        m.avg_watch_time_s, m.completion_rate,
        round(coalesce(m.hours_since_publish, extract(epoch FROM m.captured_at - p.published_at) / 3600)::numeric, 2) AS hours
      FROM public.metric_snapshots m
      WHERE m.post_id = p.id
      ORDER BY m.captured_at DESC
      LIMIT 500
    ) last_snaps
  )
  SELECT jsonb_build_object(
    'post', jsonb_build_object(
      'id', p.id, 'caption', p.caption, 'url', p.url, 'publishedAt', p.published_at,
      'durationS', p.duration_s, 'isShort', p.is_short, 'externalId', p.external_id,
      'accountId', p.account_id, 'platform', p.platform, 'handle', p.handle
    ),
    'influencer', jsonb_build_object('id', p.influencer_id, 'slug', p.slug, 'name', p.name),
    'content', (
      SELECT jsonb_build_object('id', c.id, 'title', c.title, 'format', c.format,
        'hookType', c.hook_type, 'stage', c.stage)
      FROM public.content_items c WHERE c.id = p.content_item_id
    ),
    'prompts', coalesce((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('id', pr.id, 'title', pr.title,
        'version', pr.version, 'category', pr.category))
      FROM public.content_item_assets cia
      JOIN public.generations g ON g.id = cia.generation_id OR g.output_asset_id = cia.asset_id
      JOIN public.prompts pr ON pr.id = g.prompt_id
      WHERE cia.content_item_id = p.content_item_id
    ), '[]'::jsonb),
    'snapshots', coalesce((
      SELECT jsonb_agg(jsonb_build_object('capturedAt', s.captured_at, 'hours', s.hours,
        'views', s.views, 'reach', s.reach, 'likes', s.likes, 'comments', s.comments,
        'shares', s.shares, 'saves', s.saves, 'avgWatchTimeS', s.avg_watch_time_s,
        'completionRate', s.completion_rate) ORDER BY s.captured_at)
      FROM snaps s
    ), '[]'::jsonb),
    'baselinePosts', cardinality(baseline_ids),
    'checkpoints', (
      SELECT jsonb_agg(jsonb_build_object(
        'hours', t.h,
        'views', (SELECT cp.views FROM cp WHERE cp.post_id = p.id AND cp.target_hours = t.h),
        'median', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY cp.views)
          FROM cp WHERE cp.post_id <> p.id AND cp.target_hours = t.h),
        'average', (SELECT round(avg(cp.views), 2) FROM cp WHERE cp.post_id <> p.id AND cp.target_hours = t.h),
        'measured', (SELECT count(*) FROM cp WHERE cp.post_id <> p.id AND cp.target_hours = t.h)
      ) ORDER BY t.h)
      FROM unnest(ARRAY[1, 5, 24, 72, 168]) AS t (h)
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- 4) Segment analizi -----------------------------------------------------------
-- Boyutlar: kanca türü, format, yayın saati (içeriğin saat dilimi, yoksa
-- Europe/Istanbul), süre ve platform. Boş anahtar ('') = belirtilmemiş.

CREATE FUNCTION public.post_segments(p_influencer_slug text DEFAULT NULL, p_target_hours integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF p_target_hours IS NULL OR p_target_hours NOT IN (1, 5, 24, 72, 168) THEN
    RAISE EXCEPTION 'Geçersiz kontrol noktası' USING ERRCODE = '22023';
  END IF;
  WITH selected AS MATERIALIZED (
    SELECT i.id FROM public.influencers i
    WHERE p_influencer_slug IS NULL OR i.slug = p_influencer_slug
  ), posts_in AS MATERIALIZED (
    SELECT p.id, p.published_at, p.duration_s, a.platform::text AS platform,
      c.format, c.hook_type, coalesce(c.timezone, 'Europe/Istanbul') AS tz
    FROM public.posts p
    JOIN public.social_accounts a ON a.id = p.account_id
    JOIN selected s ON s.id = a.influencer_id
    LEFT JOIN public.content_items c ON c.id = p.content_item_id
    WHERE p.published_at IS NOT NULL
  ), measured AS MATERIALIZED (
    SELECT x.*, cp.views
    FROM posts_in x
    LEFT JOIN public.post_checkpoint_views(ARRAY(SELECT id FROM posts_in)) cp
      ON cp.post_id = x.id AND cp.target_hours = p_target_hours
  ), dims AS (
    SELECT 'hook_type' AS dimension, coalesce(trim(m.hook_type), '') AS key, m.views FROM measured m
    UNION ALL
    SELECT 'format', coalesce(trim(m.format), ''), m.views FROM measured m
    UNION ALL
    SELECT 'publish_hour', CASE
        WHEN extract(hour FROM m.published_at AT TIME ZONE m.tz) < 6 THEN 'night'
        WHEN extract(hour FROM m.published_at AT TIME ZONE m.tz) < 12 THEN 'morning'
        WHEN extract(hour FROM m.published_at AT TIME ZONE m.tz) < 18 THEN 'afternoon'
        ELSE 'evening' END, m.views FROM measured m
    UNION ALL
    SELECT 'duration', CASE
        WHEN m.duration_s IS NULL THEN ''
        WHEN m.duration_s < 15 THEN 'lt15'
        WHEN m.duration_s < 30 THEN '15to30'
        WHEN m.duration_s < 60 THEN '30to60'
        ELSE 'gte60' END, m.views FROM measured m
    UNION ALL
    SELECT 'platform', m.platform, m.views FROM measured m
  ), grouped AS (
    SELECT d.dimension, d.key, count(*) AS posts, count(d.views) AS measured,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY d.views) AS median,
      round(avg(d.views), 2) AS average
    FROM dims d GROUP BY d.dimension, d.key
  )
  SELECT jsonb_build_object(
    'validInfluencer', p_influencer_slug IS NULL OR EXISTS (SELECT 1 FROM selected),
    'targetHours', p_target_hours,
    'overall', (
      SELECT jsonb_build_object('posts', count(*), 'measured', count(m.views),
        'median', percentile_cont(0.5) WITHIN GROUP (ORDER BY m.views),
        'average', round(avg(m.views), 2))
      FROM measured m
    ),
    'segments', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dimension', g.dimension, 'key', g.key, 'posts', g.posts,
        'measured', g.measured, 'median', g.median, 'average', g.average) ORDER BY g.dimension, g.key)
      FROM grouped g
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.post_checkpoint_views(uuid[]), public.post_analytics(uuid, integer),
  public.post_segments(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_checkpoint_views(uuid[]), public.post_analytics(uuid, integer),
  public.post_segments(text, integer) TO authenticated;

COMMENT ON TABLE public.learnings IS 'Tarihli öğrenim notları; post veya influencer bağlamında (#55).';
