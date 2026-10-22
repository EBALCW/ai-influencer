import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase, VIEWER_STATE } from './global-setup';

// Marka CRM'i ve medya kiti (#60). Editor oturumu; viewer ve oturumsuz kontroller ayrı context'te.
test.skip(!hasLocalSupabase(), 'Yalnız yerel Supabase ile çalışır.');

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const istanbulToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );

async function changeStage(
  page: Page,
  select: ReturnType<Page['getByLabel']>,
  stage: string,
) {
  const saved = page.waitForResponse(
    (r) =>
      r.url().includes('/api/brand-deals/') && r.request().method() === 'PATCH',
  );
  await select.selectOption(stage);
  expect((await saved).status()).toBe(200);
  await expect(select).toHaveValue(stage);
}

test('deal uçtan uca takip edilir: marka → deal → aşamalar → içerik → sözleşme → gelir', async ({
  page,
  browser,
}) => {
  const admin = adminClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const slug = `crm-${suffix}`;
  const brandName = `E2E Marka ${suffix}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: `CRM Karakter ${suffix}`, slug, status: 'active' })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const influencerId = inf.data.id;
  const content = await admin
    .from('content_items')
    .insert({ influencer_id: influencerId, title: `Sponsorlu video ${suffix}` })
    .select('id')
    .single();
  if (content.error) throw content.error;
  const storagePaths: string[] = [];

  try {
    await page.goto(`/brands?inf=${slug}&cur=USD`);
    await expect(
      page.getByRole('heading', { name: 'Markalar', level: 1 }),
    ).toBeVisible();

    // Marka (hedef marka) ekle
    const brandForm = page.getByRole('form', { name: 'Marka ekle' });
    await brandForm.getByLabel('Marka adı').fill(brandName);
    await brandForm.getByLabel('Web sitesi').fill('https://example.invalid');
    await brandForm.getByLabel('Araştırma notları').fill('Hedef: kozmetik');
    const brandCreated = page.waitForResponse(
      (r) => r.url().endsWith('/api/brands') && r.request().method() === 'POST',
    );
    await brandForm.getByRole('button', { name: 'Marka ekle' }).click();
    expect((await brandCreated).status()).toBe(201);
    const brandItem = page.getByRole('listitem', { name: brandName });
    await expect(brandItem.getByText('Hedef marka')).toBeVisible();

    // Deal aç
    const dealForm = page.getByRole('form', { name: 'Yeni deal formu' });
    await dealForm.getByLabel('Marka').selectOption({ label: brandName });
    await dealForm
      .getByLabel('Influencer', { exact: true })
      .selectOption(influencerId);
    await dealForm.getByLabel('Ücret').fill('1500,50');
    await dealForm.getByLabel('Para birimi').selectOption('USD');
    const dealCreated = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/brand-deals') && r.request().method() === 'POST',
    );
    await dealForm.getByRole('button', { name: 'Deal aç' }).click();
    const created = await dealCreated;
    expect(created.status()).toBe(201);
    const { id: dealId } = (await created.json()) as { id: string };

    const card = page.getByTestId(`deal-card-${dealId}`);
    await expect(
      page
        .getByRole('region', { name: 'Lead sütunu' })
        .getByTestId(`deal-card-${dealId}`),
    ).toBeVisible();
    await expect(card).toContainText('$1.500,50');

    // Sürükle-bırak: Lead → Görüşme
    const moved = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/brand-deals/${dealId}`) &&
        r.request().method() === 'PATCH',
    );
    await card.dragTo(page.getByRole('region', { name: 'Görüşme sütunu' }));
    expect((await moved).status()).toBe(200);
    const stage = card.getByLabel(`${brandName} aşaması`);
    await expect(stage).toHaveValue('negotiation');
    await expect(
      page
        .getByRole('region', { name: 'Görüşme sütunu' })
        .getByTestId(`deal-card-${dealId}`),
    ).toBeVisible();

    // Klavye/select ile kalan aşamalar: Anlaşma → Teslim → Ödendi
    await changeStage(page, stage, 'signed');
    await changeStage(page, stage, 'delivered');
    await changeStage(page, stage, 'paid');
    await expect(card).toContainText(`Ödeme: ${istanbulToday()}`);
    await expect(
      page.getByRole('region', { name: 'Ödendi sütunu' }),
    ).toContainText(brandName);

    // Gelir raporu: ödeme ayında görünür
    const revenue = page.getByRole('table', {
      name: 'Aylık gelir ve kâr/zarar',
    });
    await expect(revenue.locator('tfoot')).toContainText('$1.500,50');

    // Deal detayı
    await card.getByRole('link', { name: brandName }).click();
    await expect(page).toHaveURL(new RegExp(`/brands/${dealId}`));
    await expect(
      page.getByRole('heading', { name: brandName, level: 1 }),
    ).toBeVisible();

    // İçerik kartı bağla
    const linked = page.waitForResponse(
      (r) =>
        r.url().endsWith('/content-items') && r.request().method() === 'POST',
    );
    await page.getByLabel('Bağlanacak içerik').selectOption(content.data.id);
    await page.getByRole('button', { name: 'İçerik bağla' }).click();
    expect((await linked).status()).toBe(201);
    await expect(
      page.getByRole('list', { name: 'Bağlı içerikler' }),
    ).toContainText(`Sponsorlu video ${suffix}`);

    // Brief ve teslimat
    const brief = page.getByRole('form', { name: 'Brief formu' });
    await brief.getByLabel('Ürün / hizmet').fill('Nemlendirici krem');
    await brief.getByLabel(/Kullanım hakları/).fill('Marka hesabında 3 ay');
    await brief.getByRole('button', { name: 'Brief’i kaydet' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Brief kaydedildi.' }),
    ).toBeVisible();
    await page.getByLabel('Yeni teslimat').fill('1 Reels + 3 Story');
    await page.getByRole('button', { name: 'Teslimat ekle' }).click();
    await expect(page.getByText('1 Reels + 3 Story')).toBeVisible();

    // Sözleşme yükle ve kısa ömürlü bağlantıyla indir
    await page.getByLabel(/Sözleşme yükle/).setInputFiles({
      name: 'sözleşme taslağı.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%e2e\n'),
    });
    const files = page.getByRole('list', { name: 'Deal dosyaları' });
    await expect(files).toContainText('sözleşme taslağı.pdf');
    const stored = await admin
      .from('brand_deal_files')
      .select('storage_path')
      .eq('brand_deal_id', dealId);
    if (stored.error) throw stored.error;
    storagePaths.push(...stored.data.map((row) => row.storage_path));
    expect(storagePaths[0]).toMatch(
      new RegExp(`^${dealId}/[0-9a-f-]{36}\\.pdf$`),
    );
    const download = page.waitForEvent('download');
    await files
      .getByRole('button', { name: 'sözleşme taslağı.pdf dosyasını indir' })
      .click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

    // Yanıt şablonları templates/brand-replies.md'den gelir
    await expect(
      page.getByRole('heading', { name: 'İlk temas', level: 3 }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Nazik ret şablonunu kopyala' }),
    ).toBeVisible();

    // Kalıcılık: veritabanında paid_at ve brief
    const saved = await admin
      .from('brand_deals')
      .select('stage, paid_at, brief, deliverables, fee')
      .eq('id', dealId)
      .single();
    if (saved.error) throw saved.error;
    expect(saved.data).toMatchObject({
      stage: 'paid',
      paid_at: istanbulToday(),
      brief: {
        product: 'Nemlendirici krem',
        usageRights: 'Marka hesabında 3 ay',
      },
      deliverables: [{ title: '1 Reels + 3 Story', done: false }],
    });
    expect(String(saved.data.fee)).toBe('1500.5');

    // Viewer: görür ama düzenleyemez
    const viewer = await browser.newContext({ storageState: VIEWER_STATE });
    try {
      const vp = await viewer.newPage();
      await vp.goto(`/brands?inf=${slug}`);
      await expect(vp.getByLabel(`${brandName} aşaması`)).toBeDisabled();
      await expect(
        vp.getByRole('form', { name: 'Yeni deal formu' }),
      ).toHaveCount(0);
      expect(
        (
          await vp.request.patch(`/api/brand-deals/${dealId}`, {
            data: { stage: 'lost' },
          })
        ).status(),
      ).toBe(403);
      await vp.goto(`/brands/${dealId}`);
      await expect(
        vp.getByRole('list', { name: 'Deal dosyaları' }),
      ).toBeVisible();
      await expect(vp.getByLabel(/Sözleşme yükle/)).toHaveCount(0);
    } finally {
      await viewer.close();
    }
  } finally {
    if (storagePaths.length)
      await admin.storage.from('contracts').remove(storagePaths);
    await admin.from('brand_deals').delete().eq('influencer_id', influencerId);
    await admin.from('brands').delete().eq('name', brandName);
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', influencerId);
    if (removed.error) throw removed.error;
  }
});

