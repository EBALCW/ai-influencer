import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Ana ekran (#200): viewer her şeyi görür, salt okur.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

test('viewer ana ekranı salt okunur görür', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Ana ekran', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText(
    'İzleyici rolündesiniz: her şeyi görür, değiştiremezsiniz.',
  );
  await expect(
    page
      .getByRole('region', { name: 'Ne üretmek istiyorsunuz?' })
      .getByRole('link'),
  ).toHaveCount(3);
  await expect(
    page
      .getByRole('region', { name: 'Son üretimler' })
      .getByRole('listitem')
      .first(),
  ).toBeVisible();
  // Üretim başlatan eylem yok.
  await expect(page.getByRole('link', { name: /başlat|ekle/i })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});
