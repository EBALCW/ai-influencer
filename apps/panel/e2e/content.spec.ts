import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase, VIEWER_EMAIL, VIEWER_STATE } from './global-setup';
import { checklistKeys } from '../src/lib/content/checklist-schema';

test.skip(!hasLocalSupabase(), 'Yalnız yerel Supabase ile çalışır.');
const ready = {
  items: Object.fromEntries(checklistKeys.map((key) => [key, true])),
  hookScore: 4,
  engagementScore: 4,
  decision: 'ready',
};
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
/** Puanlayan (editor) üretenden farklı olsun diye üretim viewer'a atanır (#22). */
async function viewerUserId(admin: ReturnType<typeof adminClient>) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const viewer = data.users.find((u) => u.email === VIEWER_EMAIL);
  if (!viewer) throw new Error('e2e viewer kullanıcısı yok');
  return viewer.id;
}

test('içerik fikri kanban, checklist, takvim ve post metrikleriyle uçtan uca ilerler', async ({
  page,
  browser,
}) => {
  const admin = adminClient(),
    slug = `content-${crypto.randomUUID()}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: 'İçerik test karakteri', slug })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const influencerId = inf.data.id;
  const viewerId = await viewerUserId(admin);
  let accountId = '';
  try {
    const account = await admin
      .from('social_accounts')
      .insert({
        influencer_id: influencerId,
        platform: 'instagram',
        handle: '@content.fixture',
      })
      .select('id')
      .single();
    if (account.error) throw account.error;
    accountId = account.data.id;
    const asset = await admin
      .from('assets')
      .insert({
        influencer_id: influencerId,
        kind: 'reference',
        storage_path: `${influencerId}/test-placeholder.png`,
      })
      .select('id')
      .single();
    if (asset.error) throw asset.error;
    const generation = await admin
      .from('generations')
      .insert({
        influencer_id: influencerId,
        tool: 'mock',
        type: 'image',
        status: 'succeeded',
        output_asset_id: asset.data.id,
      })
      .select('id')
      .single();
    if (generation.error) throw generation.error;
    const post = await admin
      .from('posts')
      .insert({
        account_id: accountId,
        published_at: '2026-11-10T12:00:00Z',
        url: 'https://example.invalid/published-fixture',
      })
      .select('id')
      .single();
    if (post.error) throw post.error;
    const metrics = await admin
      .from('metric_snapshots')
      .insert({ post_id: post.data.id, views: 321 });
    if (metrics.error) throw metrics.error;
    await page.goto(`/content?inf=${slug}`);
    await expect(
      page.getByRole('heading', { name: 'Henüz içerik yok' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Yeni içerik', exact: true })
      .click();
    let editor = page.getByRole('region', { name: 'Yeni içerik formu' });
    await editor.getByLabel('Başlık', { exact: true }).fill('Takvim denemesi');
    await editor
      .getByLabel('Hedef hesap', { exact: true })
      .selectOption(accountId);
    await editor
      .getByLabel('Yayın zamanı', { exact: true })
      .fill('2026-11-10T15:00');
    await editor
      .getByLabel('Kaynak trend bağlantısı')
      .fill('https://example.invalid/trend');
    await editor.getByLabel('Kaynak izlenme').fill('1234');
    await editor
      .getByLabel('Neden viral?')
      .fill('Kısa açılış ve anlaşılır dönüş.');
    await editor.getByLabel('Uyarlama puanı (1–5)').fill('4');
    await editor
      .getByRole('group', { name: /Bağlı asset/ })
      .getByRole('checkbox')
      .check();
    await editor
      .getByRole('group', { name: /Bağlı üretimler/ })
      .getByRole('checkbox')
      .check();
    const createdResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/content-items') &&
        r.request().method() === 'POST',
    );
    await editor.getByRole('button', { name: 'İçeriği kaydet' }).click();
    const created = await createdResponse;
    expect(created.status()).toBe(201);
    const { item } = (await created.json()) as { item: { id: string } };
    const card = page.getByTestId(`content-card-${item.id}`);
    await expect(card).toContainText('1 asset · 1 üretim');
    await card.dragTo(page.getByRole('region', { name: 'Senaryo sütunu' }));
    const stage = card.getByLabel('Takvim denemesi aşaması');
    await expect(stage).toHaveValue('script');
    await stage.focus();
    await stage.press('ArrowDown');
    await stage.press('Enter');
    await expect(stage).toHaveValue('production');
    await stage.selectOption('qc');
    await expect(stage).toHaveValue('qc');
    await stage.selectOption('edit');
    await expect(stage).toHaveValue('edit');
    const blocked = await page.request.patch(`/api/content-items/${item.id}`, {
      data: { stage: 'scheduled' },
    });
    expect(blocked.status()).toBe(422);
    await stage.selectOption('scheduled');
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'tüm yayın öncesi kontrolleri' }),
    ).toBeVisible();
    await expect(stage).toHaveValue('edit');
    await card
      .getByRole('button', { name: 'Takvim denemesi', exact: true })
      .click();
    editor = page.getByRole('region', { name: 'İçerik düzenleme' });
    for (const checkbox of await editor.getByRole('checkbox').all())
      await checkbox.check();
    await editor.getByLabel('1. İzlenme kancası puanı (1–5)').fill('4');
    await editor.getByLabel('2. Yorum/paylaşım nedeni puanı (1–5)').fill('4');
    await editor.getByLabel('Yayın kararı').selectOption('ready');
    await editor.getByLabel('Aşama', { exact: true }).selectOption('scheduled');
    // Kartı açan editor hem üreten hem puanlayan: sunucu planlamayı reddeder (#22).
    await editor.getByRole('button', { name: 'İçeriği kaydet' }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Puanlayan kişi üreten kişiden farklı olmalı' }),
    ).toBeVisible();
    await expect(stage).toHaveValue('edit');
    await editor.getByLabel('Sorumlu', { exact: true }).selectOption(viewerId);
    await editor.getByRole('button', { name: 'İçeriği kaydet' }).click();
    await expect(stage).toHaveValue('scheduled');
    await expect(card).toContainText('en az 5 saat');
    const near = await page.request.post('/api/content-items', {
      data: {
        influencer_id: influencerId,
        title: 'Yakın plan',
        stage: 'scheduled',
        target_account_id: accountId,
        scheduled_at: '2026-11-10T16:00:00Z',
        checklist: ready,
        assignee_id: viewerId,
      },
    });
    expect(near.status()).toBe(201);
    await card.getByText('Yayınlanmış postu eşleştir', { exact: true }).click();
    await card.getByLabel('Takvim denemesi postu').selectOption(post.data.id);
    await card.getByRole('button', { name: 'Eşleştir ve yayında yap' }).click();
    await expect(stage).toHaveValue('published');
    await expect(card).toContainText('İzlenme: 321');
    await page
      .getByRole('link', { name: 'Yayın takvimi', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`inf=${slug}`));
    await page.getByLabel('Tarih', { exact: true }).fill('2026-11-10');
    await page.getByLabel('Görünüm', { exact: true }).selectOption('month');
    await page.getByRole('button', { name: 'Takvimi göster' }).click();
    await expect(
      page.getByRole('region', { name: '2026-11-10 yayınları' }),
    ).toContainText('Takvim denemesi');
    let slotForm = page.getByRole('form', { name: 'Yayın slotu formu' });
    await slotForm.getByLabel('Slot hesabı').selectOption(accountId);
    await slotForm.getByLabel('Haftanın günü').selectOption('2');
    await slotForm.getByLabel('Yerel saat', { exact: true }).fill('17:30');
    await slotForm.getByRole('button', { name: 'Slot ekle' }).click();
    let slotRow = page.getByRole('listitem').filter({ hasText: '17:30' });
    await expect(slotRow).toBeVisible();
    await expect(
      page.getByRole('region', { name: '2026-11-10 yayınları' }),
    ).toContainText('Yayın slotu · 17:30');
    await slotRow.getByRole('button', { name: 'Düzenle', exact: true }).click();
    slotForm = page.getByRole('form', { name: 'Yayın slotu formu' });
    await slotForm.getByLabel('Yerel saat', { exact: true }).fill('18:30');
    await slotForm.getByRole('button', { name: 'Slotu güncelle' }).click();
    slotRow = page.getByRole('listitem').filter({ hasText: '18:30' });
    await expect(slotRow).toBeVisible();
    await slotRow.getByRole('button', { name: 'Slotu sil' }).click();
    await expect(slotRow).toHaveCount(0);
    await page.getByLabel('Görünüm', { exact: true }).selectOption('week');
    await page.getByRole('button', { name: 'Takvimi göster' }).click();
    await expect(
      page.getByRole('region', { name: '2026-11-10 yayınları' }),
    ).toContainText('Takvim denemesi');
    await page.getByRole('link', { name: 'İçerik akışı', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`inf=${slug}`));
    const viewer = await browser.newContext({ storageState: VIEWER_STATE });
    try {
      const vp = await viewer.newPage();
      await vp.goto(`/content?inf=${slug}`);
      await expect(
        vp.getByRole('button', { name: 'Yeni içerik', exact: true }),
      ).toHaveCount(0);
      await expect(vp.getByLabel('Takvim denemesi aşaması')).toBeDisabled();
      expect(
        (
          await vp.request.patch(`/api/content-items/${item.id}`, {
            data: { stage: 'edit' },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await vp.request.post(`/api/content-items/${item.id}/post`, {
            data: { post_id: post.data.id },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await vp.request.post('/api/posting-slots', {
            data: {
              account_id: accountId,
              weekday: 1,
              local_time: '12:00',
              timezone: 'UTC',
            },
          })
        ).status(),
      ).toBe(403);
    } finally {
      await viewer.close();
    }
  } finally {
    if (accountId) {
      const deleted = await admin
        .from('posts')
        .delete()
        .eq('account_id', accountId);
      if (deleted.error) throw deleted.error;
    }
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', influencerId);
    if (removed.error) throw removed.error;
  }
});

test('100 karttan sonra sayfalama influencer filtresini korur', async ({
  page,
}) => {
  const admin = adminClient(),
    slug = `content-pages-${crypto.randomUUID()}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: 'Sayfalama test karakteri', slug })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  try {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      influencer_id: inf.data.id,
      title: `Kart ${String(i).padStart(3, '0')}`,
      sort_order: i,
    }));
    const inserted = await admin.from('content_items').insert(rows);
    if (inserted.error) throw inserted.error;
    await page.goto(`/content?inf=${slug}`);
    await expect(
      page.getByRole('button', { name: 'Kart 000', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Kart 100', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('link', { name: 'Sonraki kayıtlar' }).click();
    await expect(page).toHaveURL(
      new RegExp(`page=2.*inf=${slug}|inf=${slug}.*page=2`),
    );
    await expect(
      page.getByRole('button', { name: 'Kart 100', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Kart 000', exact: true }),
    ).toHaveCount(0);
  } finally {
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', inf.data.id);
    if (removed.error) throw removed.error;
  }
});

test('v2v içerik kaynak bilgisi olmadan planlanamaz; form alanları ve eksik kaynak filtresi çalışır (#145)', async ({
  page,
}) => {
  const admin = adminClient(),
    slug = `content-v2v-${crypto.randomUUID()}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: 'V2V test karakteri', slug })
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
        handle: '@v2v.fixture',
      })
      .select('id')
      .single();
    if (account.error) throw account.error;
    const generation = await admin
      .from('generations')
      .insert({
        influencer_id: influencerId,
        tool: 'mock',
        type: 'video',
        mode: 'video_to_video',
        status: 'succeeded',
      })
      .select('id')
      .single();
    if (generation.error) throw generation.error;
    // Service role ile oluşturulan kartta puanlayan bilinmez; yalnız kaynak kuralı engeller.
    const item = await admin
      .from('content_items')
      .insert({
        influencer_id: influencerId,
        title: 'V2V dans',
        stage: 'edit',
        checklist: ready,
        target_account_id: account.data.id,
        scheduled_at: '2026-11-12T15:00:00Z',
      })
      .select('id')
      .single();
    if (item.error) throw item.error;
    const link = await admin.from('content_item_assets').insert({
      content_item_id: item.data.id,
      generation_id: generation.data.id,
    });
    if (link.error) throw link.error;

    await page.goto(`/content?inf=${slug}`);
    const card = page.getByTestId(`content-card-${item.data.id}`);
    await expect(card).toContainText('Kaynak bilgisi eksik (v2v)');
    const stage = card.getByLabel('V2V dans aşaması');
    await stage.selectOption('scheduled');
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'kaydedilmeden planlama veya yayın yapılamaz' }),
    ).toBeVisible();
    await expect(stage).toHaveValue('edit');

    await page.getByRole('link', { name: 'Kaynak bilgisi eksik v2v' }).click();
    await expect(page).toHaveURL(/source=missing/);
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: 'V2V dans', exact: true }).click();
    const editor = page.getByRole('region', { name: 'İçerik düzenleme' });
    await expect(
      editor.getByRole('group', {
        name: /Kaynak bilgisi \(video-to-video\) · zorunlu/,
      }),
    ).toBeVisible();
    await editor
      .getByLabel('Kaynak türü', { exact: true })
      .selectOption('third_party');
    await editor.getByLabel('Kaynak sahibi').fill('@public.dance');
    await editor.getByRole('button', { name: 'İçeriği kaydet' }).click();
    await expect(editor.getByRole('alert')).toContainText(
      'sahip ve lisans/izin referansı zorunlu',
    );
    await editor
      .getByLabel('Lisans / izin referansı')
      .fill('yazılı izin – kısıtlı depoda: izin/2026-11');
    await editor.getByLabel('Aşama', { exact: true }).selectOption('scheduled');
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/content-items/${item.data.id}`) &&
        r.request().method() === 'PATCH',
    );
    await editor.getByRole('button', { name: 'İçeriği kaydet' }).click();
    expect((await saved).status()).toBe(200);
    const row = await admin
      .from('content_items')
      .select(
        'stage,source_type,source_owner,source_checked_at,source_checked_by',
      )
      .eq('id', item.data.id)
      .single();
    if (row.error) throw row.error;
    expect(row.data).toMatchObject({
      stage: 'scheduled',
      source_type: 'third_party',
      source_owner: '@public.dance',
    });
    expect(row.data.source_checked_at).not.toBeNull();
    expect(row.data.source_checked_by).not.toBeNull();
    await page.goto(`/content?inf=${slug}&source=missing`);
    await expect(
      page.getByRole('heading', {
        name: 'Kaynak bilgisi eksik v2v içerik yok',
      }),
    ).toBeVisible();
  } finally {
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', influencerId);
    if (removed.error) throw removed.error;
  }
});
