import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase, VIEWER_STATE } from './global-setup';
test.skip(!hasLocalSupabase(), 'Yalnız yerel Supabase ile çalışır.');
const custom = 'range=custom&from=2026-10-01&to=2026-10-10';
const kpi = (page: Page, label: string) =>
  page
    .getByRole('region', { name: 'Dashboard KPI', exact: true })
    .getByRole('article')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('.stat-value');

test('seed KPI ve grafikler SQL ile aynı; filtreler ve influencer seçimi korunur', async ({
  page,
}, testInfo) => {
  const url = `/?inf=demo-creator&${custom}`;
  await page.goto(url);
  await expect(kpi(page, 'Dönem izlenmesi')).toHaveText('20.140');
  await expect(kpi(page, 'Paylaşılan video')).toHaveText('10');
  await expect(kpi(page, 'Ortalama etkileşim')).toHaveText('%8,35');
  await expect(kpi(page, 'Toplam takipçi')).toHaveText('—');
  await page.getByText('Günlük izlenme veri tablosu', { exact: true }).click();
  const table = page.getByRole('table', {
    name: 'Günlük izlenme — UTC gün sonu değerleri',
  });
  await expect(
    table.getByRole('row').filter({ hasText: '2026-10-01' }),
  ).toContainText('1.200');
  await expect(
    page.getByRole('region', { name: 'En iyi 5 post', exact: true }),
  ).toContainText('24–30 saat ölçümü olan post yok.');
  const form = page.getByRole('form', { name: 'Dashboard filtreleri' });
  await form.getByLabel('Platform', { exact: true }).selectOption('instagram');
  await form.getByRole('button', { name: 'Filtreleri uygula' }).click();
  await expect(page).toHaveURL(/inf=demo-creator/);
  await expect(page).toHaveURL(/platform=instagram/);
  await expect(kpi(page, 'Dönem izlenmesi')).toHaveText('6.490');
  await expect(kpi(page, 'Paylaşılan video')).toHaveText('5');
  await expect(
    page.getByRole('region', { name: 'Dönem maliyetleri', exact: true }),
  ).toContainText('bu filtrede maliyet hesaplanamaz');
  await expect(
    page.getByRole('link', { name: 'İçerik akışını aç', exact: true }),
  ).toHaveAttribute('href', '/content?inf=demo-creator');
  await page
    .getByRole('link', { name: 'İçerik akışını aç', exact: true })
    .click();
  await expect(page).toHaveURL(/\/content\?inf=demo-creator/);
  const timings: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    await page.goto(url);
    await expect(kpi(page, 'Dönem izlenmesi')).toHaveText('20.140');
    timings.push(Date.now() - start);
  }
  const median = [...timings].sort((a, b) => a - b)[1]!;
  console.log('dashboard_load_ms', JSON.stringify({ timings, median }));
  testInfo.annotations.push({
    type: 'dashboard_load_ms',
    description: JSON.stringify({ timings, median }),
  });
  expect(median).toBeLessThan(process.env.CI ? 8000 : 2000);
});

