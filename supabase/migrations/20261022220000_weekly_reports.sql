-- Haftalık rapor ve dışa aktarma (#62).
--
-- reports           Kaydedilmiş dönem raporu. influencer_id NULL = tüm influencer'lar.
--                   (influencer_id, period_start) benzersiz; NULL da tek kayıt sayılır
--                   (NULLS NOT DISTINCT, ayrı kısmi indekse gerek kalmaz).
-- report_summary()  Rapordaki bütün sayılar ve dönemin öğrenim notları burada hesaplanır. Panel ve otomatik rapor
--                   aynı fonksiyonu kullanır; AI özeti yalnız bu çıktıyı yorumlar.
-- generate_weekly_report()   Tek tıkla rapor (editor/owner, RLS geçerli).
-- generate_weekly_reports()  Pazartesi sabahı pg_cron işi: geçen haftanın raporlarını
--                   tekrarsız oluşturur ve her yeni rapor için alerts'e kayıt yazar.
--
-- Saat dilimi: Hafta pazartesi 00:00 – pazar 23:59:59 (Europe/Istanbul). Tarih aralığı
-- [p_from 00:00, p_to + 1 gün 00:00) Türkiye saatinde alınıp UTC'ye çevrilir. Maliyetler
-- `incurred_on` (date) ile filtrelenir, dönüşüm gerekmez.
--
-- Tüm fonksiyonlar SECURITY INVOKER. Panelden çağrıldığında kullanıcının RLS'i geçerli;
-- ekip dışı kullanıcı hiçbir satır göremez. pg_cron işi migration sahibi (postgres) olarak
-- çalışır; tablo sahibi olduğu için RLS'e takılmaz, auth.uid() NULL olduğundan created_by boş kalır.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary jsonb NOT NULL CHECK (jsonb_typeof(summary) = 'object'),
  ai_summary text CHECK (ai_summary IS NULL OR length(ai_summary) <= 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Şimdilik yalnız haftalık rapor saklanır: pazartesi başlar, pazar biter.
  CONSTRAINT reports_weekly_period CHECK (
    extract(isodow FROM period_start) = 1 AND period_end = period_start + 6
  ),
  CONSTRAINT reports_influencer_period_key UNIQUE NULLS NOT DISTINCT (influencer_id, period_start)
);
CREATE INDEX reports_period_start_idx ON public.reports (period_start DESC);

CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER reports_set_created_by
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_team_read ON public.reports
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY reports_team_write ON public.reports
  FOR ALL TO authenticated
  USING (public.can_write_data())
  WITH CHECK (public.can_write_data());

REVOKE ALL ON public.reports FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;

COMMENT ON TABLE public.reports IS 'Kaydedilmiş haftalık rapor. summary sayıları report_summary() çıktısıdır; ai_summary yalnız bu sayıları yorumlar.';

-- Dönem özeti (jsonb). İzlenme ve etkileşim kümülatif sayaçtır: post başına
-- "dönem sonundaki son ölçüm - dönem başındaki son ölçüm" alınır. Dönem içinde
-- yayınlanan postun başlangıç değeri 0'dır. Dönemden önce yayınlanıp başlangıç
-- ölçümü olmayan post toplama katılmaz (uydurma artış olmasın), sayısı ayrıca döner.
-- Takipçi değişimi yalnız başlangıç ve bitiş ölçümü olan hesaplardan hesaplanır.
-- p_influencer_id verilip influencer görünmüyorsa (ekip dışı / yok) NULL döner.
CREATE FUNCTION public.report_summary(
  p_from date,
  p_to date,
  p_influencer_id uuid DEFAULT NULL,
  p_currency char(3) DEFAULT 'USD'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH period AS (
    SELECT
      (p_from::timestamp AT TIME ZONE 'Europe/Istanbul') AS start_at,
      ((p_to + 1)::timestamp AT TIME ZONE 'Europe/Istanbul') AS end_at,
      ((p_to + 1 + (p_to - p_from + 1))::timestamp AT TIME ZONE 'Europe/Istanbul') AS next_end_at
  ),
  accounts AS (
    SELECT sa.id, sa.platform, sa.handle
    FROM public.social_accounts sa
    WHERE p_influencer_id IS NULL OR sa.influencer_id = p_influencer_id
  ),
  follower_values AS (
    SELECT a.id, last_value.followers AS latest, first_value.followers AS baseline
    FROM accounts a
    CROSS JOIN period
    LEFT JOIN LATERAL (
      SELECT s.followers FROM public.account_snapshots s
      WHERE s.account_id = a.id AND s.captured_at < period.end_at
      ORDER BY s.captured_at DESC LIMIT 1
    ) last_value ON true
    LEFT JOIN LATERAL (
      SELECT s.followers FROM public.account_snapshots s
      WHERE s.account_id = a.id AND s.captured_at <= period.start_at
      ORDER BY s.captured_at DESC LIMIT 1
    ) first_value ON true
  ),
  post_values AS (
    SELECT
      p.id, p.caption, p.url, p.published_at, a.platform, a.handle,
      p.published_at >= period.start_at AND p.published_at < period.end_at AS in_period,
      last_value.views AS latest_views,
      last_value.likes + last_value.comments + last_value.shares + last_value.saves AS latest_engagement,
      CASE WHEN p.published_at >= period.start_at THEN 0 ELSE first_value.views END AS baseline_views,
      CASE WHEN p.published_at >= period.start_at THEN 0
        ELSE first_value.likes + first_value.comments + first_value.shares + first_value.saves END AS baseline_engagement
    FROM public.posts p
    JOIN accounts a ON a.id = p.account_id
    CROSS JOIN period
    LEFT JOIN LATERAL (
      SELECT m.views, m.likes, m.comments, m.shares, m.saves FROM public.metric_snapshots m
      WHERE m.post_id = p.id AND m.captured_at < period.end_at
      ORDER BY m.captured_at DESC LIMIT 1
    ) last_value ON true
    LEFT JOIN LATERAL (
      SELECT m.views, m.likes, m.comments, m.shares, m.saves FROM public.metric_snapshots m
      WHERE m.post_id = p.id AND m.captured_at <= period.start_at
      ORDER BY m.captured_at DESC LIMIT 1
    ) first_value ON true
    WHERE p.published_at IS NOT NULL AND p.published_at < period.end_at
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE in_period)::integer AS posts_published,
      COALESCE(sum(GREATEST(0, latest_views - baseline_views))
        FILTER (WHERE latest_views IS NOT NULL AND baseline_views IS NOT NULL), 0)::bigint AS views,
      COALESCE(sum(GREATEST(0, latest_engagement - baseline_engagement))
        FILTER (WHERE latest_engagement IS NOT NULL AND baseline_engagement IS NOT NULL), 0)::bigint AS engagement,
      count(*) FILTER (WHERE latest_views IS NOT NULL AND baseline_views IS NULL)::integer AS posts_without_baseline
    FROM post_values
  ),
  ranked AS (
    SELECT
      pv.*,
      row_number() OVER (ORDER BY COALESCE(pv.latest_views, 0) DESC, pv.published_at, pv.id) AS rank_desc
    FROM post_values pv
    WHERE pv.in_period
  ),
  money AS (
    SELECT
      count(*)::integer AS entry_count,
      count(*) FILTER (WHERE e.converted_amount IS NULL)::integer AS missing,
      COALESCE(sum(e.converted_amount), 0) AS total
    FROM public.cost_entries_converted(p_from, p_to, p_currency, p_influencer_id) e
  ),
  learning_items AS (
    SELECT l.id, l.body, l.tags, l.post_id, l.created_at
    FROM public.learnings l
    CROSS JOIN period
    WHERE (p_influencer_id IS NULL OR l.influencer_id = p_influencer_id)
      AND l.created_at >= period.start_at
      AND l.created_at < period.end_at
  ),
  next_items AS (
    SELECT c.id, c.title, c.stage, c.scheduled_at
    FROM public.content_items c
    CROSS JOIN period
    WHERE (p_influencer_id IS NULL OR c.influencer_id = p_influencer_id)
      AND c.stage <> 'published'
      AND c.scheduled_at >= period.end_at
      AND c.scheduled_at < period.next_end_at
  )
  SELECT jsonb_build_object(
    'version', 1,
    'timezone', 'Europe/Istanbul',
    'periodStart', p_from,
    'periodEnd', p_to,
    'currency', p_currency,
    'followers', (
      SELECT jsonb_build_object(
        'accounts', count(*),
        'accountsWithBaseline', count(*) FILTER (WHERE latest IS NOT NULL AND baseline IS NOT NULL),
        'start', sum(baseline) FILTER (WHERE latest IS NOT NULL AND baseline IS NOT NULL),
        'end', sum(latest),
        'delta', sum(latest - baseline) FILTER (WHERE latest IS NOT NULL AND baseline IS NOT NULL)
      )
      FROM follower_values
    ),
    'postsPublished', t.posts_published,
    'views', t.views,
    'engagement', t.engagement,
    'engagementRate', CASE WHEN t.views > 0 THEN round(t.engagement::numeric / t.views, 4) END,
    'postsWithoutBaseline', t.posts_without_baseline,
    'cost', jsonb_build_object(
      'entryCount', m.entry_count,
      'missingRateCount', m.missing,
      'total', CASE WHEN m.missing = 0 THEN round(m.total, 4) END,
      'perVideo', CASE WHEN m.missing = 0 AND t.posts_published > 0
        THEN round(m.total / t.posts_published, 4) END
    ),
    'topPosts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'postId', r.id, 'platform', r.platform, 'handle', r.handle,
        'caption', left(r.caption, 280), 'url', r.url, 'publishedAt', r.published_at,
        'views', r.latest_views, 'engagement', r.latest_engagement
      ) ORDER BY r.rank_desc)
      FROM ranked r WHERE r.rank_desc <= 3
    ), '[]'::jsonb),
    -- En düşük 3 post; en iyiler listesinde olanlar tekrar gösterilmez.
    'bottomPosts', COALESCE((
      SELECT jsonb_agg(x.item ORDER BY x.rank_desc DESC)
      FROM (
        SELECT r.rank_desc, jsonb_build_object(
          'postId', r.id, 'platform', r.platform, 'handle', r.handle,
          'caption', left(r.caption, 280), 'url', r.url, 'publishedAt', r.published_at,
          'views', r.latest_views, 'engagement', r.latest_engagement
        ) AS item
        FROM ranked r WHERE r.rank_desc > 3
        ORDER BY r.rank_desc DESC LIMIT 3
      ) x
    ), '[]'::jsonb),
    -- Dönem içinde yazılan öğrenim notları (#55 learnings), en yeni 10 tanesi.
    'learnings', jsonb_build_object(
      'count', (SELECT count(*) FROM learning_items),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', x.id, 'body', left(x.body, 500), 'tags', to_jsonb(x.tags),
          'postId', x.post_id, 'createdAt', x.created_at
        ) ORDER BY x.created_at DESC, x.id)
        FROM (SELECT * FROM learning_items ORDER BY created_at DESC, id LIMIT 10) x
      ), '[]'::jsonb)
    ),
    'nextPeriod', jsonb_build_object(
      'scheduledCount', (SELECT count(*) FROM next_items),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', n.id, 'title', n.title, 'stage', n.stage, 'scheduledAt', n.scheduled_at
        ) ORDER BY n.scheduled_at, n.id)
        FROM (SELECT * FROM next_items ORDER BY scheduled_at, id LIMIT 10) n
      ), '[]'::jsonb)
    )
  )
  FROM totals t, money m
  WHERE p_from IS NOT NULL AND p_to IS NOT NULL AND p_to >= p_from
    AND (p_influencer_id IS NULL OR EXISTS (
      SELECT 1 FROM public.influencers i WHERE i.id = p_influencer_id
    ));
