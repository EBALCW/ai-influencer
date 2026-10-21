import { expect, test } from '@playwright/test';

test('dashboard loads with the Turkish studio shell and key onboarding action', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Merhaba, Emre/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Ana menü' }).getByRole('button'),
  ).toHaveCount(9);
  await expect(
    page.getByRole('button', { name: /İlk influencer’ı oluştur/i }).first(),
  ).toBeVisible();
});

test('influencer selection persists in the URL after reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Aktif influencer seç').selectOption('ornek-moda');
  await expect(page).toHaveURL(/inf=ornek-moda/);
  await page.reload();
  await expect(page.getByLabel('Aktif influencer seç')).toHaveValue(
    'ornek-moda',
  );
});

test('every navigation item opens its empty module screen', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Ana menü' })
    .getByRole('button', { name: 'İçerik', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'İçerik', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Bu alan için hazırlık sürüyor')).toBeVisible();
  await expect(page).toHaveURL(/view=content/);
});

test('theme control switches the studio shell to light mode', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Açık temaya geç' }).click();
  await expect(page.locator('main')).toHaveClass(/theme-light/);
  await expect(
    page.getByRole('button', { name: 'Koyu temaya geç' }),
  ).toBeVisible();
});
