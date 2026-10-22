import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase, VIEWER_EMAIL } from './global-setup';

// Bildirim merkezi (#56): viewer okur ve kendi okundu bilgisini yazar, ayarları değiştiremez.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
// Okundu durumu paylaşılan kullanıcı verisidir; testler sırayla çalışır.
test.describe.configure({ mode: 'serial' });

const SEED_ALERT = '50000000-0000-4000-8000-000000000001';

test.beforeAll(async () => {
  // Yeniden denemede de aynı başlangıç: viewer'ın okundu kayıtlarını temizle (yalnız yerel Supabase)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const viewer = data.users.find((user) => user.email === VIEWER_EMAIL);
  if (!viewer) throw new Error('viewer kullanıcısı yok');
  const { error: deleteError } = await admin
    .from('alert_reads')
    .delete()
    .eq('user_id', viewer.id);
  if (deleteError) throw deleteError;
});

function bell(page: Page) {
  return page.getByRole('button', { name: /^Bildirimler/ });
}

async function unreadCount(page: Page) {
  const label = (await bell(page).getAttribute('aria-label')) ?? '';
  return Number(label.match(/(\d+) okunmamış/)?.[1] ?? 0);
}

test('zil seed uyarılarını listeler, klavyeyle açılıp Escape ile kapanır', async ({
  page,
}) => {
  await page.goto('/');
  await expect(bell(page)).toHaveAccessibleName(/Bildirimler, \d+ okunmamış/);
  // Okunmamış sayısı canlı bölgeden ekran okuyucuya duyurulur
  const announcer = page.getByTestId('unread-announcer');
  await expect(announcer).toHaveText(/\d+ okunmamış bildirim/);
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await expect(bell(page)).toHaveAttribute('aria-expanded', 'false');

  await bell(page).focus();
  await page.keyboard.press('Enter');
  await expect(bell(page)).toHaveAttribute('aria-expanded', 'true');
  const panel = page.getByRole('region', { name: 'Bildirim merkezi' });
  for (const title of [
    'Viral eşik aşıldı',
    'Takipçi kilometre taşı',
    'Token süresi doluyor',
    'Senkronizasyon hatası',
    'Yayın saati geldi, içerik hazır değil',
  ]) {
    await expect(panel.getByText(title, { exact: true })).toBeVisible();
  }

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(bell(page)).toBeFocused();
  await expect(bell(page)).toHaveAttribute('aria-expanded', 'false');
});

test('viewer tek bildirimi okundu işaretler, sayaç azalır', async ({
  page,
}) => {
  await page.goto('/');
  await expect(bell(page)).toHaveAccessibleName(/\d+ okunmamış/);
  const before = await unreadCount(page);
  await bell(page).click();
  const panel = page.getByRole('region', { name: 'Bildirim merkezi' });
  const markButton = panel.getByRole('button', {
    name: 'Viral eşik aşıldı bildirimini okundu işaretle',
  });
  await markButton.click();
  await expect(markButton).toHaveCount(0);
  // Paralel testler yeni uyarı üretebilir; bu yüzden kesin sayı yerine durum kontrol edilir
  const list = await (await page.request.get('/api/alerts?limit=100')).json();
  const seed = list.alerts.find(
    (alert: { id: string }) => alert.id === SEED_ALERT,
  );
  expect(seed.read).toBe(true);
  expect(list.unread).toBeLessThanOrEqual(before);
});

test('okundu API: viewer 200, geçersiz id 400, olmayan uyarı 404', async ({
  page,
}) => {
  await page.goto('/notifications');
  expect(
    (await page.request.post(`/api/alerts/${SEED_ALERT}/read`)).status(),
  ).toBe(200);
  expect(
    (await page.request.post('/api/alerts/not-a-uuid/read')).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post(
        '/api/alerts/00000000-0000-4000-8000-0000000000ff/read',
      )
    ).status(),
  ).toBe(404);
});

test('bildirim sayfası listeler ve tümünü okundu işaretler', async ({
  page,
}) => {
  const response = await page.goto('/notifications');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Bildirimler', level: 1 }),
  ).toBeVisible();
  const list = page.getByRole('region', { name: 'Bildirim listesi' });
  await expect(list.getByText('Takipçi kilometre taşı')).toBeVisible();
  await list.getByRole('button', { name: 'Tümünü okundu işaretle' }).click();
  await expect(list.getByText('Tüm bildirimler okundu.').first()).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName('Bildirimler');
});

test('viewer bildirim ayarlarını görür ama değiştiremez', async ({ page }) => {
  const response = await page.goto('/settings/notifications');
  expect(response?.status()).toBe(200);
  await expect(page.getByLabel(/Viral eşik/)).toHaveValue('3');
  await expect(page.getByLabel(/Viral eşik/)).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Bildirim ayarlarını kaydet' }),
  ).toHaveCount(0);
  const put = await page.request.put('/api/notification-settings', {
    data: {
      viralMultiplier: 5,
      followerMilestones: [1000],
      tokenExpiryDays: 7,
      channels: { ntfy: true, telegram: false, email: false },
    },
  });
  expect(put.status()).toBe(403);
});
