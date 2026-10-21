import { expect, test } from '@playwright/test';

test('login page offers approved sign-in methods without public signup', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(
    page.getByRole('heading', { name: 'Tekrar hoş geldin' }),
  ).toBeVisible();
  await expect(
    page.getByText(/yalnızca davet edilen ekip üyeleri/i),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /kayıt ol/i })).toHaveCount(0);
});

test('a signed-out visitor cannot open team settings', async ({ page }) => {
  await page.goto('/settings/team');

  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(
    page.getByRole('heading', { name: 'Tekrar hoş geldin' }),
  ).toBeVisible();
});

test('an unauthorized visitor can read the access denied explanation', async ({
  page,
}) => {
  await page.goto('/access-denied');

  await expect(
    page.getByRole('heading', { name: 'Bu çalışma alanına erişimin yok' }),
  ).toBeVisible();
});
