import { expect, test } from '@playwright/test';

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
  await influencerSelect.selectOption('aylin-demir');
  await expect(page).toHaveURL(/inf=aylin-demir/);
  await page.reload();
  await expect(influencerSelect).toHaveValue('aylin-demir');
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
