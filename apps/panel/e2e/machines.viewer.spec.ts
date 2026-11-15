import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Üretim makineleri (#211): viewer listeyi görür, yetki kaldıramaz.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

test('viewer makineleri görür ama yetki kaldıramaz (API 403)', async ({
  page,
  baseURL,
}) => {
  await page.goto('/settings/machines');
  await expect(
    page.getByRole('heading', { name: 'Üretim makineleri' }),
  ).toBeVisible();
  const response = await page.request.post(
    '/api/workers/00000000-0000-4000-8000-000000000000/revoke',
    { headers: { origin: baseURL! }, data: {} },
  );
  expect(response.status()).toBe(403);
});
