import { describe, expect, it } from 'vitest';
import type { Database } from '@ai-influencer/shared';
import { toInfluencerSummary } from './influencer-summary';

describe('toInfluencerSummary', () => {
  it('maps a database influencer row to the panel list contract', () => {
    const row = {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Demo Creator',
      slug: 'demo-creator',
      niche: 'lifestyle',
      language: 'tr',
      status: 'draft',
      avatar_asset_id: null,
      created_at: '2026-10-21T09:00:00.000Z',
      updated_at: '2026-10-21T09:00:00.000Z',
      created_by: null,
    } satisfies Database['public']['Tables']['influencers']['Row'];

    expect(toInfluencerSummary(row)).toEqual({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
    });
  });
});
