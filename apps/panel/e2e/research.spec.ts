import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase } from './global-setup';

// Trend arşivi (#10): editor trend ekler, CSV içe aktarır ve fikri backlog'a taşır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

test('editor trend ekler, CSV içe aktarır ve backlog’a aktarır', async ({
  page,
}) => {
  const admin = adminClient();
  const run = crypto.randomUUID().slice(0, 8);
  const slug = `research-${run}`;
  const inf = await admin
    .from('influencers')
    .insert({ name: `Araştırma test ${run}`, slug })
    .select('id')
    .single();
  if (inf.error) throw inf.error;
  const influencerId = inf.data.id;
  const formUrl = `https://www.instagram.com/reel/e2e-${run}/`;
  const csvUrl = `https://www.tiktok.com/@e2e/video/${run}`;
  try {
    const response = await page.goto(`/research?inf=${slug}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Araştırma', level: 1 }),
    ).toBeVisible();

    // 1) Formdan ekleme: platform linkten bulunur.
    await page.getByRole('button', { name: 'Yeni trend' }).click();
    const form = page.getByRole('form', { name: 'Trend ekle' });
    await form.getByLabel('Link', { exact: true }).fill('javascript:alert(1)');
    await form.getByRole('button', { name: 'Trendi kaydet' }).click();
    await expect(form.getByRole('alert')).toBeVisible();
    await form.getByLabel('Link', { exact: true }).fill(formUrl);
    await expect(
      form.getByLabel('Platform').locator('option').first(),
    ).toHaveText('Linkten bul (Instagram)');
    await form.getByLabel('İzlenme').fill('1,2M');
    await form.getByLabel('Uyarlama puanı').selectOption('5');
    await form.getByLabel('Neden viral').fill(`E2E kanca ${run}`);
    await form.getByLabel('Uyarlama fikri').fill(`E2E fikir ${run}`);
    await form.getByRole('button', { name: 'Trendi kaydet' }).click();
    await expect(page.getByText('Trend arşive eklendi.')).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: `E2E kanca ${run}` });
    await expect(row).toContainText(/1,2\sMn/);
    await expect(row).toContainText(`Araştırma test ${run}`);

    // 2) CSV içe aktarma: geçerli satır eklenir, hatalı satır numarasıyla raporlanır.
    const csv = [
      'link;format;uyarlama_puanı;neden_viral;influencer;durum',
      `${csvUrl};dans;4;E2E csv ${run};${slug};seçildi`,
      'javascript:alert(1);dans;9;;;',
    ].join('\r\n');
    const importForm = page.getByRole('form', { name: 'Trend CSV içe aktar' });
    await importForm.locator('input[type="file"]').setInputFiles({
      name: 'trends.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`﻿${csv}`, 'utf8'),
    });
    await importForm.getByRole('button', { name: /CSV içe aktar/ }).click();
    await expect(importForm.getByRole('status')).toContainText(
      '1 trend eklendi, 1 satır hatalı',
    );
    await expect(
      importForm.getByRole('list', { name: 'İçe aktarma hataları' }),
    ).toContainText('Satır 3:');
    const csvRow = page.getByRole('row').filter({ hasText: `E2E csv ${run}` });
    await expect(csvRow).toContainText('TikTok');
    await expect(csvRow).toContainText('Seçildi');

    // 3) Backlog'a aktar: Fikir aşamasında kart açılır, trend "Backlog’da" olur.
    await row
      .getByRole('button', { name: `Backlog'a aktar: ${formUrl}` })
      .click();
    const panel = page.getByRole('form', { name: "Backlog'a aktar" });
    await panel.getByRole('button', { name: 'Fikir kartı oluştur' }).click();
    await expect(
      page.getByText('Fikir içerik backlog’una (Fikir sütunu) aktarıldı.'),
    ).toBeVisible();
    await expect(row).toContainText('Backlog’da');
    await expect(
      row.getByRole('link', { name: 'İçerik kartına git' }),
    ).toHaveAttribute('href', `/content?inf=${slug}`);
    await expect(
      row.getByRole('button', { name: /Backlog'a aktar/ }),
    ).toHaveCount(0);

    const { data: trend } = await admin
      .from('trends')
      .select('status, content_item_id')
      .eq('url', formUrl)
      .single();
    expect(trend?.status).toBe('used');
    const { data: card } = await admin
      .from('content_items')
      .select(
        'influencer_id, stage, title, source_url, source_views, adaptation_score',
      )
      .eq('id', trend!.content_item_id!)
      .single();
    expect(card).toEqual({
      influencer_id: influencerId,
      stage: 'idea',
      title: `E2E fikir ${run}`,
      source_url: formUrl,
      source_views: 1_200_000,
      adaptation_score: 5,
    });

    // 4) Kart içerik kanbanında görünür.
    await page
      .getByRole('link', { name: 'İçerik kartına git' })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/content\\?inf=${slug}`));
    await expect(page.getByText(`E2E fikir ${run}`).first()).toBeVisible();

    // 5) Dışa aktarma aynı filtrelerle çalışır.
    const exported = await page.request.get(`/api/trends/export?inf=${slug}`);
    expect(exported.status()).toBe(200);
    const body = await exported.text();
    expect(body).toContain(formUrl);
    expect(body).toContain('üretildi');
  } finally {
    // Influencer silinince özel trendler ve içerik kartları da silinir.
    await admin.from('trends').delete().in('url', [formUrl, csvUrl]);
    await admin.from('influencers').delete().eq('id', influencerId);
  }
});
