-- Çalışma alanları: kiracı başına yalıtım (#181, docs/adr/0003-workspaces.md).
--
-- Önceki model "tek ortak ekip"ti: team_members'taki herkes her satırı görürdü. Bu migration
-- her kullanıcı verisini bir çalışma alanına (workspace) bağlar ve alanlar arasını kapatır.
--
--  1) public.workspaces + team_members.workspace_id (kullanıcı başına TEK alan; user_id PK kalır).
--  2) public.current_workspace_id(): oturumdaki üyenin alanı. Oturumsuz çağrıda (service role,
--     postgres, seed, pgTAP) YALNIZ tam olarak bir alan varsa o alan, aksi halde NULL.
--  3) Kiracıya ait her tabloya workspace_id (NOT NULL, FK, indeks) + RESTRICTIVE policy. Mevcut
--     permissive policy'ler (rol kuralları) değişmez; restrictive onlarla AND'lenir.
--  4) private.set_workspace_from_parent(): INSERT'te workspace_id üst kayıttan türetilir, UPDATE'te
--     değişmez; FK ile bağlanan her üst kayıt aynı alanda olmalıdır (FK kısıtı RLS'e bakmaz).
--  5) Küresel tekil kısıtlar alan başına tekil olur.
--  6) RLS'i aşan fonksiyonlar (SECURITY DEFINER, cron, service role) alanı açıkça filtreler.
--  7) Storage: nesnenin klasörü (influencer / deal) çağıranın alanında olmalı.
--
-- Mevcut tüm satırlar ve üyeler burada oluşturulan tek alana ("Varsayılan çalışma alanı") taşınır.
-- Kolonlar sabit DEFAULT ile eklenir: satırlar yeniden yazılmaz, trigger çalışmaz (updated_at
-- değişmez); ardından DEFAULT current_workspace_id() yapılır.

-- ── 1) workspaces ───────────────────────────────────────────────────────────
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80 AND length(name) <= 80),
  -- Push hedefleri (ntfy/Telegram/e-posta) Vault'ta kurulum genelinde tek settir. Yeni alanlar bu
  -- kanalları kullanamaz; yalnız operatör (SQL/migration) açar. İstemci bu kolonu yazamaz.
  push_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
COMMENT ON TABLE public.workspaces IS
  'Çalışma alanı (kiracı). Her kullanıcı verisi satırı tam olarak bir alana aittir (#181).';
COMMENT ON COLUMN public.workspaces.push_enabled IS
  'Kurulum geneli push kanallarını (Vault sırları) bu alan kullanabilir mi? Yalnız operatör değiştirir.';

CREATE TRIGGER workspaces_set_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER workspaces_set_created_by BEFORE INSERT OR UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- ── 2) Var olan veri tek alana taşınır; workspace_id kolonları ──────────────
DO $$
DECLARE
  v_ws uuid;
  t text;
  tenant_tables text[] := ARRAY[
    'team_members',
    'influencers', 'influencer_personas', 'assets', 'prompts', 'generations', 'social_accounts',
    'content_items', 'posts', 'metric_snapshots', 'account_snapshots', 'costs', 'brands',
    'brand_deals', 'alerts', 'budgets', 'exchange_rates', 'credit_rates', 'content_item_assets',
    'posting_slots', 'app_settings', 'learnings', 'alert_reads', 'notification_settings', 'reports',
    'sync_runs', 'brand_deal_content_items', 'brand_deal_files', 'publish_jobs', 'comments',
    'comment_replies', 'trends', 'clip_sources', 'clips'
  ];
BEGIN
  INSERT INTO public.workspaces (name, push_enabled)
  VALUES ('Varsayılan çalışma alanı', true)
  RETURNING id INTO v_ws;

  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN workspace_id uuid NOT NULL DEFAULT %L '
      'REFERENCES public.workspaces (id) ON DELETE CASCADE',
      t, v_ws
    );
    EXECUTE format('CREATE INDEX %I ON public.%I (workspace_id)', t || '_workspace_id_idx', t);
  END LOOP;

  -- Manuel senkronizasyon kısıtlaması alan başınadır (internal.request_sync).
  EXECUTE format(
    'ALTER TABLE private.sync_requests ADD COLUMN workspace_id uuid NOT NULL DEFAULT %L '
    'REFERENCES public.workspaces (id) ON DELETE CASCADE',
    v_ws
  );
  ALTER TABLE private.sync_requests ALTER COLUMN workspace_id DROP DEFAULT;
END;
$$;
CREATE INDEX sync_requests_workspace_requested_at_idx
  ON private.sync_requests (workspace_id, requested_at DESC);

-- ── 3) current_workspace_id() ───────────────────────────────────────────────
-- Oturum varsa (auth.uid()): üyenin alanı; üye değilse NULL (hiçbir satır eşleşmez).
-- Oturum yoksa ("tek kiracı uyumluluğu"): service role / postgres / seed / pgTAP yazımları,
-- YALNIZ tam olarak bir alan varken o alana düşer. Birden çok alan varken NULL döner; sunucu kodu
-- alanı açıkça vermek ya da üst kayıttan türetmek (aşağıdaki trigger) zorundadır, aksi halde
-- NOT NULL kısıtı yazımı reddeder. anon/authenticated JWT'si olup kullanıcı kimliği olmayan
-- çağrılar bu kolaylıktan yararlanamaz.
CREATE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN (
      SELECT member.workspace_id
      FROM public.team_members AS member
      WHERE member.user_id = auth.uid()
    )
    WHEN COALESCE(auth.role(), 'service_role') IN ('anon', 'authenticated') THEN NULL
    ELSE (
      SELECT (array_agg(w.id))[1]
      FROM public.workspaces AS w
      HAVING count(*) = 1
    )
  END
$$;
COMMENT ON FUNCTION public.current_workspace_id() IS
  'Oturumdaki üyenin çalışma alanı. Oturumsuz (service role/postgres) çağrıda yalnız tam olarak bir alan varsa o alan, aksi halde NULL: çok alanlı kurulumda sunucu kodu alanı açıkça verir ya da üst kayıttan türetir.';
REVOKE ALL ON FUNCTION public.current_workspace_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO authenticated, service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attname = 'workspace_id' AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN workspace_id SET DEFAULT public.current_workspace_id()', t
    );
  END LOOP;
END;
$$;

-- Kolon bazlı SELECT izni olan tabloda yeni kolon da okunabilir olsun (policy ve upsert için).
GRANT SELECT (workspace_id) ON public.publish_jobs TO authenticated;

