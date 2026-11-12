-- #24 performans takibi ve #25 ilk test dalgası analizi (Google Sheets yerine panel).
--
-- 1) app_settings 'analytics' anahtarı: "takıldı" eşiği (ilk N saatte < X izlenme), "patladı"
--    çarpanı (24 sa izlenme >= hesap medyanı × k) ve kıyas grubu boyutu (son 10 video).
--    Yalnız owner yazar (mevcut app_settings_owner_write politikası); değer şekli CHECK ile
--    denetlenir, panel Zod ile aynı sınırları uygular.
-- 2) posts.sound_type: ses türü (trend / orijinal). Platform API'leri bu bilgiyi vermez; ekip
--    post detayından girer. Toplayıcılar bu sütunu yazmaz (upsert ezmez).
-- 3) reports.actions: haftalık özetteki "gelecek hafta için 1–3 aksiyon". Rapor yeniden
--    üretildiğinde (generate_weekly_report) dokunulmaz.
-- 4) post_performance(): son N postun kontrol noktası izlenmeleri, son ölçümü, segment alanları
--    ve aynı hesabın o posttan ÖNCEKİ son k postunun 24 sa medyanı tek jsonb'de döner.
--    Gruplama (takıldı/normal/patladı), oranlar ve segment tablosu panelde saf fonksiyonlarla
--    hesaplanır (apps/panel/src/lib/analytics/performance.ts, Vitest). SECURITY INVOKER: RLS
--    çağıranın; ekip dışı kullanıcı boş liste görür.

-- ── 1) Analitik eşikleri ────────────────────────────────────────────────────
ALTER TABLE public.app_settings DROP CONSTRAINT app_settings_key_check;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_key_check CHECK (key IN ('ai', 'analytics'));

CREATE FUNCTION public.valid_analytics_settings(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  -- CASE: sayıya çevirme yalnız alanların hepsi JSON sayısıysa yapılır (metin 22P02 atmasın).
  SELECT CASE
    WHEN jsonb_typeof(p_value) = 'object'
      AND jsonb_typeof(p_value->'stuckViews') = 'number'
      AND jsonb_typeof(p_value->'stuckWithinHours') = 'number'
      AND jsonb_typeof(p_value->'viralMultiplier') = 'number'
      AND jsonb_typeof(p_value->'baselinePosts') = 'number'
    THEN (p_value->>'stuckViews')::numeric BETWEEN 1 AND 100000000
      AND (p_value->>'stuckViews')::numeric = trunc((p_value->>'stuckViews')::numeric)
      AND (p_value->>'stuckWithinHours') IN ('1', '5')
      AND (p_value->>'viralMultiplier')::numeric BETWEEN 1.1 AND 100
      AND (p_value->>'baselinePosts')::numeric BETWEEN 3 AND 50
      AND (p_value->>'baselinePosts')::numeric = trunc((p_value->>'baselinePosts')::numeric)
    ELSE false
  END;
$$;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_analytics_valid
  CHECK (key <> 'analytics' OR public.valid_analytics_settings(value));

COMMENT ON FUNCTION public.valid_analytics_settings(jsonb) IS
  'app_settings.analytics şekli (#25): stuckViews, stuckWithinHours (1|5), viralMultiplier, baselinePosts.';

-- ── 2) Ses türü ─────────────────────────────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN sound_type text CHECK (sound_type IS NULL OR sound_type IN ('trend', 'original'));
COMMENT ON COLUMN public.posts.sound_type IS
  'Ses türü (#24/#25): trend | original. NULL = girilmedi. Ekip girer; toplayıcılar yazmaz.';

-- ── 3) Haftalık aksiyonlar ──────────────────────────────────────────────────
CREATE FUNCTION public.valid_report_actions(p_actions text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_actions IS NOT NULL
    AND coalesce(array_ndims(p_actions), 1) = 1
    AND cardinality(p_actions) <= 3
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_actions) AS a (item)
      WHERE a.item IS NULL OR length(btrim(a.item)) NOT BETWEEN 1 AND 300
    );
$$;

ALTER TABLE public.reports
  ADD COLUMN actions text[] NOT NULL DEFAULT '{}'::text[]
  CONSTRAINT reports_actions_valid CHECK (public.valid_report_actions(actions));
COMMENT ON COLUMN public.reports.actions IS
  'Gelecek hafta için 1–3 aksiyon (#24). Rapor yeniden üretilince korunur.';

