import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { createSession, hasLocalSupabase } from './global-setup';

// Üretim kuyruğu (#47) uçtan uca: panelden görsel + video üretimi → kuyruk → worker → asset.
// Worker (Deno Edge Function) CI'da çalıştırılamadığı için onun veritabanı adımları service
// role ile aynı RPC'lerle (claim_generations, complete_generation) taklit edilir; sağlayıcı
// çağrılmaz. Worker mantığı Deno testleriyle ayrıca doğrulanır. Yerel Supabase yoksa atlanır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
test.describe.configure({ mode: 'serial' });

const EDITOR_STATE = 'e2e/.auth/production-editor.json';
const OWNER_STATE = 'e2e/.auth/production-owner.json';
test.use({ storageState: EDITOR_STATE });

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

const run = Date.now().toString(36);
const SLUG = 'e2e-production';
const imageTitle = `E2E Görsel ${run}`;
const videoTitle = `E2E Video ${run}`;
let infId = '';
let imagePromptId = '';
let videoPromptId = '';
// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function generationsOf(promptId: string) {
  const { data, error } = await admin()
    .from('generations')
    .select(
      'id, status, type, mode, params, input_asset_ids, output_asset_id, retry_of',
    )
    .eq('prompt_id', promptId)
    .order('created_at');
  if (error) throw error;
  return data;
}

const item = (page: Page, title: string) =>
  page.getByRole('listitem').filter({ hasText: title });

