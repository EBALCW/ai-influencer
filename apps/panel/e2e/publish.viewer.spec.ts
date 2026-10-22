import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase } from './global-setup';
import { checklistKeys } from '../src/lib/content/checklist-schema';

// Yayın kuyruğu (#58): viewer durumu görür, yayınlayamaz/planlayamaz/iptal edemez.
test.skip(!hasLocalSupabase(), 'Yalnız yerel Supabase ile çalışır.');

test('viewer yayın durumunu görür ama yayın butonları yok, API 403', async ({
  page,
}) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const slug = `publish-viewer-${crypto.randomUUID()}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: 'Yayın viewer karakteri', slug })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const influencerId = inf.data.id;
  try {
    const account = await admin
      .from('social_accounts')
      .insert({
        influencer_id: influencerId,
        platform: 'instagram',
        handle: '@publish.viewer',
      })
      .select('id')
      .single();
    if (account.error) throw account.error;
    const stored = await admin.rpc('store_social_token', {
      p_account_id: account.data.id,
      p_token: { access_token: 'e2e-fake-token' },
    });
    if (stored.error) throw stored.error;
    const asset = await admin
      .from('assets')
      .insert({
        influencer_id: influencerId,
        kind: 'final_video',
        storage_path: `${influencerId}/final.mp4`,
      })
      .select('id')
      .single();
    if (asset.error) throw asset.error;
    const item = await admin
      .from('content_items')
      .insert({
        influencer_id: influencerId,
        title: 'Viewer reels',
        checklist: {
          items: Object.fromEntries(checklistKeys.map((k) => [k, true])),
          hookScore: 4,
          engagementScore: 4,
          decision: 'ready',
        },
        target_account_id: account.data.id,
      })
      .select('id')
      .single();
    if (item.error) throw item.error;
    const link = await admin
      .from('content_item_assets')
      .insert({ content_item_id: item.data.id, asset_id: asset.data.id });
    if (link.error) throw link.error;
    const job = await admin
      .from('publish_jobs')
      .insert({
        content_item_id: item.data.id,
        account_id: account.data.id,
        asset_id: asset.data.id,
        platform: 'instagram',
        title: 'Viewer reels',
        scheduled_for: '2030-02-01T09:00:00Z',
      })
      .select('id')
      .single();
    if (job.error) throw job.error;

    await page.goto(`/content?inf=${slug}`);
    const panel = page.getByTestId(`publish-${item.data.id}`);
    await expect(panel.getByRole('status')).toContainText('Yayın: Kuyrukta');
    await expect(
      page.getByRole('region', { name: 'Yayın kuyruğu' }),
    ).toContainText('Viewer reels');
    await expect(page.getByText('Yayınla / planla')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /yayınını iptal et/ }),
    ).toHaveCount(0);
    expect(
      (
        await page.request.post(`/api/content-items/${item.data.id}/publish`, {
          data: { mode: 'now', title: 'Viewer' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(`/api/publish-jobs/${job.data.id}/cancel`, {
          data: {},
        })
      ).status(),
    ).toBe(403);
    const still = await admin
      .from('publish_jobs')
      .select('status')
      .eq('id', job.data.id)
      .single();
    expect(still.data?.status).toBe('queued');
  } finally {
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', influencerId);
    if (removed.error) throw removed.error;
  }
});
