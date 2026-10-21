/**
 * Database contract for the migrations in `supabase/migrations`.
 * Regenerate from the local Supabase database with `pnpm supabase:types`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TeamRole = 'owner' | 'editor' | 'viewer';
export type InfluencerStatus = 'draft' | 'active' | 'paused' | 'archived';
export type AssetKind = 'reference' | 'generated' | 'final_video' | 'thumbnail';
export type PromptCategory =
  'character' | 'video2video' | 'short_film' | 'caption' | 'research';
export type GenerationType = 'image' | 'video';
export type GenerationStatus =
  'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type SocialPlatform = 'instagram' | 'youtube' | 'tiktok';
export type SocialAccountStatus =
  'pending' | 'active' | 'expired' | 'revoked' | 'error';
export type ContentStage =
  'idea' | 'script' | 'production' | 'qc' | 'edit' | 'scheduled' | 'published';
export type BrandDealStage =
  'lead' | 'negotiation' | 'signed' | 'delivered' | 'paid' | 'lost';
export type CostCategory = 'subscription' | 'credits' | 'tool' | 'other';

type AuditColumns = {
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

type Table<
  Row extends Record<string, unknown>,
  Required extends keyof Row = never,
> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      team_members: Table<
        AuditColumns & { user_id: string; role: TeamRole },
        'user_id' | 'role'
      >;
      influencers: Table<
        AuditColumns & {
          id: string;
          name: string;
          slug: string;
          niche: string | null;
          language: string;
          status: InfluencerStatus;
          avatar_asset_id: string | null;
        },
        'name' | 'slug'
      >;
      influencer_personas: Table<
        AuditColumns & {
          id: string;
          influencer_id: string;
          version: number;
          bio: string;
          personality: Json;
          tone: string;
          audience: Json;
          hook_traits: string[];
          is_current: boolean;
        },
        'influencer_id' | 'version'
      >;
      assets: Table<
        AuditColumns & {
          id: string;
          influencer_id: string | null;
          kind: AssetKind;
          storage_path: string;
          mime_type: string | null;
          file_size_bytes: number | null;
          width: number | null;
          height: number | null;
          duration_ms: number | null;
          tags: string[];
          qc_status: 'pending' | 'passed' | 'failed';
          version_tag: string | null;
        },
        'kind' | 'storage_path'
      >;
      prompts: Table<
        AuditColumns & {
          id: string;
          influencer_id: string | null;
          category: PromptCategory;
          body: string;
          negative: string;
          variables: Json;
          version: number;
          rating: number | null;
        },
        'category' | 'body'
      >;
      generations: Table<
        AuditColumns & {
          id: string;
          influencer_id: string;
          prompt_id: string | null;
          tool: string;
          type: GenerationType;
          input_asset_ids: string[];
          output_asset_id: string | null;
          credits: number | null;
          status: GenerationStatus;
          error: string | null;
          duration_ms: number | null;
        },
        'influencer_id' | 'tool' | 'type'
      >;
      social_accounts: Table<
        AuditColumns & {
          id: string;
          influencer_id: string;
          platform: SocialPlatform;
          handle: string;
          external_id: string | null;
          token_ref: string | null;
          token_expires_at: string | null;
          status: SocialAccountStatus;
        },
        'influencer_id' | 'platform' | 'handle'
      >;
      content_items: Table<
        AuditColumns & {
          id: string;
          influencer_id: string;
          title: string;
          format: string;
          hook_type: string | null;
          stage: ContentStage;
          scheduled_at: string | null;
          checklist: Json;
        },
        'influencer_id' | 'title'
      >;
      posts: Table<
        AuditColumns & {
          id: string;
          content_item_id: string | null;
          account_id: string;
          external_id: string | null;
          url: string | null;
          caption: string;
          published_at: string | null;
          duration_s: number | null;
          is_short: boolean;
        },
        'account_id'
      >;
      metric_snapshots: Table<
        AuditColumns & {
          id: string;
          post_id: string;
          captured_at: string;
          hours_since_publish: number | null;
          views: number;
          reach: number | null;
          likes: number;
          comments: number;
          shares: number;
          saves: number;
          avg_watch_time_s: number | null;
          completion_rate: number | null;
          raw_payload: Json;
        },
        'post_id'
      >;
      account_snapshots: Table<
        AuditColumns & {
          id: string;
          account_id: string;
          captured_at: string;
          followers: number;
          following: number | null;
          media_count: number | null;
          reach_day: number | null;
          profile_views: number | null;
        },
        'account_id'
      >;
      costs: Table<
        AuditColumns & {
          id: string;
          influencer_id: string;
          category: CostCategory;
          description: string;
          amount: number;
          currency: string;
          credits: number | null;
          generation_id: string | null;
          incurred_on: string;
        },
        'influencer_id' | 'category' | 'amount'
      >;
      brands: Table<
        AuditColumns & {
          id: string;
          name: string;
          website: string | null;
          contact_name: string | null;
          contact_email: string | null;
          notes: string;
        },
        'name'
      >;
      brand_deals: Table<
        AuditColumns & {
          id: string;
          brand_id: string;
          influencer_id: string;
          stage: BrandDealStage;
          fee: number | null;
          currency: string;
          deliverables: Json;
          due_date: string | null;
          notes: string;
        },
        'brand_id' | 'influencer_id'
      >;
      alerts: Table<
        AuditColumns & {
          id: string;
          influencer_id: string | null;
          type: string;
          payload: Json;
          read_at: string | null;
        },
        'type'
      >;
    };
    Views: Record<never, never>;
    Functions: {
      can_manage_team: { Args: Record<PropertyKey, never>; Returns: boolean };
      can_write_data: { Args: Record<PropertyKey, never>; Returns: boolean };
      current_team_role: {
        Args: Record<PropertyKey, never>;
        Returns: TeamRole | null;
      };
      is_initial_owner_setup: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_team_member: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      team_role: TeamRole;
      influencer_status: InfluencerStatus;
      asset_kind: AssetKind;
      prompt_category: PromptCategory;
      generation_type: GenerationType;
      generation_status: GenerationStatus;
      social_platform: SocialPlatform;
      social_account_status: SocialAccountStatus;
      content_stage: ContentStage;
      brand_deal_stage: BrandDealStage;
      cost_category: CostCategory;
    };
    CompositeTypes: Record<never, never>;
  };
  __InternalSupabase: { PostgrestVersion: '14.1' };
};

export type TableName = keyof Database['public']['Tables'];
export type Row<Name extends TableName> =
  Database['public']['Tables'][Name]['Row'];
