import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Gelen kutusu (#61): viewer yorumları okur, yanıtlayamaz/gizleyemez (buton yok, API 403).
// Seed'deki demo yorumları kullanılır (supabase/seed.sql).
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

const SEED_COMMENT = '60000000-0000-4000-8000-000000000001';

test('viewer gelen kutusunu salt okur', async ({ page }) => {
  const response = await page.goto('/inbox?inf=demo-creator');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Gelen kutusu', level: 1 }),
  ).toBeVisible();
  const list = page.getByRole('list', { name: 'Yorum listesi' });
  await expect(list.getByText(/ışık ayarı çok güzel/)).toBeVisible();
  for (const name of ['Yanıtla', 'Gizle', 'Okundu işaretle', 'Lead oluştur'])
    await expect(page.getByRole('button', { name })).toHaveCount(0);

  expect(
    (
      await page.request.post(`/api/comments/${SEED_COMMENT}/reply`, {
        data: { body: 'Merhaba' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(`/api/comments/${SEED_COMMENT}`, {
        data: { status: 'hidden' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/comments/${SEED_COMMENT}/lead`, {
        data: { brandName: 'X' },
      })
    ).status(),
  ).toBe(403);
});
