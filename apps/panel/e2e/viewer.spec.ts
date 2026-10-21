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

test('viewer persona sekmesini görür ama düzenleyemez veya geri alamaz', async ({
  page,
}) => {
  const response = await page.goto('/influencers/demo-creator?tab=persona');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Versiyon geçmişi' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Personayı düzenle' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /versiyonunu geri al/ }),
  ).toHaveCount(0);
});

test('viewer persona API çağrılarında 403 alır', async ({ page }) => {
  await page.goto('/influencers/demo-creator?tab=persona');
  const id = '10000000-0000-4000-8000-000000000001';
  const save = await page.request.post(`/api/influencers/${id}/persona`, {
    data: {
      bio: 'viewer denemesi',
      tone: '',
      adjectives: [],
      hookTraits: [],
      audience: { ageRange: '', interests: [], description: '' },
      appearance: {
        hair: '',
        skin: '',
        eyes: '',
        face: '',
        body: '',
        signature: '',
      },
      changeNote: '',
    },
  });
  expect(save.status()).toBe(403);
  const restore = await page.request.post(
    `/api/influencers/${id}/persona/restore`,
    {
      data: { version: 1 },
    },
  );
  expect(restore.status()).toBe(403);
});
