import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase } from './global-setup';

// Yayıncı klipleri (#173): editor kaynak ekler, izni işaretler, klip adayı ekler ve
// backlog'a aktarır. İzin verilmeden aktarma arayüzde ve API'de engellidir.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

test('editor kaynak ekler, izin verir, klip ekler ve backlog’a aktarır', async ({
  page,
}) => {
  const admin = adminClient();
  const run = crypto.randomUUID().slice(0, 8);
  const slug = `clips-${run}`;
  const videoId = `e2e${run}`;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: `Klip test ${run}`, slug })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const influencerId = inf.data.id;
  try {
    const response = await page.goto(`/clips?inf=${slug}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Klipler', level: 1 }),
    ).toBeVisible();

    // 1) Kaynak ekleme: video id linkten çıkarılır, link kanonik biçimde saklanır.
    await page.getByRole('button', { name: /Yeni kaynak/ }).click();
    const sourceForm = page.getByRole('form', { name: /Kaynak ekle/ });
    await sourceForm
      .getByLabel(/YouTube linki/)
      .fill('https://example.invalid/watch?v=abc');
    await sourceForm.getByLabel(/Video başlığı/).fill(`E2E yayın ${run}`);
    await sourceForm.getByLabel(/Kanal adı/).fill(`E2E Kanal ${run}`);
    await sourceForm.getByRole('button', { name: /Kaynağı kaydet/ }).click();
    await expect(sourceForm.getByRole('alert')).toContainText(/YouTube/);
    await sourceForm
      .getByLabel(/YouTube linki/)
      .fill(`https://youtu.be/${videoId}?si=e2e`);
    await expect(sourceForm).toContainText(`Video id: ${videoId}`);
    await sourceForm.getByLabel(/Video süresi/).fill('10:00');
    await sourceForm.getByRole('button', { name: /Kaynağı kaydet/ }).click();
    await expect(page.getByText(/Kaynak eklendi/)).toBeVisible();

    const source = page.getByRole('article', {
      name: new RegExp(`Kaynak: E2E yayın ${run}`),
    });
    await expect(
      source.getByText('İzin bekleniyor', { exact: true }),
    ).toBeVisible();
    await expect(source).toContainText(`E2E Kanal ${run}`);
    await expect(
      source.getByRole('link', { name: new RegExp(`E2E yayın ${run}`) }),
    ).toHaveAttribute('href', videoUrl);

    // 2) Klip adayı: mm:ss girişi, 180 sn sınırı.
    await source.getByRole('button', { name: /Klip ekle/ }).click();
    const clipForm = source.getByRole('form', { name: /Klip ekle/ });
    await clipForm.getByLabel(/Klip başlığı/).fill(`E2E klip ${run}`);
    await clipForm.getByLabel(/Kanca/).fill(`E2E kanca ${run}`);
    await clipForm.getByLabel(/Başlangıç/).fill('1:30');
    await clipForm.getByLabel(/Bitiş/).fill('5:00');
    await clipForm.getByRole('button', { name: /Klibi kaydet/ }).click();
    await expect(clipForm.getByRole('alert')).toContainText(/180 sn/);
    await clipForm.getByLabel(/Bitiş/).fill('2:15');
    await clipForm.getByRole('button', { name: /Klibi kaydet/ }).click();
    await expect(page.getByText(/Klip adayı eklendi/)).toBeVisible();
    const row = source.getByRole('row').filter({ hasText: `E2E klip ${run}` });
    await expect(row).toContainText('1:30–2:15');
    await expect(row).toContainText('45 sn');
    await expect(row).toContainText(`Klip test ${run}`);

    // 3) İzin yokken aktarma engelli: düğme devre dışı + açıklama, API 422.
    const pushButton = row.getByRole('button', { name: /Backlog'a aktar/ });
    await expect(pushButton).toBeDisabled();
    await expect(source).toContainText(/Backlog’a aktarmak için kaynağın izni/);
    const { data: clip } = await admin
      .from('clips')
      .select('id, source_id')
      .eq('title', `E2E klip ${run}`)
      .single();
    const denied = await page.request.post(`/api/clips/${clip!.id}/backlog`, {
      data: { influencer_id: influencerId },
    });
    expect(denied.status()).toBe(422);
    expect(((await denied.json()) as { error: string }).error).toMatch(
      /izni onaylanmadan/,
    );
    const { count } = await admin
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('influencer_id', influencerId);
    expect(count).toBe(0);

    // 4) İzni işaretle: e-posta kabul edilmez, kısa referans zorunlu.
    await source.getByRole('button', { name: /İzni işaretle/ }).click();
    const permissionForm = source.getByRole('form', { name: /İzni işaretle/ });
    await permissionForm.getByLabel(/İzin durumu/).selectOption('granted');
    await permissionForm
      .getByLabel(/İzin referansı/)
      .fill('kisi@example.invalid');
    await permissionForm.getByRole('button', { name: /İzni kaydet/ }).click();
    await expect(permissionForm.getByRole('alert')).toContainText(/e-posta/);
    await permissionForm.getByLabel(/İzin referansı/).fill(`IZIN-E2E-${run}`);
    await permissionForm.getByRole('button', { name: /İzni kaydet/ }).click();
    await expect(page.getByText(/İzin durumu kaydedildi/)).toBeVisible();
    await expect(
      source.getByText('İzin verildi', { exact: true }),
    ).toBeVisible();
    await expect(source).toContainText(`Referans: IZIN-E2E-${run}`);

    // 5) Backlog'a aktar: Fikir aşamasında üçüncü kişi kaynaklı kart açılır.
    await expect(pushButton).toBeEnabled();
    await pushButton.click();
    const panel = source.getByRole('form', { name: /Backlog'a aktar/ });
    await panel.getByRole('button', { name: /Fikir kartı oluştur/ }).click();
    await expect(
      page.getByText(/Klip içerik backlog’una .* aktarıldı/),
    ).toBeVisible();
    await expect(
      row.getByRole('link', { name: /İçerik kartına git/ }),
    ).toHaveAttribute('href', `/content?inf=${slug}`);
    await expect(
      row.getByRole('button', { name: /Backlog'a aktar/ }),
    ).toHaveCount(0);
    await expect(row.getByRole('combobox', { name: /Durum/ })).toHaveValue(
      'approved',
    );

    const { data: pushed } = await admin
      .from('clips')
      .select('status, influencer_id, content_item_id')
      .eq('id', clip!.id)
      .single();
    expect(pushed?.status).toBe('approved');
    expect(pushed?.influencer_id).toBe(influencerId);
    const { data: card } = await admin
      .from('content_items')
      .select(
        'influencer_id, stage, title, hook_type, source_url, source_type, source_owner, source_license',
      )
      .eq('id', pushed!.content_item_id!)
      .single();
    expect(card).toEqual({
      influencer_id: influencerId,
      stage: 'idea',
      title: `E2E klip ${run}`,
      hook_type: `E2E kanca ${run}`,
      source_url: `${videoUrl}&t=90s`,
      source_type: 'third_party',
      source_owner: `E2E Kanal ${run}`,
      source_license: `yazılı izin – kısıtlı depoda: IZIN-E2E-${run}`,
    });
    const again = await page.request.post(`/api/clips/${clip!.id}/backlog`, {
      data: {},
    });
    expect(again.status()).toBe(409);

    // 6) Durum değiştirme.
    await row.getByRole('combobox', { name: /Durum/ }).selectOption('rendered');
    await expect(page.getByText(/Klip durumu güncellendi/)).toBeVisible();
    await expect(row.getByRole('combobox', { name: /Durum/ })).toHaveValue(
      'rendered',
    );

    // 7) Kart içerik kanbanında görünür.
    await row.getByRole('link', { name: /İçerik kartına git/ }).click();
    await expect(page).toHaveURL(new RegExp(`/content\\?inf=${slug}`));
    await expect(page.getByText(`E2E klip ${run}`).first()).toBeVisible();
  } finally {
    // Kaynak silinince klipleri, influencer silinince içerik kartları da silinir.
    await admin.from('clip_sources').delete().eq('video_url', videoUrl);
    await admin.from('influencers').delete().eq('id', influencerId);
  }
});
