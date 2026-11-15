import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Üretim makineleri (#211): viewer listeyi görür, makine eşleyemez.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

test('viewer makineleri görür ama eşleyemez (form yok, API 403)', async ({
  page,
  baseURL,
}) => {
  await page.goto('/settings/machines');
  await expect(
    page.getByRole('heading', { name: 'Üretim makineleri' }),
  ).toBeVisible();
  await expect(page.getByLabel('Eşleme metni')).toHaveCount(0);
  const response = await page.request.post('/api/workers/pairings', {
    headers: { origin: baseURL! },
    data: { pairing: 'aiw1.x' },
  });
  expect(response.status()).toBe(403);
});
