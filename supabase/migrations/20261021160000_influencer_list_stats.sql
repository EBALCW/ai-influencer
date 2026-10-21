-- Influencer listesi ve detay sayfası için özet metrikler (#42).
--
-- Neden SQL'de: Panel bu değerleri daha önce tüm snapshot satırlarını çekip
-- JS'te topluyordu. PostgREST `max_rows` (1000) sınırı yüzünden veri büyüdükçe
-- sonuç sessizce eksik çıkardı. Toplama artık veritabanında yapılır ve
-- influencer başına tek satır döner.
--
-- SECURITY INVOKER: Çağıranın RLS'i uygulanır. Ekip dışı kullanıcı hiçbir satır görmez.
--
-- views_7d: metric_snapshots.views kümülatif bir sayaçtır. Her post için
-- "en son değer - p_since anındaki (veya öncesindeki) son değer" hesaplanır.
-- p_since öncesinde snapshot yoksa (yeni post) en son değerin tamamı sayılır.
-- Sayaç sıfırlanırsa negatif fark 0 kabul edilir.

CREATE FUNCTION public.influencer_list_stats(
  p_influencer_ids uuid[] DEFAULT NULL,
  p_since timestamptz DEFAULT now() - interval '7 days'
)
RETURNS TABLE (
  influencer_id uuid,
  platforms text[],
  followers bigint,
  views_7d bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH inf AS (
    SELECT i.id
    FROM public.influencers i
    WHERE p_influencer_ids IS NULL OR i.id = ANY (p_influencer_ids)
  ),
  acc AS (
    SELECT sa.id, sa.influencer_id, sa.platform
    FROM public.social_accounts sa
    JOIN inf ON inf.id = sa.influencer_id
  ),
  latest_followers AS (
    SELECT DISTINCT ON (s.account_id) s.account_id, s.followers
    FROM public.account_snapshots s
    JOIN acc ON acc.id = s.account_id
    ORDER BY s.account_id, s.captured_at DESC
  ),
  post_views AS (
    SELECT
      acc.influencer_id,
      GREATEST(0, latest.views - COALESCE(baseline.views, 0)) AS gained
    FROM public.posts p
    JOIN acc ON acc.id = p.account_id
    CROSS JOIN LATERAL (
      SELECT m.views
      FROM public.metric_snapshots m
      WHERE m.post_id = p.id
      ORDER BY m.captured_at DESC
      LIMIT 1
    ) latest
    LEFT JOIN LATERAL (
      SELECT m.views
      FROM public.metric_snapshots m
      WHERE m.post_id = p.id AND m.captured_at <= p_since
      ORDER BY m.captured_at DESC
      LIMIT 1
    ) baseline ON true
  )
  SELECT
    inf.id,
    COALESCE(
      (SELECT array_agg(DISTINCT acc.platform::text ORDER BY acc.platform::text)
       FROM acc WHERE acc.influencer_id = inf.id),
      ARRAY[]::text[]
    ),
    COALESCE(
      (SELECT sum(lf.followers)
       FROM latest_followers lf
       JOIN acc ON acc.id = lf.account_id
       WHERE acc.influencer_id = inf.id),
      0
    )::bigint,
    COALESCE(
      (SELECT sum(pv.gained) FROM post_views pv WHERE pv.influencer_id = inf.id),
      0
    )::bigint
  FROM inf;
$$;

REVOKE ALL ON FUNCTION public.influencer_list_stats(uuid[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.influencer_list_stats(uuid[], timestamptz) TO authenticated;
