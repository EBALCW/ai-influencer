import { createServerClient } from '@supabase/ssr';
import { createClient, type Session } from '@supabase/supabase-js';
import { expect, test, type Browser } from '@playwright/test';
import { createSession, hasLocalSupabase } from './global-setup';

// Araç girişi (docs/AUTH.md → "Araç girişi"): panelde üretilen tek kullanımlık kodla
// `pnpm mcp:login --code` / `pnpm worker:login --code`. Burada kodu gerçek panel ucu üretir ve
// araçların yaptığı çağrıyla (anon anahtar + /auth/v1/verify) oturuma çevrilir; araçların kendi
// kodu apps/mcp ve apps/worker entegrasyon testlerinde aynı türden kodla denenir.
// Yerel Supabase yoksa atlanır.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');
test.describe.configure({ mode: 'serial' });

// Her senaryo ayrı kullanıcıyla çalışır: üretim sınırı (kullanıcı başına, 10 dakikada 5) yeniden
// denemelerde bile başka senaryoyu etkilemez.
const UI_STATE = 'e2e/.auth/tool-login-ui.json';
const API_STATE = 'e2e/.auth/tool-login-api.json';
const LIMIT_STATE = 'e2e/.auth/tool-login-limit.json';
const API_EMAIL = 'e2e-tool-login-api@example.test';
const CODE = /^[A-Za-z0-9_-]{16,256}$/;

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
const as = (session: Session) =>
  createClient(url(), anonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
/** Araçların yaptığı çağrı: kod anon anahtarla oturuma çevrilir. */
const exchange = (code: string) =>
  anon().auth.verifyOtp({ token_hash: code, type: 'magiclink' });

const run = Date.now().toString(36);
const MACHINE = `E2E Kod Makinesi ${run}`;
let uiUserId = '';
let apiUserId = '';
let mcpSession: Session | null = null;
let workerSession: Session | null = null;

/** Bir Auth oturumunu panel çerezlerine koyar (token panele gelirse ne olur?). */
async function contextFor(browser: Browser, session: Session) {
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
  return browser.newContext({
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
}

test.beforeAll(async () => {
  uiUserId = await createSession(
    'e2e-tool-login-ui@example.test',
    'editor',
    UI_STATE,
  );
  apiUserId = await createSession(API_EMAIL, 'editor', API_STATE);
  await createSession(
    'e2e-tool-login-limit@example.test',
    'editor',
    LIMIT_STATE,
  );
});

test.afterAll(async () => {
  const cleanup = await admin()
    .from('production_workers')
    .delete()
    .like('name', 'E2E Kod Makinesi %');
  if (cleanup.error) throw cleanup.error;
});

test.describe('arayüz', () => {
  test.use({ storageState: UI_STATE });

  test('kod üretilir, maskeli gösterilir, kopyalanır; kodla MCP oturumu açılır ve onay veremez', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: baseURL!,
    });
    await page.goto('/settings/machines');
    const section = page.getByRole('region', { name: 'Araç girişi' });
    await expect(
      section.getByRole('heading', { name: 'Araç girişi' }),
    ).toBeVisible();
    await expect(section.getByText('pnpm mcp:login --code')).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((item) => item.url().endsWith('/api/tool-login')),
      section.getByRole('button', { name: 'Giriş kodu üret' }).click(),
    ]);
    expect(response.status()).toBe(201);
    expect(response.request().method()).toBe('POST');
    expect(response.headers()['cache-control']).toBe('no-store');
    // Yanıt yalnız kodu taşır: oturum ya da yenileme token'ı yok
    expect(Object.keys(await response.json())).toEqual(['code']);

    const field = section.getByLabel('Giriş kodu', { exact: true });
    await expect(field).toBeVisible();
    // Varsayılan maskeli (omuz üstünden okunmasın)
    await expect(field).toHaveAttribute('type', 'password');
    const code = await field.inputValue();
    expect(code).toMatch(CODE);
    await expect(
      section.getByText(
        'Bu kod senin hesabınla giriş yapar; kimseyle paylaşma.',
      ),
    ).toBeVisible();
    await expect(section.getByText(/tek kullanımlıktır/)).toBeVisible();
    // Kod adrese yazılmaz
    expect(page.url()).not.toContain(code);

    await section.getByRole('button', { name: 'Kodu kopyala' }).click();
    await expect(section.getByText(/Kod kopyalandı/)).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      code,
    );
    await section.getByRole('button', { name: 'Kodu göster' }).click();
    await expect(field).toHaveAttribute('type', 'text');

    // `pnpm mcp:login --code`'un yaptığı: kod → oturum → register_mcp_session
    const signedIn = await exchange(code);
    expect(signedIn.error).toBeNull();
    mcpSession = signedIn.data.session!;
    expect(mcpSession.user.id).toBe(uiUserId);
    const mcp = as(mcpSession);
    expect((await mcp.rpc('is_worker_session')).data).toBe(false);
    expect(
      (await mcp.rpc('register_mcp_session', { p_client_name: 'E2E Kod MCP' }))
        .error,
    ).toBeNull();
    expect((await mcp.rpc('is_worker_session')).data).toBe(true);
    // Onay hâlâ reddedilir
    const refused = await mcp.rpc('approve_job_stage', {
      p_job_id: crypto.randomUUID(),
      p_stage_key: 'review',
    });
    expect(refused.error?.code).toBe('42501');

    // Tek kullanımlık: aynı kod ikinci kez oturum açmaz
    const again = await exchange(code);
    expect(again.error).not.toBeNull();
    expect(again.data.session).toBeNull();

    // Ekrandan kaldırınca kod sayfada kalmaz
    await section.getByRole('button', { name: 'Ekrandan kaldır' }).click();
    await expect(field).toHaveCount(0);
    expect(await page.content()).not.toContain(code);
  });
});

