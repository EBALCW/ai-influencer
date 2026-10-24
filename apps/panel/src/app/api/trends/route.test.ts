// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CSV_BOM } from '@/lib/reports/csv';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

type Call = { table: string; op: string; args: unknown[] };
const state = vi.hoisted(() => ({
  user: { id: 'editor' } as { id: string } | null,
  role: 'editor' as string | null,
  calls: [] as Call[],
  rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcError: null as { code: string; message: string } | null,
  existing: [] as Array<{ url: string; influencer_id: string | null }>,
  insertError: null as { code: string; message: string } | null,
  rows: [] as Record<string, unknown>[],
}));

function builder(table: string) {
  let op = 'select';
  const chain: Record<string, unknown> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      if (['insert', 'update', 'delete'].includes(name)) op = name;
      state.calls.push({ table, op: name, args });
      return chain;
    };
  for (const name of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'in',
    'or',
    'is',
    'not',
    'gte',
    'neq',
    'order',
    'range',
    'limit',
  ])
    chain[name] = record(name);
  const result = () => {
    if (table === 'team_members')
      return { data: state.role ? { role: state.role } : null, error: null };
    if (table === 'influencers')
      return {
        data: [
          { id: '10000000-0000-4000-8000-000000000001', slug: 'demo-creator' },
        ],
        error: null,
      };
    if (op === 'insert')
      return state.insertError
        ? { data: null, error: state.insertError }
        : { data: { id: 'new' }, error: null };
    if (op === 'update' || op === 'delete')
      return {
        data: op === 'delete' ? [{ id: 'x' }] : { id: 'x' },
        error: null,
      };
    if (state.calls.some((c) => c.table === 'trends' && c.op === 'in'))
      return { data: state.existing, error: null };
    return { data: state.rows, error: null };
  };
  chain.maybeSingle = async () => result();
  chain.single = async () => result();
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error('no session'),
      }),
    },
    from: (table: string) => builder(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpc.push({ name, args });
      return state.rpcError
        ? { data: null, error: state.rpcError }
        : { data: '20000000-0000-4000-8000-000000000009', error: null };
    },
  }),
}));

const { POST } = await import('./route');
const { PATCH, DELETE } = await import('./[id]/route');
const { POST: backlog } = await import('./[id]/backlog/route');
const { POST: importCsv } = await import('./import/route');
const { GET: exportCsv } = await import('./export/route');

const id = '70000000-0000-4000-8000-000000000001';
const ctx = { params: Promise.resolve({ id }) };
const json = (body: unknown, method = 'POST') =>
  new Request('http://localhost/api/trends', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const upload = (text: string | null) => {
  const body = new FormData();
  if (text !== null)
    body.set('file', new File([text], 'trends.csv', { type: 'text/csv' }));
  return new Request('http://localhost/api/trends/import', {
    method: 'POST',
    body,
  });
};
const inserts = () =>
  state.calls.filter((c) => c.table === 'trends' && c.op === 'insert');

beforeEach(() => {
  state.user = { id: 'editor' };
  state.role = 'editor';
  state.calls = [];
  state.rpc = [];
  state.rpcError = null;
  state.existing = [];
  state.insertError = null;
  state.rows = [];
});

describe('trend yazma yetkisi', () => {
  it('viewer ve ekip dışı 403, oturumsuz 401; veritabanına yazılmaz', async () => {
    for (const role of ['viewer', null]) {
      state.role = role;
      expect((await POST(json({ url: 'https://a.example' }))).status).toBe(403);
      expect((await PATCH(json({ status: 'new' }, 'PATCH'), ctx)).status).toBe(
        403,
      );
      expect((await DELETE(json({}, 'DELETE'), ctx)).status).toBe(403);
      expect((await backlog(json({}), ctx)).status).toBe(403);
      expect((await importCsv(upload('link\nhttps://a.example'))).status).toBe(
        403,
      );
    }
    state.user = null;
    expect((await POST(json({ url: 'https://a.example' }))).status).toBe(401);
    expect(inserts()).toEqual([]);
    expect(state.rpc).toEqual([]);
  });
});

describe('POST/PATCH /api/trends', () => {
  it('kötü link, puan ve istemci audit alanı 400 döner', async () => {
    for (const body of [
      { url: 'javascript:alert(1)' },
      { url: 'https://a.example', adaptation_score: 0 },
      { url: 'https://a.example', created_by: 'spoof' },
      { url: 'https://a.example', status: 'archived' },
    ])
      expect((await POST(json(body))).status).toBe(400);
    expect(inserts()).toEqual([]);
  });

  it('platformu linkten bulup ekler', async () => {
    const response = await POST(
      json({ url: 'https://www.instagram.com/reel/x/' }),
    );
    expect(response.status).toBe(201);
    expect(inserts()[0]?.args[0]).toMatchObject({
      url: 'https://www.instagram.com/reel/x/',
      platform: 'instagram',
      status: 'new',
    });
  });

  it('aynı link 409; PATCH geçersiz id 404, used durumu 400', async () => {
    state.insertError = { code: '23505', message: 'duplicate key' };
    expect((await POST(json({ url: 'https://a.example' }))).status).toBe(409);
    expect(
      (
        await PATCH(json({ status: 'new' }, 'PATCH'), {
          params: Promise.resolve({ id: 'bad' }),
        })
      ).status,
    ).toBe(404);
    expect((await PATCH(json({ status: 'used' }, 'PATCH'), ctx)).status).toBe(
      400,
    );
    expect(
      (await PATCH(json({ status: 'shortlisted' }, 'PATCH'), ctx)).status,
    ).toBe(200);
  });
});

describe('POST /api/trends/[id]/backlog', () => {
  it('RPC’yi çağırır ve içerik kartı id’sini döner', async () => {
    const response = await backlog(
      json({
        influencer_id: '10000000-0000-4000-8000-000000000001',
        title: 'Fikir',
      }),
      ctx,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      content_item_id: '20000000-0000-4000-8000-000000000009',
    });
    expect(state.rpc[0]).toEqual({
      name: 'push_trend_to_backlog',
      args: {
        p_trend_id: id,
        p_influencer_id: '10000000-0000-4000-8000-000000000001',
        p_title: 'Fikir',
      },
    });
  });

  it('gövde ve veritabanı hatalarını anlamlı kodlara çevirir', async () => {
    expect((await backlog(json({ influencer_id: 'x' }), ctx)).status).toBe(400);
    const cases: Array<[string, number]> = [
      ['22023', 422],
      ['23514', 422],
      ['23505', 409],
      ['P0002', 404],
      ['42501', 403],
    ];
    for (const [code, status] of cases) {
      state.rpcError = { code, message: 'Bu trend zaten backlog’a aktarıldı.' };
      expect((await backlog(json({}), ctx)).status).toBe(status);
    }
  });
});

