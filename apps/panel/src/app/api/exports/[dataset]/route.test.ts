// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Call = { table: string; method: string; args: unknown[] };
const state = vi.hoisted(() => ({
  user: { id: 'viewer-1' } as { id: string } | null,
  role: 'viewer' as string | null,
  influencer: null as { id: string } | null,
  rows: {} as Record<string, unknown[]>,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error('no session'),
      }),
    },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const record =
        (method: string) =>
        (...args: unknown[]) => {
          (state.calls as Call[]).push({ table, method, args });
          return builder;
        };
      for (const method of ['select', 'gte', 'lt', 'lte', 'eq', 'order'])
        builder[method] = record(method);
      builder.maybeSingle = async () =>
        table === 'team_members'
          ? { data: state.role ? { role: state.role } : null, error: null }
          : { data: state.influencer, error: null };
      builder.range = async (from: number, to: number) => {
        (state.calls as Call[]).push({
          table,
          method: 'range',
          args: [from, to],
        });
        return {
          data: (state.rows[table] ?? []).slice(from, to + 1),
          error: null,
        };
      };
      return builder;
    },
  }),
}));

const { GET } = await import('./route');
const { CSV_BOM } = await import('@/lib/reports/csv');

function call(dataset: string, query = 'from=2026-09-07&to=2026-09-13') {
  return GET(
    new Request(`http://127.0.0.1:3000/api/exports/${dataset}?${query}`),
    { params: Promise.resolve({ dataset }) },
  );
}

const post = (i: number, caption = `Post ${i}`) => ({
  id: `post-${i}`,
  external_id: null,
  url: `https://example.invalid/${i}`,
  caption,
  published_at: '2026-09-08T10:00:00+00:00',
  duration_s: 18,
  is_short: true,
  social_accounts: {
    platform: 'instagram',
    handle: '@örnek',
    influencer_id: 'inf-1',
    influencers: { name: 'Çağla Test', slug: 'cagla-test' },
  },
});

beforeEach(() => {
  Object.assign(state, {
    user: { id: 'viewer-1' },
    role: 'viewer',
    influencer: null,
    rows: {},
    calls: [],
  });
});

describe('GET /api/exports/[dataset]', () => {
  it('oturum yoksa 401 ve veri okunmaz', async () => {
    state.user = null;
    expect((await call('posts')).status).toBe(401);
    expect(state.calls.filter((c) => c.table === 'posts')).toHaveLength(0);
  });

  it('ekip üyesi olmayan kullanıcı 403 alır', async () => {
    state.role = null;
    expect((await call('posts')).status).toBe(403);
    expect(state.calls.filter((c) => c.table === 'posts')).toHaveLength(0);
  });

  it('geçersiz veri seti 400', async () => {
    const response = await call('users');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: expect.stringContaining('posts, metrics veya costs'),
    });
  });

  it('geçersiz tarih filtresi 400 (eksik, ters, bozuk, çok uzun, kötü slug)', async () => {
    for (const query of [
      '',
      'from=2026-09-13&to=2026-09-07',
      'from=2026-02-30&to=2026-03-01',
      'from=2025-01-01&to=2026-09-07',
      'from=2026-09-07&to=2026-09-13&inf=../../etc',
    ])
      expect((await call('posts', query)).status).toBe(400);
  });

  it('bilinmeyen influencer 404', async () => {
    const response = await call(
      'posts',
      'from=2026-09-07&to=2026-09-13&inf=yok',
    );
    expect(response.status).toBe(404);
  });

  it('viewer CSV indirir: 200, content-type, content-disposition, BOM, Türkçe ve formül koruması', async () => {
    state.rows.posts = [post(1, 'Güzel gün, şık'), post(2, '=HYPERLINK("x")')];
    const response = await call('posts');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/csv; charset=utf-8',
    );
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="posts_tum-influencerlar_2026-09-07_2026-09-13.csv"',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    const lines = text.split('\r\n');
    expect(lines[0]).toBe(
      `${CSV_BOM}Yayın zamanı (UTC),Influencer,Platform,Hesap,Post ID,Platform post ID,URL,Caption,Süre (sn),Short`,
    );
    // '@' ile başlayan hesap adı da formül sayılır; başına ' eklenir
    expect(lines[1]).toContain("Çağla Test,instagram,'@örnek,post-1");
    expect(lines[1]).toContain('"Güzel gün, şık"');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('yayın zamanı Türkiye haftasının UTC aralığıyla filtrelenir', async () => {
    await call('posts');
    const filters = state.calls.filter((c) => c.table === 'posts');
    expect(filters).toContainEqual({
      table: 'posts',
      method: 'gte',
      args: ['published_at', '2026-09-06T21:00:00.000Z'],
    });
    expect(filters).toContainEqual({
      table: 'posts',
      method: 'lt',
      args: ['published_at', '2026-09-13T21:00:00.000Z'],
    });
  });

  it('seçili influencer filtresi sunucuda uygulanır', async () => {
    state.influencer = { id: 'inf-1' };
    const response = await call(
      'metrics',
      'from=2026-09-07&to=2026-09-13&inf=cagla-test',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain(
      'metrics_cagla-test_2026-09-07_2026-09-13.csv',
    );
    expect(state.calls).toContainEqual({
      table: 'influencers',
      method: 'eq',
      args: ['slug', 'cagla-test'],
    });
    expect(state.calls).toContainEqual({
      table: 'metric_snapshots',
      method: 'eq',
      args: ['posts.social_accounts.influencer_id', 'inf-1'],
    });
  });

  it('maliyetler gün (incurred_on) aralığıyla filtrelenir', async () => {
    state.rows.costs = [
      {
        id: 'c1',
        incurred_on: '2026-09-07',
        category: 'tool',
        description: '-indirim',
        amount: '12.5000',
        currency: 'USD',
        credits: null,
        generation_id: null,
        influencers: { name: 'Çağla Test', slug: 'cagla-test' },
      },
    ];
    const response = await call('costs');
    const text = await response.text();
    expect(text).toContain(
      "2026-09-07,Çağla Test,tool,'-indirim,12.5000,USD,,",
    );
    expect(state.calls).toContainEqual({
      table: 'costs',
      method: 'lte',
      args: ['incurred_on', '2026-09-13'],
    });
  });

  it('1000 satır sınırını sayfalayarak aşar (eksik dışa aktarma yok)', async () => {
    state.rows.posts = Array.from({ length: 1005 }, (_, i) => post(i));
    const text = await (await call('posts')).text();
    expect(text.trimEnd().split('\r\n')).toHaveLength(1006);
    expect(
      state.calls.filter((c) => c.table === 'posts' && c.method === 'range'),
    ).toEqual([
      { table: 'posts', method: 'range', args: [0, 999] },
      { table: 'posts', method: 'range', args: [1000, 1999] },
    ]);
  });
});
