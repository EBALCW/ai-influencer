import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase } from './global-setup';

// Ayarlar → Senkronizasyon (#53), editor oturumu.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
// Boş durum ve eklenen satır aynı tabloyu paylaşır; testler sırayla çalışır.
test.describe.configure({ mode: 'serial' });

const RUN_ID = '53000000-0000-4000-8000-000000000001';
const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

test.beforeAll(async () => {
  const { error } = await admin().from('sync_runs').delete().eq('id', RUN_ID);
  if (error) throw error;
});
test.afterAll(async () => {
  await admin().from('sync_runs').delete().eq('id', RUN_ID);
});

test('günlük boşken EmptyState; ayarlardan bağlantı var', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Senkronizasyon' }).click();
  await expect(page).toHaveURL(/\/settings\/sync/);
  await expect(
    page.getByRole('heading', { name: 'Senkronizasyon', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Henüz senkronizasyon çalışmadı')).toBeVisible();
});

test('editor "Şimdi senkronize et" isteği gönderir; yapılandırma yoksa anlaşılır mesaj', async ({
  page,
}) => {
  await page.goto('/settings/sync');
  const button = page.getByRole('button', { name: 'Şimdi senkronize et' });
  await expect(button).toBeEnabled();
  const responsePromise = page.waitForResponse('**/api/sync');
  await button.click();
  const response = await responsePromise;
  // CI'daki yerel Supabase'te Vault sırları (project_url, cron_secret) yok → 503
  expect([202, 429, 503]).toContain(response.status());
  await expect(
    page.getByRole('status').filter({ hasText: /senkronizasyon/i }),
  ).toBeVisible();
  expect(
    (
      await page.request.post('/api/sync', { data: { accountId: 'x' } })
    ).status(),
  ).toBe(400);
});

test('çalışmalar listelenir (iş, platform, durum, işlenen)', async ({
  page,
}) => {
  const { error } = await admin().from('sync_runs').insert({
    id: RUN_ID,
    job: 'metrics',
    platform: 'instagram',
    status: 'partial',
    processed_count: 7,
    quota_units: 12,
    error: 'Rate limit: kalan iş sonraki çalışmaya bırakıldı',
  });
  if (error) throw error;
  await page.goto('/settings/sync');
  const log = page.getByRole('region', { name: 'Senkronizasyon günlüğü' });
  const row = log.getByRole('row').filter({ hasText: 'Rate limit' });
  await expect(row).toContainText('Metrik snapshot');
  await expect(row).toContainText('Instagram');
  await expect(row).toContainText('Kısmi');
  await expect(row).toContainText('7');
  await expect(log.getByText('Henüz senkronizasyon çalışmadı')).toHaveCount(0);
});
