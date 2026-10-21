// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: null as string | null,
  rpc: vi.fn(),
}));

// Gerçek requireApiRole çalışsın; sadece Supabase istemcisi sahte
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error('no session'),
      }),
    },
    from: (table: string) => ({
      select: () => {
        const chain = {
          eq: () => chain,
          maybeSingle: async () =>
            table === 'team_members'
              ? { data: state.role ? { role: state.role } : null, error: null }
              : { data: null, error: null },
        };
        return chain;
      },
    }),
    rpc: state.rpc,
  }),
}));

const { POST: save } = await import('./route');
const { POST: restore } = await import('./restore/route');

const ID = '10000000-0000-4000-8000-000000000001';
const validPersona = {
  bio: 'Bio',
  tone: 'samimi',
  adjectives: ['meraklı'],
  hookTraits: [],
  sampleCaptions: [],
  audience: { ageRange: '', interests: [], description: '' },
  appearance: {
    hair: '',
    skin: '',
    eyes: '',
    face: '',
    body: '',
    signature: '',
  },
  changeNote: 'ilk',
};

function call(handler: typeof save, body: unknown, id = ID) {
  const request = new Request(
    `http://127.0.0.1:3000/api/influencers/${id}/persona`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
  return handler(request as unknown as NextRequest, {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  state.user = { id: 'user-editor' };
  state.role = 'editor';
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: { version: 2 }, error: null });
});

describe.each([
  ['POST /persona', save, validPersona],
  ['POST /persona/restore', restore, { version: 1 }],
] as const)('%s', (_name, handler, body) => {
  it('oturum yoksa 401', async () => {
    state.user = null;
    expect((await call(handler, body)).status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('viewer 403 alır ve RPC çağrılmaz', async () => {
    state.role = 'viewer';
    expect((await call(handler, body)).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('ekip dışı kullanıcı 403 alır', async () => {
    state.role = null;
    expect((await call(handler, body)).status).toBe(403);
  });

  it('geçersiz influencer id 404', async () => {
    expect((await call(handler, body, 'not-a-uuid')).status).toBe(404);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('geçersiz gövde 400', async () => {
    expect((await call(handler, { version: 'x', bio: 1 })).status).toBe(400);
    expect((await call(handler, '{bozuk')).status).toBe(400);
  });

  it('editor başarılı kayıtta 201 ve yeni versiyon numarası', async () => {
    const response = await call(handler, body);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ version: 2 });
  });

  it('veritabanı yetki reddini (42501) 403 olarak döner', async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'x' },
    });
    expect((await call(handler, body)).status).toBe(403);
  });

  it('bulunamayan kayıt (P0002) 404', async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'x' },
    });
    expect((await call(handler, body)).status).toBe(404);
  });

  it('beklenmeyen veritabanı hatasında ayrıntı sızdırmadan 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    state.rpc.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'iç ayrıntı' },
    });
    const response = await call(handler, body);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('iç ayrıntı');
    spy.mockRestore();
  });
});

describe('POST /persona', () => {
  it("versiyon numarasını veya created_by alanını RPC'ye göndermez", async () => {
    await call(save, { ...validPersona, version: 99, created_by: 'someone' });
    const [fn, args] = state.rpc.mock.calls[0]!;
    expect(fn).toBe('create_persona_version');
    expect(args).not.toHaveProperty('p_version');
    expect(args).not.toHaveProperty('created_by');
    expect(args).toMatchObject({
      p_influencer_id: ID,
      p_bio: 'Bio',
      p_change_note: 'ilk',
      p_sample_captions: [],
    });
  });
});

describe('POST /persona/restore', () => {
  it("restore_persona_version RPC'sini doğru parametrelerle çağırır", async () => {
    await call(restore, { version: 1 });
    expect(state.rpc).toHaveBeenCalledWith('restore_persona_version', {
      p_influencer_id: ID,
      p_version: 1,
      p_change_note: '',
    });
  });
});
