-- Üretim maliyetlerinin otomatik kaydı ve video başına gerçek maliyet (#59).
--
-- 1) Bir `generations` satırı `succeeded` veya `failed` durumuna geldiğinde ve kredisi > 0
--    ise `costs`'a TEK bir `credits` kaydı yazılır (generation_id ile bağlı). Tutar
--    `credits_to_money(tool, credits, üretim günü)` ile hesaplanır. Başarısız üretimin
--    kredisi de harcanmıştır, o da yazılır.
--    - Tekrarsız: costs.generation_id benzersizdir, yazım ON CONFLICT DO NOTHING ile yapılır.
--      Durum ikinci kez değişse, kredi sonradan güncellense de ikinci satır oluşmaz ve
--      mevcut kayıt (elle düzeltilmiş olabilir) ezilmez.
--    - Kredi fiyatı yoksa: kayıt YAZILMAZ (sıfır tutarlı yanlış kayıt yerine). Owner o araç
--      için `credit_rates`'e fiyat girdiğinde, fiyatın valid_from gününden itibaren biten ve
--      henüz kaydı olmayan üretimler için kayıtlar otomatik tamamlanır.
--    - Var olan biten üretimler için de bu migration bir kez aynı kaydı oluşturur.
--
-- 2) Post maliyeti: post -> content_item -> content_item_assets -> üretim. Bağ ya doğrudan
--    (content_item_assets.generation_id) ya da üretimin çıktı asset'i üzerinden
--    (content_item_assets.asset_id = generations.output_asset_id) kurulur; yeni kolon
--    gerekmez. `post_cost()` bu üretimlerin maliyetlerini toplar. Bağlı üretim yoksa
--    postun yayın ayındaki influencer ortalamasına (cost_summary.cost_per_video) düşer.

-- ── Tekrarsızlık ────────────────────────────────────────────────
ALTER TABLE public.costs
  ADD CONSTRAINT costs_generation_id_key UNIQUE (generation_id);
-- Benzersiz kısıt kendi indeksini getirir; eski kısmi indeks gereksiz.
DROP INDEX public.costs_generation_id_idx;

-- ── Üretim -> maliyet kaydı ─────────────────────────────────────
-- generations (biten üretim) ve credit_rates (yeni/güncellenen fiyat) trigger'ı.
-- SECURITY INVOKER: yazan kişinin RLS'i geçerli. Üretimi yazabilen (editor+) ve kredi
-- fiyatı girebilen (owner) costs'a da yazabilir; service role RLS'e takılmaz.
CREATE FUNCTION public.record_generation_costs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_generation_id uuid;
  v_tool text;
  v_from date;
BEGIN
  IF TG_TABLE_NAME = 'generations' THEN
    v_generation_id := NEW.id;
  ELSE
    v_tool := NEW.tool;
    v_from := NEW.valid_from;
  END IF;

  INSERT INTO public.costs (
    influencer_id, category, description, amount, currency, credits, generation_id, incurred_on
  )
  SELECT
    g.influencer_id,
    'credits'::public.cost_category,
    format('%s %s üretimi (%s)', g.tool, g.type, g.status),
    m.amount,
    m.currency,
    g.credits,
    g.id,
    g.created_at::date
  FROM public.generations g
  CROSS JOIN LATERAL public.credits_to_money(g.tool, g.credits, g.created_at::date) m
  WHERE g.status IN ('succeeded', 'failed')
    AND g.credits > 0
    AND (v_generation_id IS NULL OR g.id = v_generation_id)
    AND (v_tool IS NULL OR (g.tool = v_tool AND g.created_at::date >= v_from))
    AND NOT EXISTS (SELECT 1 FROM public.costs c WHERE c.generation_id = g.id)
  ON CONFLICT (generation_id) DO NOTHING;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_generation_costs() FROM PUBLIC, anon;

CREATE TRIGGER generations_record_cost
  AFTER INSERT OR UPDATE OF status, credits ON public.generations
  FOR EACH ROW
  WHEN (NEW.status IN ('succeeded', 'failed') AND NEW.credits > 0)
  EXECUTE FUNCTION public.record_generation_costs();
CREATE TRIGGER credit_rates_record_generation_costs
  AFTER INSERT OR UPDATE OF tool, rate_per_credit, valid_from ON public.credit_rates
  FOR EACH ROW EXECUTE FUNCTION public.record_generation_costs();