test('medya kiti güncel ölçümlerle oluşur ve PDF tek tıkla iner', async ({
  page,
  browser,
}) => {
  const admin = adminClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const slug = `kit-${suffix}`;
  const inf = await admin
    .from('influencers')
    .insert({
      name: `Kit Karakter ${suffix}`,
      slug,
      status: 'active',
      niche: 'güzellik',
    })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const influencerId = inf.data.id;
  try {
    const account = await admin
      .from('social_accounts')
      .insert({
        influencer_id: influencerId,
        platform: 'instagram',
        handle: `kit_${suffix}`,
      })
      .select('id')
      .single();
    if (account.error) throw account.error;
    const now = Date.now();
    const iso = (daysAgo: number) =>
      new Date(now - daysAgo * 86_400_000).toISOString();
    const followers = await admin.from('account_snapshots').insert([
      { account_id: account.data.id, captured_at: iso(40), followers: 10000 },
      { account_id: account.data.id, captured_at: iso(1), followers: 12500 },
    ]);
    if (followers.error) throw followers.error;
    const post = await admin
      .from('posts')
      .insert({
        account_id: account.data.id,
        caption: 'Işıltılı rutin',
        published_at: iso(5),
      })
      .select('id')
      .single();
    if (post.error) throw post.error;
    const metric = await admin.from('metric_snapshots').insert({
      post_id: post.data.id,
      captured_at: iso(2),
      views: 4000,
      likes: 300,
      comments: 50,
      shares: 30,
      saves: 20,
    });
    if (metric.error) throw metric.error;

    await page.goto(`/brands?inf=${slug}`);
    await page.getByRole('link', { name: 'Medya kiti' }).click();
    await expect(page).toHaveURL(new RegExp(`/brands/media-kit\\?inf=${slug}`));
    await expect(
      page.getByRole('heading', {
        name: `Kit Karakter ${suffix} · Medya kiti`,
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByText(/Veri aralığı: .* \(son 30 gün/)).toBeVisible();
    await expect(
      page.getByText(/yapay zekâ ile oluşturulmuş kurgusal/),
    ).toBeVisible();
    const followerSection = page.getByRole('region', { name: 'Takipçi' });
    await expect(followerSection).toContainText('12.500');
    await expect(followerSection).toContainText('+2.500');
    const performance = page.getByRole('region', {
      name: 'İçerik performansı',
    });
    await expect(performance).toContainText('4.000');
    await expect(performance).toContainText('%10,00');
    await expect(
      page.getByRole('region', { name: 'En iyi içerikler' }),
    ).toContainText('Işıltılı rutin');
    await expect(page.getByRole('region', { name: 'Kitle' })).toContainText(
      'veri yok',
    );

    const pdfLink = page.getByRole('link', { name: 'PDF indir' });
    await expect(pdfLink).toHaveAttribute('href', `/api/media-kit/${slug}`);
    const download = page.waitForEvent('download');
    await pdfLink.click();
    expect((await download).suggestedFilename()).toMatch(
      new RegExp(`^medya-kiti-${slug}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`),
    );

    const pdf = await page.request.get(`/api/media-kit/${slug}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    expect(
      (await page.request.get('/api/media-kit/olmayan-karakter')).status(),
    ).toBe(404);

    // Viewer da indirebilir
    const viewer = await browser.newContext({ storageState: VIEWER_STATE });
    try {
      const response = await viewer.request.get(`/api/media-kit/${slug}`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toBe('application/pdf');
    } finally {
      await viewer.close();
    }

    // Oturumsuz: 401
    const guest = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      expect((await guest.request.get(`/api/media-kit/${slug}`)).status()).toBe(
        401,
      );
    } finally {
      await guest.close();
    }
  } finally {
    await admin
      .from('posts')
      .delete()
      .in(
        'account_id',
        (
          await admin
            .from('social_accounts')
            .select('id')
            .eq('influencer_id', influencerId)
        ).data?.map((row) => row.id) ?? [],
      );
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', influencerId);
    if (removed.error) throw removed.error;
  }
});

test('olmayan deal 404 döner', async ({ page }) => {
  const response = await page.goto(
    '/brands/00000000-0000-4000-8000-000000000000',
  );
  expect(response?.status()).toBe(404);
  expect((await page.goto('/brands/bozuk-id'))?.status()).toBe(404);
});
