import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase } from './global-setup';

// Editor oturumu (playwright.config → analytics projesi). Viewer: analytics.viewer.spec.ts
test.skip(!hasLocalSupabase(), 'Yalnız yerel Supabase ile çalışır.');
test.describe.configure({ mode: 'serial' });

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const admin = adminClient();
const slug = `analytics-${crypto.randomUUID()}`;
let influencerId = '';
let accountId = '';
const posts: Record<string, string> = {};

async function must<T>(
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/** 4 kıyas postu + incelenen post. Kıyas: 1 sa 10/20/30/40, 24 sa 100/200/300/1000. */
test.beforeAll(async () => {
  if (!hasLocalSupabase()) return;
  influencerId = (
    await must(
      admin
        .from('influencers')
        .insert({ name: 'Analitik test karakteri', slug })
        .select('id')
        .single(),
    )
  ).id;
  accountId = (
    await must(
      admin
        .from('social_accounts')
        .insert({
          influencer_id: influencerId,
          platform: 'instagram',
          handle: '@analytics.fixture',
        })
        .select('id')
        .single(),
    )
  ).id;
  const content = await must(
    admin
      .from('content_items')
      .insert({
        influencer_id: influencerId,
        title: 'Soru kancalı video',
        format: 'short_video',
        hook_type: 'soru',
      })
      .select('id')
      .single(),
  );
  const prompt = await must(
    admin
      .from('prompts')
      .insert({
        influencer_id: influencerId,
        category: 'video2video',
        key: `analytics-${Date.now()}`,
        title: 'Analitik test promptu',
        body: 'Kısa bir video',
      })
      .select('id')
      .single(),
  );
  const generation = await must(
    admin
      .from('generations')
      .insert({
        influencer_id: influencerId,
        prompt_id: prompt.id,
        tool: 'mock',
        type: 'video',
        status: 'succeeded',
      })
      .select('id')
      .single(),
  );
  await must(
    admin
      .from('content_item_assets')
      .insert({ content_item_id: content.id, generation_id: generation.id }),
  );

  const fixtures = [
    { key: 'b1', caption: 'Kıyas bir', day: 1, h1: 10, h24: 100 },
    { key: 'b2', caption: 'Kıyas iki', day: 2, h1: 20, h24: 200 },
    { key: 'b3', caption: 'Kıyas üç', day: 3, h1: 30, h24: 300 },
    { key: 'b4', caption: 'Kıyas dört', day: 4, h1: 40, h24: 1000 },
    { key: 'target', caption: 'Zayıf açılış', day: 5, h1: 5, h24: 50 },
  ];
  for (const f of fixtures) {
    const published = `2026-09-0${f.day}T10:00:00Z`;
    const post = await must(
      admin
        .from('posts')
        .insert({
          account_id: accountId,
          caption: f.caption,
          published_at: published,
          duration_s: 12,
          url: `https://example.invalid/analytics/${f.key}`,
          content_item_id: f.key === 'target' ? content.id : null,
        })
        .select('id')
        .single(),
    );
    posts[f.key] = post.id;
    const at = (hours: number) =>
      new Date(Date.parse(published) + hours * 3_600_000).toISOString();
    await must(
      admin.from('metric_snapshots').insert([
        {
          post_id: post.id,
          captured_at: at(1),
          hours_since_publish: 1,
          views: f.h1,
        },
        {
          post_id: post.id,
          captured_at: at(24),
          hours_since_publish: 24,
          views: f.h24,
          likes: 5,
          comments: 1,
          shares: 1,
          saves: 3,
        },
      ]),
    );
  }
});

test.afterAll(async () => {
  if (!influencerId) return;
  await must(admin.from('posts').delete().eq('account_id', accountId));
  await must(admin.from('influencers').delete().eq('id', influencerId));
});

// Next.js'in rota duyurucusu da role="alert" kullanır; hata kartını başlığıyla seç
const compareError = (page: Page) =>
  page.getByRole('alert').filter({ hasText: 'Karşılaştırma yapılamadı' });

async function openAnalytics(page: Page) {
  const response = await page.goto(`/analytics?inf=${slug}`);
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Analitik', level: 1 }),
  ).toBeVisible();
}

test('segment tablosu en az 3 boyutta medyan ve endeks gösterir', async ({
  page,
}) => {
  await openAnalytics(page);
  for (const name of [
    'Kanca türü segmentleri',
    'Format segmentleri',
    'Yayın saati segmentleri',
    'Süre segmentleri',
    'Platform segmentleri',
  ])
    await expect(page.getByRole('table', { name })).toBeVisible();
  // 24 sa: 50, 100, 200, 300, 1000 -> genel medyan 200; 'soru' (tek post) 50 -> 0,25×
  const hook = page.getByRole('table', { name: 'Kanca türü segmentleri' });
  await expect(hook.getByRole('row', { name: /soru/ })).toContainText('0,25×');
  await expect(hook.getByRole('row', { name: /Belirtilmemiş/ })).toContainText(
    '250',
  );
  await expect(
    page.getByRole('table', { name: 'Süre segmentleri' }),
  ).toContainText('15 sn altı');

  // Kontrol noktası değişince ?inf= korunur
  await page
    .getByRole('navigation', { name: 'Kontrol noktası' })
    .getByRole('link', { name: '1 sa' })
    .click();
  await expect(page).toHaveURL(new RegExp(`h=1.*inf=${slug}`));
  await expect(
    page.getByRole('table', { name: 'Kanca türü segmentleri' }),
  ).toContainText('Medyan 1 sa izlenme');
});

