-- Kredi ve maliyet takibi (#59).
--
-- Tablolar:
--   budgets        Aylık bütçe tavanı. influencer_id NULL = tüm ekip toplamı.
--   exchange_rates Para birimi kuru: 1 <currency> = rate <base_currency>, valid_on gününden itibaren.
--   credit_rates   Sağlayıcı kredisinin para karşılığı: 1 kredi = rate_per_credit <currency>.
--
-- Yazma yetkisi: costs (mevcut tablo) editor+; budgets / exchange_rates / credit_rates
-- sadece owner (ayar niteliğinde, rapor sonuçlarını değiştirir).
--
-- Para: her yerde numeric. Farklı para birimleri dönüşüm yapılmadan TOPLANMAZ;
-- kuru bulunamayan kayıt sayılır ve toplam NULL döner (panel "eksik kur" uyarısı gösterir).
--
-- Bütçe uyarıları: costs veya budgets değişince trigger, eşiği geçen bütçe için
-- alerts'e bir kez (ay + bütçe + seviye başına) kayıt yazar. Uyarıyı tarayıcı üretmez.

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  month date NOT NULL CHECK (month = date_trunc('month', month)::date),
  amount numeric(14, 4) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  warn_ratio numeric(4, 3) NOT NULL DEFAULT 0.8 CHECK (warn_ratio > 0 AND warn_ratio <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
-- (influencer_id, month) benzersiz; NULL influencer (toplam bütçe) için ayrı kısmi indeks
CREATE UNIQUE INDEX budgets_influencer_month_idx
  ON public.budgets (influencer_id, month) WHERE influencer_id IS NOT NULL;
CREATE UNIQUE INDEX budgets_total_month_idx
  ON public.budgets (month) WHERE influencer_id IS NULL;

CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  base_currency char(3) NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  rate numeric(20, 8) NOT NULL CHECK (rate > 0),
  valid_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CHECK (currency <> base_currency),
  UNIQUE (currency, base_currency, valid_on)
);

CREATE TABLE public.credit_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool text NOT NULL CHECK (length(trim(tool)) > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  rate_per_credit numeric(20, 8) NOT NULL CHECK (rate_per_credit >= 0),
  valid_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  UNIQUE (tool, valid_from)
);

CREATE INDEX costs_incurred_on_idx ON public.costs (incurred_on);
CREATE INDEX costs_generation_id_idx ON public.costs (generation_id) WHERE generation_id IS NOT NULL;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['budgets', 'exchange_rates', 'credit_rates'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_created_by()',
      table_name || '_set_created_by', table_name
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_team_member())',
      table_name || '_team_read', table_name
    );
    -- Ayar tabloları: sadece owner yazar
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_manage_team()) WITH CHECK (public.can_manage_team())',
      table_name || '_owner_write', table_name
    );
  END LOOP;
END;
$$;

REVOKE ALL ON public.budgets, public.exchange_rates, public.credit_rates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets, public.exchange_rates, public.credit_rates TO authenticated;