-- ── 4) Üst kayıttan türetme + alan değişmezliği ─────────────────────────────
-- TG_ARGV: '[?]<fk kolonu>=<public tablo>.<anahtar kolonu>' listesi.
--   * INSERT: '?' ile başlamayan ilk dolu FK'nin üst kaydı workspace_id'yi BELİRLER (istemcinin ya da
--     DEFAULT'un verdiği değer ezilir). Böylece auth.uid()'siz service role yazımları doğru alana
--     düşer; başka alanın kaydına bağlanan satır o alanın workspace_id'sini alır ve restrictive
--     WITH CHECK tarafından reddedilir.
--   * Dolu her FK'nin (türeten + '?' ile işaretli yalnız-denetlenen) üst kaydı satırla aynı alanda
--     olmalıdır; değilse 23514.
--   * UPDATE: workspace_id asla değişmez (satır alan değiştiremez); FK'lerden biri değiştiyse
--     denetim yeniden yapılır.
-- SECURITY DEFINER: üst kayıt çağıranın RLS'inde görünmese bile (başka alan) alanı okunabilmeli.
CREATE FUNCTION private.set_workspace_from_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new jsonb;
  v_old jsonb;
  v_spec text;
  v_check_only boolean;
  v_col text;
  v_ref text;
  v_fk text;
  v_parent uuid;
  v_derived uuid;
  v_parents uuid[] := '{}';
  v_changed boolean := false;
  i integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.workspace_id := OLD.workspace_id;
  END IF;
  IF TG_NARGS = 0 THEN
    RETURN NEW;
  END IF;

  v_new := to_jsonb(NEW);
  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    FOR i IN 0 .. TG_NARGS - 1 LOOP
      v_col := split_part(ltrim(TG_ARGV[i], '?'), '=', 1);
      IF (v_new ->> v_col) IS DISTINCT FROM (v_old ->> v_col) THEN
        v_changed := true;
      END IF;
    END LOOP;
    IF NOT v_changed THEN
      RETURN NEW;
    END IF;
  END IF;

  FOR i IN 0 .. TG_NARGS - 1 LOOP
    v_spec := TG_ARGV[i];
    v_check_only := left(v_spec, 1) = '?';
    v_spec := ltrim(v_spec, '?');
    v_col := split_part(v_spec, '=', 1);
    v_ref := split_part(v_spec, '=', 2);
    v_fk := v_new ->> v_col;
    CONTINUE WHEN v_fk IS NULL;
    EXECUTE format(
      'SELECT p.workspace_id FROM public.%I AS p WHERE p.%I = $1',
      split_part(v_ref, '.', 1), split_part(v_ref, '.', 2)
    ) INTO v_parent USING v_fk::uuid;
    -- Üst kayıt yoksa FK kısıtı zaten reddeder.
    CONTINUE WHEN v_parent IS NULL;
    v_parents := v_parents || v_parent;
    IF v_derived IS NULL AND NOT v_check_only THEN
      v_derived := v_parent;
    END IF;
  END LOOP;

  IF TG_OP = 'INSERT' AND v_derived IS NOT NULL THEN
    NEW.workspace_id := v_derived;
  END IF;
  IF NEW.workspace_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(v_parents) AS parent_ws WHERE parent_ws <> NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Bağlanan kayıt başka bir çalışma alanına ait.'
      USING ERRCODE = '23514', HINT = 'workspace_mismatch';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.set_workspace_from_parent() FROM PUBLIC, anon, authenticated, service_role;

-- Trigger adı "aa_" ile başlar: BEFORE trigger'lar ada göre sıralanır; diğer trigger'lar
-- (doğrulama, hazırlama) workspace_id'si belirlenmiş satırı görür.
DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('team_members', ''),
      ('influencers', '?avatar_asset_id=assets.id'),
      ('influencer_personas', 'influencer_id=influencers.id'),
      ('assets', 'influencer_id=influencers.id'),
      ('prompts', 'influencer_id=influencers.id'),
      ('generations', 'influencer_id=influencers.id,?prompt_id=prompts.id,?output_asset_id=assets.id,?retry_of=generations.id'),
      ('social_accounts', 'influencer_id=influencers.id'),
      ('content_items', 'influencer_id=influencers.id,?assignee_id=team_members.user_id,?target_account_id=social_accounts.id'),
      ('posts', 'account_id=social_accounts.id,?content_item_id=content_items.id'),
      ('metric_snapshots', 'post_id=posts.id'),
      ('account_snapshots', 'account_id=social_accounts.id'),
      ('costs', 'influencer_id=influencers.id,?generation_id=generations.id'),
      ('brands', ''),
      ('brand_deals', 'influencer_id=influencers.id,?brand_id=brands.id'),
      ('alerts', 'influencer_id=influencers.id'),
      ('budgets', 'influencer_id=influencers.id'),
      ('exchange_rates', ''),
      ('credit_rates', ''),
      ('content_item_assets', 'content_item_id=content_items.id,?asset_id=assets.id,?generation_id=generations.id'),
      ('posting_slots', 'account_id=social_accounts.id'),
      ('app_settings', ''),
      ('learnings', 'influencer_id=influencers.id,post_id=posts.id'),
      ('alert_reads', 'alert_id=alerts.id'),
      ('notification_settings', ''),
      ('reports', 'influencer_id=influencers.id'),
      ('sync_runs', 'account_id=social_accounts.id'),
      ('brand_deal_content_items', 'brand_deal_id=brand_deals.id,?content_item_id=content_items.id'),
      ('brand_deal_files', 'brand_deal_id=brand_deals.id'),
      ('publish_jobs', 'content_item_id=content_items.id,?account_id=social_accounts.id,?asset_id=assets.id,?published_post_id=posts.id'),
      ('comments', 'post_id=posts.id,?brand_deal_id=brand_deals.id'),
      ('comment_replies', 'comment_id=comments.id'),
      ('trends', 'influencer_id=influencers.id,?content_item_id=content_items.id'),
      ('clip_sources', '?permission_checked_by=team_members.user_id'),
      ('clips', 'source_id=clip_sources.id,?influencer_id=influencers.id,?content_item_id=content_items.id')
    ) AS v (table_name, parents)
  LOOP
    EXECUTE format(
      'CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent(%s)',
      spec.table_name,
      (SELECT COALESCE(string_agg(quote_literal(p), ', '), '')
       FROM unnest(string_to_array(NULLIF(spec.parents, ''), ',')) AS p)
    );
  END LOOP;
END;
$$;

-- ── 5) RESTRICTIVE policy'ler ───────────────────────────────────────────────
-- Mevcut permissive policy'ler rolü denetler; bu policy satırın alanını. İkisi AND'lenir.
-- (SELECT …) sarmalı: fonksiyon satır başına değil sorgu başına bir kez çalışır.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attname = 'workspace_id' AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (workspace_id = (SELECT public.current_workspace_id())) '
      'WITH CHECK (workspace_id = (SELECT public.current_workspace_id()))',
      t || '_workspace', t
    );
  END LOOP;
END;
$$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspaces_member_read ON public.workspaces
  FOR SELECT TO authenticated
  USING (id = (SELECT public.current_workspace_id()));
CREATE POLICY workspaces_owner_update ON public.workspaces
  FOR UPDATE TO authenticated
  USING (id = (SELECT public.current_workspace_id()) AND public.can_manage_team())
  WITH CHECK (id = (SELECT public.current_workspace_id()) AND public.can_manage_team());
-- İstemciden alan oluşturma/silme yok; owner yalnız adı değiştirebilir.
REVOKE ALL ON public.workspaces FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workspaces TO authenticated;
GRANT UPDATE (name) ON public.workspaces TO authenticated;

