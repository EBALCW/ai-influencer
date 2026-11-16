import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Araç girişi (docs/AUTH.md → "Araç girişi"): viewer giriş kodu üretemez.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

test('viewer giriş kodu düğmesini görmez ve uç 403 döner', async ({
  page,
  baseURL,
}) => {
  await page.goto('/settings/machines');
  const section = page.getByRole('region', { name: 'Araç girişi' });
  await expect(
    section.getByRole('heading', { name: 'Araç girişi' }),
  ).toBeVisible();
  await expect(section.getByRole('button')).toHaveCount(0);
  await expect(
    section.getByText('Giriş kodu üretmek için owner ya da editor olmalısın.'),
  ).toBeVisible();
  const response = await page.request.post('/api/tool-login', {
    headers: { origin: baseURL! },
    data: {},
  });
  expect(response.status()).toBe(403);
  expect(JSON.stringify(await response.json())).not.toMatch(/"code"/);
});
