import { expect, test } from '@playwright/test';
import { hasLocalSupabase, OWNER_EMAIL } from './global-setup';

// Oturum gerektirir: CI'da yerel Supabase ile çalışır, yerelde Supabase yoksa atlanır
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
// Hepsi aynı oturumu paylaşır; çıkış testi oturumu iptal ettiği için sırayla ve en sonda çalışır
test.describe.configure({ mode: 'serial' });

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

test('influencer listesi detay sayfasına gider ve ?inf= seçimini korur', async ({
  page,
}) => {
  await page.goto('/influencers?inf=demo-creator');
  await expect(
    page.getByRole('heading', { name: 'Influencer’lar', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demo Creator' })).toBeVisible();
  await page.getByRole('link', { name: 'Demo Creator' }).click();
  await expect(page).toHaveURL(/\/influencers\/demo-creator\?inf=demo-creator/);
  await expect(
    page.getByRole('heading', { name: 'Demo Creator', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Influencer detay sekmeleri' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Persona' })).toBeVisible();
  await page.getByRole('link', { name: 'Persona' }).click();
  await expect(page).toHaveURL(/tab=persona/);
  await expect(page.getByText('Persona kaydı yok')).toBeVisible();
});

test('bilinmeyen influencer slug gerçek HTTP 404 döndürür', async ({
  page,
}) => {
  const response = await page.goto('/influencers/yok-boyle-biri');
  expect(response?.status()).toBe(404);
});

test('arşivlenen influencer etkin listeden çıkar ve arşivden geri alınır', async ({
  page,
}) => {
  await page.goto('/influencers/demo-creator');
  await page.getByRole('button', { name: 'Arşivle' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Arşivle' }).click();
  await expect(page.getByText('Arşiv', { exact: true })).toBeVisible();

  await page.goto('/influencers');
  await expect(page.getByRole('link', { name: 'Demo Creator' })).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Duruma göre filtrele' })
    .selectOption('archived');
  await page.getByRole('link', { name: 'Demo Creator' }).click();
  await page.getByRole('button', { name: 'Arşivden çıkar' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Yeniden etkinleştir' })
    .click();
  await expect(page.getByText('Aktif', { exact: true })).toBeVisible();
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

test('owner ekip sayfasında kendini görür', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: /Ekip/ }).click();
  await expect(page).toHaveURL(/\/settings\/team/);
  await expect(
    page.getByRole('heading', { name: 'Ekip', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(OWNER_EMAIL)).toBeVisible();
});

test('profilde gerçek kullanıcı ve çıkış var', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTitle(OWNER_EMAIL).first()).toBeVisible();
  await page.getByRole('button', { name: 'Çıkış yap' }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
