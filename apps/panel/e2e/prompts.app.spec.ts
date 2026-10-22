import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createSession, hasLocalSupabase } from './global-setup';

// Prompt kütüphanesi (#46). Kendi editor kullanıcısıyla çalışır: owner oturumu app.spec'teki
// çıkış testiyle iptal edildiğinde paralel koşan bu dosya etkilenmesin; ayrıca editor
// yetkisinin (owner olmadan) yeterli olduğunu doğrular. Yerel Supabase yoksa atlanır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
test.describe.configure({ mode: 'serial' });

const EDITOR_STATE = 'e2e/.auth/prompts-editor.json';
test.use({ storageState: EDITOR_STATE });

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

const run = Date.now().toString(36);
const title = `E2E Kombin ${run}`;
const specificTitle = `E2E A özel ${run}`;
// Demo Creator'ı app.spec geçici olarak arşivliyor; bu dosya kendi influencer'larını kullanır
let infA = '';
let promptUrl = '';
let v2Id = '';

test.beforeAll(async () => {
  await createSession(
    'e2e-prompts-editor@example.test',
    'editor',
    EDITOR_STATE,
  );
  const { data, error } = await admin()
    .from('influencers')
    .upsert(
      [
        { name: 'E2E Prompt A', slug: 'e2e-prompt-a', status: 'active' },
        { name: 'E2E Prompt B', slug: 'e2e-prompt-b', status: 'active' },
      ],
      { onConflict: 'slug' },
    )
    .select('id, slug');
  if (error) throw error;
  infA = data.find((row) => row.slug === 'e2e-prompt-a')!.id;
});

test('yeni global prompt oluşturulur ve detayına gidilir', async ({ page }) => {
  await page.goto('/prompts');
  await page.getByRole('link', { name: 'Yeni prompt' }).click();
  await expect(
    page.getByRole('heading', { name: 'Yeni prompt', level: 1 }),
  ).toBeVisible();
  const form = page.getByRole('form', { name: 'Yeni prompt' });
  await form.getByLabel('Başlık').fill(title);
  await form.getByLabel('Kategori').selectOption('character');
  await form.getByLabel('Kapsam').selectOption('');
  await form
    .getByLabel('Prompt metni')
    .fill('{{kıyafet}} giyen karakter, {{mekan}} arka planı');
  await form.getByRole('textbox', { name: 'mekan', exact: true }).fill('kafe');
  await form.getByRole('button', { name: "Prompt'u kaydet" }).click();

  await expect(page).toHaveURL(/\/prompts\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('heading', { name: title, level: 1 }),
  ).toBeVisible();
  promptUrl = new URL(page.url()).pathname;
});

test('aynı başlıkla ikinci "yeni prompt" yeni versiyon yerine hata verir', async ({
  page,
}) => {
  await page.goto('/prompts/new');
  const form = page.getByRole('form', { name: 'Yeni prompt' });
  await form.getByLabel('Başlık').fill(title);
  await form.getByLabel('Kategori').selectOption('character');
  await form.getByLabel('Prompt metni').fill('Başka metin');
  await form.getByRole('button', { name: "Prompt'u kaydet" }).click();
  await expect(
    page.getByText(/aynı başlıkta bir prompt zaten var/),
  ).toBeVisible();
});