test.describe('uç', () => {
  test.use({ storageState: API_STATE });

  test('başka siteden ya da Origin başlıksız istek kod üretemez; GET yoktur', async ({
    page,
  }) => {
    for (const headers of [{ origin: 'https://example.invalid' }, {}]) {
      const forged = await page.request.post('/api/tool-login', {
        headers,
        data: {},
      });
      expect(forged.status()).toBe(403);
      expect(JSON.stringify(await forged.json())).not.toMatch(/"code"/);
    }
    expect((await page.request.get('/api/tool-login')).status()).toBe(405);
  });

  test('kod yalnız çağıranın kendi hesabı içindir; makine oturumu açılır ve onay veremez', async ({
    page,
    baseURL,
  }) => {
    // Gövdede başka bir hesabı göstermek işe yaramaz: gövde okunmaz
    const minted = await page.request.post('/api/tool-login', {
      headers: { origin: baseURL! },
      data: {
        email: 'e2e-tool-login-ui@example.test',
        user_id: uiUserId,
        type: 'recovery',
      },
    });
    expect(minted.status()).toBe(201);
    const body = (await minted.json()) as { code: string };
    expect(Object.keys(body)).toEqual(['code']);
    expect(body.code).toMatch(CODE);

    // `pnpm worker:login --code`'un yaptığı: kod → oturum → register_worker
    const signedIn = await exchange(body.code);
    expect(signedIn.error).toBeNull();
    workerSession = signedIn.data.session!;
    expect(workerSession.user.id).toBe(apiUserId);
    expect(workerSession.user.email).toBe(API_EMAIL);
    const machine = as(workerSession);
    const registered = await machine.rpc('register_worker', {
      p_name: MACHINE,
      p_platform: 'linux',
      p_version: '0.1.0',
      p_capabilities: [],
    });
    expect(registered.error).toBeNull();
    expect((await machine.rpc('is_worker_session')).data).toBe(true);
    const refused = await machine.rpc('approve_job_stage', {
      p_job_id: crypto.randomUUID(),
      p_stage_key: 'review',
    });
    expect(refused.error?.code).toBe('42501');

    // Tek kullanımlık
    const again = await exchange(body.code);
    expect(again.error).not.toBeNull();
    expect(again.data.session).toBeNull();
  });

  test('otomasyon oturumu (MCP, makine) kod üretemez', async ({
    browser,
    baseURL,
  }) => {
    expect(mcpSession, 'önceki test MCP oturumu açmış olmalı').not.toBeNull();
    expect(
      workerSession,
      'önceki test makine oturumu açmış olmalı',
    ).not.toBeNull();
    for (const session of [mcpSession!, workerSession!]) {
      const context = await contextFor(browser, session);
      try {
        const response = await context.request.post('/api/tool-login', {
          headers: { origin: baseURL! },
          data: {},
        });
        expect(response.status()).toBe(403);
        expect(JSON.stringify(await response.json())).not.toMatch(/"code"/);
      } finally {
        await context.close();
      }
    }
  });
});

test.describe('hız sınırı', () => {
  test.use({ storageState: LIMIT_STATE });

  test('kullanıcı başına üretim sınırlıdır (429)', async ({
    page,
    baseURL,
  }) => {
    const statuses: number[] = [];
    // Sınır 10 dakikada 5; yeniden denemede sayaç dolu olabilir, bu yüzden ilk 429 aranır.
    for (
      let attempt = 0;
      attempt < 6 && statuses.at(-1) !== 429;
      attempt += 1
    ) {
      const response = await page.request.post('/api/tool-login', {
        headers: { origin: baseURL! },
        data: {},
      });
      statuses.push(response.status());
    }
    expect(statuses.at(-1)).toBe(429);
    expect(statuses.slice(0, -1).every((status) => status === 201)).toBe(true);
  });
});
