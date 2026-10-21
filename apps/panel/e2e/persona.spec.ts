import { expect, test, type Page } from '@playwright/test';
import { hasLocalSupabase } from './global-setup';

// Editor rolüyle persona düzenleme, geçmiş, geri alma ve karşılaştırma (#44).
// Yerel Supabase yoksa atlanır. Aynı influencer'ın geçmişini değiştirdiği için sırayla çalışır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
test.describe.configure({ mode: 'serial' });

const PERSONA_URL = '/influencers/demo-creator?tab=persona';

async function currentVersion(page: Page) {
  const heading = page.getByRole('heading', {
    name: /^(Persona · v\d+|Henüz persona yok)$/,
  });
  const text = (await heading.textContent()) ?? '';
  return Number(text.match(/v(\d+)/)?.[1] ?? 0);
}

async function saveVersion(page: Page, bio: string, note: string) {
  const expected = (await currentVersion(page)) + 1;
  await page.getByRole('button', { name: 'Personayı düzenle' }).click();
  const form = page.getByRole('form', { name: 'Persona düzenleme formu' });
  await form.getByLabel('Biyografi / hikaye').fill(bio);
  await form.getByLabel('Değişiklik notu').fill(note);
  await form
    .getByRole('button', { name: 'Yeni versiyon olarak kaydet' })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: `v${expected} kaydedildi` }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: `Persona · v${expected}` }),
  ).toBeVisible();
  return expected;
}

/** Geçmiş tablosunda ilk hücresi "vN" (ve varsa "Güncel") olan satır */
function historyRow(page: Page, version: number) {
  return page
    .getByRole('table')
    .getByRole('row')
    .filter({
      has: page.getByRole('cell', {
        name: new RegExp(`^v${version}(\\s*Güncel)?$`),
      }),
    });
}

test('düzenleme yeni versiyon oluşturur, eski versiyon geçmişte kalır', async ({
  page,
}) => {
  const response = await page.goto(PERSONA_URL);
  expect(response?.status()).toBe(200);

  const first = await saveVersion(page, `E2E bio A ${Date.now()}`, 'e2e: ilk');
  const second = await saveVersion(
    page,
    `E2E bio B ${Date.now()}`,
    'e2e: ikinci',
  );
  expect(second).toBe(first + 1);

  await expect(historyRow(page, first)).toContainText('e2e: ilk');
  const currentRow = historyRow(page, second);
  await expect(currentRow).toContainText('Güncel');
  await expect(currentRow).toContainText('Sen');
  // Güncel satırda geri alma yok, eski satırda var
  await expect(
    page.getByRole('button', { name: `v${second} versiyonunu geri al` }),
  ).toHaveCount(0);
});

test('geri alma eski içerikle yeni versiyon oluşturur, geçmiş silinmez', async ({
  page,
}) => {
  await page.goto(PERSONA_URL);
  const bioA = `E2E restore kaynağı ${Date.now()}`;
  const source = await saveVersion(page, bioA, 'e2e: kaynak');
  const changed = await saveVersion(
    page,
    `E2E değişti ${Date.now()}`,
    'e2e: değişti',
  );

  await page
    .getByRole('button', { name: `v${source} versiyonunu geri al` })
    .click();
  const dialog = page.getByRole('dialog', {
    name: `v${source} geri alınsın mı?`,
  });
  await dialog.getByRole('button', { name: 'Geri al' }).click();

  const restored = changed + 1;
  await expect(
    page.getByRole('heading', { name: `Persona · v${restored}` }),
  ).toBeVisible();
  await expect(page.getByText(bioA).first()).toBeVisible();
  await expect(historyRow(page, restored)).toContainText(`Kaynak: v${source}`);
  // Kaynak ve arada değişen versiyon geçmişte duruyor
  await expect(historyRow(page, source)).toHaveCount(1);
  await expect(historyRow(page, changed)).toHaveCount(1);
});

test('iki versiyon arası fark gösterilir', async ({ page }) => {
  await page.goto(PERSONA_URL);
  await page
    .getByRole('link', { name: 'Güncel ile karşılaştır' })
    .first()
    .click();
  await expect(page).toHaveURL(/from=\d+&to=\d+/);
  const diff = page.getByRole('list', { name: 'Versiyon farkları' });
  await expect(diff).toContainText('Biyografi');
});

test('geçersiz gövde ve olmayan influencer API seviyesinde reddedilir', async ({
  page,
}) => {
  await page.goto(PERSONA_URL);
  const invalid = await page.request.post(
    '/api/influencers/10000000-0000-4000-8000-000000000001/persona',
    { data: { bio: 123 } },
  );
  expect(invalid.status()).toBe(400);
  const missing = await page.request.post(
    '/api/influencers/10000000-0000-4000-8000-0000000000ff/persona/restore',
    { data: { version: 1 } },
  );
  expect(missing.status()).toBe(404);
});
