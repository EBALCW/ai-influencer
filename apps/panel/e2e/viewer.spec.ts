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

test('viewer maliyetleri görür ama ekleyemez', async ({ page }) => {
  const response = await page.goto('/costs');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Maliyetler', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('form', { name: 'Maliyet ekle' })).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Bütçe tanımla' })).toHaveCount(
    0,
  );

  // Sunucu da reddeder: UI'da gizlemek yetki kontrolü değildir
  const api = await page.request.post('/api/costs', {
    data: {
      influencerId: '10000000-0000-4000-8000-000000000001',
      category: 'other',
      amount: '1',
      currency: 'USD',
      incurredOn: '2026-10-01',
    },
  });
  expect(api.status()).toBe(403);
  const budget = await page.request.put('/api/budgets', {
    data: {
      influencerId: null,
      month: '2026-10',
      amount: '1',
      currency: 'USD',
    },
  });
  expect(budget.status()).toBe(403);
});