test('post detayı zaman çizelgesi, skor, ilk test dalgası, bağlı içerik ve maliyet yerini gösterir', async ({
  page,
}) => {
  await openAnalytics(page);
  await page.getByRole('link', { name: 'Zayıf açılış' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/analytics/posts/${posts.target}\\?inf=${slug}`),
  );
  await expect(
    page.getByRole('heading', { name: 'Post detayı', level: 1 }),
  ).toBeVisible();
  // İlk test dalgası: 1 sa 5 / medyan 25 = 0,2× < 0,5×
  await expect(
    page.getByRole('status').filter({ hasText: 'İlk test dalgası' }),
  ).toContainText('Eşik altında');
  // 24 sa: 50 / medyan 250 = 0,2×
  const checkpoints = page.getByRole('table', { name: 'Kontrol noktaları' });
  await expect(checkpoints.getByRole('row', { name: /24 sa/ })).toContainText(
    '250',
  );
  await expect(checkpoints.getByRole('row', { name: /24 sa/ })).toContainText(
    '0,2×',
  );
  await expect(
    page.getByRole('region', { name: 'Snapshot zaman çizelgesi' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Snapshot zaman çizelgesi/ }),
  ).toBeVisible();
  const content = page.getByRole('region', { name: 'Bağlı içerik' });
  await expect(content).toContainText('Soru kancalı video');
  await expect(content).toContainText('Kısa video');
  await expect(
    content.getByRole('link', { name: /Analitik test promptu/ }),
  ).toHaveAttribute('href', new RegExp(`inf=${slug}`));
  await expect(page.getByText('Maliyet', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: '← Analitik' }).click();
  await expect(page).toHaveURL(new RegExp(`/analytics\\?inf=${slug}`));
});

test('öğrenim eklenir ve listelenir; boş metin 400 döner', async ({ page }) => {
  await page.goto(`/analytics/posts/${posts.target}?inf=${slug}`);
  const form = page.getByRole('form', { name: 'Öğrenim ekle' });
  await form
    .getByLabel('Öğrenim notu')
    .fill('Soru kancası ilk saatte tutmadı; açılışı kısalt.');
  await form.getByLabel(/Etiketler/).fill('kanca, açılış');
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/learnings') && r.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Öğrenim ekle' }).click();
  expect((await saved).status()).toBe(201);
  const list = page.getByRole('list', { name: 'Öğrenim listesi' });
  await expect(list).toContainText('açılışı kısalt');
  await expect(list).toContainText('kanca, açılış');
  await expect(list.locator('time')).toHaveCount(1);

  // Influencer sayfasında da listelenir
  await page.goto(`/analytics?inf=${slug}`);
  await expect(
    page.getByRole('list', { name: 'Öğrenim listesi' }),
  ).toContainText('açılışı kısalt');

  const blank = await page.request.post('/api/learnings', {
    data: { body: '   ', postId: posts.target },
  });
  expect(blank.status()).toBe(400);
});

test('olmayan veya geçersiz post id HTTP 404 döner', async ({ page }) => {
  const missing = await page.goto(
    `/analytics/posts/${crypto.randomUUID()}?inf=${slug}`,
  );
  expect(missing?.status()).toBe(404);
  const invalid = await page.goto('/analytics/posts/abc');
  expect(invalid?.status()).toBe(404);
});

test('2 post seçilip karşılaştırılır, ?inf= korunur', async ({ page }) => {
  await openAnalytics(page);
  await page
    .getByRole('checkbox', { name: 'Zayıf açılış karşılaştırmaya ekle' })
    .check();
  await page
    .getByRole('checkbox', { name: 'Kıyas dört karşılaştırmaya ekle' })
    .check();
  await page
    .getByRole('link', { name: /Seçilenleri karşılaştır \(2\)/ })
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `/analytics/compare\\?ids=${posts.target},${posts.b4}&inf=${slug}`,
    ),
  );
  await expect(
    page.getByRole('heading', { name: 'Post karşılaştırma', level: 1 }),
  ).toBeVisible();
  const table = page.getByRole('table', { name: 'Post karşılaştırma tablosu' });
  await expect(table).toContainText('Zayıf açılış');
  await expect(table).toContainText('Kıyas dört');
  await expect(
    table.getByRole('row', { name: /^24 sa izlenme/ }),
  ).toContainText('★ en yüksek');
  await expect(
    table.getByRole('link', { name: /Zayıf açılış/ }),
  ).toHaveAttribute('href', new RegExp(`inf=${slug}`));
});

test('karşılaştırma 1 veya 5 id ile anlamlı hata verir', async ({ page }) => {
  await page.goto(`/analytics/compare?ids=${posts.target}&inf=${slug}`);
  await expect(compareError(page)).toContainText('en az 2 post seçin');
  await expect(
    page.getByRole('link', { name: 'Post seçimine dön' }),
  ).toHaveAttribute('href', `/analytics?inf=${slug}`);
  const five = Object.values(posts).join(',');
  await page.goto(`/analytics/compare?ids=${five}`);
  await expect(compareError(page)).toContainText(
    'En fazla 4 post karşılaştırılabilir',
  );
  await page.goto(
    `/analytics/compare?ids=${posts.target},${crypto.randomUUID()}`,
  );
  await expect(compareError(page)).toContainText('bulunamadı');
});