test('şablon doldurulur, önizlenir ve üretim kuyruğuna gönderilir', async ({
  page,
}) => {
  await page.goto(promptUrl);
  const form = page.getByRole('form', { name: 'Önizleme ve üretim' });
  const submit = form.getByRole('button', { name: 'Üretime gönder' });

  await form.getByRole('textbox', { name: 'kıyafet', exact: true }).fill('');
  await expect(form.getByText('Eksik değişken: kıyafet')).toBeVisible();
  await expect(submit).toBeDisabled();

  await form
    .getByRole('textbox', { name: 'kıyafet', exact: true })
    .fill('trençkot');
  await expect(form.getByLabel('Doldurulmuş prompt')).toHaveText(
    'trençkot giyen karakter, kafe arka planı',
  );
  await form.getByLabel('Influencer').selectOption(infA);
  await submit.click();
  await expect(page.getByText(/Üretim kuyruğa alındı/)).toBeVisible();

  const promptId = promptUrl.split('/').pop()!;
  const { data, error } = await admin()
    .from('generations')
    .select('status, type, influencer_id, params')
    .eq('prompt_id', promptId);
  expect(error).toBeNull();
  expect(data).toEqual([
    {
      status: 'queued',
      type: 'image',
      influencer_id: infA,
      params: expect.objectContaining({
        prompt: 'trençkot giyen karakter, kafe arka planı',
        prompt_version: 1,
      }),
    },
  ]);
});

test('yeni versiyon oluşturulur, eski versiyon değişmez ve puanlanır', async ({
  page,
}) => {
  await page.goto(promptUrl);
  const form = page.getByRole('form', { name: 'Yeni versiyon' });
  await form
    .getByLabel('Prompt metni')
    .fill('{{kıyafet}} giyen karakter, {{mekan}} arka planı, gün batımı');
  await form.getByLabel('Değişiklik notu').fill('ışık eklendi');
  await form.getByRole('button', { name: 'Yeni versiyonu kaydet' }).click();

  await expect(page).not.toHaveURL(new RegExp(`${promptUrl}$`));
  await expect(page.getByText('v2 · ışık eklendi')).toBeVisible();
  v2Id = new URL(page.url()).pathname.split('/').pop()!;

  const versions = page.getByRole('table');
  await expect(versions.getByRole('link', { name: 'v1' })).toBeVisible();
  await expect(versions.getByRole('link', { name: 'v2' })).toBeVisible();

  await page.getByLabel('v2 puanı').selectOption('4');
  await page
    .getByRole('row', { name: /v2/ })
    .getByRole('button', { name: 'Puanla' })
    .click();
  await expect(page.getByText('Puan kaydedildi: 4/5')).toBeVisible();

  await page.goto(promptUrl);
  await expect(page.getByLabel('Doldurulmuş prompt')).not.toContainText(
    'gün batımı',
  );
});

test('kütüphanede başarı oranı ve ortalama kredi görünür', async ({ page }) => {
  const { error } = await admin()
    .from('generations')
    .insert([
      {
        influencer_id: infA,
        prompt_id: v2Id,
        tool: 'mock',
        type: 'image',
        status: 'succeeded',
        credits: 3,
      },
      {
        influencer_id: infA,
        prompt_id: v2Id,
        tool: 'mock',
        type: 'image',
        status: 'failed',
        credits: 1,
      },
    ]);
  expect(error).toBeNull();

  await page.goto('/prompts');
  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row).toContainText('v2');
  await expect(row).toContainText('4/5');
  await expect(row).toContainText('(1/2)');
  await expect(row.getByRole('cell').nth(7)).toHaveText('3');
});

test("influencer'a özel prompt sadece kendi influencer'ında görünür", async ({
  page,
}) => {
  await page.goto('/prompts/new?inf=e2e-prompt-a');
  const form = page.getByRole('form', { name: 'Yeni prompt' });
  await form.getByLabel('Başlık').fill(specificTitle);
  await form.getByLabel('Kategori').selectOption('caption');
  await expect(form.getByLabel('Kapsam')).toHaveValue(infA);
  await form.getByLabel('Prompt metni').fill('A için caption: {{konu}}');
  await form.getByRole('button', { name: "Prompt'u kaydet" }).click();
  await expect(page).toHaveURL(/\/prompts\/[0-9a-f-]{36}\?inf=e2e-prompt-a$/);
  // Caption metin görevidir: görsel/video üretimine gönderilemez
  await expect(
    page.getByRole('button', { name: 'Üretime gönder' }),
  ).toHaveCount(0);

  await page.goto('/prompts?inf=e2e-prompt-a');
  await expect(page.getByRole('link', { name: specificTitle })).toBeVisible();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  await page.goto('/prompts?inf=e2e-prompt-b');
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await expect(page.getByRole('link', { name: specificTitle })).toHaveCount(0);
});