-- 1 p_from = ? p_to. Aynı para birimi 1; doğrudan kur yoksa ters kur; o da yoksa NULL.
-- p_on gününde veya öncesinde geçerli en yeni kur kullanılır.
CREATE FUNCTION public.fx_rate(p_from char(3), p_to char(3), p_on date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_from = p_to THEN 1::numeric
    ELSE COALESCE(
      (SELECT r.rate FROM public.exchange_rates r
       WHERE r.currency = p_from AND r.base_currency = p_to AND r.valid_on <= p_on
       ORDER BY r.valid_on DESC LIMIT 1),
      (SELECT 1 / r.rate FROM public.exchange_rates r
       WHERE r.currency = p_to AND r.base_currency = p_from AND r.valid_on <= p_on
       ORDER BY r.valid_on DESC LIMIT 1)
    )
  END
$$;

-- Kredi miktarının para karşılığı (sağlayıcının o gün geçerli kredi fiyatıyla).
-- Kredi fiyatı yoksa NULL. Üretim kayıtları (#47) costs'a yazarken bunu kullanır.
CREATE FUNCTION public.credits_to_money(p_tool text, p_credits numeric, p_on date)
RETURNS TABLE (amount numeric, currency char(3))
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT round(p_credits * cr.rate_per_credit, 4), cr.currency
  FROM public.credit_rates cr
  WHERE cr.tool = p_tool AND cr.valid_from <= p_on
  ORDER BY cr.valid_from DESC
  LIMIT 1
$$;

-- Dönemdeki maliyet kayıtları, hedef para birimine çevrilmiş halde.
-- converted_amount NULL = o gün için kur yok.
CREATE FUNCTION public.cost_entries_converted(
  p_from date,
  p_to date,
  p_currency char(3),
  p_influencer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  influencer_id uuid,
  category public.cost_category,
  incurred_on date,
  amount numeric,
  currency char(3),
  generation_id uuid,
  converted_amount numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    c.id, c.influencer_id, c.category, c.incurred_on, c.amount, c.currency, c.generation_id,
    round(c.amount * public.fx_rate(c.currency, p_currency, c.incurred_on), 4)
  FROM public.costs c
  WHERE c.incurred_on BETWEEN p_from AND p_to
    AND (p_influencer_id IS NULL OR c.influencer_id = p_influencer_id)
$$;

-- Dönem özeti. Kuru eksik kayıt varsa para toplamları NULL döner (yanlış toplam göstermemek için).
--   video_count       : dönemde yayınlanan post sayısı
--   views             : bu postların en son izlenme sayılarının toplamı
--   failed_*          : dönemde oluşturulan ve 'failed' biten üretimler; başarısız üretimin
--                       kredisi de harcanmıştır, toplam maliyete dahildir ve ayrıca raporlanır
CREATE FUNCTION public.cost_summary(
  p_from date,
  p_to date,
  p_currency char(3),
  p_influencer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total numeric,
  entry_count integer,
  missing_rate_count integer,
  video_count integer,
  views bigint,
  cost_per_video numeric,
  cost_per_1000_views numeric,
  generation_count integer,
  failed_generation_count integer,
  failed_ratio numeric,
  failed_credits numeric,
  failed_cost numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH entries AS (
    SELECT * FROM public.cost_entries_converted(p_from, p_to, p_currency, p_influencer_id)
  ),
  money AS (
    SELECT
      count(*)::integer AS entry_count,
      count(*) FILTER (WHERE converted_amount IS NULL)::integer AS missing,
      COALESCE(sum(converted_amount), 0) AS total
    FROM entries
  ),
  videos AS (
    SELECT p.id
    FROM public.posts p
    JOIN public.social_accounts sa ON sa.id = p.account_id
    WHERE p.published_at IS NOT NULL
      AND p.published_at::date BETWEEN p_from AND p_to
      AND (p_influencer_id IS NULL OR sa.influencer_id = p_influencer_id)
  ),
  video_views AS (
    SELECT COALESCE(sum(latest.views), 0)::bigint AS views
    FROM videos v
    CROSS JOIN LATERAL (
      SELECT m.views FROM public.metric_snapshots m
      WHERE m.post_id = v.id ORDER BY m.captured_at DESC LIMIT 1
    ) latest
  ),
  gens AS (
    SELECT
      count(*)::integer AS total,
      count(*) FILTER (WHERE g.status = 'failed')::integer AS failed,
      COALESCE(sum(g.credits) FILTER (WHERE g.status = 'failed'), 0) AS failed_credits
    FROM public.generations g
    WHERE g.created_at::date BETWEEN p_from AND p_to
      AND (p_influencer_id IS NULL OR g.influencer_id = p_influencer_id)
  ),
  failed_money AS (
    SELECT
      count(*) FILTER (WHERE e.converted_amount IS NULL)::integer AS missing,
      COALESCE(sum(e.converted_amount), 0) AS total
    FROM entries e
    JOIN public.generations g ON g.id = e.generation_id
    WHERE g.status = 'failed'
  )
  SELECT
    CASE WHEN m.missing = 0 THEN m.total END,
    m.entry_count,
    m.missing,
    (SELECT count(*)::integer FROM videos),
    vv.views,
    CASE WHEN m.missing = 0 AND (SELECT count(*) FROM videos) > 0
      THEN round(m.total / (SELECT count(*) FROM videos), 4) END,
    CASE WHEN m.missing = 0 AND vv.views > 0
      THEN round(m.total * 1000 / vv.views, 4) END,
    gens.total,
    gens.failed,
    CASE WHEN gens.total > 0 THEN round(gens.failed::numeric / gens.total, 4) END,
    gens.failed_credits,
    CASE WHEN fm.missing = 0 THEN fm.total END
  FROM money m, video_views vv, gens, failed_money fm
$$;

-- Günlük harcama (grafik). Kuru eksik gün için total NULL ve missing_rate_count > 0.
CREATE FUNCTION public.cost_daily(
  p_from date,
  p_to date,
  p_currency char(3),
  p_influencer_id uuid DEFAULT NULL
)
RETURNS TABLE (day date, total numeric, missing_rate_count integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    e.incurred_on,
    CASE WHEN count(*) FILTER (WHERE e.converted_amount IS NULL) = 0 THEN sum(e.converted_amount) END,
    count(*) FILTER (WHERE e.converted_amount IS NULL)::integer
  FROM public.cost_entries_converted(p_from, p_to, p_currency, p_influencer_id) e
  GROUP BY e.incurred_on
  ORDER BY e.incurred_on
$$;

-- Kategori dağılımı (grafik).
CREATE FUNCTION public.cost_by_category(
  p_from date,
  p_to date,
  p_currency char(3),
  p_influencer_id uuid DEFAULT NULL
)
RETURNS TABLE (category public.cost_category, total numeric, missing_rate_count integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    e.category,
    CASE WHEN count(*) FILTER (WHERE e.converted_amount IS NULL) = 0 THEN sum(e.converted_amount) END,
    count(*) FILTER (WHERE e.converted_amount IS NULL)::integer
  FROM public.cost_entries_converted(p_from, p_to, p_currency, p_influencer_id) e
  GROUP BY e.category
  ORDER BY 2 DESC NULLS LAST
$$;

-- Ayın bütçe durumu: harcama bütçenin para birimine çevrilir.
CREATE FUNCTION public.budget_status(p_month date)
RETURNS TABLE (
  budget_id uuid,
  influencer_id uuid,
  month date,
  amount numeric,
  currency char(3),
  warn_ratio numeric,
  spent numeric,
  missing_rate_count integer,
  ratio numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    b.id, b.influencer_id, b.month, b.amount, b.currency, b.warn_ratio,
    CASE WHEN s.missing = 0 THEN s.spent END,
    s.missing,
    CASE WHEN s.missing = 0 THEN round(s.spent / b.amount, 4) END
  FROM public.budgets b
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(sum(e.converted_amount), 0) AS spent,
      count(*) FILTER (WHERE e.converted_amount IS NULL)::integer AS missing
    FROM public.cost_entries_converted(
      b.month, (b.month + interval '1 month' - interval '1 day')::date, b.currency, b.influencer_id
    ) e
  ) s
  WHERE b.month = date_trunc('month', p_month)::date
$$;

-- Uyarı tekilleştirme: aynı bütçe + ay + seviye için tek kayıt.
CREATE UNIQUE INDEX alerts_budget_dedupe_idx
  ON public.alerts (type, (payload ->> 'budget_id'), (payload ->> 'month'))
  WHERE type IN ('budget_warning', 'budget_exceeded');

-- Ayın bütçelerini kontrol eder, eşiği geçenler için alerts'e (tekrarsız) yazar.
-- SECURITY INVOKER: çağıranın RLS'i geçerli; costs/budgets'a yazabilen (editor/owner)
-- alerts'e de yazabilir. Viewer zaten tetikleyemez.
CREATE FUNCTION public.raise_budget_alerts(p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  inserted integer;
BEGIN
  WITH due AS (
    SELECT
      s.*,
      CASE WHEN s.ratio >= 1 THEN 'budget_exceeded' ELSE 'budget_warning' END AS level
    FROM public.budget_status(p_month) s
    WHERE s.ratio IS NOT NULL AND s.ratio >= s.warn_ratio
  ),
  ins AS (
    INSERT INTO public.alerts (influencer_id, type, payload)
    SELECT
      d.influencer_id,
      d.level,
      jsonb_build_object(
        'budget_id', d.budget_id::text,
        'month', to_char(d.month, 'YYYY-MM'),
        'amount', d.amount,
        'currency', d.currency,
        'spent', d.spent,
        'ratio', d.ratio
      )
    FROM due d
    ON CONFLICT (type, (payload ->> 'budget_id'), (payload ->> 'month'))
      WHERE type IN ('budget_warning', 'budget_exceeded')
      DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO inserted FROM ins;
  RETURN inserted;
END;
$$;

CREATE FUNCTION public.costs_check_budgets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'budgets' THEN
    PERFORM public.raise_budget_alerts(NEW.month);
  ELSE
    PERFORM public.raise_budget_alerts(NEW.incurred_on);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER costs_check_budgets
  AFTER INSERT OR UPDATE OF amount, currency, incurred_on, influencer_id ON public.costs
  FOR EACH ROW EXECUTE FUNCTION public.costs_check_budgets();
CREATE TRIGGER budgets_check_budgets
  AFTER INSERT OR UPDATE OF amount, currency, warn_ratio ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.costs_check_budgets();

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.fx_rate(char, char, date)',
    'public.credits_to_money(text, numeric, date)',
    'public.cost_entries_converted(date, date, char, uuid)',
    'public.cost_summary(date, date, char, uuid)',
    'public.cost_daily(date, date, char, uuid)',
    'public.cost_by_category(date, date, char, uuid)',
    'public.budget_status(date)',
    'public.raise_budget_alerts(date)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.costs_check_budgets() FROM PUBLIC, anon;
