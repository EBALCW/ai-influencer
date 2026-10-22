import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Prompt kütüphanesi (#46), viewer: okur, değiştiremez. Yerel Supabase yoksa atlanır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

let promptId = '';
let promptTitle = '';

const adminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

test.beforeAll(async () => {
  const admin = adminClient();
  const fixture = crypto.randomUUID();
  promptTitle = `Viewer görüntüleme testi ${fixture}`;
  const { data, error } = await admin
    .from('prompts')
    .insert({
      category: 'character',
      key: `viewer-${fixture}`,
      title: promptTitle,
      body: '{{renk}} saçlı karakter',
      version: 1,
    })
    .select('id')
    .single();
  if (error) throw error;
  promptId = data.id;
});

test.afterAll(async () => {
  if (!promptId) return;
  const { error } = await adminClient()
    .from('prompts')
    .delete()
    .eq('id', promptId);
  if (error) throw error;
});

test('viewer kütüphaneyi görür ama prompt oluşturamaz', async ({ page }) => {
  const response = await page.goto('/prompts');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Prompt kütüphanesi', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: promptTitle, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Yeni prompt' })).toHaveCount(0);

  await page.goto('/prompts/new');
  await expect(page).toHaveURL(/\/prompts\?error=editor_required$/);
  await expect(
    page.getByText('Prompt oluşturmak için düzenleme yetkisi gerekir.'),
  ).toBeVisible();
});

test('viewer önizleyebilir; puanlama, üretim ve yeni versiyon yok', async ({
  page,
}) => {
  const response = await page.goto(`/prompts/${promptId}`);
  expect(response?.status()).toBe(200);
  const preview = page.getByRole('form', { name: 'Önizleme ve üretim' });
  await preview
    .getByRole('textbox', { name: 'renk', exact: true })
    .fill('kızıl');
  await expect(preview.getByLabel('Doldurulmuş prompt')).toHaveText(
    'kızıl saçlı karakter',
  );
  for (const name of ['Üretime gönder', 'Puanla', 'Yeni versiyonu kaydet'])
    await expect(page.getByRole('button', { name })).toHaveCount(0);
});

test('viewer dışa aktarabilir ama içe aktaramaz: form yok, API 403', async ({
  page,
}) => {
  await page.goto('/prompts');
  await expect(
    page.getByRole('form', { name: 'Prompt içe aktar' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Tümünü dışa aktar' }),
  ).toBeVisible();
  const response = await page.request.post('/api/prompts/import', {
    multipart: {
      file: {
        name: 'prompts.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            format: 'ai-influencer/prompts',
            version: 1,
            prompts: [
              { category: 'caption', key: 'viewer', title: 'V', body: 'V' },
            ],
          }),
        ),
      },
    },
  });
  expect(response.status()).toBe(403);
});
