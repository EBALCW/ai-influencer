-- Marka iş birliği CRM'i ve medya kiti (#60).
--
-- brand_deals.paid_at       Ödeme tarihi. Aylık gelir buna göre hesaplanır (updated_at'e göre değil).
--                           Yalnız 'paid' aşamasında dolu olabilir. Deal 'paid'e geçince boşsa
--                           bugünün (Europe/Istanbul) tarihi yazılır; 'paid'den çıkınca temizlenir.
-- brand_deals.brief         Brief alanları (6.4 şablonu), JSON nesnesi. Şema panelde Zod ile doğrulanır.
-- brand_deal_content_items  Deal ↔ içerik kartı bağlantısı. İçerik, deal ile aynı influencer'a ait olmalı.
-- brand_deal_files          Sözleşme vb. dosyalar. Nesne private `contracts` bucket'ında
--                           `<brand_deal_id>/<dosya>` yolunda durur; indirme kısa ömürlü signed URL ile.
-- brand_deal_revenue()      Ödenmiş deal'ler, hedef para birimine çevrilmiş halde (fx_rate, ödeme günü kuru).
--                           Kuru olmayan deal için converted_fee NULL; toplama panelde (money.ts) yapılır.
--
-- Yetki: ilk şemadaki kalıp. Ekip okur, owner/editor yazar, ekip dışı hiçbir şey görmez.

ALTER TABLE public.brand_deals
  ADD COLUMN paid_at date,
  ADD COLUMN brief jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(brief) = 'object'),
  ADD CONSTRAINT brand_deals_paid_at_only_when_paid
    CHECK (paid_at IS NULL OR stage = 'paid');

CREATE INDEX brand_deals_paid_at_idx ON public.brand_deals (paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX brand_deals_brand_id_idx ON public.brand_deals (brand_id);

CREATE FUNCTION public.brand_deals_sync_paid_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.stage = 'paid' THEN
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := (now() AT TIME ZONE 'Europe/Istanbul')::date;
    END IF;
  ELSE
    NEW.paid_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER brand_deals_sync_paid_at
  BEFORE INSERT OR UPDATE OF stage, paid_at ON public.brand_deals
  FOR EACH ROW EXECUTE FUNCTION public.brand_deals_sync_paid_at();

CREATE TABLE public.brand_deal_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_deal_id uuid NOT NULL REFERENCES public.brand_deals (id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.content_items (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  UNIQUE (brand_deal_id, content_item_id)
);
CREATE INDEX brand_deal_content_items_content_idx
  ON public.brand_deal_content_items (content_item_id);

-- Bağlanan içerik deal ile aynı influencer'a ait olmalı (başka karakterin kartı bağlanamaz).
CREATE FUNCTION public.validate_brand_deal_content_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.brand_deals d
    JOIN public.content_items c ON c.influencer_id = d.influencer_id
    WHERE d.id = NEW.brand_deal_id AND c.id = NEW.content_item_id
  ) THEN
    RAISE EXCEPTION 'İçerik kartı deal ile aynı influencer''a ait olmalı.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER brand_deal_content_items_validate
  BEFORE INSERT OR UPDATE ON public.brand_deal_content_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_brand_deal_content_item();

CREATE TABLE public.brand_deal_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_deal_id uuid NOT NULL REFERENCES public.brand_deals (id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 200),
  mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Kayıt yalnız kendi deal klasöründeki dosyayı gösterebilir
  CONSTRAINT brand_deal_files_path_in_deal_folder CHECK (
    storage_path LIKE brand_deal_id::text || '/%'
    AND position('/' IN substr(storage_path, length(brand_deal_id::text) + 2)) = 0
  )
);
CREATE INDEX brand_deal_files_deal_idx ON public.brand_deal_files (brand_deal_id);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['brand_deal_content_items', 'brand_deal_files'] LOOP
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
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_write_data()) WITH CHECK (public.can_write_data())',
      table_name || '_team_write', table_name
    );
  END LOOP;
END;
$$;

REVOKE ALL ON public.brand_deal_content_items, public.brand_deal_files FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_deal_content_items, public.brand_deal_files TO authenticated;

-- Sözleşme dosyaları: medya varlığı değildir, ayrı private bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts', 'contracts', false, 20971520,
  ARRAY[
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Nesne tam olarak bir seviye derinlikte ve var olan (çağıranın görebildiği) bir deal klasöründe mi?
CREATE FUNCTION public.brand_file_in_deal_folder(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(array_length(storage.foldername(object_name), 1), 0) = 1
    AND EXISTS (
      SELECT 1
      FROM public.brand_deals AS d
      WHERE d.id::text = (storage.foldername(object_name))[1]
    );
$$;

COMMENT ON FUNCTION public.brand_file_in_deal_folder(text) IS
  'contracts bucket nesnesi `<brand_deal_id>/<dosya>` biçiminde ve var olan bir deal klasöründe mi? RLS ile çalışır.';

CREATE POLICY contracts_storage_team_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contracts' AND public.is_team_member());

CREATE POLICY contracts_storage_team_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND public.can_write_data()
    AND public.brand_file_in_deal_folder(name)
  );

CREATE POLICY contracts_storage_team_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'contracts' AND public.can_write_data())
  WITH CHECK (
    bucket_id = 'contracts'
    AND public.can_write_data()
    AND public.brand_file_in_deal_folder(name)
  );

CREATE POLICY contracts_storage_team_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contracts' AND public.can_write_data());

-- Dönemde ödenmiş deal'ler (paid_at aralıkta), p_currency'ye ödeme günü kuruyla çevrilmiş.
-- 'lost' ve henüz ödenmemiş deal'ler hiç dönmez. Ücreti boş deal 0 sayılmaz: fee NULL döner.
CREATE FUNCTION public.brand_deal_revenue(
  p_from date,
  p_to date,
  p_currency char(3),
  p_influencer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  influencer_id uuid,
  paid_at date,
  fee numeric,
  currency char(3),
  converted_fee numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    d.id, d.influencer_id, d.paid_at, d.fee, d.currency,
    round(d.fee * public.fx_rate(d.currency, p_currency, d.paid_at), 4)
  FROM public.brand_deals d
  WHERE d.stage = 'paid'
    AND d.paid_at BETWEEN p_from AND p_to
    AND (p_influencer_id IS NULL OR d.influencer_id = p_influencer_id)
  ORDER BY d.paid_at, d.id
$$;

REVOKE ALL ON FUNCTION public.brand_deal_revenue(date, date, char, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.brand_deal_revenue(date, date, char, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.brand_file_in_deal_folder(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.brand_file_in_deal_folder(text) TO authenticated;

COMMENT ON COLUMN public.brand_deals.paid_at IS 'Ödeme tarihi; aylık gelir buna göre hesaplanır. Yalnız paid aşamasında dolu.';
COMMENT ON COLUMN public.brand_deals.brief IS 'Brief alanları (6.4 şablonu), panelde Zod şemasıyla doğrulanır.';
COMMENT ON TABLE public.brand_deal_content_items IS 'Deal ile içerik kartı bağlantısı (aynı influencer).';
COMMENT ON TABLE public.brand_deal_files IS 'Deal dosyaları (sözleşme). Nesne private contracts bucket''ında, signed URL ile indirilir.';