-- Mevcut biten üretimler (fiyatı olanlar) için tek seferlik kayıt.
INSERT INTO public.costs (
  influencer_id, category, description, amount, currency, credits, generation_id, incurred_on
)
SELECT
  g.influencer_id,
  'credits'::public.cost_category,
  format('%s %s üretimi (%s)', g.tool, g.type, g.status),
  m.amount,
  m.currency,
  g.credits,
  g.id,
  g.created_at::date
FROM public.generations g
CROSS JOIN LATERAL public.credits_to_money(g.tool, g.credits, g.created_at::date) m
WHERE g.status IN ('succeeded', 'failed')
  AND g.credits > 0
  AND NOT EXISTS (SELECT 1 FROM public.costs c WHERE c.generation_id = g.id)
ON CONFLICT (generation_id) DO NOTHING;

CREATE INDEX generations_output_asset_id_idx
  ON public.generations (output_asset_id) WHERE output_asset_id IS NOT NULL;

-- ── Post başına maliyet ─────────────────────────────────────────
-- allocation:
--   'direct'  postun içeriğine bağlı üretim var; total = bu üretimlerin maliyet kayıtlarının
--             p_currency'deki toplamı. Aynı içerik birden çok hesapta yayınlandıysa her post
--             içeriğin tüm maliyetini gösterir (bölüştürülmez).
--   'average' bağlı üretim yok; total = postun yayın ayında (yayınlanmadıysa oluşturulma
--             ayında) influencer'ın video başına ortalaması (cost_summary.cost_per_video).
-- Kuru eksik kayıt varsa total NULL ve missing_rate_count > 0 (diğer özetlerle aynı kural).
-- SECURITY INVOKER: post RLS'e takılırsa (ekip dışı) hiç satır dönmez.
CREATE FUNCTION public.post_cost(p_post_id uuid, p_currency char(3))
RETURNS TABLE (
  post_id uuid,
  allocation text,
  total numeric,
  currency char(3),
  entry_count integer,
  missing_rate_count integer,
  generation_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH post AS (
    SELECT
      p.id,
      p.content_item_id,
      sa.influencer_id,
      date_trunc('month', COALESCE(p.published_at, p.created_at))::date AS month
    FROM public.posts p
    JOIN public.social_accounts sa ON sa.id = p.account_id
    WHERE p.id = p_post_id
  ),
  gens AS (
    SELECT DISTINCT g.id
    FROM post
    JOIN public.content_item_assets cia ON cia.content_item_id = post.content_item_id
    JOIN public.generations g
      ON g.id = cia.generation_id
      OR (cia.asset_id IS NOT NULL AND g.output_asset_id = cia.asset_id)
  ),
  direct AS (
    SELECT
      count(*)::integer AS entry_count,
      count(*) FILTER (WHERE x.converted IS NULL)::integer AS missing,
      COALESCE(sum(x.converted), 0) AS total
    FROM (
      SELECT round(c.amount * public.fx_rate(c.currency, p_currency, c.incurred_on), 4) AS converted
      FROM public.costs c
      WHERE c.generation_id IN (SELECT id FROM gens)
    ) x
  ),
  avg_period AS (
    SELECT s.*
    FROM post
    CROSS JOIN LATERAL public.cost_summary(
      post.month,
      (post.month + interval '1 month' - interval '1 day')::date,
      p_currency,
      post.influencer_id
    ) s
    WHERE NOT EXISTS (SELECT 1 FROM gens)
  )
  SELECT
    post.id,
    CASE WHEN g.n > 0 THEN 'direct' ELSE 'average' END,
    CASE WHEN g.n > 0 THEN (CASE WHEN d.missing = 0 THEN d.total END) ELSE a.cost_per_video END,
    p_currency,
    CASE WHEN g.n > 0 THEN d.entry_count ELSE COALESCE(a.entry_count, 0) END,
    CASE WHEN g.n > 0 THEN d.missing ELSE COALESCE(a.missing_rate_count, 0) END,
    g.n
  FROM post
  CROSS JOIN (SELECT count(*)::integer AS n FROM gens) g
  CROSS JOIN direct d
  LEFT JOIN avg_period a ON true
$$;
REVOKE ALL ON FUNCTION public.post_cost(uuid, char) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_cost(uuid, char) TO authenticated;
