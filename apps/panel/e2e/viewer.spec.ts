import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Viewer rolü: okuyabilir, değiştiremez. Yerel Supabase yoksa atlanır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

test('viewer influencer listesini ve detayını görür', async ({ page }) => {
  await page.goto('/influencers');
  await page
    .getByRole('link', { name: /Demo Creator/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/influencers\/demo-creator/);
});

test('viewer için durum değiştirme butonları yok', async ({ page }) => {
  const response = await page.goto('/influencers/demo-creator');
  expect(response?.status()).toBe(200);
  for (const name of [
    'Arşivle',
    'Duraklat',
    'Arşivden çıkar',
    'Yeniden etkinleştir',
  ]) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
  }
});
