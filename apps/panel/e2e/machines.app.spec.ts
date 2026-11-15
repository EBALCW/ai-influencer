import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createSession, hasLocalSupabase } from './global-setup';

// Üretim makineleri (#211): makine bir üyenin kendi oturumudur (`pnpm worker:login`). Burada
// programın yaptığı adımlar (üye olarak giriş, register_worker, kalp atışı) aynı RPC'lerle
// yapılır; liste ve yetki kaldırma gerçek panel sayfasıyla denenir. Program ayrıca apps/worker
// entegrasyon testiyle doğrulanır. Yerel Supabase yoksa atlanır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
test.describe.configure({ mode: 'serial' });

const EDITOR_STATE = 'e2e/.auth/machines-editor.json';
const OTHER_STATE = 'e2e/.auth/machines-other.json';
const EDITOR_EMAIL = 'e2e-machines-editor@example.test';
test.use({ storageState: EDITOR_STATE });

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const anon = () =>
  createClient(url(), anonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
const admin = () =>
  createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const run = Date.now().toString(36);
const MACHINE = `E2E Makine ${run}`;
let editorId = '';
let machine: SupabaseClient;
let machineTokens = { access: '', refresh: '' };
let workerId = '';

function claims(accessToken: string) {
  return JSON.parse(
    Buffer.from(accessToken.split('.')[1]!, 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
}

test.beforeAll(async () => {
  editorId = await createSession(EDITOR_EMAIL, 'editor', EDITOR_STATE);
  await createSession('e2e-machines-other@example.test', 'editor', OTHER_STATE);
  // Önceki koşulardan kalan makineler listeyi kalabalıklaştırmasın.
  const cleanup = await admin()
    .from('production_workers')
    .delete()
    .like('name', 'E2E Makine %');
  if (cleanup.error) throw cleanup.error;
});

test('makine oturumu kaydolur, listede görünür ve yalnız makine işlerini yapabilir', async ({
  page,
  browser,
  baseURL,
}) => {
  // Makine: üye olarak ayrı bir giriş (panel oturumundan bağımsız bir Auth oturumu).
  const password = `e2e-${crypto.randomUUID()}`;
  const updated = await admin().auth.admin.updateUserById(editorId, {
    password,
  });
  expect(updated.error).toBeNull();
  const signedIn = await anon().auth.signInWithPassword({
    email: EDITOR_EMAIL,
    password,
  });
  expect(signedIn.error).toBeNull();
  const session = signedIn.data.session!;
  machineTokens = {
    access: session.access_token,
    refresh: session.refresh_token,
  };
  // Gerçek erişim token'ında session_id claim'i var (#201 TODO'su).
  expect(claims(session.access_token).session_id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  machine = createClient(url(), anonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  expect((await machine.rpc('is_worker_session')).data).toBe(false);

  const registered = await machine.rpc('register_worker', {
    p_name: MACHINE,
    p_platform: 'linux',
    p_version: '0.1.0',
    p_capabilities: ['voice.edge-tts', 'kind:clip.selftest'],
  });
  expect(registered.error).toBeNull();
  workerId = (registered.data as { id: string }).id;
  expect((await machine.rpc('is_worker_session')).data).toBe(true);
  expect(
    (await machine.rpc('worker_heartbeat', { p_worker_id: workerId })).error,
  ).toBeNull();

  // Panelde listelenir
  await page.goto('/settings/machines');
  await expect(
    page.getByRole('heading', { name: 'Üretim makineleri' }),
  ).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: MACHINE });
  await expect(row).toBeVisible();
  await expect(row.getByText('(senin)')).toBeVisible();
  await expect(row.getByText('Çevrimiçi')).toBeVisible();
  await expect(row.getByText(/Linux · 0\.1\.0/)).toBeVisible();
  await expect(row.getByText(/voice\.edge-tts/)).toBeVisible();

  // Makine oturumu iş açamaz, ekibi göremez
  const enqueue = await machine.rpc('enqueue_job', {
    p_module: 'clip',
    p_kind: 'clip.selftest',
    p_stages: [{ key: 'a' }],
  });
  expect(enqueue.error?.code).toBe('42501');
  const team = await machine.from('team_members').select('user_id');
  expect(team.error).toBeNull();
  expect(team.data).toEqual([]);

  // Makine oturumu panelin kendisine de giremez: API 403, sayfa oturumu kapatır.
  const jar = new Map<string, string>();
  const ssr = createServerClient(url(), anonKey(), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const set = await ssr.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  expect(set.error).toBeNull();
  const context = await browser.newContext({
    storageState: {
      cookies: [...jar].map(([name, value]) => ({
        name,
        value,
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      })),
      origins: [],
    },
  });
  try {
    const revoke = await context.request.post(
      `/api/workers/${workerId}/revoke`,
      { headers: { origin: baseURL! }, data: {} },
    );
    expect(revoke.status()).toBe(403);
    const machinePage = await context.newPage();
    await machinePage.goto('/settings/machines');
    await expect(machinePage).toHaveURL(/\/login/);
  } finally {
    await context.close();
  }
});

test('başka bir editor başkasının makinesini kaldıramaz', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ storageState: OTHER_STATE });
  try {
    const page = await context.newPage();
    await page.goto('/settings/machines');
    const row = page.getByRole('row').filter({ hasText: MACHINE });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button')).toHaveCount(0);
    const response = await context.request.post(
      `/api/workers/${workerId}/revoke`,
      { headers: { origin: baseURL! }, data: {} },
    );
    expect(response.status()).toBe(403);
    const foreign = await context.request.post(
      `/api/workers/${workerId}/revoke`,
      { headers: { origin: 'https://example.invalid' }, data: {} },
    );
    expect(foreign.status()).toBe(403);
  } finally {
    await context.close();
  }
});

test('sahibi yetkiyi kaldırır: makinenin oturumu biter', async ({ page }) => {
  await page.goto('/settings/machines');
  const row = page.getByRole('row').filter({ hasText: MACHINE });
  await expect(row).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await row
    .getByRole('button', { name: /makinesinin yetkisini kaldır/ })
    .click();
  await expect(row.getByText('Yetkisi kaldırıldı')).toBeVisible();
  await expect(row.getByRole('button')).toHaveCount(0);

  // Süresi dolmamış erişim token'ı artık hiçbir şey göremez ve makine RPC'leri reddedilir.
  const heartbeat = await machine.rpc('worker_heartbeat', {
    p_worker_id: workerId,
  });
  expect(heartbeat.error?.code).toBe('42501');
  const workers = await machine.from('production_workers').select('id');
  expect(workers.data).toEqual([]);
  // Yenileme token'ı da ölü: Auth oturumu silindi.
  const refreshed = await anon().auth.refreshSession({
    refresh_token: machineTokens.refresh,
  });
  expect(refreshed.error).not.toBeNull();
  expect(refreshed.data.session).toBeNull();
});
