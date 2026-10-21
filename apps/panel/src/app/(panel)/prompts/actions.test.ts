// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const auth = vi.hoisted(() => ({ role: 'editor' as string }));
vi.mock('@/lib/auth', () => ({
  requireTeamMember: async () => ({
    user: { id: 'user-1', email: null },
    role: auth.role,
  }),
}));

type Result = {
  data: unknown;
  error: { code?: string; message: string } | null;
};
type Call = {
  table: string;
  op: string;
  payload?: unknown;
  filters: unknown[][];
};

const db = vi.hoisted(() => ({
  calls: [] as Call[],
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
  respond: (() => ({ data: null, error: null })) as (call: Call) => Result,
  rpcResult: { data: null, error: null } as Result,
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: unknown) => {
      db.rpcCalls.push({ name, args });
      return db.rpcResult;
    },
    from: (table: string) => {
      const call: Call = { table, op: 'select', filters: [] };
      db.calls.push(call);
      const builder = {
        select: () => builder,
        update: (payload: unknown) => (
          (call.op = 'update'),
          (call.payload = payload),
          builder
        ),
        insert: (payload: unknown) => (
          (call.op = 'insert'),
          (call.payload = payload),
          builder
        ),
        eq: (...args: unknown[]) => (
          call.filters.push(['eq', ...args]),
          builder
        ),
        is: (...args: unknown[]) => (
          call.filters.push(['is', ...args]),
          builder
        ),
        limit: () => builder,
        maybeSingle: async () => db.respond(call),
        then: (resolve: (value: Result) => unknown) =>
          resolve(db.respond(call)),
      };
      return builder;
    },
  }),
}));

const { enqueueGeneration, ratePrompt, savePromptVersion } =
  await import('./actions');

const PROMPT_ID = '11111111-1111-4111-8111-111111111111';
const INF_A = '22222222-2222-4222-8222-222222222222';
const INF_B = '33333333-3333-4333-8333-333333333333';

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

beforeEach(() => {
  auth.role = 'editor';
  db.calls = [];
  db.rpcCalls = [];
  db.respond = () => ({ data: [], error: null });
  db.rpcResult = { data: { id: PROMPT_ID }, error: null };
});

