import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Üretim kuyruğu (#47), viewer: kuyruğu görür, iptal/yeniden deneme yapamaz.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

const SLUG = 'e2e-production-viewer';
let genIds: string[] = [];

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

test.beforeAll(async () => {
  const db = admin();
  const { data: inf, error } = await db
    .from('influencers')
    .upsert(
      { name: 'E2E Production Viewer', slug: SLUG, status: 'active' },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();
  if (error) throw error;
  const { data, error: genError } = await db
    .from('generations')
    .insert([
      {
        influencer_id: inf.id,
        tool: 'higgsfield',
        type: 'image',
        mode: 'text_to_image',
        status: 'failed',
        error: 'Sağlayıcı üretimi tamamlayamadı.',
      },
      {
        influencer_id: inf.id,
        tool: 'higgsfield',
        type: 'video',
        mode: 'image_to_video',
        status: 'queued',
      },
    ])
    .select('id');
  if (genError) throw genError;
  genIds = data.map((row) => row.id);
});

test.afterAll(async () => {
  if (genIds.length)
    await admin().from('generations').delete().in('id', genIds);
});

test('viewer kuyruğu salt okunur görür', async ({ page }) => {
  const response = await page.goto(`/production?inf=${SLUG}`);
  expect(response?.status()).toBe(200);
  const list = page.getByRole('region', { name: 'Üretim kuyruğu' });
  await expect(list.getByText('Başarısız')).toBeVisible();
  await expect(list.getByText('Kuyrukta')).toBeVisible();
  await expect(list.getByText(/Görüntüleme yetkiniz var/)).toBeVisible();
  await expect(list.getByRole('button')).toHaveCount(0);
});

test('viewer API ile iptal veya yeniden deneme yapamaz (403)', async ({
  page,
}) => {
  await page.goto('/production');
  for (const [id, action] of [
    [genIds[1], 'cancel'],
    [genIds[0], 'retry'],
  ]) {
    const res = await page.request.post(`/api/generations/${id}/${action}`, {
      data: {},
    });
    expect(res.status()).toBe(403);
  }
  const { data } = await admin()
    .from('generations')
    .select('status')
    .in('id', genIds)
    .order('status');
  expect(data?.map((row) => row.status).sort()).toEqual(['failed', 'queued']);
});
