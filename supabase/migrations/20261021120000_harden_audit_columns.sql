-- İlk şemanın sertleştirilmesi (#38 incelemesi).
--
-- 1) created_by: İstemci herhangi bir kullanıcı id'si yazabiliyordu (sahte kayıt sahipliği).
--    Artık INSERT'te oturumdaki kullanıcıya sabitlenir ve sonradan değiştirilemez.
--    Service role / migration / seed gibi oturumsuz yazımlarda (auth.uid() NULL) verilen değere dokunulmaz.
-- 2) UNIQUE (x, captured_at) kısıtları zaten aynı sütunlarda indeks oluşturuyor;
--    ayrıca açılan DESC indeksler gereksiz yazma maliyetiydi.

CREATE FUNCTION public.set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
  audited_tables text[] := ARRAY[
    'team_members', 'influencers', 'influencer_personas', 'assets', 'prompts',
    'generations', 'social_accounts', 'content_items', 'posts', 'metric_snapshots',
    'account_snapshots', 'costs', 'brands', 'brand_deals', 'alerts'
  ];
BEGIN
  FOREACH table_name IN ARRAY audited_tables LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_created_by()',
      table_name || '_set_created_by', table_name
    );
  END LOOP;
END;
$$;

DROP INDEX public.metric_snapshots_post_captured_at_idx;
DROP INDEX public.account_snapshots_account_captured_at_idx;
