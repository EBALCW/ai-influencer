import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase } from './global-setup';

// Gelen kutusu (#61), editor oturumu. Her test kendi influencer'ını ve yorumlarını açar
// (yorum toplama Edge Function'da; burada service role ile uydurma yorum yazılır).
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

type Fixture = {
  slug: string;
  influencerId: string;
  comments: Record<'yt' | 'brand' | 'old', string>;
};

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

async function seed(): Promise<Fixture> {
  const db = admin();
  const suffix = crypto.randomUUID().slice(0, 8);
  const slug = `inbox-${suffix}`;
  const inf = await db
    .from('influencers')
    .insert({ name: `Inbox Karakter ${suffix}`, slug, status: 'active' })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const accounts = await db
    .from('social_accounts')
    .insert([
      {
        influencer_id: inf.data.id,
        platform: 'youtube',
        handle: `@yt-${suffix}`,
        external_id: `yt-${suffix}`,
        status: 'active',
      },
      {
        influencer_id: inf.data.id,
        platform: 'instagram',
        handle: `@ig-${suffix}`,
        external_id: `ig-${suffix}`,
        status: 'active',
      },
    ])
    .select('id, platform');
  if (accounts.error) throw accounts.error;
  const account = (p: string) =>
    accounts.data.find((a) => a.platform === p)!.id;
  const posts = await db
    .from('posts')
    .insert([
      {
        account_id: account('youtube'),
        external_id: `vid-${suffix}`,
        url: 'https://example.invalid/yt',
        caption: `YouTube post ${suffix}`,
        published_at: hoursAgo(30 * 24),
      },
      {
        account_id: account('instagram'),
        external_id: `media-${suffix}`,
        url: 'https://example.invalid/ig',
        caption: `Instagram post ${suffix}`,
        published_at: hoursAgo(48),
      },
    ])
    .select('id, account_id');
  if (posts.error) throw posts.error;
  const post = (p: string) =>
    posts.data.find((x) => x.account_id === account(p))!.id;
  const rows = [
    {
      key: 'yt',
      platform: 'youtube',
      author_name: `Uydurma İzleyici ${suffix}`,
      text: `Harika video ${suffix}`,
      published_at: hoursAgo(2),
      is_brand_inquiry: false,
    },
    {
      key: 'brand',
      platform: 'instagram',
      author_name: `uydurma.marka.${suffix}`,
      text: `İş birliği için yazar mısınız ${suffix}?`,
      published_at: hoursAgo(5),
      is_brand_inquiry: true,
    },
    {
      key: 'old',
      platform: 'youtube',
      author_name: `Eski İzleyici ${suffix}`,
      text: `Eski yorum ${suffix}`,
      published_at: hoursAgo(10 * 24),
      is_brand_inquiry: false,
    },
  ] as const;
  const inserted = await db
    .from('comments')
    .insert(
      rows.map((r) => ({
        post_id: post(r.platform),
        account_id: account(r.platform),
        platform: r.platform,
        external_id: `${r.key}-${suffix}`,
        author_name: r.author_name,
        text: r.text,
        published_at: r.published_at,
        is_brand_inquiry: r.is_brand_inquiry,
      })),
    )
    .select('id, external_id');
  if (inserted.error) throw inserted.error;
  const id = (key: string) =>
    inserted.data.find((c) => c.external_id === `${key}-${suffix}`)!.id;
  return {
    slug,
    influencerId: inf.data.id,
    comments: { yt: id('yt'), brand: id('brand'), old: id('old') },
  };
}

const item = (page: Page, author: RegExp | string) =>
  page.getByRole('listitem', {
    name: typeof author === 'string' ? `${author} yorumu` : author,
  });