$$;

-- Tek tıkla haftalık rapor. Aynı hafta için tekrar çağrılırsa rapor güncellenir
-- (sayılar değiştiyse eski AI özeti silinir, eski sayıları yorumluyordu).
CREATE FUNCTION public.generate_weekly_report(
  p_period_start date,
  p_influencer_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_summary jsonb;
  v_id uuid;
  v_this_week date := date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
  IF p_period_start IS NULL OR extract(isodow FROM p_period_start) <> 1 THEN
    RAISE EXCEPTION 'period_start must be a Monday' USING ERRCODE = '22023';
  END IF;
  IF p_period_start > v_this_week THEN
    RAISE EXCEPTION 'period_start is in the future' USING ERRCODE = '22023';
  END IF;

  v_summary := public.report_summary(p_period_start, p_period_start + 6, p_influencer_id);
  IF v_summary IS NULL THEN
    RAISE EXCEPTION 'influencer not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.reports AS r (influencer_id, period_start, period_end, summary)
  VALUES (p_influencer_id, p_period_start, p_period_start + 6, v_summary)
  ON CONFLICT (influencer_id, period_start) DO UPDATE
    SET summary = EXCLUDED.summary,
        ai_summary = CASE WHEN r.summary = EXCLUDED.summary THEN r.ai_summary END
  RETURNING r.id INTO v_id;
  RETURN v_id;
END;
$$;

-- Otomatik rapor (pg_cron). Varsayılan dönem: Türkiye saatine göre geçen hafta.
-- Tüm influencer'lar (NULL) + aktif/duraklatılmış her influencer için rapor açar.
-- Var olan rapora dokunmaz (idempotent); yalnız yeni raporlar için bildirim yazar.
-- Dönen değer: yeni oluşturulan rapor sayısı.
CREATE FUNCTION public.generate_weekly_reports(p_period_start date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_start date := COALESCE(
    p_period_start,
    date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul')::date - 7
  );
  v_created integer;
BEGIN
  IF extract(isodow FROM v_start) <> 1 THEN
    RAISE EXCEPTION 'period_start must be a Monday' USING ERRCODE = '22023';
  END IF;

  WITH targets AS (
    SELECT NULL::uuid AS influencer_id
    UNION ALL
    SELECT i.id FROM public.influencers i WHERE i.status IN ('active', 'paused')
  ),
  created AS (
    INSERT INTO public.reports (influencer_id, period_start, period_end, summary)
    SELECT t.influencer_id, v_start, v_start + 6,
      public.report_summary(v_start, v_start + 6, t.influencer_id)
    FROM targets t
    ON CONFLICT (influencer_id, period_start) DO NOTHING
    RETURNING id, influencer_id, period_start
  ),
  notified AS (
    INSERT INTO public.alerts (influencer_id, type, payload)
    SELECT c.influencer_id, 'weekly_report_ready',
      jsonb_build_object('report_id', c.id::text, 'period_start', c.period_start::text)
    FROM created c
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_created FROM created;
  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.report_summary(date, date, uuid, char) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_summary(date, date, uuid, char) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_weekly_report(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_weekly_report(date, uuid) TO authenticated;
-- Toplu üretim yalnız zamanlanmış iş içindir; panel kullanıcıları çağıramaz.
REVOKE ALL ON FUNCTION public.generate_weekly_reports(date) FROM PUBLIC, anon, authenticated;

-- Pazartesi 09:00 Türkiye = 06:00 UTC (pg_cron UTC çalışır; Türkiye'de yaz saati yok).
-- cron.schedule aynı isimle tekrar çağrılırsa işi günceller.
SELECT cron.schedule('weekly-reports', '0 6 * * 1', 'SELECT public.generate_weekly_reports()');
