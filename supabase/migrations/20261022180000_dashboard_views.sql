-- Dashboard aggregates stay inside SQL: PostgREST's 1000-row cap must not affect totals.
CREATE FUNCTION public.dashboard_overview(
  p_from date, p_to date, p_influencer_slug text DEFAULT NULL,
  p_platform public.social_platform DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 365 THEN
    RAISE EXCEPTION 'Invalid dashboard period' USING ERRCODE = '22023';
  END IF;
  WITH bounds AS (
    SELECT p_from::timestamp AT TIME ZONE 'UTC' AS start_at,
      (p_to + 1)::timestamp AT TIME ZONE 'UTC' AS end_at,
      (now() AT TIME ZONE 'Europe/Istanbul')::date AS today
  ), selected AS MATERIALIZED (
    SELECT id, slug, name FROM public.influencers
    WHERE p_influencer_slug IS NULL OR slug = p_influencer_slug
  ), accounts AS MATERIALIZED (
    SELECT a.id, a.platform FROM public.social_accounts a JOIN selected i ON i.id = a.influencer_id
    WHERE p_platform IS NULL OR a.platform = p_platform
  ), selected_posts AS MATERIALIZED (
    SELECT p.id, p.content_item_id, p.caption, p.published_at, a.platform
    FROM public.posts p JOIN accounts a ON a.id = p.account_id CROSS JOIN bounds b
    WHERE p.published_at < b.end_at
  ), followers AS (
    SELECT a.id, a.platform, latest.followers, baseline.followers AS baseline
    FROM accounts a CROSS JOIN bounds b
    LEFT JOIN LATERAL (SELECT s.followers FROM public.account_snapshots s WHERE s.account_id = a.id
      AND s.captured_at < b.end_at ORDER BY s.captured_at DESC LIMIT 1) latest ON true
    LEFT JOIN LATERAL (SELECT s.followers FROM public.account_snapshots s WHERE s.account_id = a.id
      AND s.captured_at <= b.start_at ORDER BY s.captured_at DESC LIMIT 1) baseline ON true
  ), latest_posts AS MATERIALIZED (
    SELECT p.*, m.views, m.likes + m.comments + m.shares + m.saves AS interactions,
      m.captured_at, target.views AS views24
    FROM selected_posts p CROSS JOIN bounds b
    LEFT JOIN LATERAL (SELECT m.* FROM public.metric_snapshots m WHERE m.post_id = p.id
      AND m.captured_at < b.end_at ORDER BY m.captured_at DESC LIMIT 1) m ON true
    -- Until #53 adds target_hours: first measured snapshot in the explicit 24–30 h window.
    LEFT JOIN LATERAL (SELECT m.views FROM public.metric_snapshots m WHERE m.post_id = p.id
      AND m.hours_since_publish BETWEEN 24 AND 30 AND m.captured_at < b.end_at
      ORDER BY m.hours_since_publish, m.captured_at LIMIT 1) target ON true
  ), observations AS (
    -- One baseline + one last observation per UTC day. Old posts without a baseline
    -- start contributing only after their first observation (never assume zero).
    SELECT p.id, p_from - 1 AS day,
      CASE WHEN p.published_at >= b.start_at THEN 0::numeric ELSE m.views END AS views
    FROM selected_posts p CROSS JOIN bounds b
    LEFT JOIN LATERAL (SELECT m.views FROM public.metric_snapshots m WHERE m.post_id = p.id
      AND m.captured_at <= b.start_at ORDER BY m.captured_at DESC LIMIT 1) m ON true
    UNION ALL
    SELECT observed.post_id, observed.day, observed.views FROM (
      SELECT DISTINCT ON (m.post_id, (m.captured_at AT TIME ZONE 'UTC')::date)
        m.post_id, (m.captured_at AT TIME ZONE 'UTC')::date AS day, m.views
      FROM public.metric_snapshots m JOIN selected_posts p ON p.id = m.post_id CROSS JOIN bounds b
      WHERE m.captured_at > b.start_at AND m.captured_at < b.end_at
      ORDER BY m.post_id, (m.captured_at AT TIME ZONE 'UTC')::date, m.captured_at DESC
    ) observed
  ), deltas AS (
    SELECT id, day, views - lag(views) OVER (PARTITION BY id ORDER BY day) AS delta FROM observations
  ), daily_views AS (
    SELECT day, sum(greatest(0,delta)) FILTER (WHERE delta IS NOT NULL) AS views,
      count(*) FILTER (WHERE delta IS NOT NULL) AS measured
    FROM deltas WHERE day >= p_from GROUP BY day
  ), daily AS (
    SELECT d.day::date AS day, v.views, coalesce(v.measured,0) AS measured,
      engagement.views AS engagement_views, engagement.interactions,
      coalesce(f.values,'[]'::jsonb) AS followers
    FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)
    LEFT JOIN daily_views v ON v.day = d.day::date
    LEFT JOIN LATERAL (
      SELECT sum(m.views) AS views, sum(m.likes+m.comments+m.shares+m.saves) AS interactions
      FROM selected_posts p JOIN LATERAL (SELECT m.* FROM public.metric_snapshots m
        WHERE m.post_id = p.id AND m.captured_at >= d.day AT TIME ZONE 'UTC'
          AND m.captured_at < (d.day + interval '1 day') AT TIME ZONE 'UTC'
        ORDER BY m.captured_at DESC LIMIT 1) m ON true
    ) engagement ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('platform',platform,'value',value) ORDER BY platform) AS values
      FROM (SELECT a.platform, CASE WHEN count(*)=count(s.followers) THEN sum(s.followers) END AS value
        FROM accounts a LEFT JOIN LATERAL (SELECT s.followers FROM public.account_snapshots s
          WHERE s.account_id=a.id AND s.captured_at < (d.day+interval '1 day') AT TIME ZONE 'UTC'
          ORDER BY s.captured_at DESC LIMIT 1) s ON true GROUP BY a.platform) platform_values
    ) f ON true
  ), cohort AS MATERIALIZED (
    SELECT p.* FROM latest_posts p CROSS JOIN bounds b WHERE p.published_at >= b.start_at
  ), ranked AS (
    SELECT jsonb_build_object('id',id,'caption',left(caption,120),'platform',platform,'views',views24) AS value,
      views24, id FROM cohort WHERE views24 IS NOT NULL
  ), costs AS (
    SELECT c.currency, sum(c.amount)::text AS total,
      (sum(c.amount) / nullif((SELECT count(*) FROM cohort),0))::numeric(20,4)::text AS per_video
    FROM public.costs c JOIN selected i ON i.id=c.influencer_id
    WHERE c.incurred_on BETWEEN p_from AND p_to AND p_platform IS NULL GROUP BY c.currency
  ), content AS MATERIALIZED (
    SELECT c.id,c.title,c.stage,c.scheduled_at,i.slug FROM public.content_items c JOIN selected i ON i.id=c.influencer_id
    LEFT JOIN public.social_accounts a ON a.id=c.target_account_id
    WHERE (p_platform IS NULL OR a.platform=p_platform) AND c.stage <> 'published'
  ), planned AS (
    SELECT c.* FROM content c CROSS JOIN bounds b
    WHERE c.scheduled_at >= b.today::timestamp AT TIME ZONE 'Europe/Istanbul'
      AND c.scheduled_at < (b.today+1)::timestamp AT TIME ZONE 'Europe/Istanbul'
    ORDER BY c.scheduled_at,c.id LIMIT 10
  ), pending AS (
    SELECT * FROM content ORDER BY scheduled_at NULLS LAST,id LIMIT 10
  ), comparisons AS (
    SELECT c.content_item_id, min(ci.title) AS title,
      jsonb_agg(jsonb_build_object('platform',c.platform,'views',c.views,'postId',c.id) ORDER BY c.platform,c.id) AS posts
    FROM cohort c JOIN public.content_items ci ON ci.id=c.content_item_id
    GROUP BY c.content_item_id HAVING count(DISTINCT c.platform)>1
    ORDER BY c.content_item_id LIMIT 50
  )
  SELECT jsonb_build_object(
    'validInfluencer',p_influencer_slug IS NULL OR EXISTS(SELECT 1 FROM selected),
    'accounts',(SELECT count(*) FROM accounts),
    'followers',(SELECT CASE WHEN count(*)=count(followers) AND count(*)>0 THEN sum(followers) END FROM followers),
    'followerChange',(SELECT CASE WHEN count(*)=count(followers) AND count(*)=count(baseline) AND count(*)>0 THEN sum(followers-baseline) END FROM followers),
    'accountsMeasured',(SELECT count(followers) FROM followers),
    'views',(SELECT sum(views) FROM daily_views),
    'measuredPostDays',(SELECT coalesce(sum(measured),0) FROM daily_views),
    'postsWithoutBaseline',(SELECT count(*) FROM selected_posts p CROSS JOIN bounds b WHERE p.published_at < b.start_at
      AND NOT EXISTS(SELECT 1 FROM public.metric_snapshots m WHERE m.post_id=p.id AND m.captured_at<=b.start_at)),
    'published',(SELECT count(*) FROM cohort),
    'engagementViews',(SELECT sum(views) FROM cohort),
    'interactions',(SELECT sum(interactions) FROM cohort),
    'postsMeasured',(SELECT count(views) FROM cohort),
    'costs',coalesce((SELECT jsonb_agg(jsonb_build_object('currency',currency,'total',total,'perVideo',per_video) ORDER BY currency) FROM costs),'[]'::jsonb),
    'daily',coalesce((SELECT jsonb_agg(to_jsonb(daily) ORDER BY day) FROM daily),'[]'::jsonb),
    'best',coalesce((SELECT jsonb_agg(value ORDER BY views24 DESC,id) FROM (SELECT * FROM ranked ORDER BY views24 DESC,id LIMIT 5) r),'[]'::jsonb),
    'worst',coalesce((SELECT jsonb_agg(value ORDER BY views24,id) FROM (SELECT * FROM ranked ORDER BY views24,id LIMIT 5) r),'[]'::jsonb),
    'today',coalesce((SELECT jsonb_agg(to_jsonb(planned) ORDER BY scheduled_at,id) FROM planned),'[]'::jsonb),
    'todayCount',(SELECT count(*) FROM content c CROSS JOIN bounds b WHERE (c.scheduled_at AT TIME ZONE 'Europe/Istanbul')::date=b.today),
    'pending',coalesce((SELECT jsonb_agg(to_jsonb(pending) ORDER BY scheduled_at NULLS LAST,id) FROM pending),'[]'::jsonb),
    'pendingCount',(SELECT count(*) FROM content),
    'comparisons',coalesce((SELECT jsonb_agg(to_jsonb(comparisons) ORDER BY content_item_id) FROM comparisons),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.dashboard_overview(date,date,text,public.social_platform) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_overview(date,date,text,public.social_platform) TO authenticated;
