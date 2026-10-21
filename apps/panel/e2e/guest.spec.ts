import { expect, test } from '@playwright/test';

test('giriş sayfası davetle erişimi anlatır', async ({ page }) => {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: /Ekip alanına giriş/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Sadece davet edilen ekip üyeleri/i),
  ).toBeVisible();
});

for (const path of ['/', '/influencers', '/settings', '/settings/team']) {
  test(`misafir ${path} adresinden girişe yönlenir`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole('heading', { name: /Ekip alanına giriş/i }),
    ).toBeVisible();
  });
}

test('misafir ekip API’sine erişemez', async ({ request }) => {
  const response = await request.get('/api/team');
  expect([401, 503]).toContain(response.status());
});

test('auth callback dış adrese yönlendirmez', async ({ page }) => {
  await page.goto('/auth/callback?next=//evil.example');
  await expect(page).toHaveURL(
    /^http:\/\/(127\.0\.0\.1|localhost):3000\/login/,
  );
});