describe('POST /api/trends/import', () => {
  it('dosya yoksa 400, link sütunu yoksa 400', async () => {
    expect((await importCsv(upload(null))).status).toBe(400);
    const response = await importCsv(upload('tarih,hesap\n1,2'));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/link/);
  });

  it('geçerli satırları ekler, hatalıları satır no ile raporlar, var olanı atlar', async () => {
    state.existing = [{ url: 'https://youtu.be/var', influencer_id: null }];
    const csv = `${CSV_BOM}link;izlenme;influencer\nhttps://youtu.be/yeni;1,2M;demo-creator\njavascript:x;;\nhttps://youtu.be/var;;\nhttps://youtu.be/yeni;;demo-creator\n`;
    const response = await importCsv(upload(csv));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      created: 1,
      skipped: 2,
      errors: [{ line: 3, message: expect.stringMatching(/link/) }],
      ignoredColumns: [],
    });
    const rows = inserts()[0]?.args[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      url: 'https://youtu.be/yeni',
      platform: 'youtube',
      views: 1_200_000,
      influencer_id: '10000000-0000-4000-8000-000000000001',
    });
    expect(rows[0]?.captured_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('hiç geçerli satır yoksa 422 döner', async () => {
    const response = await importCsv(upload('link\nnot-a-link\n'));
    expect(response.status).toBe(422);
    expect(inserts()).toEqual([]);
  });
});

describe('GET /api/trends/export', () => {
  it('viewer BOM’lu CSV indirir; geçersiz filtre 400, oturumsuz 401', async () => {
    state.role = 'viewer';
    state.rows = [
      {
        id,
        captured_on: '2026-10-20',
        platform: 'instagram',
        url: 'https://example.invalid/trend/01',
        account_handle: '',
        views: 10,
        likes: null,
        comments: null,
        duration_s: null,
        format: 'short_film',
        hook: '',
        sound: '',
        why_viral: '',
        adaptation_idea: '',
        adaptation_score: 5,
        cost_estimate: 'low',
        status: 'shortlisted',
        source: 'manual',
        notes: '',
        influencer: null,
      },
    ];
    const response = await exportCsv(
      new Request('http://localhost/api/trends/export?sort=views'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/csv/);
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await response.text();
    expect(text.startsWith('id,tarih,platform,link')).toBe(true);
    expect(text).toContain(',kısa_film,');
    expect(text).toContain(',düşük,seçildi,manual,,');
    expect(
      (
        await exportCsv(
          new Request('http://localhost/api/trends/export?sort=x'),
        )
      ).status,
    ).toBe(400);
    state.user = null;
    expect(
      (await exportCsv(new Request('http://localhost/api/trends/export')))
        .status,
    ).toBe(401);
  });
});
