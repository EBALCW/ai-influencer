// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PROMPT_BUNDLE_FORMAT } from '@/lib/prompt-bundle';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const INF_A = 'a1000000-0000-4000-8000-000000000001';
const P1 = 'b1000000-0000-4000-8000-000000000001';
const P2 = 'b1000000-0000-4000-8000-000000000002';

type Lineage = {
  id: string;
  category: string;
  key: string;
  influencer_id: string | null;
  title: string;
  body: string;
  negative: string;
  variables: unknown;
  version: number;
  change_note: string;
};

const state = vi.hoisted(() => ({
  user: { id: 'editor' } as { id: string } | null,
  role: 'editor' as string | null,
  influencers: [] as Array<{ id: string; slug: string; name: string }>,
  lineages: [] as Lineage[],
  rpcCalls: [] as Array<Record<string, unknown>>,
  rpcError: null as { code?: string; message: string } | null,
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
      let rows: Record<string, unknown>[] =
        table === 'influencers'
          ? state.influencers
          : table === 'prompt_lineages'
            ? state.lineages
            : [];
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: (column: string, value: unknown) => {
          rows = rows.filter((row) => row[column] === value);
          return chain;
        },
        neq: () => chain,
        in: (column: string, values: unknown[]) => {
          rows = rows.filter((row) => values.includes(row[column]));
          return chain;
        },
        or: () => chain,
        maybeSingle: async () =>
          table === 'team_members'
            ? { data: state.role ? { role: state.role } : null, error: null }
            : { data: rows[0] ?? null, error: null },
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: rows, error: null }),
      };
      return chain;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, ...args });
      return state.rpcError
        ? { data: null, error: state.rpcError }
        : { data: { id: 'new' }, error: null };
    },
  }),
}));

const { POST: importPrompts } = await import('./import/route');
const { GET: exportPrompts } = await import('./export/route');

const entry = {
  category: 'character',
  key: 'kombin',
  title: 'Kombin',
  body: '{{kıyafet}} giyen karakter',
};
const bundle = (prompts: unknown[]) =>
  JSON.stringify({ format: PROMPT_BUNDLE_FORMAT, version: 1, prompts });

function upload(content: string | null, name = 'prompts.json') {
  const form = new FormData();
  if (content !== null)
    form.set('file', new File([content], name, { type: 'application/json' }));
  return importPrompts(
    new NextRequest('http://localhost/api/prompts/import', {
      method: 'POST',
      body: form,
    }),
  );
}

const download = (query = '') =>
  exportPrompts(new NextRequest(`http://localhost/api/prompts/export${query}`));

beforeEach(() => {
  state.user = { id: 'editor' };
  state.role = 'editor';
  state.influencers = [{ id: INF_A, slug: 'demo-a', name: 'Demo A' }];
  state.lineages = [
    {
      id: P1,
      category: 'character',
      key: 'kombin',
      influencer_id: null,
      title: 'Kombin',
      body: '{{kıyafet}} giyen karakter',
      negative: '',
      variables: { kıyafet: {} },
      version: 2,
      change_note: '',
    },
    {
      id: P2,
      category: 'caption',
      key: 'ozel',
      influencer_id: INF_A,
      title: 'Özel',
      body: 'A için caption',
      negative: '',
      variables: {},
      version: 1,
      change_note: '',
    },
  ];
  state.rpcCalls = [];
  state.rpcError = null;
});