test('menüden açılır; son 7 gün listelenir, filtreler (görünüm, platform, dönem) çalışır', async ({
  page,
}) => {
  const f = await seed();
  await page.goto(`/?inf=${f.slug}`);
  await page
    .getByRole('navigation', { name: 'Ana menü' })
    .getByRole('link', { name: 'Gelen kutusu' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/inbox\\?inf=${f.slug}`));
  await expect(
    page.getByRole('heading', { name: 'Gelen kutusu', level: 1 }),
  ).toBeVisible();

  const list = page.getByRole('list', { name: 'Yorum listesi' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByText(/Harika video/)).toBeVisible();
  await expect(list.getByText(/İş birliği için yazar/)).toBeVisible();
  await expect(list.getByText(/Eski yorum/)).toHaveCount(0);
  await expect(
    item(page, /uydurma\.marka/).getByText('İş birliği fırsatı'),
  ).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Yorum görünümü' })
    .getByRole('link', { name: 'İş birliği fırsatı' })
    .click();
  await expect(page).toHaveURL(/view=brand/);
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByText(/İş birliği için yazar/)).toBeVisible();

  await page.goto(`/inbox?inf=${f.slug}`);
  const filters = page.getByRole('form', { name: 'Yorum filtreleri' });
  await filters.getByLabel('Platform').selectOption('youtube');
  await filters.getByLabel('Dönem').selectOption('30');
  await filters.getByRole('button', { name: 'Filtrele' }).click();
  await expect(page).toHaveURL(/platform=youtube/);
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByText(/Eski yorum/)).toBeVisible();
  await expect(list.getByText(/İş birliği için yazar/)).toHaveCount(0);

  // Post detayına ve post filtresine link
  await item(page, /Uydurma İzleyici/)
    .getByRole('link', { name: 'Bu postun yorumları' })
    .click();
  await expect(page).toHaveURL(/post=/);
  await expect(page.getByText('Yalnız bu postun yorumları:')).toBeVisible();
  await expect(
    item(page, /Uydurma İzleyici/).getByRole('link', { name: 'Post detayı' }),
  ).toHaveAttribute('href', new RegExp(`/analytics/posts/.+\\?inf=${f.slug}`));
});

test('okundu işaretle, gizle ve gizlemeyi kaldır', async ({ page }) => {
  const f = await seed();
  await page.goto(`/inbox?inf=${f.slug}`);
  const yt = item(page, /Uydurma İzleyici/);
  await expect(yt.getByText('Yeni', { exact: true })).toBeVisible();
  const read = page.waitForResponse(
    (r) =>
      r.url().includes('/api/comments/') && r.request().method() === 'PATCH',
  );
  await yt.getByRole('button', { name: 'Okundu işaretle' }).click();
  expect((await read).status()).toBe(200);
  await expect(yt.getByText('Okundu', { exact: true })).toBeVisible();

  await yt.getByRole('button', { name: 'Gizle' }).click();
  await expect(yt).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Yorum görünümü' })
    .getByRole('link', { name: 'Gizlenenler' })
    .click();
  await expect(item(page, /Uydurma İzleyici/)).toBeVisible();
  await item(page, /Uydurma İzleyici/)
    .getByRole('button', { name: 'Gizlemeyi kaldır' })
    .click();
  await expect(item(page, /Uydurma İzleyici/)).toHaveCount(0);
  const { data } = await admin()
    .from('comments')
    .select('status')
    .eq('id', f.comments.yt)
    .single();
  expect(data?.status).toBe('read');
});

test('şablon + AI önerisiyle yanıt kuyruğa alınır; çift istek ikinci yanıt açmaz', async ({
  page,
}) => {
  const f = await seed();
  await page.route('**/api/ai/settings', (r) =>
    r.fulfill({
      json: { enabled: true, hasKey: true, canEdit: false, settings: null },
    }),
  );
  await page.route('**/api/ai/suggest', async (r) => {
    const body = r.request().postDataJSON();
    expect(body.influencerId).toBe(f.influencerId);
    expect(body.request).toMatchObject({
      task: 'reply',
      input: { commentId: f.comments.yt },
    });
    await r.fulfill({
      json: {
        task: 'reply',
        suggestion: { reply: 'Çok teşekkürler, iyi ki izledin!' },
        warnings: [],
      },
    });
  });
  await page.goto(`/inbox?inf=${f.slug}`);
  const yt = item(page, /Uydurma İzleyici/);
  await yt.getByRole('button', { name: 'Yanıtla' }).click();
  const form = yt.getByRole('form', { name: 'Yanıt formu' });
  await form.getByLabel('Şablon').selectOption('Teşekkür');
  await expect(form.getByLabel('Yanıt', { exact: true })).toHaveValue(
    /teşekkürler/i,
  );

  await form.getByRole('button', { name: 'AI ile öner' }).click();
  await expect(form.getByRole('region', { name: 'AI önerisi' })).toContainText(
    'iyi ki izledin',
  );
  await form.getByRole('button', { name: 'Öneriyi forma uygula' }).click();
  await expect(form.getByLabel('Yanıt', { exact: true })).toHaveValue(
    'Çok teşekkürler, iyi ki izledin!',
  );

  const queued = page.waitForResponse((r) => r.url().endsWith('/reply'));
  await form.getByRole('button', { name: 'Yanıtı gönder' }).click();
  expect((await queued).status()).toBe(202);
  await expect(yt.getByText(/Yanıt: Gönderim sırasında/)).toBeVisible();
  await expect(yt.getByRole('button', { name: 'Yanıtla' })).toHaveCount(0);

  const again = await page.request.post(
    `/api/comments/${f.comments.yt}/reply`,
    { data: { body: 'İkinci deneme' } },
  );
  expect(again.status()).toBe(200);
  expect(await again.json()).toMatchObject({ duplicate: true });
  const { data } = await admin()
    .from('comment_replies')
    .select('body, status')
    .eq('comment_id', f.comments.yt);
  expect(data).toEqual([
    { body: 'Çok teşekkürler, iyi ki izledin!', status: 'queued' },
  ]);
});

test('iş birliği yorumundan lead oluşturulur ve deal’e gidilir', async ({
  page,
}) => {
  const f = await seed();
  const brandName = `Inbox Marka ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto(`/inbox?inf=${f.slug}&view=brand`);
  const brand = item(page, /uydurma\.marka/);
  await brand.getByRole('button', { name: 'Lead oluştur' }).click();
  const form = brand.getByRole('form', { name: 'Lead formu' });
  await form.getByLabel('Yeni marka adı').fill(brandName);
  const created = page.waitForResponse((r) => r.url().endsWith('/lead'));
  await form.getByRole('button', { name: 'Lead’i kaydet' }).click();
  expect((await created).status()).toBe(201);
  await brand.getByRole('link', { name: 'Lead’e git' }).click();
  await expect(page).toHaveURL(/\/brands\/[0-9a-f-]{36}/);
  await expect(page.getByText(brandName).first()).toBeVisible();
});
