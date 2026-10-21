-- Prompt kütüphanesi (#46): adlandırılmış prompt soyları, değiştirilemez versiyonlar,
-- puanlama ve başarı oranı.
--
-- Model: Bir "soy" (lineage) = kapsam (influencer_id, NULL = global) + kategori + key.
-- Her versiyon ayrı bir satırdır. Mevcut satırın içeriği (body, negative, variables,
-- kapsam, kategori, key, version) değiştirilemez; değişiklik = yeni versiyon. Böylece
-- geçmiş üretimlerin (generations.prompt_id) bağlı olduğu metin sonradan değişmez ve
-- başarı oranı geçmişi bozulmaz.

ALTER TABLE public.prompts
  ADD COLUMN title text NOT NULL DEFAULT 'Adsız prompt'
    CHECK (length(trim(title)) BETWEEN 1 AND 120),
  ADD COLUMN key text NOT NULL DEFAULT 'default'
    CHECK (length(key) <= 64 AND key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD COLUMN change_note text NOT NULL DEFAULT ''
    CHECK (length(change_note) <= 500);

-- Puan arayüzde 1–5; DB de aynı aralığı zorlar (eski kısıt 0–5'ti, veri yok).
ALTER TABLE public.prompts
  ADD CONSTRAINT prompts_rating_min CHECK (rating IS NULL OR rating >= 1);

-- Benzersizlik artık soy bazında: aynı kapsam + kategoride birden çok adlandırılmış prompt olabilir.
DROP INDEX public.prompts_scope_category_version_idx;
CREATE UNIQUE INDEX prompts_scope_category_key_version_idx
  ON public.prompts (
    COALESCE(influencer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    category, key, version
  );

CREATE INDEX generations_prompt_id_idx ON public.generations (prompt_id);

-- Üretim isteğinin parametreleri (doldurulmuş prompt, negatif prompt, değişken değerleri).
-- Kuyruk worker'ı (#47) bu alanı okuyarak sağlayıcıya istek atar.
ALTER TABLE public.generations
  ADD COLUMN params jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(params) = 'object');

COMMENT ON COLUMN public.prompts.key IS 'Lineage key within (scope, category); versions of the same prompt share it.';
COMMENT ON COLUMN public.generations.params IS 'Request parameters (rendered prompt, negative prompt, variable values). Never store secrets here.';

-- Versiyon içeriği değiştirilemez. Başlık, puan ve değişiklik notu güncellenebilir.
CREATE FUNCTION public.prevent_prompt_content_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body
    OR NEW.negative IS DISTINCT FROM OLD.negative
    OR NEW.variables IS DISTINCT FROM OLD.variables
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.key IS DISTINCT FROM OLD.key
    OR NEW.influencer_id IS DISTINCT FROM OLD.influencer_id
    OR NEW.version IS DISTINCT FROM OLD.version
  THEN
    RAISE EXCEPTION 'Prompt versiyonları değiştirilemez; yeni bir versiyon oluşturun.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prompts_prevent_content_update
  BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_prompt_content_update();

-- Yeni versiyon (veya yeni soyun v1'i) atomik oluşturulur. Versiyon numarası istemcide
-- hesaplanmaz; aynı soya eşzamanlı iki istek advisory lock ile sıraya girer.
-- SECURITY INVOKER: RLS uygulanır, viewer ve ekip dışı kullanıcı INSERT edemez (42501).
CREATE FUNCTION public.create_prompt_version(
  p_category public.prompt_category,
  p_key text,
  p_title text,
  p_body text,
  p_negative text DEFAULT '',
  p_variables jsonb DEFAULT '{}'::jsonb,
  p_influencer_id uuid DEFAULT NULL,
  p_change_note text DEFAULT ''
)
RETURNS public.prompts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  next_version integer;
  created public.prompts;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat_ws(':', 'prompt', COALESCE(p_influencer_id::text, 'global'), p_category::text, p_key),
      0
    )
  );

  SELECT COALESCE(max(p.version), 0) + 1
  INTO next_version
  FROM public.prompts p
  WHERE p.influencer_id IS NOT DISTINCT FROM p_influencer_id
    AND p.category = p_category
    AND p.key = p_key;

  INSERT INTO public.prompts (
    influencer_id, category, key, title, body, negative, variables, version, change_note
  )
  VALUES (
    p_influencer_id, p_category, p_key, p_title, p_body,
    COALESCE(p_negative, ''), COALESCE(p_variables, '{}'::jsonb), next_version,
    COALESCE(p_change_note, '')
  )
  RETURNING * INTO created;

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_prompt_version(public.prompt_category, text, text, text, text, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_prompt_version(public.prompt_category, text, text, text, text, jsonb, uuid, text) TO authenticated;

-- Versiyon başına üretim istatistikleri. security_invoker: çağıranın RLS'i uygulanır;
-- olmadan view sahibinin yetkisiyle çalışıp RLS'i sessizce baypas ederdi.
-- success_rate = başarılı / (başarılı + başarısız); kuyruktaki, çalışan ve iptal edilenler
-- orana katılmaz. avg_credits yalnızca başarılı üretimlerin ortalamasıdır.
CREATE VIEW public.prompt_stats
WITH (security_invoker = true)
AS
SELECT
  p.id AS prompt_id,
  count(g.id)::integer AS total,
  (count(g.id) FILTER (WHERE g.status = 'succeeded'))::integer AS succeeded,
  (count(g.id) FILTER (WHERE g.status = 'failed'))::integer AS failed,
  (count(g.id) FILTER (WHERE g.status IN ('queued', 'running')))::integer AS pending,
  CASE
    WHEN count(g.id) FILTER (WHERE g.status IN ('succeeded', 'failed')) = 0 THEN NULL
    ELSE round(
      (count(g.id) FILTER (WHERE g.status = 'succeeded'))::numeric
        / (count(g.id) FILTER (WHERE g.status IN ('succeeded', 'failed'))),
      4
    )
  END AS success_rate,
  round(avg(g.credits) FILTER (WHERE g.status = 'succeeded'), 4) AS avg_credits
FROM public.prompts p
LEFT JOIN public.generations g ON g.prompt_id = p.id
GROUP BY p.id;

-- Her soyun en son versiyonu + versiyon sayısı (liste sayfası tek sorguyla, max_rows'a takılmadan).
CREATE VIEW public.prompt_lineages
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (COALESCE(p.influencer_id, '00000000-0000-0000-0000-000000000000'::uuid), p.category, p.key)
  p.*,
  count(*) OVER (
    PARTITION BY COALESCE(p.influencer_id, '00000000-0000-0000-0000-000000000000'::uuid), p.category, p.key
  )::integer AS version_count
FROM public.prompts p
ORDER BY COALESCE(p.influencer_id, '00000000-0000-0000-0000-000000000000'::uuid), p.category, p.key, p.version DESC;

REVOKE ALL ON public.prompt_stats, public.prompt_lineages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.prompt_stats, public.prompt_lineages TO authenticated;
