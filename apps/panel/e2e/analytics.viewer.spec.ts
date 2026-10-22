import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Viewer rolü: analitiği okur, öğrenim ekleyemez. Seed'deki demo postları kullanılır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

const demoPost = '30000000-0000-4000-8000-000000000001';

test('viewer analitik ve post detayını görür ama öğrenim formu yok', async ({
  page,
}) => {
  const list = await page.goto('/analytics?inf=demo-creator');
  expect(list?.status()).toBe(200);
  await expect(
    page.getByRole('table', { name: 'Kanca türü segmentleri' }),
  ).toBeVisible();
  await expect(page.getByRole('form', { name: 'Öğrenim ekle' })).toHaveCount(0);

  const detail = await page.goto(
    `/analytics/posts/${demoPost}?inf=demo-creator`,
  );
  expect(detail?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Post detayı', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('form', { name: 'Öğrenim ekle' })).toHaveCount(0);
});

test('viewer öğrenim API çağrısında 403 alır', async ({ page }) => {
  await page.goto('/analytics');
  const response = await page.request.post('/api/learnings', {
    data: { body: 'viewer denemesi', postId: demoPost },
  });
  expect(response.status()).toBe(403);
});