describe('savePromptVersion', () => {
  const valid = {
    mode: 'new',
    title: 'Günlük Kombin',
    category: 'character',
    body: '{{kıyafet}} giyen karakter, {{mekan}}',
    'default:mekan': 'kafe',
    'default:fazla': 'kullanılmıyor',
  };

  it('rejects viewers without touching the database', async () => {
    auth.role = 'viewer';
    const state = await savePromptVersion(null, form(valid));
    expect(state).toEqual({
      ok: false,
      message: expect.stringMatching(/yetki/),
    });
    expect(db.calls).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('validates the input (empty body)', async () => {
    const state = await savePromptVersion(null, form({ ...valid, body: '  ' }));
    expect(state?.ok).toBe(false);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('creates a new lineage via the RPC with a derived key and only used variables', async () => {
    await expect(
      savePromptVersion(null, form({ ...valid, inf: 'demo' })),
    ).rejects.toThrow(`REDIRECT:/prompts/${PROMPT_ID}?inf=demo`);
    expect(db.rpcCalls).toEqual([
      {
        name: 'create_prompt_version',
        args: expect.objectContaining({
          p_category: 'character',
          p_key: 'gunluk-kombin',
          p_influencer_id: undefined,
          p_variables: { kıyafet: {}, mekan: { default: 'kafe' } },
        }),
      },
    ]);
  });

  it('refuses a "new" prompt whose lineage already exists', async () => {
    db.respond = () => ({ data: [{ id: 'existing' }], error: null });
    const state = await savePromptVersion(null, form(valid));
    expect(state?.message).toMatch(/zaten var/);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('maps an RLS rejection to a permission message', async () => {
    db.rpcResult = { data: null, error: { code: '42501', message: 'rls' } };
    const state = await savePromptVersion(
      null,
      form({ ...valid, mode: 'version', key: 'gunluk-kombin' }),
    );
    expect(state).toEqual({
      ok: false,
      message: expect.stringMatching(/yetki/),
    });
  });
});

describe('ratePrompt', () => {
  it('accepts only 1-5', async () => {
    for (const rating of ['0', '6', '3.5', 'x']) {
      const state = await ratePrompt(
        null,
        form({ promptId: PROMPT_ID, rating }),
      );
      expect(state?.ok).toBe(false);
    }
    expect(db.calls).toHaveLength(0);
  });

  it('reports "no rows updated" instead of a silent success', async () => {
    db.respond = () => ({ data: [], error: null });
    const state = await ratePrompt(
      null,
      form({ promptId: PROMPT_ID, rating: '4' }),
    );
    expect(state).toEqual({
      ok: false,
      message: expect.stringMatching(/bulunamadı|yetkin yok/),
    });
  });

  it('rejects viewers', async () => {
    auth.role = 'viewer';
    expect(
      (await ratePrompt(null, form({ promptId: PROMPT_ID, rating: '4' })))?.ok,
    ).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe('enqueueGeneration', () => {
  const prompt = (overrides: Record<string, unknown> = {}) => ({
    id: PROMPT_ID,
    body: '{{kıyafet}} @ {{mekan}}',
    negative: 'bulanık',
    category: 'character',
    influencer_id: null,
    version: 2,
    ...overrides,
  });
  const respondWith = (row: Record<string, unknown>) => {
    db.respond = (call) =>
      call.table === 'prompts'
        ? { data: row, error: null }
        : { data: [{ id: 'gen-1' }], error: null };
  };

  it('queues a generation with the rendered prompt; the provider is not called', async () => {
    respondWith(prompt());
    const state = await enqueueGeneration(
      null,
      form({
        promptId: PROMPT_ID,
        influencerId: INF_A,
        'value:kıyafet': 'trençkot',
        'value:mekan': 'sahil',
        'value:fazla': 'x',
      }),
    );
    expect(state?.ok).toBe(true);
    const insert = db.calls.find((call) => call.op === 'insert');
    expect(insert?.payload).toEqual({
      influencer_id: INF_A,
      prompt_id: PROMPT_ID,
      tool: 'mock',
      type: 'image',
      status: 'queued',
      params: {
        prompt: 'trençkot @ sahil',
        negative: 'bulanık',
        variables: { kıyafet: 'trençkot', mekan: 'sahil' },
        prompt_version: 2,
      },
    });
  });

  it('refuses when a variable is missing', async () => {
    respondWith(prompt());
    const state = await enqueueGeneration(
      null,
      form({
        promptId: PROMPT_ID,
        influencerId: INF_A,
        'value:kıyafet': 'trençkot',
      }),
    );
    expect(state).toEqual({ ok: false, message: 'Eksik değişken: mekan' });
    expect(db.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('refuses text-only categories (caption/research)', async () => {
    respondWith(prompt({ category: 'caption', body: 'Metin' }));
    const state = await enqueueGeneration(
      null,
      form({ promptId: PROMPT_ID, influencerId: INF_A }),
    );
    expect(state?.message).toMatch(/gönderilemez/);
  });

  it('does not use an influencer-specific prompt for another influencer', async () => {
    respondWith(prompt({ influencer_id: INF_A, body: 'Sabit' }));
    const state = await enqueueGeneration(
      null,
      form({ promptId: PROMPT_ID, influencerId: INF_B }),
    );
    expect(state?.message).toMatch(/yalnızca kendi/);
    expect(db.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('requires an influencer and rejects viewers', async () => {
    respondWith(prompt({ body: 'Sabit' }));
    expect(
      (await enqueueGeneration(null, form({ promptId: PROMPT_ID })))?.ok,
    ).toBe(false);
    auth.role = 'viewer';
    db.calls = [];
    expect(
      (
        await enqueueGeneration(
          null,
          form({ promptId: PROMPT_ID, influencerId: INF_A }),
        )
      )?.ok,
    ).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});
