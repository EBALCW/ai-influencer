-- Core single-team schema for AI Influencer Studio.
-- Secrets and OAuth tokens are stored in Supabase Vault, never in these tables.

CREATE TYPE public.team_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE public.influencer_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE public.asset_kind AS ENUM ('reference', 'generated', 'final_video', 'thumbnail');
CREATE TYPE public.prompt_category AS ENUM ('character', 'video2video', 'short_film', 'caption', 'research');
CREATE TYPE public.generation_type AS ENUM ('image', 'video');
CREATE TYPE public.generation_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE public.social_platform AS ENUM ('instagram', 'youtube', 'tiktok');
CREATE TYPE public.social_account_status AS ENUM ('pending', 'active', 'expired', 'revoked', 'error');
CREATE TYPE public.content_stage AS ENUM ('idea', 'script', 'production', 'qc', 'edit', 'scheduled', 'published');
CREATE TYPE public.brand_deal_stage AS ENUM ('lead', 'negotiation', 'signed', 'delivered', 'paid', 'lost');
CREATE TYPE public.cost_category AS ENUM ('subscription', 'credits', 'tool', 'other');

CREATE TABLE public.team_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.team_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE TABLE public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  niche text,
  language text NOT NULL DEFAULT 'tr' CHECK (length(language) BETWEEN 2 AND 16),
  status public.influencer_status NOT NULL DEFAULT 'draft',
  avatar_asset_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE TABLE public.influencer_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  bio text NOT NULL DEFAULT '',
  personality jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(personality) = 'object'),
  tone text NOT NULL DEFAULT '',
  audience jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(audience) = 'object'),
  hook_traits text[] NOT NULL DEFAULT '{}',
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  UNIQUE (influencer_id, version)
);
CREATE UNIQUE INDEX influencer_personas_one_current_idx
  ON public.influencer_personas (influencer_id) WHERE is_current;

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  kind public.asset_kind NOT NULL,
  storage_path text NOT NULL UNIQUE CHECK (length(trim(storage_path)) > 0),
  mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  tags text[] NOT NULL DEFAULT '{}',
  qc_status text NOT NULL DEFAULT 'pending' CHECK (qc_status IN ('pending', 'passed', 'failed')),
  version_tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.influencers
  ADD CONSTRAINT influencers_avatar_asset_id_fkey
  FOREIGN KEY (avatar_asset_id) REFERENCES public.assets (id) ON DELETE SET NULL;

CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  category public.prompt_category NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  negative text NOT NULL DEFAULT '',
  variables jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(variables) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  rating numeric(2, 1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX prompts_scope_category_version_idx
  ON public.prompts (COALESCE(influencer_id, '00000000-0000-0000-0000-000000000000'::uuid), category, version);

CREATE TABLE public.generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES public.prompts (id) ON DELETE SET NULL,
  tool text NOT NULL CHECK (length(trim(tool)) > 0),
  type public.generation_type NOT NULL,
  input_asset_ids uuid[] NOT NULL DEFAULT '{}',
  output_asset_id uuid REFERENCES public.assets (id) ON DELETE SET NULL,
  credits numeric(12, 4) CHECK (credits IS NULL OR credits >= 0),
  status public.generation_status NOT NULL DEFAULT 'queued',
  error text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  handle text NOT NULL CHECK (length(trim(handle)) > 0),
  external_id text,
  token_ref text,
  token_expires_at timestamptz,
  status public.social_account_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  UNIQUE (influencer_id, platform, handle)
);
CREATE UNIQUE INDEX social_accounts_platform_external_id_idx
  ON public.social_accounts (platform, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  format text NOT NULL DEFAULT 'short_video',
  hook_type text,
  stage public.content_stage NOT NULL DEFAULT 'idea',
  scheduled_at timestamptz,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checklist) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid REFERENCES public.content_items (id) ON DELETE SET NULL,
  account_id uuid NOT NULL REFERENCES public.social_accounts (id) ON DELETE RESTRICT,
  external_id text,
  url text,
  caption text NOT NULL DEFAULT '',
  published_at timestamptz,
  duration_s numeric(10, 3) CHECK (duration_s IS NULL OR duration_s >= 0),
  is_short boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX posts_account_external_id_idx
  ON public.posts (account_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX posts_account_published_at_idx
  ON public.posts (account_id, published_at DESC);

CREATE TABLE public.metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  hours_since_publish numeric(10, 2) CHECK (hours_since_publish IS NULL OR hours_since_publish >= 0),
  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  reach bigint CHECK (reach IS NULL OR reach >= 0),
  likes bigint NOT NULL DEFAULT 0 CHECK (likes >= 0),
  comments bigint NOT NULL DEFAULT 0 CHECK (comments >= 0),
  shares bigint NOT NULL DEFAULT 0 CHECK (shares >= 0),
  saves bigint NOT NULL DEFAULT 0 CHECK (saves >= 0),
  avg_watch_time_s numeric(10, 3) CHECK (avg_watch_time_s IS NULL OR avg_watch_time_s >= 0),
  completion_rate numeric(6, 5) CHECK (completion_rate IS NULL OR completion_rate BETWEEN 0 AND 1),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(raw_payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  UNIQUE (post_id, captured_at)
);
CREATE INDEX metric_snapshots_post_captured_at_idx
  ON public.metric_snapshots (post_id, captured_at DESC);

CREATE TABLE public.account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.social_accounts (id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  followers bigint NOT NULL DEFAULT 0 CHECK (followers >= 0),
  following bigint CHECK (following IS NULL OR following >= 0),
  media_count bigint CHECK (media_count IS NULL OR media_count >= 0),
  reach_day bigint CHECK (reach_day IS NULL OR reach_day >= 0),
  profile_views bigint CHECK (profile_views IS NULL OR profile_views >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  UNIQUE (account_id, captured_at)
);
CREATE INDEX account_snapshots_account_captured_at_idx
  ON public.account_snapshots (account_id, captured_at DESC);

CREATE TABLE public.costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  category public.cost_category NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric(14, 4) NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  credits numeric(14, 4) CHECK (credits IS NULL OR credits >= 0),
  generation_id uuid REFERENCES public.generations (id) ON DELETE SET NULL,
  incurred_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
CREATE INDEX costs_influencer_incurred_on_idx
  ON public.costs (influencer_id, incurred_on DESC);

CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  website text,
  contact_name text,
  contact_email text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX brands_name_lower_idx ON public.brands (lower(name));

CREATE TABLE public.brand_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE RESTRICT,
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  stage public.brand_deal_stage NOT NULL DEFAULT 'lead',
  fee numeric(14, 2) CHECK (fee IS NULL OR fee >= 0),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(deliverables) = 'array'),
  due_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
CREATE INDEX brand_deals_influencer_stage_idx
  ON public.brand_deals (influencer_id, stage);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  type text NOT NULL CHECK (length(trim(type)) > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX influencers_status_name_idx ON public.influencers (status, name);
CREATE INDEX assets_influencer_kind_idx ON public.assets (influencer_id, kind);
CREATE INDEX content_items_influencer_stage_schedule_idx
  ON public.content_items (influencer_id, stage, scheduled_at);
CREATE INDEX generations_influencer_created_at_idx
  ON public.generations (influencer_id, created_at DESC);

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.current_team_role()
RETURNS public.team_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT member.role
  FROM public.team_members AS member
  WHERE member.user_id = auth.uid()
$$;

CREATE FUNCTION public.is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT public.current_team_role() IS NOT NULL
$$;

CREATE FUNCTION public.can_write_data()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT COALESCE(public.current_team_role() IN ('owner', 'editor'), false)
$$;

CREATE FUNCTION public.can_manage_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT COALESCE(public.current_team_role() = 'owner', false)
$$;

CREATE FUNCTION public.is_initial_owner_setup()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.team_members)
$$;

CREATE FUNCTION public.prevent_last_team_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  remaining_owners integer;
BEGIN
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner') THEN
    SELECT count(*) INTO remaining_owners
    FROM public.team_members
    WHERE role = 'owner' AND user_id <> OLD.user_id;

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

CREATE TRIGGER team_members_set_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER team_members_prevent_last_owner_removal
  BEFORE UPDATE OF role OR DELETE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_team_owner_removal();

DO $$
DECLARE
  table_name text;
  app_tables text[] := ARRAY[
    'influencers', 'influencer_personas', 'assets', 'prompts', 'generations',
    'social_accounts', 'content_items', 'posts', 'metric_snapshots',
    'account_snapshots', 'costs', 'brands', 'brand_deals', 'alerts'
  ];
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      table_name || '_set_updated_at', table_name
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

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_members_read ON public.team_members
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'owner' AND public.is_initial_owner_setup())
    OR public.can_manage_team()
  );
CREATE POLICY team_members_update ON public.team_members
  FOR UPDATE TO authenticated
  USING (public.can_manage_team())
  WITH CHECK (public.can_manage_team());
CREATE POLICY team_members_delete ON public.team_members
  FOR DELETE TO authenticated USING (public.can_manage_team());

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

REVOKE ALL ON FUNCTION public.current_team_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_team() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_initial_owner_setup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_team_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_initial_owner_setup() TO authenticated;

COMMENT ON TABLE public.team_members IS 'Single-team membership and application role for Supabase Auth users.';
COMMENT ON COLUMN public.social_accounts.token_ref IS 'Reference to a secret in Supabase Vault; never store the token itself here.';
COMMENT ON COLUMN public.assets.storage_path IS 'Object path in a private Supabase Storage bucket.';
