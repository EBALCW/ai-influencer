import { expect, test } from '@playwright/test';

const authenticatedStorageState = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE;

test.describe('authenticated panel shell', () => {
  test.use({
    storageState: authenticatedStorageState ?? { cookies: [], origins: [] },
  });
  test.beforeEach(() => {
    test.skip(
      !authenticatedStorageState,
      'Panel ekranları için PLAYWRIGHT_AUTH_STORAGE_STATE ile giriş yapmış bir test oturumu verin.',
    );
  });

  test('home page shows the studio shell and overview', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /İçerik üretiminiz için/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Ana menü' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Influencer’lar', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Aktif influencer' }),
    ).toBeVisible();
  });

  test('all navigation sections open with an empty state', async ({ page }) => {
    const destinations = [
      ['Influencer’lar', '/influencers'],
      ['İçerik', '/content'],
      ['Takvim', '/calendar'],
      ['Analitik', '/analytics'],
      ['Üretim', '/production'],
      ['Maliyetler', '/costs'],
      ['Markalar', '/brands'],
      ['Ayarlar', '/settings'],
    ];
    for (const [label, href] of destinations) {
      await page.goto(href);
      await expect(
        page.getByRole('heading', { name: label, level: 1 }),
      ).toBeVisible();
      await expect(page.getByText(/kayıt bulunmuyor/i)).toBeVisible();
    }
  });

  test('influencer selection is stored in the URL', async ({ page }) => {
    await page.goto('/');
    const influencerSelect = page.getByRole('combobox', {
      name: 'Aktif influencer',
    });
    await influencerSelect.selectOption('demo-creator');
    await expect(page).toHaveURL(/inf=demo-creator/);
    await page.reload();
    await expect(influencerSelect).toHaveValue('demo-creator');

    // Menüde başka sayfaya geçince seçim kaybolmamalı (#40: tüm sayfalar seçili influencer'a göre filtrelenir)
    await page.getByRole('link', { name: 'Analitik', exact: true }).click();
    await expect(page).toHaveURL(/\/analytics\?inf=demo-creator/);
    await expect(influencerSelect).toHaveValue('demo-creator');
  });

  test('unknown sections return 404', async ({ page }) => {
    const response = await page.goto('/olmayan-bolum');
    expect(response?.status()).toBe(404);
  });

  test('theme can be switched and stays selected after reload', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Açık temaya geç' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
