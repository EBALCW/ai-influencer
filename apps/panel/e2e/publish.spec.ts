import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase } from './global-setup';
import { checklistKeys } from '../src/lib/content/checklist-schema';

// Panelden yayınlama ve zamanlanmış paylaşım (#58). Gerçek platforma istek atılmaz: panel yalnız
// yayın işi açar; worker (Edge Function) Deno testlerinde sahte fetch ile doğrulanır.
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

test('editor içeriği şimdi yayınlar, iptal eder ve planlar; eksik AI etiketi engellenir', async ({
  page,
}) => {
  const admin = adminClient();
  const slug = `publish-${crypto.randomUUID()}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: 'Yayın test karakteri', slug })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const influencerId = inf.data.id;
  try {
    const account = await admin
      .from('social_accounts')
      .insert({
        influencer_id: influencerId,
        platform: 'youtube',
        handle: '@publish.fixture',
        external_id: `publish-${influencerId}`,
      })
      .select('id')
      .single();
    if (account.error) throw account.error;
    const accountId = account.data.id;
    // Sahte token (yerel Vault); gerçek hesap yok, platforma istek atılmaz.
    const stored = await admin.rpc('store_social_token', {
      p_account_id: accountId,
      p_token: { access_token: 'e2e-fake-token' },
    });
    if (stored.error) throw stored.error;
    const asset = await admin
      .from('assets')
      .insert({
        influencer_id: influencerId,
        kind: 'final_video',
        storage_path: `${influencerId}/final.mp4`,
        mime_type: 'video/mp4',
      })
      .select('id')
      .single();
    if (asset.error) throw asset.error;
    const items = await admin
      .from('content_items')
      .insert([
        {
          influencer_id: influencerId,
          title: 'Hazır short',
          checklist: ready,
          target_account_id: accountId,
        },
        {
          influencer_id: influencerId,
          title: 'Etiketsiz short',
          checklist: {
            ...ready,
            items: { ...ready.items, ai_disclosure: false },
          },
          target_account_id: accountId,
        },
      ])
      .select('id,title');
    if (items.error) throw items.error;
    const readyId = items.data.find((i) => i.title === 'Hazır short')!.id;
    const unlabeledId = items.data.find(
      (i) => i.title === 'Etiketsiz short',
    )!.id;
    const links = await admin.from('content_item_assets').insert([
      { content_item_id: readyId, asset_id: asset.data.id },
      { content_item_id: unlabeledId, asset_id: asset.data.id },
    ]);
    if (links.error) throw links.error;

    await page.goto(`/content?inf=${slug}`);
    const card = page.getByTestId(`content-card-${readyId}`);
    const jobStatus = page
      .getByTestId(`publish-${readyId}`)
      .getByRole('status');

    // 1) Şimdi yayınla → iş kuyrukta, kart Planlandı'da.
    await card.getByText('Yayınla / planla', { exact: true }).click();
    const form = card.getByRole('form', { name: 'Hazır short yayın formu' });
    await expect(form).toContainText('YouTube Shorts · @publish.fixture');
    await form.getByLabel('Açıklama').fill('Sabah rutini #ai');
    await form.getByLabel('Etiketler (virgülle)').fill('ai, günlük');
    const nowResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/content-items/${readyId}/publish`) &&
        r.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'Şimdi yayınla' }).click();
    expect((await nowResponse).status()).toBe(201);
    await expect(jobStatus).toContainText('Yayın: Kuyrukta');
    await expect(card.getByLabel('Hazır short aşaması')).toHaveValue(
      'scheduled',
    );
    const queue = page.getByRole('region', { name: 'Yayın kuyruğu' });
    await expect(queue).toContainText('Hazır short');
    await expect(queue).toContainText('Kuyrukta');
    const first = await admin
      .from('publish_jobs')
      .select('id,status,caption,tags,platform')
      .eq('content_item_id', readyId)
      .single();
    if (first.error) throw first.error;
    expect(first.data).toMatchObject({
      status: 'queued',
      caption: 'Sabah rutini #ai',
      tags: ['ai', 'günlük'],
      platform: 'youtube',
    });

    // Aynı içerik için ikinci açık iş açılamaz.
    const dup = await page.request.post(
      `/api/content-items/${readyId}/publish`,
      { data: { mode: 'now', title: 'Tekrar' } },
    );
    expect(dup.status()).toBe(409);

    // 2) İptal.
    await card
      .getByRole('button', { name: 'Hazır short yayınını iptal et' })
      .click();
    await expect(jobStatus).toContainText('Yayın: İptal edildi');

    // 3) Planla (içeriğin saat dilimi Europe/Istanbul, UTC+3).
    await card.getByText('Yayınla / planla', { exact: true }).click();
    await form.getByLabel('Planlanan saatte').check();
    await form
      .getByLabel('Yayın zamanı (Europe/Istanbul)')
      .fill('2030-01-15T10:30');
    await form.getByRole('button', { name: 'Planla' }).click();
    await expect(jobStatus).toContainText('Yayın: Kuyrukta');
    await expect(jobStatus).toContainText('2030-01-15 10:30');
    const planned = await admin
      .from('publish_jobs')
      .select('scheduled_for,status')
      .eq('content_item_id', readyId)
      .eq('status', 'queued')
      .single();
    if (planned.error) throw planned.error;
    expect(new Date(planned.data.scheduled_for).toISOString()).toBe(
      '2030-01-15T07:30:00.000Z',
    );

    // 4) AI etiketi işaretlenmemiş içerik yayına alınamaz (422).
    const unlabeled = page.getByTestId(`content-card-${unlabeledId}`);
    await unlabeled.getByText('Yayınla / planla', { exact: true }).click();
    await expect(unlabeled).toContainText(
      'Yayın öncesi kontrol listesi (AI etiketi dahil) tamamlanmalı.',
    );
    const blocked = page.waitForResponse((r) =>
      r.url().endsWith(`/api/content-items/${unlabeledId}/publish`),
    );
    await unlabeled
      .getByRole('form', { name: 'Etiketsiz short yayın formu' })
      .getByRole('button', { name: 'Şimdi yayınla' })
      .click();
    expect((await blocked).status()).toBe(422);
    await expect(
      page.getByRole('status').filter({ hasText: 'AI etiketi' }).first(),
    ).toBeVisible();
    const none = await admin
      .from('publish_jobs')
      .select('id')
      .eq('content_item_id', unlabeledId);
    expect(none.data).toEqual([]);
  } finally {
    const removed = await admin
      .from('influencers')
      .delete()
      .eq('id', influencerId);
    if (removed.error) throw removed.error;
  }
});
