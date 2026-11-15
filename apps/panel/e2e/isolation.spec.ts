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

test('ikinci alanın ana ekranı birinci alanın üretimlerini göstermez', async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: OTHER_STATE });
  const page = await context.newPage();
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Ana ekran', level: 1 }),
  ).toBeVisible();
  // Yeni alan boştur: ilk adımı söyleyen boş durum görünür, birinci alanın seed klipleri değil.
  await expect(
    page.getByRole('heading', { name: 'Henüz üretim yok' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Anlatım videosu başlat' }),
  ).toBeVisible();
  await expect(page.getByText(/Demo: /)).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /Yayıncı klipleri: 0 kaynak · 0 klip/ }),
  ).toBeVisible();
  await context.close();
});

test('ikinci alan birinci alanın anlatım serisini, bölümünü ve konu isteğini göremez, değiştiremez', async ({
  browser,
}) => {
  const run = crypto.randomUUID().slice(0, 8);
  const seriesName = `E2E Yalıtım Seri ${run}`;
  const episodeTitle = `E2E Yalıtım Bölüm ${run}`;

  // Birinci alanın editörü panel API'siyle veri açar (alan oturumdan gelir).
  const first = await browser.newContext({ storageState: EDITOR_STATE });
  const create = async <T>(url: string, data: unknown): Promise<T> => {
    const response = await first.request.post(url, { data });
    expect(response.status(), url).toBe(201);
    return (await response.json()) as T;
  };
  const seriesId = (
    await create<{ series: { id: string } }>('/api/explainers/series', {
      name: seriesName,
      settings: { kind: 'event' },
    })
  ).series.id;
  const requestId = (
    await create<{ request: { id: string } }>(
      '/api/explainers/topic-requests',
      {
        prompt: `Yalıtım isteği ${run}`,
        series_id: seriesId,
        suggestions: [{ title: `Yalıtım önerisi ${run}`, kind: 'event' }],
      },
    )
  ).request.id;
  const episodeId = (
    await create<{ episode: { id: string } }>('/api/explainers/episodes', {
      title: episodeTitle,
      series_id: seriesId,
    })
  ).episode.id;
  const similarFirst = await first.request.get(
    `/api/explainers/similar?title=${encodeURIComponent(episodeTitle)}`,
  );
  const ownMatches = (
    (await similarFirst.json()) as { similar: Array<{ id: string }> }
  ).similar;
  expect(ownMatches.map((item) => item.id)).toContain(episodeId);
  const suggestionId = (
    (await (
      await first.request.get(
        `/api/explainers/similar?title=${encodeURIComponent(`Yalıtım önerisi ${run}`)}`,
      )
    ).json()) as { similar: Array<{ id: string; source: string }> }
  ).similar.find((item) => item.source === 'suggestion')!.id;
  // Kontrol: sahibi sayfaları görür.
  const own = await first.newPage();
  expect((await own.goto(`/explainers/episodes/${episodeId}`))?.status()).toBe(
    200,
  );
  await first.close();

  const context = await browser.newContext({ storageState: OTHER_STATE });
  const page = await context.newPage();
  const list = await page.goto('/explainers?show=archived');
  expect(list?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'İlk anlatım videonuzu başlatın' }),
  ).toBeVisible();
  await expect(page.getByText(seriesName)).toHaveCount(0);
  await expect(page.getByText(episodeTitle)).toHaveCount(0);

  for (const path of [
    `/explainers/series/${seriesId}`,
    `/explainers/series/${seriesId}/edit`,
    `/explainers/episodes/${episodeId}`,
    `/explainers/topics/${requestId}`,
  ])
    expect((await page.goto(path))?.status(), path).toBe(404);
  // Başka alanın serisi form seçeneklerine de sızmaz.
  await page.goto(`/explainers/episodes/new?series=${seriesId}`);
  await expect(
    page.getByRole('form', { name: 'Yeni video' }).getByLabel(/^Seri/),
  ).toHaveValue('');
  await expect(page.getByRole('option', { name: seriesName })).toHaveCount(0);

  // API: başka alanın kimliği "bulunamadı"dır; hiçbir şey değişmez.
  const api = context.request;
  expect(
    (await api.get(`/api/explainers/episodes/${episodeId}/script`)).status(),
  ).toBe(404);
  const writes: Array<[string, 'post' | 'patch' | 'put', unknown]> = [
    [`/api/explainers/series/${seriesId}`, 'patch', { name: 'Ele geçirildi' }],
    [`/api/explainers/series/${seriesId}/archive`, 'post', { archived: true }],
    [
      `/api/explainers/topic-requests/${requestId}/suggestions`,
      'post',
      { suggestions: [{ title: 'Sızma', kind: 'event' }] },
    ],
    [`/api/explainers/suggestions/${suggestionId}/pick`, 'post', {}],
    [`/api/explainers/suggestions/${suggestionId}/reject`, 'post', {}],
    [
      '/api/explainers/episodes',
      'post',
      { title: 'Sızma', kind: 'event', series_id: seriesId },
    ],
    [`/api/explainers/episodes/${episodeId}`, 'patch', { title: 'Sızma' }],
    [`/api/explainers/episodes/${episodeId}/move`, 'post', { series_id: null }],
    [
      `/api/explainers/episodes/${episodeId}/archive`,
      'post',
      { archived: true },
    ],
    [
      `/api/explainers/episodes/${episodeId}/script`,
      'put',
      { script_text: 'Sızma' },
    ],
    [
      `/api/explainers/episodes/${episodeId}/approve`,
      'post',
      { script_version: 1, acknowledge_fact_gaps: true },
    ],
    [
      `/api/explainers/episodes/${episodeId}/jobs`,
      'post',
      { kind: 'explainer.render' },
    ],
  ];
  for (const [url, method, data] of writes)
    expect((await api[method](url, { data })).status(), url).toBe(404);
  const similarOther = await api.get(
    `/api/explainers/similar?title=${encodeURIComponent(episodeTitle)}`,
  );
  expect(similarOther.status()).toBe(200);
  expect(
    ((await similarOther.json()) as { similar: unknown[] }).similar,
  ).toEqual([]);
  // Seri adı alan içinde tekildir: ikinci alan aynı adı kullanabilir.
  const sameName = await api.post('/api/explainers/series', {
    data: { name: seriesName },
  });
  expect(sameName.status()).toBe(201);
  await context.close();

  // Birinci alanın kayıtları değişmedi.
  const { data: series, error: seriesError } = await adminClient()
    .from('series')
    .select('name, status')
    .eq('id', seriesId)
    .single();
  if (seriesError) throw seriesError;
  expect(series).toEqual({ name: seriesName, status: 'active' });
  const { data: episode, error: episodeError } = await adminClient()
    .from('episodes')
    .select('title, series_id, script_text, archived_at')
    .eq('id', episodeId)
    .single();
  if (episodeError) throw episodeError;
  expect(episode).toEqual({
    title: episodeTitle,
    series_id: seriesId,
    script_text: '',
    archived_at: null,
  });
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
