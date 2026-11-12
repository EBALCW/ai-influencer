import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Yayıncı klipleri (#173): viewer kaynakları ve klipleri okur, yazamaz (buton yok, API 403).
// Seed'deki demo kaynaklar kullanılır (supabase/seed.sql).
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

const SEED_SOURCE = '80000000-0000-4000-8000-000000000001';
const SEED_CLIP = '81000000-0000-4000-8000-000000000001';

test('viewer klipleri salt okur', async ({ page }) => {
  const response = await page.goto('/clips');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Klipler', level: 1 }),
  ).toBeVisible();

  const granted = page.getByRole('article', {
    name: /Kaynak: Demo: haftalık sohbet yayını/,
  });
  await expect(
    granted.getByText('İzin verildi', { exact: true }),
  ).toBeVisible();
  await expect(granted).toContainText('Demo Sohbet Kanalı');
  const row = granted
    .getByRole('row')
    .filter({ hasText: 'Demo: beklenmedik soru anı' });
  await expect(row).toContainText('12:34–13:32');
  await expect(row).toContainText('Aday');

  const pending = page.getByRole('article', {
    name: /Kaynak: Demo: turnuva yayını/,
  });
  await expect(
    pending.getByText('İzin bekleniyor', { exact: true }),
  ).toBeVisible();
  await expect(pending).toContainText(/Backlog’a aktarmak için kaynağın izni/);

  for (const name of [
    /Yeni kaynak/,
    /Klip ekle/,
    /İzni işaretle/,
    /Backlog'a aktar/,
    /sil/i,
  ])
    await expect(
      page.getByRole('main').getByRole('button', { name }),
    ).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: /Durum/ })).toHaveCount(0);

  expect(
    (
      await page.request.post('/api/clip-sources', {
        data: {
          video_url: 'https://www.youtube.com/watch?v=viewerClip1',
          channel_name: 'Viewer',
          title: 'Viewer',
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(`/api/clip-sources/${SEED_SOURCE}`, {
        data: { permission_status: 'denied' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await page.request.delete(`/api/clip-sources/${SEED_SOURCE}`)).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post('/api/clips', {
        data: {
          source_id: SEED_SOURCE,
          title: 'Viewer',
          start_seconds: 0,
          end_seconds: 10,
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(`/api/clips/${SEED_CLIP}`, {
        data: { status: 'rejected' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/clips/${SEED_CLIP}/backlog`, { data: {} })
    ).status(),
  ).toBe(403);
});
