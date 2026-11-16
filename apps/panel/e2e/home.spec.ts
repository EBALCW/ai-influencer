import { expect, test } from '@playwright/test';
import { sameOrigin } from './same-origin';
import { hasLocalSupabase } from './global-setup';

// Ana ekran ve modül gezinmesi (#200, ADR 0004 → Karar 7). Seed verisi kullanılır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

test('ana ekranda modüller, park işareti ve modüller arası son üretimler görünür', async ({
  page,
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Ana ekran', level: 1 }),
  ).toBeVisible();

  const modules = page.getByRole('region', {
    name: 'Ne üretmek istiyorsunuz?',
  });
  const cards = modules.getByRole('link');
  await expect(cards).toHaveCount(3);
  // Öncelikli modüller önce, park edilen sonda ve açıkça işaretli.
  await expect(cards.nth(0)).toHaveAccessibleName(/^Anlatım videoları: /);
  await expect(cards.nth(0)).toHaveAttribute('href', '/explainers');
  await expect(cards.nth(1)).toHaveAccessibleName(/^Yayıncı klipleri: /);
  await expect(cards.nth(1)).toHaveAttribute('href', '/clips');
  await expect(cards.nth(2)).toHaveAccessibleName(
    /^AI influencer \(park edildi\): /,
  );
  await expect(cards.nth(2)).toHaveAttribute('href', '/influencers');
  await expect(cards.nth(2)).toContainText('Park edildi');
  await expect(cards.nth(0)).not.toContainText('Park edildi');

  // Son üretimler: az önce eklenen yayıncı klibi, modül etiketi ve durumuyla en üstte.
  const run = crypto.randomUUID().slice(0, 8);
  const source = await page.request.post('/api/clip-sources', {
    headers: sameOrigin,
    data: {
      video_url: `https://www.youtube.com/watch?v=hm${run}x`,
      channel_name: `Ana ekran kanal ${run}`,
      channel_url: `https://www.youtube.com/@ana-ekran-${run}`,
      title: `Ana ekran yayın ${run}`,
    },
  });
  expect(source.status()).toBe(201);
  const sourceId = ((await source.json()) as { source: { id: string } }).source
    .id;
  try {
    const clip = await page.request.post('/api/clips', {
      headers: sameOrigin,
      data: {
        source_id: sourceId,
        title: `Ana ekran klip ${run}`,
        start_seconds: 0,
        end_seconds: 30,
      },
    });
    expect(clip.status()).toBe(201);
    await page.reload();
    const recent = page.getByRole('region', { name: 'Son üretimler' });
    const row = recent
      .getByRole('listitem')
      .filter({ hasText: `Ana ekran klip ${run}` });
    await expect(row).toContainText('Yayıncı klipleri');
    await expect(row).toContainText(`Ana ekran yayın ${run}`);
    await expect(row).toContainText('Aday');
    await expect(row.getByRole('link')).toHaveAttribute('href', '/clips');
  } finally {
    await page.request.delete(`/api/clip-sources/${sourceId}`, {
      headers: sameOrigin,
    });
  }

  // Makine durumu ana ekranda; üretim sayfasına götürür.
  await expect(
    page.getByRole('link', { name: /üretim makinesi/i }),
  ).toHaveAttribute('href', '/production');
});

test('menü modüllere göre gruplanır, mevcut adresler değişmeden açılır', async ({
  page,
}) => {
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Ana menü' });
  for (const [name, href] of [
    [/^Ana ekran$/, '/'],
    [/^Anlatım videoları$/, '/explainers'],
    [/^Yayıncı klipleri$/, '/clips'],
    [/^AI influencer\s*Park$/, '/influencers'],
    [/^Prompt'lar$/, '/prompts'],
    [/^Araştırma$/, '/research'],
    [/^Markalar$/, '/brands'],
    [/^Üretim$/, '/production'],
    [/^İçerik$/, '/content'],
    [/^Takvim$/, '/calendar'],
    [/^Gelen kutusu$/, '/inbox'],
    [/^Analitik$/, '/analytics'],
    [/^Maliyetler$/, '/costs'],
    [/^Ayarlar$/, '/settings'],
  ] as const)
    await expect(menu.getByRole('link', { name })).toHaveAttribute(
      'href',
      href,
    );
  for (const group of ['MODÜLLER', 'ÜRETİM', 'YAYIN', 'YÖNETİM'])
    await expect(menu.getByText(group, { exact: true })).toBeVisible();

  // İçerik, takvim, klipler ve maliyet eski adreslerinde çalışır.
  for (const [href, heading] of [
    ['/content', 'İçerik akışı'],
    ['/calendar', 'Yayın takvimi'],
    ['/clips', 'Klipler'],
    ['/costs', /Maliyet/],
  ] as const) {
    const response = await page.goto(href);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: heading, level: 1 }),
    ).toBeVisible();
  }
});

test('modül kartı klavyeyle açılır ve park edilen modül erişilebilir kalır', async ({
  page,
}) => {
  await page.goto('/');
  const explainer = page.getByRole('link', { name: /^Anlatım videoları: / });
  await explainer.focus();
  await expect(explainer).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/explainers$/);
  await expect(
    page.getByRole('heading', { name: 'Anlatım videoları', level: 1 }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Ana menü' })
      .getByRole('link', { name: /^Anlatım videoları$/ }),
  ).toHaveAttribute('aria-current', 'page');

  await page.goto('/');
  await page
    .getByRole('link', { name: /^AI influencer \(park edildi\)/ })
    .click();
  await expect(page).toHaveURL(/\/influencers$/);
  await expect(
    page.getByRole('heading', { name: 'Influencer’lar', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText(/park edildi/i);
  // Eski dashboard modülün özetinde.
  await page.getByRole('link', { name: 'Performans özeti' }).click();
  await expect(page).toHaveURL(/\/influencers\/overview$/);
  await expect(
    page.getByRole('heading', { name: 'Genel bakış', level: 1 }),
  ).toBeVisible();
});

test('eski filtreli ana sayfa adresi influencer özetine yönlenir, seçim korunur', async ({
  page,
}) => {
  await page.goto('/?inf=demo-creator&range=30&platform=youtube');
  await expect(page).toHaveURL(
    /\/influencers\/overview\?inf=demo-creator&range=30&platform=youtube$/,
  );
  // Yalnız `?inf=` taşıyan adres ana ekranda kalır ve menü linkleri seçimi korur.
  await page.goto('/?inf=demo-creator');
  await expect(
    page.getByRole('heading', { name: 'Ana ekran', level: 1 }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Ana menü' })
      .getByRole('link', { name: /^İçerik$/ }),
  ).toHaveAttribute('href', '/content?inf=demo-creator');
});
