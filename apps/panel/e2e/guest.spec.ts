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

for (const path of [
  '/',
  '/influencers',
  '/settings',
  '/settings/team',
  '/notifications',
  '/settings/notifications',
]) {
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

test('misafir bildirim API’lerine erişemez', async ({ request }) => {
  const id = '50000000-0000-4000-8000-000000000001';
  for (const response of [
    await request.get('/api/alerts'),
    await request.post(`/api/alerts/${id}/read`),
    await request.post('/api/alerts/read-all'),
    await request.get('/api/notification-settings'),
  ]) {
    expect([401, 503]).toContain(response.status());
  }
});

test('auth callback dış adrese yönlendirmez', async ({ page }) => {
  await page.goto('/auth/callback?next=//evil.example');
  await expect(page).toHaveURL(
    /^http:\/\/(127\.0\.0\.1|localhost):3000\/login/,
  );
});

test('misafir sosyal OAuth başlatamaz ve callback işleyemez', async ({
  request,
}) => {
  for (const response of [
    await request.post('/api/oauth/youtube/start'),
    await request.get('/api/oauth/youtube/callback?state=bad&code=bad'),
  ]) {
    expect([401, 503]).toContain(response.status());
  }
});

test('misafir sosyal hesap bağlantısını kaldıramaz', async ({ request }) => {
  expect([401, 503]).toContain(
    (
      await request.post(
        '/api/social-accounts/33333333-3333-4333-8333-333333333333/disconnect',
      )
    ).status(),
  );
});
