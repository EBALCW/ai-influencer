import type { Database } from '@ai-influencer/shared';

export type InfluencerRow = Database['public']['Tables']['influencers']['Row'];

export type InfluencerSummary = Pick<
  InfluencerRow,
  'id' | 'name' | 'slug' | 'status'
>;

export function toInfluencerSummary(row: InfluencerRow): InfluencerSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
  };
}
