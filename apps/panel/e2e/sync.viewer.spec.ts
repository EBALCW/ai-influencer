import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Senkronizasyon (#53): viewer günlüğü görür, tetikleyemez.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

test('viewer senkronizasyon sayfasını görür ama tetikleyemez (buton yok, API 403)', async ({
  page,
}) => {
  const response = await page.goto('/settings/sync');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Senkronizasyon', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Senkronizasyon günlüğü' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Şimdi senkronize et' }),
  ).toHaveCount(0);
  expect((await page.request.post('/api/sync', { data: {} })).status()).toBe(
    403,
  );
});