describe('POST /api/prompts/import', () => {
  it('oturum yok 401, viewer ve ekip dışı 403; hiçbir şey yazılmaz', async () => {
    state.user = null;
    expect((await upload(bundle([entry]))).status).toBe(401);
    state.user = { id: 'viewer' };
    state.role = 'viewer';
    expect((await upload(bundle([entry]))).status).toBe(403);
    state.role = null;
    expect((await upload(bundle([entry]))).status).toBe(403);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it.each([
    ['dosya yok', null],
    ['boş dosya', ''],
    ['JSON değil', 'merhaba'],
    ['paket değil', JSON.stringify([entry])],
    ['hatalı prompt', bundle([{ ...entry, body: '' }])],
    ['1 MB üstü', 'x'.repeat(1_000_001)],
  ])('%s → 400, yazma yok', async (_name, content) => {
    const response = await upload(content);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeTruthy();
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("bu ortamda olmayan influencer slug'ı tüm paketi reddeder", async () => {
    const response = await upload(
      bundle([
        { ...entry, key: 'yeni', body: 'Yeni' },
        { ...entry, influencer: 'baska-ortam' },
      ]),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('baska-ortam');
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('create_prompt_version ile yeni versiyon oluşturur, aynı içeriği atlar', async () => {
    const response = await upload(
      bundle([
        entry,
        {
          ...entry,
          key: 'kombin-gece',
          title: 'Gece',
          body: '{{kıyafet}} giyen karakter, gece',
        },
        {
          category: 'caption',
          key: 'ozel',
          title: 'Özel',
          body: 'A için yeni caption',
          influencer: 'demo-a',
          changeNote: 'dosyadan',
        },
      ]),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      created: 2,
      unchanged: 1,
      failed: [],
    });
    expect(state.rpcCalls).toEqual([
      expect.objectContaining({
        name: 'create_prompt_version',
        p_category: 'character',
        p_key: 'kombin-gece',
        p_influencer_id: undefined,
        p_variables: { kıyafet: {} },
        p_change_note: 'Dosyadan içe aktarıldı',
      }),
      expect.objectContaining({
        p_key: 'ozel',
        p_influencer_id: INF_A,
        p_change_note: 'dosyadan',
      }),
    ]);
    // Sahiplik/versiyon alanları istemciden gelmez
    for (const call of state.rpcCalls) {
      expect(call).not.toHaveProperty('p_version');
      expect(call).not.toHaveProperty('p_created_by');
    }
  });

  it('veritabanı yetki reddi 403 döner', async () => {
    state.rpcError = { code: '42501', message: 'private' };
    const response = await upload(bundle([{ ...entry, key: 'yeni' }]));
    expect(response.status).toBe(403);
  });

  it('beklenmeyen kayıt hatası iç mesajı sızdırmaz', async () => {
    state.rpcError = { code: 'XX000', message: 'private detail' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await upload(bundle([{ ...entry, key: 'yeni' }]));
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain('private detail');
    expect(text).toContain('Kaydedilemedi');
    warn.mockRestore();
  });
});

describe('GET /api/prompts/export', () => {
  it('oturum yok 401, ekip dışı 403', async () => {
    state.user = null;
    expect((await download()).status).toBe(401);
    state.user = { id: 'x' };
    state.role = null;
    expect((await download()).status).toBe(403);
  });

  it('viewer okuyabildiği için dışa aktarabilir; dosya indirilir', async () => {
    state.role = 'viewer';
    const response = await download();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="ai-influencer-prompts-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const body = await response.json();
    expect(body.format).toBe(PROMPT_BUNDLE_FORMAT);
    expect(body.prompts).toEqual([
      expect.objectContaining({ key: 'kombin', influencer: null, version: 2 }),
      expect.objectContaining({ key: 'ozel', influencer: 'demo-a' }),
    ]);
  });

  it('seçilen id ve kategori filtresi uygulanır', async () => {
    const byId = await (await download(`?id=${P2}`)).json();
    expect(byId.prompts.map((p: { key: string }) => p.key)).toEqual(['ozel']);
    const byCategory = await (await download('?kategori=character')).json();
    expect(byCategory.prompts.map((p: { key: string }) => p.key)).toEqual([
      'kombin',
    ]);
  });

  it('geçersiz istek 400, bilinmeyen influencer veya boş sonuç 404', async () => {
    expect((await download('?id=x')).status).toBe(400);
    expect((await download('?kategori=yok')).status).toBe(400);
    expect((await download('?inf=yok')).status).toBe(404);
    state.lineages = [];
    expect((await download()).status).toBe(404);
  });
});
