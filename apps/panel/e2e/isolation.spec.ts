import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  createSession,
  EDITOR_STATE,
  hasLocalSupabase,
  OTHER_EMAIL,
  OTHER_STATE,
  OTHER_WORKSPACE_NAME,
  removeOtherWorkspace,
} from './global-setup';

// Çalışma alanı yalıtımı (#181): ikinci alanın kullanıcısı birinci alanın verisini göremez.
// Yalnız yerel Supabase'e karşı çalışır. İkinci alan burada açılır ve test bitince silinir
// (bkz. playwright.config.ts → isolation projesi).
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
test.describe.configure({ mode: 'serial' });

const INFLUENCER_ID = 'e2e00000-0000-4000-8000-000000000181';
const INFLUENCER_NAME = 'E2E Yalıtım Birinci Alan';
const INFLUENCER_SLUG = 'e2e-yalitim-birinci-alan';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test.beforeAll(async () => {
  const admin = adminClient();
  // Yarıda kalmış önceki denemeden (retry) artan alanı temizle; birinci alan tek kalsın.
  await removeOtherWorkspace();
  const { data: first, error: firstError } = await admin
    .from('workspaces')
    .select('id')
    .single();
  if (firstError) throw firstError;

  // Birinci alanın influencer'ı: alan açıkça verilir.
  const { error: influencerError } = await admin.from('influencers').upsert({
    id: INFLUENCER_ID,
    name: INFLUENCER_NAME,
    slug: INFLUENCER_SLUG,
    status: 'active',
    workspace_id: first.id,
  });
  if (influencerError) throw influencerError;

  const { data: second, error: secondError } = await admin
    .from('workspaces')
    .insert({ name: OTHER_WORKSPACE_NAME })
    .select('id')
    .single();
  if (secondError) throw secondError;
  await createSession(OTHER_EMAIL, 'owner', OTHER_STATE, undefined, second.id);
});

test.afterAll(async () => {
  if (!hasLocalSupabase()) return;
  await removeOtherWorkspace();
  const { error } = await adminClient()
    .from('influencers')
    .delete()
    .eq('id', INFLUENCER_ID);
  if (error) throw error;
});

test('birinci alanın üyesi kendi influencer’ını görür (kontrol)', async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: EDITOR_STATE });
  const page = await context.newPage();
  const response = await page.goto(`/influencers/${INFLUENCER_SLUG}`);
  expect(response?.status()).toBe(200);
  await page.goto('/influencers');
  // Üst çubuktaki seçici (gizli <option>) değil, sayfa içeriğindeki liste.
  await expect(
    page.locator('main').getByText(INFLUENCER_NAME).first(),
  ).toBeVisible();
  await context.close();
});

test('ikinci alanın kullanıcısı birinci alanın influencer’ını listede görmez, adresinde 404 alır', async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: OTHER_STATE });
  const page = await context.newPage();

  const list = await page.goto('/influencers');
  expect(list?.status()).toBe(200);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByText(INFLUENCER_NAME)).toHaveCount(0);
  // Birinci alanın seed verisi de görünmez.
  await expect(page.getByText('Demo Creator')).toHaveCount(0);

  const detail = await page.goto(`/influencers/${INFLUENCER_SLUG}`);
  expect(detail?.status()).toBe(404);
  const seeded = await page.goto('/influencers/demo-creator');
  expect(seeded?.status()).toBe(404);
  await context.close();
});

test('ikinci alanın owner’ı yalnız kendi alanının adını ve üyelerini görür', async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: OTHER_STATE });
  const page = await context.newPage();

  // Ekip API'si service role kullanır; alan filtresi sunucuda uygulanır.
  const team = await context.request.get('/api/team');
  expect(team.status()).toBe(200);
  const { members } = (await team.json()) as {
    members: { email: string; role: string }[];
  };
  expect(members).toEqual([
    expect.objectContaining({ email: OTHER_EMAIL, role: 'owner' }),
  ]);

  await page.goto('/settings');
  await expect(page.getByLabel('Çalışma alanı adı')).toHaveValue(
    OTHER_WORKSPACE_NAME,
  );
  await context.close();
});

test('ikinci alanın owner’ı birinci alanın üyesinin rolünü değiştiremez ve onu çıkaramaz', async ({
  browser,
}) => {
  const admin = adminClient();
  const { data: second, error: secondError } = await admin
    .from('workspaces')
    .select('id')
    .eq('name', OTHER_WORKSPACE_NAME)
    .single();
  if (secondError) throw secondError;
  const { data: others, error } = await admin
    .from('team_members')
    .select('user_id, role')
    .neq('workspace_id', second.id)
    .eq('role', 'editor')
    .limit(1);
  if (error) throw error;
  const target = others[0];
  expect(target).toBeTruthy();

  const context = await browser.newContext({ storageState: OTHER_STATE });
  const origin = { Origin: 'http://127.0.0.1:3000' };
  const patch = await context.request.patch(`/api/team/${target!.user_id}`, {
    data: { role: 'viewer' },
    headers: origin,
  });
  expect(patch.status()).toBe(404);
  const remove = await context.request.delete(`/api/team/${target!.user_id}`, {
    headers: origin,
  });
  expect(remove.status()).toBe(404);

  const { data: after, error: afterError } = await adminClient()
    .from('team_members')
    .select('role')
    .eq('user_id', target!.user_id)
    .single();
  if (afterError) throw afterError;
  expect(after.role).toBe(target!.role);
  await context.close();
});