test('olmayan veya geçersiz prompt kimliği 404 döner', async ({ page }) => {
  for (const path of [
    '/prompts/00000000-0000-4000-8000-000000000000',
    '/prompts/gecersiz',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test('seçilen prompt dosya olarak indirilir, düzenlenip geri yüklenince yeni versiyon olur', async ({
  page,
}) => {
  await page.goto('/prompts?inf=e2e-prompt-a');
  const exportSelected = page.getByRole('button', {
    name: /Seçilenleri dışa aktar/,
  });
  await expect(exportSelected).toBeDisabled();
  await page.getByLabel(`${title} dışa aktarılsın`).check();
  await expect(exportSelected).toHaveText(/\(1\)/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportSelected.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^ai-influencer-prompts-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(chunk as Buffer);
  const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(bundle.prompts).toHaveLength(1);
  expect(bundle.prompts[0]).toMatchObject({
    title,
    influencer: null,
    version: 2,
  });

  bundle.prompts[0].body += ', yağmur';
  bundle.prompts.push({
    category: 'caption',
    key: `ice-aktarilan-${run}`,
    title: `E2E içe aktarılan ${run}`,
    body: 'A için içe aktarılan caption',
    influencer: 'e2e-prompt-a',
  });
  const file = {
    name: 'prompts.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  };
  const importForm = page.getByRole('form', { name: 'Prompt içe aktar' });
  await importForm.getByLabel(/Prompt paketi seçin/).setInputFiles(file);
  await importForm.getByRole('button', { name: 'İçe aktar' }).click();
  await expect(page.getByText('2 yeni versiyon oluşturuldu.')).toBeVisible();
  await expect(
    page.getByRole('row', { name: new RegExp(title) }),
  ).toContainText('v3');
  await expect(
    page.getByRole('link', { name: `E2E içe aktarılan ${run}` }),
  ).toBeVisible();

  // Aynı dosya tekrar yüklenirse gereksiz versiyon oluşmaz
  await importForm.getByLabel(/Prompt paketi seçin/).setInputFiles(file);
  await importForm.getByRole('button', { name: 'İçe aktar' }).click();
  await expect(
    page.getByText('0 yeni versiyon oluşturuldu, 2 prompt zaten günceldi.'),
  ).toBeVisible();
  // v2 değişmedi (versiyonlar değiştirilemez)
  const { data } = await admin()
    .from('prompts')
    .select('version, body')
    .eq('id', v2Id)
    .single();
  expect(data?.version).toBe(2);
  expect(data?.body).not.toContain('yağmur');
});

test('hatalı prompt dosyası reddedilir', async ({ page }) => {
  await page.goto('/prompts');
  const importForm = page.getByRole('form', { name: 'Prompt içe aktar' });
  await importForm.getByLabel(/Prompt paketi seçin/).setInputFiles({
    name: 'bozuk.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"baska"}'),
  });
  await importForm.getByRole('button', { name: 'İçe aktar' }).click();
  await expect(page.getByText(/prompt paketi değil/)).toBeVisible();
});

test("influencer detayındaki Prompt'lar sekmesi kütüphaneye filtreyle bağlanır", async ({
  page,
}) => {
  await page.goto('/influencers/e2e-prompt-a?tab=prompts');
  await page.getByRole('link', { name: 'Prompt kütüphanesinde aç' }).click();
  await expect(page).toHaveURL(/\/prompts\?inf=e2e-prompt-a$/);
  await expect(
    page.getByText("Global prompt'lar ve E2E Prompt A için özel olanlar."),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: specificTitle })).toBeVisible();
});
