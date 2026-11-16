import { expect, test } from '@playwright/test';
import { sameOrigin } from './same-origin';

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
    await request.post(`/api/alerts/${id}/read`, { headers: sameOrigin }),
    await request.post('/api/alerts/read-all', { headers: sameOrigin }),
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
    await request.post('/api/oauth/youtube/start', { headers: sameOrigin }),
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
        { headers: sameOrigin },
      )
    ).status(),
  );
});

test('kodsuz dönüş bağlantısı "ekip üyesi değil" demez, yeni bağlantı ister', async ({
  page,
}) => {
  await page.goto('/auth/callback');
  await expect(page).toHaveURL(/\/login\?link=1/);
  await expect(page.getByText(/yeni giriş bağlantısı iste/i)).toBeVisible();
  await expect(page.getByText(/ekip üyesi değil/i)).toHaveCount(0);
});

test('süresi dolmuş davet bağlantısı açıklanır ve adres temizlenir', async ({
  page,
}) => {
  await page.goto(
    '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
  );
  await expect(page.getByText(/süresi dolmuş/i)).toBeVisible();
  await expect(page).not.toHaveURL(/error_code/);
});
