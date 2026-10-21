-- #48: model/fiyat ayarları ve satır sınırına takılmayan haftalık özet.
CREATE TABLE public.app_settings (
  key text PRIMARY KEY CHECK (key = 'ai'),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_team_read ON public.app_settings FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY app_settings_owner_write ON public.app_settings FOR ALL TO authenticated
  USING (public.current_team_role() = 'owner') WITH CHECK (public.current_team_role() = 'owner');
CREATE TRIGGER app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_settings_creator BEFORE INSERT OR UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

CREATE FUNCTION public.ai_weekly_summary(p_influencer_id uuid, p_as_of timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
WITH period AS (SELECT p_as_of - interval '7 days' AS start_at, p_as_of AS end_at),
accounts AS (SELECT a.id FROM public.social_accounts a WHERE a.influencer_id = p_influencer_id),
post_values AS (
 SELECT p.id, p.published_at, last_value.captured_at AS latest_captured_at, last_value.views AS latest, CASE WHEN p.published_at >= period.start_at THEN 0 ELSE first_value.views END AS baseline
 FROM public.posts p JOIN accounts a ON a.id = p.account_id CROSS JOIN period
 LEFT JOIN LATERAL (SELECT m.views, m.captured_at FROM public.metric_snapshots m WHERE m.post_id = p.id
   AND m.captured_at <= period.end_at ORDER BY m.captured_at DESC LIMIT 1) last_value ON true
 LEFT JOIN LATERAL (SELECT m.views, m.captured_at FROM public.metric_snapshots m WHERE m.post_id = p.id
   AND m.captured_at <= period.start_at ORDER BY m.captured_at DESC LIMIT 1) first_value ON true
 WHERE p.published_at <= period.end_at
), follower_values AS (
 SELECT a.id, last_value.captured_at AS latest_captured_at, last_value.followers AS latest, first_value.followers AS baseline
 FROM accounts a CROSS JOIN period
 LEFT JOIN LATERAL (SELECT s.followers, s.captured_at FROM public.account_snapshots s WHERE s.account_id = a.id
   AND s.captured_at <= period.end_at ORDER BY s.captured_at DESC LIMIT 1) last_value ON true
 LEFT JOIN LATERAL (SELECT s.followers, s.captured_at FROM public.account_snapshots s WHERE s.account_id = a.id
   AND s.captured_at <= period.start_at ORDER BY s.captured_at DESC LIMIT 1) first_value ON true
)
SELECT jsonb_build_object(
 'from',period.start_at,'to',period.end_at,
 'postsPublished',(SELECT count(*) FROM post_values WHERE published_at >= period.start_at AND published_at < period.end_at),
 'observedViewIncrease',(SELECT coalesce(sum(greatest(0,latest-baseline)) FILTER (WHERE baseline IS NOT NULL),0) FROM post_values),
 'postsWithViewBaseline',(SELECT count(*) FROM post_values WHERE baseline IS NOT NULL AND latest IS NOT NULL),
 'postsWithRecentSnapshot',(SELECT count(*) FROM post_values WHERE latest_captured_at > period.start_at),
 'accountsWithRecentSnapshot',(SELECT count(*) FROM follower_values WHERE latest_captured_at > period.start_at),
 'postsWithLatestViews',(SELECT count(*) FROM post_values WHERE latest IS NOT NULL),
 'latestFollowers',(SELECT sum(latest) FROM follower_values),
 'followerChange',(SELECT CASE WHEN count(*) = count(baseline) AND count(*) = count(latest) AND count(*) > 0
   THEN sum(latest-baseline) ELSE NULL END FROM follower_values),
 'accountsWithBaseline',(SELECT count(*) FROM follower_values WHERE baseline IS NOT NULL AND latest IS NOT NULL),
 'accounts',(SELECT count(*) FROM accounts)
) FROM period WHERE EXISTS (SELECT 1 FROM public.influencers WHERE id = p_influencer_id);
$$;
REVOKE ALL ON FUNCTION public.ai_weekly_summary(uuid,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_weekly_summary(uuid,timestamptz) TO authenticated;
