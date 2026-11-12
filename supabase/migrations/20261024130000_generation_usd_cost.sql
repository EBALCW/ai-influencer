-- Üretim maliyeti USD olarak (#150, ADR 0002 "Doğrulama notları" madde 2).
--
-- Higgsfield kredi değil USD bakiyeden düşer. Worker gönderimden önce
-- `POST /estimate/<model-id>` ile tahmini tutarı alır ve `estimated_cost_usd`'ye yazar. Status
-- yanıtında maliyet alanı yok; başarısız/nsfw/iptal edilmiş istek ücretlendirilmez. Bu yüzden
-- iş başarıyla bittiğinde worker tahmini tutarı gerçek tutar olarak `cost_usd`'ye yazar.
--
-- `record_generation_costs()` artık önce `cost_usd`'ye bakar: doluysa (> 0) `costs` satırı
-- doğrudan USD tutarla yazılır (kredi fiyatı gerekmez). Boşsa eski davranış: `credits` ×
-- `credits_to_money()` (fiyat yoksa kayıt yazılmaz). Tekrarsızlık kuralları değişmedi
-- (costs.generation_id benzersiz, ON CONFLICT DO NOTHING, mevcut kayıt ezilmez).
--
-- Not: `generations_prepare` (worker kolonu koruması) bu migration'da değişmez. `cost_usd` ve
-- `estimated_cost_usd` da `credits` gibi korunmayan kolonlardır; editor satırı güncelleyebiliyorsa
-- bunları da elle düzeltebilir.

ALTER TABLE public.generations
  ADD COLUMN estimated_cost_usd numeric(14, 4) CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
  ADD COLUMN cost_usd numeric(14, 4) CHECK (cost_usd IS NULL OR cost_usd >= 0);

COMMENT ON COLUMN public.generations.estimated_cost_usd IS 'Gönderimden önce sağlayıcının estimate endpoint''inden alınan tahmini tutar (USD). Worker yazar.';
COMMENT ON COLUMN public.generations.cost_usd IS 'Gerçekleşen tutar (USD). Doluysa costs kaydı bundan yazılır; boşsa credits × kredi fiyatı.';

CREATE OR REPLACE FUNCTION public.record_generation_costs()
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
    CASE WHEN g.cost_usd > 0 THEN g.cost_usd ELSE m.amount END,
    CASE WHEN g.cost_usd > 0 THEN 'USD'::char(3) ELSE m.currency END,
    g.credits,
    g.id,
    g.created_at::date
  FROM public.generations g
  LEFT JOIN LATERAL public.credits_to_money(g.tool, g.credits, g.created_at::date) m ON true
  WHERE g.status IN ('succeeded', 'failed')
    AND (g.cost_usd > 0 OR (g.credits > 0 AND m.amount IS NOT NULL))
    AND (v_generation_id IS NULL OR g.id = v_generation_id)
    AND (v_tool IS NULL OR (g.tool = v_tool AND g.created_at::date >= v_from))
    AND NOT EXISTS (SELECT 1 FROM public.costs c WHERE c.generation_id = g.id)
  ON CONFLICT (generation_id) DO NOTHING;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_generation_costs() FROM PUBLIC, anon;

DROP TRIGGER generations_record_cost ON public.generations;
CREATE TRIGGER generations_record_cost
  AFTER INSERT OR UPDATE OF status, credits, cost_usd ON public.generations
  FOR EACH ROW
  WHEN (NEW.status IN ('succeeded', 'failed') AND (NEW.credits > 0 OR NEW.cost_usd > 0))
  EXECUTE FUNCTION public.record_generation_costs();