-- ── 4) Post performans listesi ──────────────────────────────────────────────
CREATE FUNCTION public.post_performance(
  p_influencer_slug text DEFAULT NULL,
  p_baseline_posts integer DEFAULT 10,
  p_limit integer DEFAULT 200
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  k integer := least(greatest(coalesce(p_baseline_posts, 10), 3), 50);
  n integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  result jsonb;
BEGIN
  WITH selected AS MATERIALIZED (
    SELECT i.id FROM public.influencers i
    WHERE p_influencer_slug IS NULL OR i.slug = p_influencer_slug
  ), all_posts AS MATERIALIZED (
    SELECT p.id, p.account_id, p.published_at, p.caption, p.url, p.duration_s, p.sound_type,
      a.platform::text AS platform, a.handle, c.format, c.hook_type, c.checklist,
      coalesce(c.timezone, 'Europe/Istanbul') AS tz
    FROM public.posts p
    JOIN public.social_accounts a ON a.id = p.account_id
    JOIN selected s ON s.id = a.influencer_id
    LEFT JOIN public.content_items c ON c.id = p.content_item_id
    WHERE p.published_at IS NOT NULL
  ), cp AS MATERIALIZED (
    SELECT * FROM public.post_checkpoint_views(ARRAY(SELECT id FROM all_posts))
  ), with_views AS MATERIALIZED (
    SELECT ap.*,
      (SELECT cp.views FROM cp WHERE cp.post_id = ap.id AND cp.target_hours = 1) AS v1,
      (SELECT cp.views FROM cp WHERE cp.post_id = ap.id AND cp.target_hours = 5) AS v5,
      (SELECT cp.views FROM cp WHERE cp.post_id = ap.id AND cp.target_hours = 24) AS v24
    FROM all_posts ap
  ), shown AS MATERIALIZED (
    SELECT * FROM with_views w ORDER BY w.published_at DESC, w.id DESC LIMIT n
  )
  SELECT jsonb_build_object(
    'validInfluencer', p_influencer_slug IS NULL OR EXISTS (SELECT 1 FROM selected),
    'baselinePosts', k,
    'totalPosts', (SELECT count(*) FROM all_posts),
    'posts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'caption', left(x.caption, 280), 'url', x.url,
        'publishedAt', x.published_at, 'platform', x.platform, 'handle', x.handle,
        'durationS', x.duration_s, 'soundType', x.sound_type,
        'format', x.format, 'hookType', x.hook_type,
        'checklistScore', CASE
          WHEN jsonb_typeof(x.checklist->'hookScore') = 'number'
            AND jsonb_typeof(x.checklist->'engagementScore') = 'number'
          THEN (x.checklist->>'hookScore')::numeric + (x.checklist->>'engagementScore')::numeric
        END,
        'publishHour', extract(hour FROM x.published_at AT TIME ZONE x.tz)::integer,
        'views1', x.v1, 'views5', x.v5, 'views24', x.v24,
        'baselineMedian24', base.median, 'baselineMeasured', base.measured,
        'latest', CASE WHEN last.captured_at IS NOT NULL THEN jsonb_build_object(
          'capturedAt', last.captured_at,
          'hours', round(coalesce(last.hours_since_publish,
            extract(epoch FROM last.captured_at - x.published_at) / 3600)::numeric, 2),
          'views', last.views, 'reach', last.reach, 'likes', last.likes,
          'comments', last.comments, 'shares', last.shares, 'saves', last.saves,
          'avgWatchTimeS', last.avg_watch_time_s, 'completionRate', last.completion_rate
        ) END
      ) ORDER BY x.published_at DESC, x.id DESC)
      FROM shown x
      LEFT JOIN LATERAL (
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY b.v24) AS median,
          count(b.v24)::integer AS measured
        FROM (
          SELECT w.v24 FROM with_views w
          WHERE w.account_id = x.account_id AND w.id <> x.id AND w.published_at < x.published_at
          ORDER BY w.published_at DESC, w.id DESC
          LIMIT k
        ) b
      ) base ON true
      LEFT JOIN LATERAL (
        SELECT m.captured_at, m.hours_since_publish, m.views, m.reach, m.likes, m.comments,
          m.shares, m.saves, m.avg_watch_time_s, m.completion_rate
        FROM public.metric_snapshots m
        WHERE m.post_id = x.id
        ORDER BY m.captured_at DESC
        LIMIT 1
      ) last ON true
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.post_performance(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_performance(text, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.valid_report_actions(text[]), public.valid_analytics_settings(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valid_report_actions(text[]), public.valid_analytics_settings(jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.post_performance(text, integer, integer) IS
  'Performans takibi (#24/#25): son N post + aynı hesabın önceki son k postunun 24 sa medyanı.';