COMMENT ON TABLE public.team_members IS
  'Çalışma alanı üyeliği ve rolü. Kullanıcı başına tek alan (user_id PK).';

-- Son owner kuralı artık alan başına. Alan silinirken (CASCADE) üyelikler engellenmez.
CREATE OR REPLACE FUNCTION public.prevent_last_team_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  remaining_owners integer;
BEGIN
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner') THEN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
      SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id
    ) THEN
      RETURN OLD;
    END IF;

    SELECT count(*) INTO remaining_owners
    FROM public.team_members
    WHERE role = 'owner' AND user_id <> OLD.user_id AND workspace_id = OLD.workspace_id;

    IF remaining_owners = 0 THEN
      RAISE EXCEPTION 'At least one team owner must remain.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Her alanın bildirim ayarı satırı olur (istemci yalnız UPDATE edebilir).
CREATE FUNCTION private.workspaces_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_settings (workspace_id) VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.workspaces_after_insert() FROM PUBLIC, anon, authenticated, service_role;

-- ── 6) Tekil kısıtlar: alan başına ──────────────────────────────────────────
-- Bilinçli küresel kalanlar: social_accounts (platform, external_id) (gerçek bir sosyal hesap tek
-- alana bağlanır), assets.storage_path ve brand_deal_files.storage_path (yol <influencer|deal uuid>/…
-- ile başlar; tek bucket'taki fiziksel nesneyi gösterir), uuid üst kayda bağlı tüm kısıtlar.
ALTER TABLE public.influencers DROP CONSTRAINT influencers_slug_key;
ALTER TABLE public.influencers ADD CONSTRAINT influencers_slug_key UNIQUE (workspace_id, slug);

ALTER TABLE public.clip_sources DROP CONSTRAINT clip_sources_video_url_key;
ALTER TABLE public.clip_sources
  ADD CONSTRAINT clip_sources_video_url_key UNIQUE (workspace_id, video_url);

ALTER TABLE public.app_settings DROP CONSTRAINT app_settings_pkey;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (workspace_id, key);

ALTER TABLE public.notification_settings DROP CONSTRAINT notification_settings_pkey;
ALTER TABLE public.notification_settings
  ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (workspace_id);

ALTER TABLE public.exchange_rates
  DROP CONSTRAINT exchange_rates_currency_base_currency_valid_on_key;
ALTER TABLE public.exchange_rates
  ADD CONSTRAINT exchange_rates_currency_base_currency_valid_on_key
  UNIQUE (workspace_id, currency, base_currency, valid_on);

ALTER TABLE public.credit_rates DROP CONSTRAINT credit_rates_tool_valid_from_key;
ALTER TABLE public.credit_rates
  ADD CONSTRAINT credit_rates_tool_valid_from_key UNIQUE (workspace_id, tool, valid_from);

ALTER TABLE public.reports DROP CONSTRAINT reports_influencer_period_key;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_influencer_period_key
  UNIQUE NULLS NOT DISTINCT (workspace_id, influencer_id, period_start);

ALTER TABLE public.alerts DROP CONSTRAINT alerts_dedupe_key_key;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_dedupe_key_key UNIQUE (workspace_id, dedupe_key);

DROP INDEX public.budgets_total_month_idx;
CREATE UNIQUE INDEX budgets_total_month_idx
  ON public.budgets (workspace_id, month) WHERE influencer_id IS NULL;

DROP INDEX public.brands_name_lower_idx;
CREATE UNIQUE INDEX brands_name_lower_idx ON public.brands (workspace_id, lower(name));

DROP INDEX public.prompts_scope_category_key_version_idx;
CREATE UNIQUE INDEX prompts_scope_category_key_version_idx
  ON public.prompts (
    workspace_id,
    COALESCE(influencer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    category, key, version
  );

DROP INDEX public.trends_url_scope_idx;
CREATE UNIQUE INDEX trends_url_scope_idx
  ON public.trends (
    workspace_id, url, coalesce(influencer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE TRIGGER workspaces_after_insert AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION private.workspaces_after_insert();
-- Varsayılan alanın ayar satırı (ilk migration'dan) zaten var; yoksa oluştur.
INSERT INTO public.notification_settings (workspace_id)
SELECT w.id FROM public.workspaces w
ON CONFLICT (workspace_id) DO NOTHING;

-- ── 7) Service role yardımcıları (private) ──────────────────────────────────
CREATE FUNCTION private.user_workspace_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT m.workspace_id FROM public.team_members m WHERE m.user_id = p_user_id
$$;

-- Kullanıcı owner/editor mü ve influencer onun alanında mı? (OAuth RPC'leri service role ile
-- çağrılır; kullanıcı kimliği parametre olarak gelir.)
CREATE FUNCTION private.user_can_write_influencer(p_user_id uuid, p_influencer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members m
    JOIN public.influencers i ON i.workspace_id = m.workspace_id
    WHERE m.user_id = p_user_id AND m.role IN ('owner', 'editor') AND i.id = p_influencer_id
  )
$$;
REVOKE ALL ON FUNCTION private.user_workspace_id(uuid), private.user_can_write_influencer(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.oauth_state_save(p_hash text, p_user_id uuid, p_influencer_id uuid,
 p_platform public.social_platform, p_verifier text, p_expires_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_expires_at IS NULL OR NOT isfinite(p_expires_at) OR p_expires_at <= clock_timestamp()
    OR p_expires_at > clock_timestamp() + interval '11 minutes' THEN
    RAISE EXCEPTION 'OAuth süresi geçersiz.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE user_id=p_user_id AND role IN ('owner','editor')) THEN
    RAISE EXCEPTION 'OAuth yetkisi gerekli.' USING ERRCODE = '42501';
  END IF;
  -- Influencer, kullanıcının çalışma alanında olmalı (service role RLS görmez).
  IF NOT private.user_can_write_influencer(p_user_id, p_influencer_id) THEN
    RAISE EXCEPTION 'OAuth yetkisi gerekli.' USING ERRCODE = '42501';
  END IF;
  -- Aynı kullanıcıdan gelen başlangıçları seri çalıştır, sınırsız verifier birikmesin.
  PERFORM 1 FROM auth.users WHERE id=p_user_id FOR UPDATE;
  DELETE FROM private.oauth_states WHERE expires_at <= clock_timestamp();
  IF (SELECT count(*) FROM private.oauth_states WHERE user_id=p_user_id) >= 20 THEN
    RAISE EXCEPTION 'OAuth deneme sınırı.' USING ERRCODE = '54000';
  END IF;
  INSERT INTO private.oauth_states VALUES(p_hash,p_user_id,p_influencer_id,p_platform,p_verifier,least(p_expires_at,clock_timestamp()+interval '10 minutes'));
END;
$$;

CREATE OR REPLACE FUNCTION private.oauth_state_consume(p_hash text, p_user_id uuid, p_influencer_id uuid,
 p_platform public.social_platform)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v private.oauth_states;
BEGIN
  IF NOT private.user_can_write_influencer(p_user_id, p_influencer_id) THEN
    RETURN NULL;
  END IF;
  -- DELETE ... RETURNING, aynı state için eşzamanlı callback'lerden yalnız birine veri verir.
  DELETE FROM private.oauth_states WHERE state_hash=p_hash AND user_id=p_user_id
    AND influencer_id=p_influencer_id AND platform=p_platform AND expires_at>clock_timestamp()
    RETURNING * INTO v;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('userId',v.user_id,'influencerId',v.influencer_id,
    'platform',v.platform,'verifier',v.verifier,'expiresAt',extract(epoch FROM v.expires_at)*1000);
END;
$$;

CREATE OR REPLACE FUNCTION private.oauth_connect_token(p_user_id uuid,p_account_id uuid,p_influencer_id uuid,
 p_platform public.social_platform,p_external_id text,p_token jsonb,p_expires_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.social_accounts;
BEGIN
 IF NOT private.user_can_write_influencer(p_user_id, p_influencer_id) THEN
  RAISE EXCEPTION 'OAuth yetkisi gerekli.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM public.social_accounts WHERE id=p_account_id FOR UPDATE;
 IF NOT FOUND OR a.influencer_id IS DISTINCT FROM p_influencer_id OR a.platform IS DISTINCT FROM p_platform
  OR a.workspace_id IS DISTINCT FROM private.user_workspace_id(p_user_id)
  OR a.external_id IS DISTINCT FROM p_external_id THEN
  RAISE EXCEPTION 'OAuth hesap eşleşmesi geçersiz.' USING ERRCODE='42501';
 END IF;
 IF a.status='revoked' AND a.token_ref IS NOT NULL THEN
  RAISE EXCEPTION 'Bağlantı kaldırma işlemi tamamlanmalı.' USING ERRCODE='55000';
 END IF;
 PERFORM public.store_social_token(p_account_id,p_token,p_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION private.oauth_revoke_begin(p_user_id uuid,p_account_id uuid,p_influencer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.social_accounts; t jsonb; n uuid;
BEGIN
 IF NOT private.user_can_write_influencer(p_user_id, p_influencer_id) THEN RAISE EXCEPTION 'Yetki gerekli.' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.social_accounts WHERE id=p_account_id FOR UPDATE;
 IF NOT FOUND OR a.influencer_id IS DISTINCT FROM p_influencer_id
  OR a.workspace_id IS DISTINCT FROM private.user_workspace_id(p_user_id) THEN RAISE EXCEPTION 'Hesap eşleşmiyor.' USING ERRCODE='42501'; END IF;
 IF a.token_ref IS NULL THEN UPDATE public.social_accounts SET status='revoked' WHERE id=a.id; RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM private.oauth_refresh_leases WHERE account_id=a.id AND expires_at>clock_timestamp())
 OR EXISTS(SELECT 1 FROM private.oauth_revoke_leases WHERE account_id=a.id AND expires_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'Hesap işlemi sürüyor.' USING ERRCODE='55000';
 END IF;
 SELECT s.decrypted_secret::jsonb INTO t FROM vault.decrypted_secrets s WHERE s.id::text=a.token_ref AND s.name='social-token:'||a.id::text;
 IF t IS NULL THEN RAISE EXCEPTION 'Token okunamadı.' USING ERRCODE='55000'; END IF;
 n:=pg_catalog.gen_random_uuid();
 INSERT INTO private.oauth_revoke_leases VALUES(a.id,n,clock_timestamp()+interval '3 minutes',a.token_ref)
 ON CONFLICT(account_id) DO UPDATE SET nonce=excluded.nonce,expires_at=excluded.expires_at,expected_ref=excluded.expected_ref;
 -- Bulut revoke tamamlanana kadar yeni refresh/bağlantı yazımını durdurur, sır retry için Vault'ta kalır.
 UPDATE public.social_accounts SET status='revoked' WHERE id=a.id;
 RETURN jsonb_build_object('nonce',n,'token',t);
END;
$$;

-- ── 8) Uyarılar ─────────────────────────────────────────────────────────────
-- Alan açıkça verilir; verilmezse influencer'dan, o da yoksa current_workspace_id()'den bulunur.
-- Alan belirlenemiyorsa (çok alanlı kurulumda influencer'sız, alansız çağrı) uyarı yazılmaz.
CREATE FUNCTION private.raise_alert(
  p_type text, p_influencer_id uuid, p_payload jsonb, p_dedupe_key text, p_workspace_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := COALESCE(
    (SELECT i.workspace_id FROM public.influencers i WHERE i.id = p_influencer_id),
    p_workspace_id,
    public.current_workspace_id()
  );
BEGIN
  IF v_ws IS NULL THEN
    RAISE LOG 'alerts: % için çalışma alanı belirlenemedi; uyarı yazılmadı.', p_type;
    RETURN false;
  END IF;
  INSERT INTO public.alerts (workspace_id, type, influencer_id, payload, dedupe_key)
  VALUES (v_ws, p_type, p_influencer_id, COALESCE(p_payload, '{}'::jsonb), p_dedupe_key)
  ON CONFLICT (workspace_id, dedupe_key) DO NOTHING;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION private.raise_alert(
  p_type text, p_influencer_id uuid, p_payload jsonb, p_dedupe_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.raise_alert(p_type, p_influencer_id, p_payload, p_dedupe_key, NULL::uuid);
END;
$$;
REVOKE ALL ON FUNCTION private.raise_alert(text, uuid, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.account_snapshots_milestone_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous bigint;
  v_milestone integer;
  v_account record;
BEGIN
  SELECT max(s.followers) INTO v_previous
  FROM public.account_snapshots s
  WHERE s.account_id = NEW.account_id AND s.captured_at < NEW.captured_at;
  IF v_previous IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT max(t.m) INTO v_milestone
  FROM public.notification_settings ns
  CROSS JOIN LATERAL unnest(ns.follower_milestones) AS t(m)
  WHERE ns.workspace_id = NEW.workspace_id AND t.m > v_previous AND t.m <= NEW.followers;
  IF v_milestone IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.influencer_id, a.platform INTO v_account
  FROM public.social_accounts a WHERE a.id = NEW.account_id;

  PERFORM private.raise_alert(
    'follower_milestone',
    v_account.influencer_id,
    jsonb_build_object(
      'account_id', NEW.account_id,
      'platform', v_account.platform,
      'milestone', v_milestone,
      'followers', NEW.followers
    ),
    'follower_milestone:' || NEW.account_id::text || ':' || v_milestone::text,
    NEW.workspace_id
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.metric_snapshots_viral_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post record;
  v_multiplier numeric;
  v_baseline numeric;
  v_samples integer;
BEGIN
  IF NEW.views <= 0 OR NOT (
    coalesce(NEW.target_hours = 1, false) OR coalesce(NEW.hours_since_publish <= 1, false)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT p.id, p.account_id, a.influencer_id, a.platform INTO v_post
  FROM public.posts p
  JOIN public.social_accounts a ON a.id = p.account_id
  WHERE p.id = NEW.post_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT s.viral_multiplier INTO v_multiplier
  FROM public.notification_settings s WHERE s.workspace_id = NEW.workspace_id;
  v_multiplier := COALESCE(v_multiplier, 3);

  SELECT avg(first_hour.views), count(*)::integer INTO v_baseline, v_samples
  FROM (
    SELECT max(m.views) AS views
    FROM public.posts p
    JOIN public.metric_snapshots m ON m.post_id = p.id
    WHERE p.account_id = v_post.account_id
      AND p.id <> NEW.post_id
      AND (m.target_hours = 1 OR m.hours_since_publish <= 1)
    GROUP BY p.id
    ORDER BY p.published_at DESC NULLS LAST
    LIMIT 30
  ) first_hour;

  IF v_samples < 3 OR v_baseline IS NULL OR v_baseline <= 0
     OR NEW.views < v_baseline * v_multiplier THEN
    RETURN NULL;
  END IF;

  PERFORM private.raise_alert(
    'viral_post',
    v_post.influencer_id,
    jsonb_build_object(
      'post_id', NEW.post_id,
      'account_id', v_post.account_id,
      'platform', v_post.platform,
      'views', NEW.views,
      'baseline', round(v_baseline),
      'ratio', round(NEW.views / v_baseline, 1),
      'multiplier', v_multiplier
    ),
    'viral_post:' || NEW.post_id::text,
    NEW.workspace_id
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.raise_token_alerts(p_account_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  inserted integer := 0;
BEGIN
  FOR r IN
    SELECT a.id, a.influencer_id, a.platform, a.token_expires_at
    FROM public.social_accounts a
    JOIN public.notification_settings ns ON ns.workspace_id = a.workspace_id
    WHERE a.token_expires_at IS NOT NULL
      AND a.status IN ('active', 'expired')
      AND a.token_expires_at <= now() + make_interval(days => ns.token_expiry_days)
      AND (p_account_id IS NULL OR a.id = p_account_id)
  LOOP
    IF private.raise_alert(
      'token_expiring',
      r.influencer_id,
      jsonb_build_object(
        'account_id', r.id,
        'platform', r.platform,
        'expires_at', r.token_expires_at,
        'days_left', greatest(0, ceil(extract(epoch FROM r.token_expires_at - now()) / 86400))::integer
      ),
      'token_expiring:' || r.id::text || ':' || to_char(r.token_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ) THEN
      inserted := inserted + 1;
    END IF;
  END LOOP;
  RETURN inserted;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_runs_failed_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_influencer uuid;
  v_platform public.social_platform;
BEGIN
  IF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'failed') THEN
    SELECT a.influencer_id, a.platform INTO v_influencer, v_platform
    FROM public.social_accounts a WHERE a.id = NEW.account_id;
    PERFORM private.raise_alert(
      'sync_failed',
      v_influencer,
      jsonb_build_object(
        'account_id', NEW.account_id,
        'platform', coalesce(NEW.platform, v_platform),
        'job', NEW.job,
        'sync_run_id', NEW.id
      ),
      'sync_failed:' || coalesce(NEW.account_id::text, 'job-' || NEW.job) || ':'
        || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      NEW.workspace_id
    );
  END IF;
  RETURN NULL;
END;
$$;

-- YouTube kotası alan başına izlenir (eşik alanın bildirim ayarından; toplam o alanın işlerinden).
CREATE OR REPLACE FUNCTION private.sync_runs_quota_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start timestamptz;
  v_used bigint;
  v_threshold integer;
BEGIN
  IF NEW.platform IS DISTINCT FROM 'youtube' OR coalesce(NEW.quota_units, 0) <= 0 THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.quota_units IS NOT DISTINCT FROM NEW.quota_units THEN
    RETURN NULL;
  END IF;

  SELECT coalesce((SELECT s.youtube_quota_warn_units FROM public.notification_settings s
    WHERE s.workspace_id = NEW.workspace_id), 8000)
  INTO v_threshold;
  v_start := private.youtube_quota_day_start(NEW.started_at);
  SELECT coalesce(sum(r.quota_units), 0) INTO v_used
  FROM public.sync_runs r
  WHERE r.platform = 'youtube'
    AND r.workspace_id = NEW.workspace_id
    AND r.started_at >= v_start
    AND r.started_at < v_start + interval '1 day';

  IF v_used >= v_threshold THEN
    PERFORM private.raise_alert(
      'quota_warning',
      NULL,
      jsonb_build_object(
        'platform', 'youtube',
        'used_units', v_used,
        'threshold_units', v_threshold,
        'daily_limit_units', 10000,
        'quota_day', to_char(NEW.started_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD')
      ),
      'quota_warning:youtube:' || to_char(NEW.started_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD'),
      NEW.workspace_id
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION private.alert_push_requests(p_type text, p_workspace_id uuid)
RETURNS TABLE (channel text, url text, headers jsonb, body jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.notification_settings;
  v_title text := private.alert_push_title(p_type);
  v_text text;
  v_url text;
  v_token text;
  v_chat text;
  v_from text;
  v_to text;
BEGIN
  SELECT * INTO s FROM public.notification_settings ns WHERE ns.workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- Push hedefleri (Vault sırları) kurulum genelinde tektir; yalnız operatörün açtığı alanlar kullanır.
  IF NOT COALESCE(
    (SELECT w.push_enabled FROM public.workspaces w WHERE w.id = p_workspace_id), false
  ) THEN
    RETURN;
  END IF;
  v_text := v_title || '. Ayrıntılar panelde: Bildirimler.';

  IF s.push_ntfy THEN
    v_url := private.notify_secret('notify_ntfy_url');
    IF v_url ~ '^https://[^/?#]+/[A-Za-z0-9_-]{1,64}$' THEN
      v_token := private.notify_secret('notify_ntfy_token');
      channel := 'ntfy';
      url := regexp_replace(v_url, '/[^/]+$', '');
      headers := jsonb_build_object('Content-Type', 'application/json')
        || CASE WHEN v_token IS NULL THEN '{}'::jsonb
                ELSE jsonb_build_object('Authorization', 'Bearer ' || v_token) END;
      body := jsonb_build_object(
        'topic', substring(v_url FROM '[^/]+$'),
        'title', 'AI Influencer Studio',
        'message', v_text
      );
      RETURN NEXT;
    END IF;
  END IF;

  IF s.push_telegram THEN
    v_token := private.notify_secret('notify_telegram_bot_token');
    v_chat := private.notify_secret('notify_telegram_chat_id');
    IF v_token ~ '^[0-9]+:[A-Za-z0-9_-]+$' AND v_chat IS NOT NULL THEN
      channel := 'telegram';
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage';
      headers := jsonb_build_object('Content-Type', 'application/json');
      body := jsonb_build_object('chat_id', v_chat, 'text', v_text);
      RETURN NEXT;
    END IF;
  END IF;

  IF s.push_email THEN
    v_token := private.notify_secret('notify_resend_api_key');
    v_from := private.notify_secret('notify_email_from');
    v_to := private.notify_secret('notify_email_to');
    IF v_token IS NOT NULL AND v_from IS NOT NULL AND v_to IS NOT NULL THEN
      channel := 'email';
      url := 'https://api.resend.com/emails';
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_token
      );
      body := jsonb_build_object(
        'from', v_from,
        'to', to_jsonb(ARRAY(SELECT trim(x) FROM unnest(string_to_array(v_to, ',')) AS x WHERE trim(x) <> '')),
        'subject', 'AI Influencer Studio: ' || v_title,
        'text', v_text
      );
      RETURN NEXT;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.alert_push_requests(p_type text)
RETURNS TABLE (channel text, url text, headers jsonb, body jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT r.channel, r.url, r.headers, r.body
  FROM private.alert_push_requests(p_type, public.current_workspace_id()) r;
END;
$$;
REVOKE ALL ON FUNCTION private.alert_push_requests(text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.alerts_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  v_limit integer := private.alert_push_limit();
BEGIN
  FOR r IN SELECT * FROM private.alert_push_requests(NEW.type, NEW.workspace_id) LOOP
    BEGIN
      DELETE FROM private.alert_push_log l
      WHERE l.channel = r.channel AND l.sent_at < now() - interval '1 hour';
      IF (
        SELECT count(*) FROM private.alert_push_log l
        WHERE l.channel = r.channel AND l.sent_at > now() - interval '10 minutes'
      ) >= v_limit THEN
        RAISE LOG 'Bildirim kanalı % için 10 dakikalık sınır (%) doldu; push atlandı.', r.channel, v_limit;
        CONTINUE;
      END IF;
      PERFORM private.http_post(r.url, r.headers, r.body);
      INSERT INTO private.alert_push_log (channel) VALUES (r.channel);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Bildirim kanalı % için istek oluşturulamadı (SQLSTATE %).', r.channel, SQLSTATE;
    END;
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Bildirim gönderimi atlandı (SQLSTATE %).', SQLSTATE;
  RETURN NULL;
END;
$$;

-- ── 9) Kur, kredi fiyatı, bütçe: alan açıkça filtrelenir ────────────────────
-- exchange_rates ve credit_rates owner tarafından düzenlenir, yani kiracıya aittir. Çekirdekler
-- `internal` şemasında ve alanı parametre alır (SECURITY INVOKER: kullanıcı çağırırsa RLS de
-- uygulanır; service role / DEFINER bağlamında satırın kendi workspace_id'si verilir).
-- public sarmalayıcıların imzası değişmez; alanı current_workspace_id()'den alırlar.
CREATE FUNCTION internal.fx_rate(p_from char(3), p_to char(3), p_on date, p_workspace_id uuid)
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
       WHERE r.workspace_id = p_workspace_id
         AND r.currency = p_from AND r.base_currency = p_to AND r.valid_on <= p_on
       ORDER BY r.valid_on DESC LIMIT 1),
      (SELECT 1 / r.rate FROM public.exchange_rates r
       WHERE r.workspace_id = p_workspace_id
         AND r.currency = p_to AND r.base_currency = p_from AND r.valid_on <= p_on
       ORDER BY r.valid_on DESC LIMIT 1)
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.fx_rate(p_from char(3), p_to char(3), p_on date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT internal.fx_rate(p_from, p_to, p_on, public.current_workspace_id())
$$;

CREATE FUNCTION internal.credits_to_money(
  p_tool text, p_credits numeric, p_on date, p_workspace_id uuid
)
RETURNS TABLE (amount numeric, currency char(3))
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT round(p_credits * cr.rate_per_credit, 4), cr.currency
  FROM public.credit_rates cr
  WHERE cr.workspace_id = p_workspace_id AND cr.tool = p_tool AND cr.valid_from <= p_on
  ORDER BY cr.valid_from DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.credits_to_money(p_tool text, p_credits numeric, p_on date)
RETURNS TABLE (amount numeric, currency char(3))
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT m.amount, m.currency
  FROM internal.credits_to_money(p_tool, p_credits, p_on, public.current_workspace_id()) m
$$;

CREATE FUNCTION internal.cost_entries_converted(
  p_from date,
  p_to date,
  p_currency char(3),
  p_influencer_id uuid,
  p_workspace_id uuid
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
    round(c.amount * internal.fx_rate(c.currency, p_currency, c.incurred_on, p_workspace_id), 4)
  FROM public.costs c
  WHERE c.workspace_id = p_workspace_id
    AND c.incurred_on BETWEEN p_from AND p_to
    AND (p_influencer_id IS NULL OR c.influencer_id = p_influencer_id)
$$;

CREATE OR REPLACE FUNCTION public.cost_entries_converted(
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
  SELECT e.id, e.influencer_id, e.category, e.incurred_on, e.amount, e.currency, e.generation_id,
    e.converted_amount
  FROM internal.cost_entries_converted(
    p_from, p_to, p_currency, p_influencer_id, public.current_workspace_id()
  ) e
$$;

CREATE FUNCTION internal.budget_status(p_month date, p_workspace_id uuid)
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
    FROM internal.cost_entries_converted(
      b.month, (b.month + interval '1 month' - interval '1 day')::date, b.currency,
      b.influencer_id, p_workspace_id
    ) e
  ) s
  WHERE b.workspace_id = p_workspace_id
    AND b.month = date_trunc('month', p_month)::date
$$;

CREATE OR REPLACE FUNCTION public.budget_status(p_month date)
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
  SELECT s.budget_id, s.influencer_id, s.month, s.amount, s.currency, s.warn_ratio, s.spent,
    s.missing_rate_count, s.ratio
  FROM internal.budget_status(p_month, public.current_workspace_id()) s
$$;

REVOKE ALL ON FUNCTION
  internal.fx_rate(char, char, date, uuid),
  internal.credits_to_money(text, numeric, date, uuid),
  internal.cost_entries_converted(date, date, char, uuid, uuid),
  internal.budget_status(date, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  internal.fx_rate(char, char, date, uuid),
  internal.credits_to_money(text, numeric, date, uuid),
  internal.cost_entries_converted(date, date, char, uuid, uuid),
  internal.budget_status(date, uuid)
  TO authenticated, service_role;

-- Bütçe uyarısı: yalnız değişen satırın alanındaki bütçeler denetlenir. Eski sürüm DEFINER
-- bağlamında (RLS'siz) tüm alanların bütçelerini ve giderlerini birlikte topluyordu.
CREATE FUNCTION private.raise_budget_alerts(p_month date, p_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted integer;
BEGIN
  IF p_workspace_id IS NULL THEN
    RETURN 0;
  END IF;
  WITH due AS (
    SELECT
      s.*,
      CASE WHEN s.ratio >= 1 THEN 'budget_exceeded' ELSE 'budget_warning' END AS level
    FROM internal.budget_status(p_month, p_workspace_id) s
    WHERE s.ratio IS NOT NULL AND s.ratio >= s.warn_ratio
  ),
  ins AS (
    INSERT INTO public.alerts (workspace_id, influencer_id, type, payload)
    SELECT
      p_workspace_id,
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

CREATE OR REPLACE FUNCTION private.costs_check_budgets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'budgets' THEN
    PERFORM private.raise_budget_alerts(NEW.month, NEW.workspace_id);
  ELSE
    PERFORM private.raise_budget_alerts(NEW.incurred_on, NEW.workspace_id);
  END IF;
  RETURN NULL;
END;
$$;
DROP FUNCTION private.raise_budget_alerts(date);
REVOKE ALL ON FUNCTION private.raise_budget_alerts(date, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Üretim → maliyet kaydı: kredi fiyatı üretimin KENDİ alanından okunur (worker service role ile
-- yazar, RLS yoktur). Kredi fiyatı değişince yalnız o alanın üretimleri tamamlanır.
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
    workspace_id, influencer_id, category, description, amount, currency, credits, generation_id,
    incurred_on
  )
  SELECT
    g.workspace_id,
    g.influencer_id,
    'credits'::public.cost_category,
    format('%s %s üretimi (%s)', g.tool, g.type, g.status),
    CASE WHEN g.cost_usd > 0 THEN g.cost_usd ELSE m.amount END,
    CASE WHEN g.cost_usd > 0 THEN 'USD'::char(3) ELSE m.currency END,
    g.credits,
    g.id,
    g.created_at::date
  FROM public.generations g
  LEFT JOIN LATERAL internal.credits_to_money(
    g.tool, g.credits, g.created_at::date, g.workspace_id
  ) m ON true
  WHERE g.status IN ('succeeded', 'failed')
    AND g.workspace_id = NEW.workspace_id
    AND (g.cost_usd > 0 OR (g.credits > 0 AND m.amount IS NOT NULL))
    AND (v_generation_id IS NULL OR g.id = v_generation_id)
    AND (v_tool IS NULL OR (g.tool = v_tool AND g.created_at::date >= v_from))
    AND NOT EXISTS (SELECT 1 FROM public.costs c WHERE c.generation_id = g.id)
  ON CONFLICT (generation_id) DO NOTHING;

  RETURN NULL;
END;
$$;

-- ── 10) Haftalık rapor ──────────────────────────────────────────────────────
CREATE FUNCTION internal.report_summary(
  p_from date,
  p_to date,
  p_influencer_id uuid,
  p_currency char(3),
  p_workspace_id uuid
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
    WHERE sa.workspace_id = p_workspace_id
      AND (p_influencer_id IS NULL OR sa.influencer_id = p_influencer_id)
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
    FROM internal.cost_entries_converted(p_from, p_to, p_currency, p_influencer_id, p_workspace_id) e
  ),
  learning_items AS (
    SELECT l.id, l.body, l.tags, l.post_id, l.created_at
    FROM public.learnings l
    CROSS JOIN period
    WHERE l.workspace_id = p_workspace_id
      AND (p_influencer_id IS NULL OR l.influencer_id = p_influencer_id)
      AND l.created_at >= period.start_at
      AND l.created_at < period.end_at
  ),
  next_items AS (
    SELECT c.id, c.title, c.stage, c.scheduled_at
    FROM public.content_items c
    CROSS JOIN period
    WHERE c.workspace_id = p_workspace_id
      AND (p_influencer_id IS NULL OR c.influencer_id = p_influencer_id)
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
      SELECT 1 FROM public.influencers i
      WHERE i.id = p_influencer_id AND i.workspace_id = p_workspace_id
    ));
$$;

CREATE OR REPLACE FUNCTION public.report_summary(
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
  SELECT internal.report_summary(
    p_from, p_to, p_influencer_id, p_currency, public.current_workspace_id()
  )
$$;
REVOKE ALL ON FUNCTION internal.report_summary(date, date, uuid, char, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.report_summary(date, date, uuid, char, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_weekly_report(
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
  v_ws uuid := public.current_workspace_id();
  v_this_week date := date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
  IF p_period_start IS NULL OR extract(isodow FROM p_period_start) <> 1 THEN
    RAISE EXCEPTION 'period_start must be a Monday' USING ERRCODE = '22023';
  END IF;
  IF p_period_start > v_this_week THEN
    RAISE EXCEPTION 'period_start is in the future' USING ERRCODE = '22023';
  END IF;

  v_summary := internal.report_summary(p_period_start, p_period_start + 6, p_influencer_id, 'USD', v_ws);
  IF v_summary IS NULL THEN
    RAISE EXCEPTION 'influencer not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.reports AS r (workspace_id, influencer_id, period_start, period_end, summary)
  VALUES (v_ws, p_influencer_id, p_period_start, p_period_start + 6, v_summary)
  ON CONFLICT (workspace_id, influencer_id, period_start) DO UPDATE
    SET summary = EXCLUDED.summary,
        ai_summary = CASE WHEN r.summary = EXCLUDED.summary THEN r.ai_summary END
  RETURNING r.id INTO v_id;
  RETURN v_id;
END;
$$;

-- Cron (postgres, RLS'siz): her alan için ayrı ekip toplamı + o alanın influencer'ları.
CREATE OR REPLACE FUNCTION public.generate_weekly_reports(p_period_start date DEFAULT NULL)
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
    SELECT w.id AS workspace_id, NULL::uuid AS influencer_id FROM public.workspaces w
    UNION ALL
    SELECT i.workspace_id, i.id FROM public.influencers i WHERE i.status IN ('active', 'paused')
  ),
  created AS (
    INSERT INTO public.reports (workspace_id, influencer_id, period_start, period_end, summary)
    SELECT t.workspace_id, t.influencer_id, v_start, v_start + 6,
      internal.report_summary(v_start, v_start + 6, t.influencer_id, 'USD', t.workspace_id)
    FROM targets t
    ON CONFLICT (workspace_id, influencer_id, period_start) DO NOTHING
    RETURNING id, workspace_id, influencer_id, period_start
  ),
  notified AS (
    INSERT INTO public.alerts (workspace_id, influencer_id, type, payload, dedupe_key)
    SELECT c.workspace_id, c.influencer_id, 'weekly_report_ready',
      jsonb_build_object('report_id', c.id::text, 'period_start', c.period_start::text),
      'weekly_report_ready:' || c.id::text
    FROM created c
    ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_created FROM created;
  RETURN v_created;
END;
$$;

-- ── 11) Kullanıcı tetikli DEFINER çekirdekler ───────────────────────────────
CREATE OR REPLACE FUNCTION internal.cancel_generation(p_id uuid)
RETURNS public.generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  g public.generations;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'İptal için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  -- DEFINER RLS görmez: yalnız çağıranın alanındaki üretim bulunur.
  SELECT * INTO g FROM public.generations
  WHERE id = p_id AND workspace_id = public.current_workspace_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Üretim bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF g.status NOT IN ('queued', 'running') THEN
    RAISE EXCEPTION 'Biten üretim iptal edilemez.' USING ERRCODE = '55000';
  END IF;

  IF g.provider_job_id IS NULL THEN
    UPDATE public.generations
    SET status = 'cancelled', finished_at = now(), cancel_requested_at = now()
    WHERE id = p_id
    RETURNING * INTO g;
  ELSE
    -- Sağlayıcıdaki işi worker iptal eder; hemen ele alınsın.
    UPDATE public.generations
    SET cancel_requested_at = now(), next_run_at = now()
    WHERE id = p_id
    RETURNING * INTO g;
  END IF;
  RETURN g;
END;
$$;

-- Zamanlanmış çağrılar (2 parametre) tüm alanları kapsar; panelden gelen manuel istek alanla
-- sınırlanır (sync-dispatch gövdesine workspace_id eklenir).
CREATE FUNCTION private.invoke_sync(p_job text, p_account_id uuid, p_workspace_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := private.notify_secret('project_url');
  v_secret text := private.notify_secret('cron_secret');
BEGIN
  IF p_job IS NULL OR p_job NOT IN ('metrics', 'posts', 'accounts', 'manual') THEN
    RAISE EXCEPTION 'Geçersiz senkronizasyon işi.' USING ERRCODE = '22023';
  END IF;
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE LOG 'sync: Vault sırları (project_url, cron_secret) tanımlı değil; % işi atlandı.', p_job;
    RETURN NULL;
  END IF;
  v_url := rtrim(v_url, '/');
  IF NOT private.valid_project_url(v_url) THEN
    RAISE LOG 'sync: project_url biçimi geçersiz; % işi atlandı.', p_job;
    RETURN NULL;
  END IF;
  RETURN private.http_post(
    v_url || '/functions/v1/sync-dispatch',
    jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    jsonb_build_object('job', p_job)
      || CASE WHEN p_account_id IS NULL THEN '{}'::jsonb
              ELSE jsonb_build_object('account_id', p_account_id) END
      || CASE WHEN p_workspace_id IS NULL THEN '{}'::jsonb
              ELSE jsonb_build_object('workspace_id', p_workspace_id) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.invoke_sync(p_job text, p_account_id uuid DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.invoke_sync(p_job, p_account_id, NULL::uuid);
END;
$$;
REVOKE ALL ON FUNCTION private.invoke_sync(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION internal.request_sync(p_account_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request bigint;
  v_ws uuid := public.current_workspace_id();
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'Senkronizasyonu yalnız owner veya editör başlatabilir.' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.social_accounts a
    WHERE a.id = p_account_id AND a.workspace_id = v_ws
      AND a.status IN ('active', 'error') AND a.token_ref IS NOT NULL
  ) THEN
    RETURN 'not_found';
  END IF;
  -- Eşzamanlı iki tıklama da aynı kontrolden geçer: kısıtlama alan başına tek kilit altında.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.request_sync:' || v_ws::text, 0)
  );
  IF EXISTS (
    SELECT 1 FROM private.sync_requests r
    WHERE r.workspace_id = v_ws
      AND r.requested_at > now() - interval '2 minutes'
      AND (r.account_id IS NULL OR r.account_id IS NOT DISTINCT FROM p_account_id)
  ) THEN
    RETURN 'throttled';
  END IF;
  v_request := private.invoke_sync('manual', p_account_id, v_ws);
  IF v_request IS NULL THEN
    RETURN 'not_configured';
  END IF;
  INSERT INTO private.sync_requests (account_id, requested_by, request_id, workspace_id)
  VALUES (p_account_id, auth.uid(), v_request, v_ws);
  RETURN 'queued';
END;
$$;

-- ── 12) Storage: klasör çağıranın alanında olmalı ───────────────────────────
-- Önceki okuma/silme policy'leri yalnız role bakıyordu (bucket içindeki her nesne). Yazma
-- yardımcıları RLS üzerinden zaten alanla sınırlanır; alan koşulu açıkça da eklenir.
CREATE OR REPLACE FUNCTION public.asset_object_in_influencer_folder(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(array_length(storage.foldername(object_name), 1), 0) = 1
    AND EXISTS (
      SELECT 1
      FROM public.influencers AS i
      WHERE i.id::text = (storage.foldername(object_name))[1]
        AND i.workspace_id = public.current_workspace_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.brand_file_in_deal_folder(object_name text)
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
        AND d.workspace_id = public.current_workspace_id()
    );
$$;

-- Nesnenin ilk klasörü çağıranın alanındaki bir influencer (assets) ya da deal (contracts) mı?
-- Bilinmeyen bucket: false (yeni bucket eklenince buraya da eklenmeli; pgTAP hatırlatır).
CREATE FUNCTION public.storage_object_in_workspace(p_bucket_id text, p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE p_bucket_id
    WHEN 'assets' THEN EXISTS (
      SELECT 1 FROM public.influencers AS i
      WHERE i.id::text = (storage.foldername(p_object_name))[1]
        AND i.workspace_id = public.current_workspace_id()
    )
    WHEN 'contracts' THEN EXISTS (
      SELECT 1 FROM public.brand_deals AS d
      WHERE d.id::text = (storage.foldername(p_object_name))[1]
        AND d.workspace_id = public.current_workspace_id()
    )
    ELSE false
  END
$$;
COMMENT ON FUNCTION public.storage_object_in_workspace(text, text) IS
  'Storage nesnesinin klasörü çağıranın çalışma alanına mı ait? Tanımsız bucket için false.';
REVOKE ALL ON FUNCTION public.storage_object_in_workspace(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_object_in_workspace(text, text) TO authenticated;

CREATE POLICY storage_objects_workspace ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.storage_object_in_workspace(bucket_id, name))
  WITH CHECK (public.storage_object_in_workspace(bucket_id, name));

-- ── 13) Yeni alan açma (yalnız service role) ────────────────────────────────
-- Alan + owner üyeliği. Kullanıcı başka bir alanda üyeyse taşınır; o alanın son owner'ıysa hata.
-- İstemciden alan oluşturma yok (self-serve kayıt sonraki faz): pnpm workspace:create.
CREATE FUNCTION private.create_workspace_for_user(p_user_id uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(COALESCE(p_name, ''));
  v_member public.team_members;
  v_ws uuid;
BEGIN
  IF length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Çalışma alanı adı 1-80 karakter olmalı.' USING ERRCODE = '22023';
  END IF;
  -- Aynı kullanıcı için eşzamanlı çağrılar sıraya girer.
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kullanıcı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_member FROM public.team_members WHERE user_id = p_user_id FOR UPDATE;
  IF FOUND THEN
    IF v_member.role = 'owner' AND NOT EXISTS (
      SELECT 1 FROM public.team_members m
      WHERE m.workspace_id = v_member.workspace_id AND m.role = 'owner' AND m.user_id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'Kullanıcı mevcut çalışma alanının son owner''ı; önce başka bir owner atayın.'
        USING ERRCODE = '23514', HINT = 'last_owner';
    END IF;
    DELETE FROM public.team_members WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.workspaces (name, created_by)
  VALUES (v_name, p_user_id)
  RETURNING id INTO v_ws;
  INSERT INTO public.team_members (user_id, role, workspace_id, created_by)
  VALUES (p_user_id, 'owner', v_ws, p_user_id);
  RETURN v_ws;
END;
$$;

CREATE FUNCTION public.create_workspace_for_user(p_user_id uuid, p_name text)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.create_workspace_for_user(p_user_id, p_name)
$$;
REVOKE ALL ON FUNCTION private.create_workspace_for_user(uuid, text),
  public.create_workspace_for_user(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.create_workspace_for_user(uuid, text),
  public.create_workspace_for_user(uuid, text) TO service_role;
