import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Trend arşivi (#10): viewer arşivi okur ve CSV indirir, yazamaz (buton yok, API 403).
// Seed'deki demo trendler kullanılır (supabase/seed.sql).
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

const SEED_TREND = '70000000-0000-4000-8000-000000000001';

test('viewer trend arşivini salt okur', async ({ page }) => {
  const response = await page.goto('/research');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Araştırma', level: 1 }),
  ).toBeVisible();
  const table = page.getByRole('table', { name: 'Trendler' });
  await expect(
    table.getByText('Demo: izleyiciyi sahnenin içine koyan POV kancası'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /CSV indir/ })).toBeVisible();
  for (const name of [
    /Yeni trend/,
    /Backlog'a aktar/,
    /Düzenle/,
    /CSV içe aktar/,
  ])
    await expect(page.getByRole('button', { name })).toHaveCount(0);

  // Filtre: elenmiş trendler.
  await page.getByLabel('Durum').selectOption('rejected');
  await page.getByRole('button', { name: 'Filtrele' }).click();
  await expect(page).toHaveURL(/status=rejected/);
  await expect(
    table.getByText('Demo: telifli sahneye dayanıyor'),
  ).toBeVisible();
  await expect(table.getByText('Demo: izleyiciyi')).toHaveCount(0);

  expect(
    (
      await page.request.post('/api/trends', {
        data: { url: 'https://example.invalid/viewer' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(`/api/trends/${SEED_TREND}`, {
        data: { status: 'rejected' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/trends/${SEED_TREND}/backlog`, { data: {} })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post('/api/trends/import', {
        multipart: {
          file: {
            name: 'trends.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from('link\nhttps://example.invalid/x'),
          },
        },
      })
    ).status(),
  ).toBe(403);
  const exported = await page.request.get('/api/trends/export');
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain('https://example.invalid/trend/01');
});
