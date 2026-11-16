import { expect, test } from '@playwright/test';
import { sameOrigin } from './same-origin';
import { EDITOR_STATE, hasLocalSupabase } from './global-setup';

// Anlatım modülü: viewer seri, öneri ve senaryoyu okur; hiçbir şeyi değiştiremez (düğme yok,
// API 403). Veri editor oturumuyla panel API'sinden kurulur.
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

test('viewer anlatım ekranlarını salt okur', async ({ page, browser }) => {
  const run = crypto.randomUUID().slice(0, 8);
  const seriesName = `E2E Viewer Seri ${run}`;
  const editor = await browser.newContext({ storageState: EDITOR_STATE });
  let seriesId = '';
  let requestId = '';
  let suggestionId = '';
  let episodeId = '';
  try {
    const post = async <T>(url: string, data: unknown): Promise<T> => {
      const response = await editor.request.post(url, {
        headers: sameOrigin,
        data,
      });
      expect(response.status(), url).toBeLessThan(300);
      return (await response.json()) as T;
    };
    seriesId = (
      await post<{ series: { id: string } }>('/api/explainers/series', {
        name: seriesName,
        settings: { kind: 'how_it_works', visual_route: 'hyperframes' },
      })
    ).series.id;
    requestId = (
      await post<{ request: { id: string } }>(
        '/api/explainers/topic-requests',
        {
          prompt: `Viewer isteği ${run}`,
          series_id: seriesId,
          suggestions: [
            {
              title: `Viewer önerisi ${run}`,
              kind: 'how_it_works',
              source_candidates: [
                { title: 'Kaynak', url: 'https://example.org/v' },
              ],
            },
          ],
        },
      )
    ).request.id;
    episodeId = (
      await post<{ episode: { id: string } }>('/api/explainers/episodes', {
        title: `Viewer bölümü ${run}`,
        series_id: seriesId,
      })
    ).episode.id;
    const saved = await editor.request.put(
      `/api/explainers/episodes/${episodeId}/script`,
      {
        headers: sameOrigin,
        data: {
          script_text: 'Viewer için senaryo.',
          fact_notes: [
            {
              claim: 'Tek kaynaklı iddia',
              sources: [{ title: 'Rapor', url: 'https://example.org/rapor' }],
            },
          ],
          expected_version: 0,
        },
      },
    );
    expect(saved.status()).toBe(200);
  } finally {
    await editor.close();
  }

  // Genel bakış: eylem yok.
  expect((await page.goto('/explainers'))?.status()).toBe(200);
  await expect(
    page.getByRole('article', { name: `Seri: ${seriesName}` }),
  ).toBeVisible();
  for (const name of [/Yeni seri/, /Tekil video/, /Konu önerisi iste/])
    await expect(
      page.getByRole('main').getByRole('link', { name }),
    ).toHaveCount(0);

  // Oluşturma sayfaları viewer'ı listeye geri gönderir.
  for (const path of [
    '/explainers/series/new',
    '/explainers/episodes/new',
    '/explainers/topics/new',
    `/explainers/series/${seriesId}/edit`,
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      path.endsWith('/edit')
        ? new RegExp(`/explainers/series/${seriesId}$`)
        : /\/explainers$/,
    );
  }

  // Seri: bölüm listesi var, düğme yok.
  await page.goto(`/explainers/series/${seriesId}`);
  await expect(page.getByRole('note')).toContainText('İzleyici rolündesiniz');
  await expect(
    page.getByRole('row').filter({ hasText: `Viewer bölümü ${run}` }),
  ).toContainText('1 kaynağı eksik iddia');
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('combobox')).toHaveCount(0);
  for (const name of [/Bölüm ekle/, /Düzenle/, /Konu önerisi iste/])
    await expect(
      page.getByRole('main').getByRole('link', { name }),
    ).toHaveCount(0);

  // Öneriler: kart okunur, seç / ele / ekle yok.
  await page.goto(`/explainers/topics/${requestId}`);
  const card = page.getByRole('article', {
    name: `Öneri: Viewer önerisi ${run}`,
  });
  await expect(card.getByRole('link', { name: 'Kaynak' })).toHaveAttribute(
    'href',
    'https://example.org/v',
  );
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('form')).toHaveCount(0);

  // Bölüm: senaryo okunur, alanlar kapalı, kaydet / onayla / üretime gönder yok.
  await page.goto(`/explainers/episodes/${episodeId}`);
  await expect(page.getByLabel('Anlatıcı metni')).toHaveValue(
    'Viewer için senaryo.',
  );
  await expect(page.getByLabel('Anlatıcı metni')).toBeDisabled();
  await expect(page.getByLabel('İddia 1 metni')).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Rapor' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Bölüm ayarları' }),
  ).toHaveCount(0);
  const suggestion = await page.request.get(
    `/api/explainers/similar?title=${encodeURIComponent(`Viewer önerisi ${run}`)}`,
  );
  expect(suggestion.status()).toBe(200);
  const { similar } = (await suggestion.json()) as {
    similar: Array<{ id: string; source: string }>;
  };
  suggestionId = similar.find((item) => item.source === 'suggestion')!.id;

  // API: her yazma 403.
  const writes: Array<[string, 'post' | 'patch' | 'put', unknown]> = [
    ['/api/explainers/series', 'post', { name: 'Viewer' }],
    [`/api/explainers/series/${seriesId}`, 'patch', { name: 'Viewer' }],
    [`/api/explainers/series/${seriesId}/archive`, 'post', { archived: true }],
    ['/api/explainers/topic-requests', 'post', { prompt: 'Viewer' }],
    [
      `/api/explainers/topic-requests/${requestId}/suggestions`,
      'post',
      { suggestions: [{ title: 'Viewer', kind: 'event' }] },
    ],
    [`/api/explainers/suggestions/${suggestionId}/pick`, 'post', {}],
    [`/api/explainers/suggestions/${suggestionId}/reject`, 'post', {}],
    ['/api/explainers/episodes', 'post', { title: 'Viewer', kind: 'event' }],
    [`/api/explainers/episodes/${episodeId}`, 'patch', { title: 'Viewer' }],
    [`/api/explainers/episodes/${episodeId}/move`, 'post', { series_id: null }],
    [
      `/api/explainers/episodes/${episodeId}/archive`,
      'post',
      { archived: true },
    ],
    [
      `/api/explainers/episodes/${episodeId}/script`,
      'put',
      { script_text: 'Viewer' },
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
    expect(
      (await page.request[method](url, { headers: sameOrigin, data })).status(),
      url,
    ).toBe(403);
});