test.beforeAll(async () => {
  await createSession(
    'e2e-production-editor@example.test',
    'editor',
    EDITOR_STATE,
  );
  await createSession(
    'e2e-production-owner@example.test',
    'owner',
    OWNER_STATE,
  );
  const db = admin();
  const { data: inf, error } = await db
    .from('influencers')
    .upsert(
      { name: 'E2E Production', slug: SLUG, status: 'active' },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();
  if (error) throw error;
  infId = inf.id;
  // Önceki koşulardan kalan bütçe/maliyet kayıtları bu dosyayı etkilemesin
  await db.from('budgets').delete().eq('influencer_id', infId);
  await db.from('costs').delete().eq('influencer_id', infId);

  const refPath = `${infId}/ref-${run}.png`;
  const upload = await db.storage
    .from('assets')
    .upload(refPath, PNG, { contentType: 'image/png', upsert: true });
  if (upload.error) throw upload.error;
  const asset = await db.from('assets').insert({
    influencer_id: infId,
    kind: 'reference',
    storage_path: refPath,
    mime_type: 'image/png',
    version_tag: `ref-${run}`,
  });
  if (asset.error) throw asset.error;

  const prompts = await db
    .from('prompts')
    .insert([
      {
        influencer_id: infId,
        category: 'character',
        key: `img-${run}`,
        title: imageTitle,
        body: 'Kafede portre',
        version: 1,
      },
      {
        influencer_id: infId,
        category: 'short_film',
        key: `vid-${run}`,
        title: videoTitle,
        body: 'Yürüyüş sahnesi',
        version: 1,
      },
    ])
    .select('id, category');
  if (prompts.error) throw prompts.error;
  imagePromptId = prompts.data.find((p) => p.category === 'character')!.id;
  videoPromptId = prompts.data.find((p) => p.category === 'short_film')!.id;
});

test.afterAll(async () => {
  const db = admin();
  if (!infId) return;
  await db.from('budgets').delete().eq('influencer_id', infId);
  await db.from('costs').delete().eq('influencer_id', infId);
});

test('görsel: panelden kuyruğa → çalışıyor → tamamlandı, sonuç medya kütüphanesinde', async ({
  page,
}) => {
  await page.goto(`/prompts/${imagePromptId}?inf=${SLUG}`);
  const form = page.getByRole('form', { name: 'Önizleme ve üretim' });
  await expect(form.getByLabel(/Test modu/)).toBeChecked();
  await expect(form.getByText('Mod: Görsel')).toBeVisible();
  await form.getByRole('button', { name: 'Üretime gönder' }).click();
  await expect(page.getByText(/Üretim kuyruğa alındı/)).toBeVisible();

  const [gen] = await generationsOf(imagePromptId);
  expect(gen).toMatchObject({
    status: 'queued',
    type: 'image',
    mode: 'text_to_image',
    params: expect.objectContaining({ test_mode: true, resolution: '480p' }),
  });

  await page.goto(`/production?inf=${SLUG}`);
  await expect(
    page.getByRole('heading', { name: 'Üretim', level: 1 }),
  ).toBeVisible();
  await expect(item(page, imageTitle)).toContainText('Kuyrukta');

  // Worker: claim → sağlayıcıya gönderildi
  const claimed = await admin().rpc('claim_generations', {
    p_tools: ['higgsfield'],
    p_limit: 50,
  });
  expect(claimed.error).toBeNull();
  expect((claimed.data ?? []).map((row: { id: string }) => row.id)).toContain(
    gen.id,
  );
  const running = await admin()
    .from('generations')
    .update({
      status: 'running',
      provider_job_id: `job-${run}`,
      progress: 50,
      attempts: 1,
      started_at: new Date().toISOString(),
    })
    .eq('id', gen.id);
  expect(running.error).toBeNull();
  await page.reload();
  await expect(item(page, imageTitle)).toContainText('Üretiliyor');
  await expect(
    page.getByRole('progressbar', { name: `${imageTitle} ilerleme` }),
  ).toHaveAttribute('value', '50');

  // Worker: sonuç Storage'a + complete_generation
  const outPath = `${infId}/generated-${gen.id}.png`;
  const up = await admin()
    .storage.from('assets')
    .upload(outPath, PNG, { contentType: 'image/png', upsert: true });
  expect(up.error).toBeNull();
  const done = await admin().rpc('complete_generation', {
    p_id: gen.id,
    p_storage_path: outPath,
    p_mime_type: 'image/png',
    p_file_size_bytes: PNG.byteLength,
  });
  expect(done.error).toBeNull();

  await page.reload();
  const row = item(page, imageTitle);
  await expect(row).toContainText('Tamamlandı');
  await expect(row.getByRole('button')).toHaveCount(0);
  const [finished] = await generationsOf(imagePromptId);
  const { data: asset } = await admin()
    .from('assets')
    .select('kind, influencer_id, storage_path')
    .eq('id', finished.output_asset_id!)
    .single();
  expect(asset).toEqual({
    kind: 'generated',
    influencer_id: infId,
    storage_path: outPath,
  });

  await row.getByRole('link', { name: 'Medya kütüphanesinde gör' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/influencers/${SLUG}/assets\\?inf=${SLUG}$`),
  );
});

test('video: referans görselle kuyruğa → başarısız → yeniden dene → iptal', async ({
  page,
}) => {
  await page.goto(`/prompts/${videoPromptId}?inf=${SLUG}`);
  const form = page.getByRole('form', { name: 'Önizleme ve üretim' });
  await expect(form.getByText('Mod: Görselden video')).toBeVisible();
  // Referans görsel seçilmeden gönderilemez
  await form.getByRole('button', { name: 'Üretime gönder' }).click();
  await expect(page.getByText(/en az bir referans görsel/)).toBeVisible();

  await form.getByLabel(`Referans · ref-${run}`).check();
  await form.getByLabel('Süre (sn)').fill('8');
  await form.getByRole('button', { name: 'Üretime gönder' }).click();
  await expect(page.getByText(/Üretim kuyruğa alındı/)).toBeVisible();
  const [gen] = await generationsOf(videoPromptId);
  expect(gen).toMatchObject({
    status: 'queued',
    type: 'video',
    mode: 'image_to_video',
  });
  expect(gen.input_asset_ids).toHaveLength(1);

  // Worker: sağlayıcı hatası
  const failed = await admin()
    .from('generations')
    .update({
      status: 'failed',
      error: 'Sağlayıcı üretimi tamamlayamadı.',
      attempts: 1,
    })
    .eq('id', gen.id);
  expect(failed.error).toBeNull();

  await page.goto(`/production?inf=${SLUG}`);
  const row = item(page, videoTitle);
  await expect(row).toContainText('Başarısız');
  await expect(row).toContainText('Sağlayıcı üretimi tamamlayamadı.');
  await row.getByRole('button', { name: /yeniden dene$/ }).click();
  await expect(page.getByText('Üretim yeniden kuyruğa alındı.')).toBeVisible();

  const rows = await generationsOf(videoPromptId);
  expect(rows).toHaveLength(2);
  expect(rows[0].status).toBe('failed');
  expect(rows[1]).toMatchObject({ status: 'queued', retry_of: gen.id });

  const queued = page
    .getByRole('listitem')
    .filter({ hasText: 'yeniden deneme' });
  await expect(queued).toContainText('Kuyrukta');
  await queued.getByRole('button', { name: /iptal et$/ }).click();
  await expect(page.getByText('Üretim iptal edildi.')).toBeVisible();
  expect((await generationsOf(videoPromptId))[1].status).toBe('cancelled');
});

test('bütçe dolunca editor engellenir, owner onayıyla açılır', async ({
  page,
  browser,
}) => {
  const month = new Date();
  const monthStart = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const db = admin();
  const budget = await db.from('budgets').insert({
    influencer_id: infId,
    month: monthStart,
    amount: 1,
    currency: 'USD',
  });
  expect(budget.error).toBeNull();
  const cost = await db.from('costs').insert({
    influencer_id: infId,
    category: 'credits',
    amount: 5,
    currency: 'USD',
    incurred_on: new Date().toISOString().slice(0, 10),
  });
  expect(cost.error).toBeNull();
  const before = (await generationsOf(imagePromptId)).length;

  await page.goto(`/prompts/${imagePromptId}?inf=${SLUG}`);
  const form = page.getByRole('form', { name: 'Önizleme ve üretim' });
  await expect(form.getByLabel(/owner olarak onaylıyorum/)).toHaveCount(0);
  await form.getByRole('button', { name: 'Üretime gönder' }).click();
  await expect(page.getByText(/bütçesi doldu.*owner onayı/)).toBeVisible();
  expect((await generationsOf(imagePromptId)).length).toBe(before);

  const ownerContext = await browser.newContext({ storageState: OWNER_STATE });
  const owner = await ownerContext.newPage();
  await owner.goto(`/prompts/${imagePromptId}?inf=${SLUG}`);
  const ownerForm = owner.getByRole('form', { name: 'Önizleme ve üretim' });
  await ownerForm.getByRole('button', { name: 'Üretime gönder' }).click();
  await expect(owner.getByText(/bütçesi doldu/)).toBeVisible();
  await ownerForm.getByLabel(/owner olarak onaylıyorum/).check();
  await ownerForm.getByRole('button', { name: 'Üretime gönder' }).click();
  await expect(owner.getByText(/Üretim kuyruğa alındı/)).toBeVisible();
  await ownerContext.close();

  const rows = await generationsOf(imagePromptId);
  expect(rows.length).toBe(before + 1);
  expect(rows.at(-1)!.params).toHaveProperty('budget_override_by');
});

test('sağlayıcı yapılandırılmamışsa kuyruk sayfası bunu söyler', async ({
  page,
}) => {
  const db = admin();
  const { data: previous } = await db
    .from('generation_worker_status')
    .select('*')
    .maybeSingle();
  const set = await db.from('generation_worker_status').upsert({
    id: true,
    providers: [],
    claimed: 0,
    message: 'x',
    last_run_at: new Date().toISOString(),
  });
  expect(set.error).toBeNull();
  try {
    await page.goto(`/production?inf=${SLUG}`);
    await expect(
      page.getByText(/Üretim sağlayıcısı yapılandırılmamış/),
    ).toBeVisible();
  } finally {
    if (previous) await db.from('generation_worker_status').upsert(previous);
    else await db.from('generation_worker_status').delete().eq('id', true);
  }
});