test('boş hesap CTA; canlı fixture karşılaştırma, kapsam, plan ve viewer okuması', async ({
  page,
  browser,
}) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const slug = `dash-${crypto.randomUUID()}`;
  let id = '';
  const accountIds: string[] = [];
  try {
    const inf = await admin
      .from('influencers')
      .insert({ name: 'Dashboard fixture', slug })
      .select('id')
      .single();
    if (inf.error) throw inf.error;
    id = inf.data.id;
    await page.goto(`/?inf=${slug}&${custom}`);
    await expect(
      page.getByRole('heading', { name: 'Bağlı sosyal hesap yok' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Hesap bağla', exact: true }),
    ).toHaveAttribute('href', `/influencers/${slug}?tab=accounts&inf=${slug}`);
    const accounts = await admin
      .from('social_accounts')
      .insert([
        { influencer_id: id, platform: 'instagram', handle: slug + 'ig' },
        { influencer_id: id, platform: 'youtube', handle: slug + 'yt' },
      ])
      .select('id,platform');
    if (accounts.error) throw accounts.error;
    accountIds.push(...accounts.data.map((a) => a.id));
    const content = await admin
      .from('content_items')
      .insert({
        influencer_id: id,
        title: 'Dashboard same content',
        target_account_id: accountIds[0],
        scheduled_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (content.error) throw content.error;
    const posts = await admin
      .from('posts')
      .insert(
        accounts.data.map((a) => ({
          account_id: a.id,
          content_item_id: content.data.id,
          published_at: '2026-10-01T00:00Z',
          caption: `Fixture ${a.platform}`,
        })),
      )
      .select('id,account_id');
    if (posts.error) throw posts.error;
    const snapshots = await admin.from('metric_snapshots').insert(
      posts.data.map((p, i) => ({
        post_id: p.id,
        captured_at: '2026-10-02T00:00Z',
        hours_since_publish: 24,
        views: (i + 1) * 100,
        likes: (i + 1) * 10,
      })),
    );
    if (snapshots.error) throw snapshots.error;
    const cost = await admin.from('costs').insert([
      {
        influencer_id: id,
        category: 'other',
        amount: 20,
        currency: 'USD',
        incurred_on: '2026-10-02',
      },
      {
        influencer_id: id,
        category: 'other',
        amount: 600,
        currency: 'TRY',
        incurred_on: '2026-10-02',
      },
    ]);
    if (cost.error) throw cost.error;
    await page.reload();
    await expect(kpi(page, 'Dönem izlenmesi')).toHaveText('300');
    await expect(kpi(page, 'Paylaşılan video')).toHaveText('2');
    await expect(kpi(page, 'Ortalama etkileşim')).toHaveText('%10');
    await expect(kpi(page, 'Video başına maliyet')).toHaveText(
      'Para birimi bazında',
    );
    await expect(
      page.getByRole('region', {
        name: 'Platform karşılaştırması',
        exact: true,
      }),
    ).toContainText('Dashboard same content');
    await expect(
      page
        .getByRole('region', { name: 'En iyi 5 post', exact: true })
        .getByRole('cell', { name: '200', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Bugünün yayın planı', exact: true }),
    ).toContainText('Dashboard same content');
    await expect(
      page.getByRole('region', { name: 'Bekleyen işler', exact: true }),
    ).toContainText('Dashboard same content');
    await expect(
      page.getByRole('region', { name: 'Dönem maliyetleri', exact: true }),
    ).toContainText('$10,00');
    const viewer = await browser.newContext({ storageState: VIEWER_STATE });
    try {
      const vp = await viewer.newPage();
      await vp.goto(`/?inf=${slug}&${custom}`);
      await expect(kpi(vp, 'Dönem izlenmesi')).toHaveText('300');
    } finally {
      await viewer.close();
    }
    // Scope changes reset table search/pagination while retaining the date filter.
    const best = page.getByRole('region', {
      name: 'En iyi 5 post',
      exact: true,
    });
    await best.getByLabel('Tabloda ara').fill('no dashboard match');
    const selection = page.getByLabel('Aktif influencer', { exact: true });
    await selection.selectOption('');
    await expect(kpi(page, 'Paylaşılan video')).not.toHaveText('2');
    await selection.selectOption(slug);
    await expect(kpi(page, 'Dönem izlenmesi')).toHaveText('300');
    await expect(best.getByLabel('Tabloda ara')).toHaveValue('');
    await expect(
      best.getByRole('cell', { name: '200', exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/from=2026-10-01/);
    await page.goto(`/?inf=${slug}&range=custom&from=2026-02-30&to=2026-03-01`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Geçersiz filtre',
    );
    await page.goto(`/?inf=dashboard-unknown-${crypto.randomUUID()}&${custom}`);
    await expect(
      page.getByRole('heading', { name: 'Influencer bulunamadı' }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Dashboard KPI', exact: true }),
    ).toHaveCount(0);
  } finally {
    if (accountIds.length) {
      const r = await admin.from('posts').delete().in('account_id', accountIds);
      if (r.error) throw r.error;
    }
    if (id) {
      const r = await admin.from('influencers').delete().eq('id', id);
      if (r.error) throw r.error;
    }
  }
});
