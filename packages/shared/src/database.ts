// Elle yazılan yardımcı tipler. `database.types.ts` Supabase CLI tarafından üretilir
// (`pnpm supabase:types`) ve elle düzenlenmez; yeni yardımcıları buraya ekle.
import type { Database } from './database.types.js';

export type { Database, Json } from './database.types.js';

type PublicSchema = Database['public'];

export type TableName = keyof PublicSchema['Tables'];
export type Row<Name extends TableName> = PublicSchema['Tables'][Name]['Row'];
export type Insert<Name extends TableName> =
  PublicSchema['Tables'][Name]['Insert'];
export type Update<Name extends TableName> =
  PublicSchema['Tables'][Name]['Update'];

export type EnumName = keyof PublicSchema['Enums'];
export type Enum<Name extends EnumName> = PublicSchema['Enums'][Name];

export type TeamRole = Enum<'team_role'>;
export type InfluencerStatus = Enum<'influencer_status'>;
export type AssetKind = Enum<'asset_kind'>;
export type PromptCategory = Enum<'prompt_category'>;
export type GenerationType = Enum<'generation_type'>;
export type GenerationStatus = Enum<'generation_status'>;
export type SocialPlatform = Enum<'social_platform'>;
export type SocialAccountStatus = Enum<'social_account_status'>;
export type ContentStage = Enum<'content_stage'>;
export type BrandDealStage = Enum<'brand_deal_stage'>;
export type CostCategory = Enum<'cost_category'>;
