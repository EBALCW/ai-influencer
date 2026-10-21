import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase, OWNER_EMAIL } from './global-setup';

// Oturum gerektirir: CI'da yerel Supabase ile çalışır, yerelde Supabase yoksa atlanır
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
// Hepsi aynı oturumu paylaşır; çıkış testi oturumu iptal ettiği için sırayla ve en sonda çalışır
test.describe.configure({ mode: 'serial' });

test('home page shows the studio shell and overview', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /İçerik üretiminiz için/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Ana menü' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Influencer’lar', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Aktif influencer' }),
  ).toBeVisible();
});

test('navigation opens real modules and unfinished sections show empty states', async ({
  page,
}) => {
  for (const [label, href] of [
    ['İçerik akışı', '/content'],
    ['Yayın takvimi', '/calendar'],
  ] as const) {
    await page.goto(href);
    await expect(
      page.getByRole('heading', { name: label, level: 1 }),
    ).toBeVisible();
  }
  const destinations = [
    ['Analitik', '/analytics'],
    ['Üretim', '/production'],
    ['Markalar', '/brands'],
    ['Ayarlar', '/settings'],
  ];
  for (const [label, href] of destinations) {
    await page.goto(href);
    await expect(
      page.getByRole('heading', { name: label, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/kayıt bulunmuyor/i)).toBeVisible();
  }
});

test('influencer listesi detay sayfasına gider ve ?inf= seçimini korur', async ({
  page,
}) => {
  await page.goto('/influencers?inf=demo-creator');
  await expect(
    page.getByRole('heading', { name: 'Influencer’lar', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demo Creator' })).toBeVisible();
  await page.getByRole('link', { name: 'Demo Creator' }).click();
  await expect(page).toHaveURL(/\/influencers\/demo-creator\?inf=demo-creator/);
  await expect(
    page.getByRole('heading', { name: 'Demo Creator', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Influencer detay sekmeleri' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Persona' })).toBeVisible();
  await page.getByRole('link', { name: 'Persona' }).click();
  await expect(page).toHaveURL(/tab=persona/);
  await expect(page.getByText('Persona kaydı yok')).toBeVisible();
});

test('taslak influencer kurulumunu referans ve özet adımlarıyla tamamlar', async ({
  page,
}) => {
  await page.goto('/influencers?inf=demo-creator');
  await page.getByRole('link', { name: 'Kuruluma devam et' }).click();
  await expect(page).toHaveURL(/setup/);
  await expect(
    page.getByRole('heading', { name: 'Yeni influencer oluştur', level: 1 }),
  ).toBeVisible();

  await page.getByLabel('Karakter hikâyesi').fill('Test persona hikâyesi.');
  await page.getByLabel('Ses tonu').fill('Samimi ve açık');
  await page
    .getByLabel('Hedef kitle açıklaması')
    .fill('Yaratıcı içerik izleyicileri.');
  await page.getByRole('button', { name: 'Kaydet ve devam et' }).click();
  await expect(
    page.getByRole('heading', { name: 'Görünüm ve karakter prompt’u' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Prompt’u kaydet ve devam et' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Referans görselleri' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Medya kütüphanesinde yükle' }).click();
  await expect(
    page.getByRole('heading', { name: 'Görsel ve videolar' }),
  ).toBeVisible();
  await page.getByLabel('Görsel veya video yükle').setInputFiles({
    name: 'wizard-reference.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mMMqDjBwMDAxMDAwMDAAAAScgGUP/5+KwAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await expect(
    page.getByRole('status').getByText('Dosyalar yüklendi.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Kuruluma dön' }).click();
  await expect(page.getByRole('status')).toContainText('1 referans yüklendi');
  await page.getByRole('button', { name: 'Avatar seçimine devam et' }).click();

  await page
    .getByRole('link', { name: 'Seti karşılaştır ve avatarı belirle' })
    .click();
  await page.getByRole('button', { name: 'Avatar yap' }).click();
  await page.getByRole('link', { name: 'Kuruluma dön' }).click();
  await expect(page.getByRole('status')).toContainText('Avatar belirlendi');
  await page.getByRole('button', { name: 'Özeti gör' }).click();
  await expect(
    page.getByRole('heading', { name: 'Taslak özeti' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Taslağı tamamla' }).click();
  await expect(page).toHaveURL(/\/influencers\/demo-creator\?inf=demo-creator/);

  await page.goto('/influencers/demo-creator/assets?inf=demo-creator');
  await page.getByRole('button', { name: 'Sil', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Dosyayı sil' })
    .click();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('bilinmeyen influencer slug gerçek HTTP 404 döndürür', async ({
  page,
}) => {
  const response = await page.goto('/influencers/yok-boyle-biri');
  expect(response?.status()).toBe(404);
});

test('arşivlenen influencer etkin listeden çıkar ve arşivden geri alınır', async ({
  page,
}) => {
  await page.goto('/influencers/demo-creator');
  await page.getByRole('button', { name: 'Arşivle' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Arşivle' }).click();
  await expect(page.getByText('Arşiv', { exact: true })).toBeVisible();

  await page.goto('/influencers');
  await expect(page.getByRole('link', { name: 'Demo Creator' })).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Duruma göre filtrele' })
    .selectOption('archived');
  await page.getByRole('link', { name: 'Demo Creator' }).click();
  await page.getByRole('button', { name: 'Arşivden çıkar' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Yeniden etkinleştir' })
    .click();
  await expect(page.getByText('Aktif', { exact: true })).toBeVisible();
});

test('influencer selection is stored in the URL', async ({ page }) => {
  await page.goto('/');
  const influencerSelect = page.getByRole('combobox', {
    name: 'Aktif influencer',
  });
  await influencerSelect.selectOption('demo-creator');
  await expect(page).toHaveURL(/inf=demo-creator/);
  await page.reload();
  await expect(influencerSelect).toHaveValue('demo-creator');

  // Menüde başka sayfaya geçince seçim kaybolmamalı (#40: tüm sayfalar seçili influencer'a göre filtrelenir)
  await page.getByRole('link', { name: 'Analitik', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\?inf=demo-creator/);
  await expect(influencerSelect).toHaveValue('demo-creator');
});

test('unknown sections return 404', async ({ page }) => {
  const response = await page.goto('/olmayan-bolum');
  expect(response?.status()).toBe(404);
});

test('asset manager uploads, previews, and removes a private image', async ({
  page,
}) => {
  await page.goto('/influencers/demo-creator/assets?inf=demo-creator');
  await expect(
    page.getByRole('heading', { name: 'Görsel ve videolar' }),
  ).toBeVisible();
  await page.getByLabel('Görsel veya video yükle').setInputFiles([
    {
      name: 'asset-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mMMqDjBwMDAxMDAwMDAAAAScgGUP/5+KwAAAABJRU5ErkJggg==',
        'base64',
      ),
    },
    {
      name: 'asset-test-2.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mMMqDjBwMDAxMDAwMDAAAAScgGUP/5+KwAAAABJRU5ErkJggg==',
        'base64',
      ),
    },
  ]);
  await expect(
    page.getByRole('status').getByText('Dosyalar yüklendi.'),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.locator('img').first()).toBeVisible();
  await page.getByLabel('Tarihe göre filtrele').selectOption('7');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByLabel('Tarihe göre filtrele').selectOption('all');
  const assetChecks = page.getByLabel('Toplu işlem için seç');
  await assetChecks.first().check();
  await assetChecks.last().check();
  await page.getByLabel('Seçilenlere etiket uygula').fill('e2e-reference');
  await page.getByRole('button', { name: 'Etiketleri kaydet (2)' }).click();
  await page.getByLabel('Etikete göre filtrele').selectOption('e2e-reference');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByLabel('Etikete göre filtrele').selectOption('all');
  await page.getByRole('button', { name: 'Görseli büyüt' }).first().click();
  await expect(
    page.getByRole('dialog', { name: 'Görsel önizleme' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Önizlemeyi kapat' }).click();
  const versionSelects = page.getByLabel('Referans versiyonu');
  await expect(versionSelects).toHaveCount(2);
  await versionSelects.first().selectOption('v2');
  await page.getByLabel('Sol referans seti').selectOption('v1');
  await page.getByLabel('Sağ referans seti').selectOption('v2');
  await expect(
    page.getByRole('region', { name: 'Referans seti sol v1' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Referans seti sağ v2' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Avatar yap' }).first().click();
  await expect(page.getByRole('button', { name: 'Mevcut avatar' })).toHaveCount(
    1,
  );
  await page.getByRole('button', { name: 'Sil', exact: true }).first().click();
  const firstDialog = page.getByRole('dialog');
  await firstDialog.getByRole('button', { name: 'Dosyayı sil' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Mevcut avatar' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Sil', exact: true }).click();
  const secondDialog = page.getByRole('dialog');
  await secondDialog.getByRole('button', { name: 'Dosyayı sil' }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('asset manager accepts drag and drop uploads', async ({ page }) => {
  await page.goto('/influencers/demo-creator/assets?inf=demo-creator');
  await page.locator('.file-dropzone').evaluate((dropzone) => {
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mMMqDjBwMDAxMDAwMDAAAAScgGUP/5+KwAAAABJRU5ErkJggg==';
    const bytes = Uint8Array.from(atob(base64), (character) =>
      character.charCodeAt(0),
    );
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([bytes], 'drag-reference.png', { type: 'image/png' }),
    );
    dropzone.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }),
    );
    dropzone.dispatchEvent(
      new DragEvent('drop', { bubbles: true, dataTransfer: transfer }),
    );
  });
  await expect(
    page.getByRole('status').getByText('Dosyalar yüklendi.'),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sil', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Dosyayı sil' })
    .click();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('theme can be switched and stays selected after reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Açık temaya geç' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('owner ekip sayfasında kendini görür', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: /Ekip/ }).click();
  await expect(page).toHaveURL(/\/settings\/team/);
  await expect(
    page.getByRole('heading', { name: 'Ekip', level: 1 }),
  ).toBeVisible();
  // E-posta üst bardaki profilde de görünüyor; ekip listesini main içinde ara
  await expect(page.getByRole('main').getByText(OWNER_EMAIL)).toBeVisible();
});

test('maliyet sayfası açılır, kayıt yoksa uydurma değer göstermez', async ({
  page,
}) => {
  const response = await page.goto('/costs?month=2026-09&cur=USD');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Maliyetler', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Bu dönemde harcama yok')).toBeVisible();
  await expect(page.getByText('Bu ay için bütçe yok')).toBeVisible();
});

test('owner maliyet girer; video ve 1000 izlenme başına maliyet SQL’den hesaplanır', async ({
  page,
}) => {
  // Playwright yeniden denerse aynı kayıt iki kez eklenmesin: önce bu testin kaydını temizle
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const cleanup = await admin
    .from('costs')
    .delete()
    .eq('description', 'E2E abonelik');
  expect(cleanup.error).toBeNull();

  // Seed: Ekim 2026'da 10 video, en son izlenmelerin toplamı 20.140
  await page.goto('/costs?month=2026-10&cur=USD&inf=demo-creator');
  const form = page.getByRole('form', { name: 'Maliyet ekle' });
  await form.getByLabel('Tutar').fill('20.14');
  await form.getByLabel('Tarih').fill('2026-10-05');
  await form.getByLabel('Açıklama').fill('E2E abonelik');
  await form.getByRole('button', { name: 'Maliyet ekle' }).click();
  await expect(form.getByText('Maliyet kaydedildi.')).toBeVisible();

  const summary = page.getByRole('region', { name: 'Dönem özeti' });
  await expect(summary.getByText('$20,14')).toBeVisible();
  await expect(summary.getByText('$2,01')).toBeVisible(); // 20,14 / 10 video
  await expect(summary.getByText('$1,00')).toBeVisible(); // 20,14 * 1000 / 20.140
  await expect(page.getByRole('cell', { name: 'E2E abonelik' })).toBeVisible();
});

test('owner bütçe tanımlar; %80 eşiği aşılınca uyarı görünür', async ({
  page,
}) => {
  await page.goto('/costs?month=2026-10&cur=USD&inf=demo-creator');
  const form = page.getByRole('form', { name: 'Bütçe tanımla' });
  await form.getByLabel('Kapsam').selectOption({ label: 'Demo Creator' });
  await form.getByLabel('Aylık tavan').fill('25');
  await form.getByRole('button', { name: /bütçesini kaydet/ }).click();
  await expect(form.getByText('Bütçe kaydedildi.')).toBeVisible();
  // 20,14 / 25 = %80,6 -> uyarı
  await expect(
    page.getByRole('progressbar', { name: 'Demo Creator bütçe kullanımı' }),
  ).toHaveAttribute('aria-valuetext', /Uyarı eşiği aşıldı/);
});

test('profilde gerçek kullanıcı ve çıkış var', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTitle(OWNER_EMAIL).first()).toBeVisible();
  await page.getByRole('button', { name: 'Çıkış yap' }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
