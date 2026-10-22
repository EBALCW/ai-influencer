import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase, VIEWER_STATE } from './global-setup';

test.skip(!hasLocalSupabase(), 'Yalnız yerel Supabase ile çalışır.');

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Hafta: 2026-09-07 (pazartesi) – 2026-09-13 (pazar), Türkiye saati.
const WEEK = { from: '2026-09-07', to: '2026-09-13' };

test('haftalık rapor tek tıkla oluşur; CSV ve yazdırma görünümü çalışır', async ({
  page,
  browser,
}) => {
  const admin = adminClient();
  const slug = `rapor-${crypto.randomUUID()}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: 'Rapor Şule Ğ', slug, status: 'active' })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const influencerId = inf.data.id;
  const postIds: string[] = [];
  try {
    const account = await admin
      .from('social_accounts')
      .insert({
        influencer_id: influencerId,
        platform: 'instagram',
        handle: `rapor_${slug.slice(-8)}`,
      })
      .select('id')
      .single();
    if (account.error) throw account.error;
    const accountId = account.data.id;

    const followers = await admin.from('account_snapshots').insert([
      {
        account_id: accountId,
        captured_at: '2026-09-06T20:00:00Z',
        followers: 1000,
      },
      {
        account_id: accountId,
        captured_at: '2026-09-13T20:00:00Z',
        followers: 1150,
      },
    ]);
    if (followers.error) throw followers.error;

    const posts = await admin
      .from('posts')
      .insert([
        {
          account_id: accountId,
          caption: 'Çok güzel bir gün, ışıl ışıl',
          published_at: '2026-09-08T10:00:00Z',
        },
        {
          account_id: accountId,
          caption: '=HYPERLINK("https://example.invalid","tıkla")',
          published_at: '2026-09-13T20:30:00Z', // pazar 23:30 TR
        },
      ])
      .select('id');
    if (posts.error) throw posts.error;
    postIds.push(...posts.data.map((row) => row.id));

    const metrics = await admin.from('metric_snapshots').insert([
      {
        post_id: postIds[0],
        captured_at: '2026-09-12T12:00:00Z',
        views: 1300,
        likes: 60,
      },
      {
        post_id: postIds[1],
        captured_at: '2026-09-13T20:45:00Z',
        views: 500,
        likes: 20,
      },
    ]);
    if (metrics.error) throw metrics.error;

    const costs = await admin.from('costs').insert([
      {
        influencer_id: influencerId,
        category: 'tool',
        amount: 10,
        currency: 'USD',
        incurred_on: '2026-09-07',
        description: 'Kurgu aracı',
      },
      {
        influencer_id: influencerId,
        category: 'credits',
        amount: 5,
        currency: 'USD',
        incurred_on: '2026-09-13',
        description: '-iade',
      },
    ]);
    if (costs.error) throw costs.error;

    const learning = await admin.from('learnings').insert({
      influencer_id: influencerId,
      post_id: postIds[0],
      body: 'Soru ile açılan hook daha uzun izlendi',
      tags: ['hook'],
      created_at: '2026-09-10T09:00:00Z',
    });
    if (learning.error) throw learning.error;

    // Canlı özet
    await page.goto(`/analytics/reports?date=${WEEK.from}&inf=${slug}`);
    await expect(
      page.getByRole('heading', { name: 'Haftalık rapor', level: 1 }),
    ).toBeVisible();
    const kpis = page.getByRole('region', { name: "Dönem KPI'ları" });
    await expect(kpis.getByText('+150', { exact: true })).toBeVisible();
    await expect(kpis.getByText('1.800', { exact: true })).toBeVisible();
    await expect(kpis.getByText('$15,00', { exact: true })).toBeVisible();
    await expect(kpis.getByText('$7,50', { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'En iyi içerikler' })
        .getByText('Çok güzel bir gün, ışıl ışıl'),
    ).toBeVisible();

    await expect(
      page
        .getByRole('region', { name: 'Öğrenimler' })
        .getByText('Soru ile açılan hook daha uzun izlendi'),
    ).toBeVisible();

    // Tek tıkla kaydet → rapor sayfası
    await page.getByRole('button', { name: 'Haftalık raporu oluştur' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/analytics/reports/[0-9a-f-]{36}\\?inf=${slug}$`),
    );
    await expect(
      page.getByRole('heading', { name: 'Rapor Şule Ğ', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText('Elle oluşturuldu', { exact: false }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: "Dönem KPI'ları" })
        .getByText('1.800', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Yazdır / PDF olarak kaydet' }),
    ).toBeVisible();
    const saved = await admin
      .from('reports')
      .select('id, period_start, summary')
      .eq('influencer_id', influencerId);
    if (saved.error) throw saved.error;
    expect(saved.data).toHaveLength(1);
    expect(saved.data[0]!.period_start).toBe(WEEK.from);

    // PDF: yazdırma görünümünde panel kabuğu gizlenir
    await page.emulateMedia({ media: 'print' });
    await expect(
      page.getByRole('navigation', { name: 'Ana menü' }),
    ).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Yazdır / PDF olarak kaydet' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Rapor Şule Ğ', level: 1 }),
    ).toBeVisible();
    await page.emulateMedia({ media: 'screen' });

    // CSV
    const query = `inf=${slug}&from=${WEEK.from}&to=${WEEK.to}`;
    const csv = await page.request.get(`/api/exports/posts?${query}`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toBe('text/csv; charset=utf-8');
    expect(csv.headers()['content-disposition']).toBe(
      `attachment; filename="posts_${slug}_${WEEK.from}_${WEEK.to}.csv"`,
    );
    const bytes = await csv.body();
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8');
    expect(text).toContain('Rapor Şule Ğ');
    expect(text).toContain('"Çok güzel bir gün, ışıl ışıl"');
    expect(text).toContain(
      `"'=HYPERLINK(""https://example.invalid"",""tıkla"")"`,
    );
    expect(text.trimEnd().split('\r\n')).toHaveLength(3);

    for (const dataset of ['metrics', 'costs']) {
      const response = await page.request.get(
        `/api/exports/${dataset}?${query}`,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()['content-disposition']).toContain(
        `${dataset}_${slug}`,
      );
    }
    const costCsv = await (
      await page.request.get(`/api/exports/costs?${query}`)
    ).text();
    expect(costCsv).toContain("'-iade");
    expect(
      (await page.request.get(`/api/exports/users?${query}`)).status(),
    ).toBe(400);

    // Viewer: okur ve dışa aktarır, rapor oluşturamaz
    const viewer = await browser.newContext({ storageState: VIEWER_STATE });
    try {
      const vp = await viewer.newPage();
      await vp.goto(`/analytics/reports?date=${WEEK.from}&inf=${slug}`);
      await expect(
        vp.getByRole('link', { name: 'Kayıtlı raporu aç' }),
      ).toBeVisible();
      await expect(
        vp.getByRole('button', { name: /raporu (oluştur|güncelle)/i }),
      ).toHaveCount(0);
      expect(
        (await vp.request.get(`/api/exports/posts?${query}`)).status(),
      ).toBe(200);
      expect(
        (
          await vp.request.post('/api/reports', {
            data: { periodStart: WEEK.from, influencerId },
          })
        ).status(),
      ).toBe(403);
    } finally {
      await viewer.close();
    }

    // Oturumsuz: dışa aktarma 401
    const guest = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      expect(
        (await guest.request.get(`/api/exports/posts?${query}`)).status(),
      ).toBe(401);
      expect(
        (await guest.request.post('/api/reports', { data: {} })).status(),
      ).toBe(401);
    } finally {
      await guest.close();
    }
  } finally {
    if (postIds.length) {
      const removedPosts = await admin.from('posts').delete().in('id', postIds);
      if (removedPosts.error) throw removedPosts.error;
    }
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', influencerId);
    if (removed.error) throw removed.error;
  }
});

test('veri olmayan haftada boş durum gösterilir', async ({ page }) => {
  const admin = adminClient();
  const slug = `rapor-bos-${crypto.randomUUID()}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: 'Boş rapor karakteri', slug })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  try {
    await page.goto(`/analytics/reports?date=2026-08-03&inf=${slug}`);
    await expect(page.getByText('Bu dönem için veri yok')).toBeVisible();
    await expect(page.getByText('Kayıtlı rapor yok')).toBeVisible();
    await page.getByRole('link', { name: 'Ay', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Aylık rapor', level: 1 }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`period=month.*inf=${slug}`));
  } finally {
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', inf.data.id);
    if (removed.error) throw removed.error;
  }
});
