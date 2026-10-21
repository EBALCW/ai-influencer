// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

type DbResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: null as string | null,
  /** `.from(table)` okuma/yazma sonucu (team_members hariç) */
  rows: {} as Record<string, DbResult>,
  writes: [] as Array<{ table: string; op: string; values: unknown }>,
  rpc: vi.fn(),
}));

// Gerçek requireApiRole çalışsın; sadece Supabase istemcisi sahte
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => {
    const result = (table: string): DbResult =>
      table === 'team_members'
        ? { data: state.role ? { role: state.role } : null, error: null }
        : (state.rows[table] ?? { data: null, error: null });
    const chain = (table: string) => {
      const c = {
        eq: () => c,
        order: () => c,
        limit: () => c,
        select: () => c,
        single: async () => result(table),
        maybeSingle: async () => result(table),
      };
      return c;
    };
    return {
      auth: {
        getUser: async () => ({
          data: { user: state.user },
          error: state.user ? null : new Error('no session'),
        }),
      },
      from: (table: string) => ({
        select: () => chain(table),
        insert: (values: unknown) => {
          state.writes.push({ table, op: 'insert', values });
          return chain(table);
        },
        update: (values: unknown) => {
          state.writes.push({ table, op: 'update', values });
          return chain(table);
        },
      }),
      rpc: state.rpc,
    };
  },
}));

const { POST: createDraft } = await import('./route');
const { PATCH: updateDraft } = await import('./[id]/draft/route');
const { POST: savePersona } = await import('./[id]/wizard-persona/route');
const { POST: savePrompt } = await import('./[id]/character-prompt/route');
const { POST: completeWizard } = await import('./[id]/complete-wizard/route');

const ID = '10000000-0000-4000-8000-000000000001';
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

const draftBody = {
  name: 'Deniz',
  slug: 'deniz',
  niche: 'moda',
  language: 'tr',
};
const personaBody = {
  bio: 'Hikâye',
  tone: 'samimi',
  adjectives: ['meraklı'],
  hookTraits: [],
  sampleCaptions: [],
  audience: { ageRange: '', interests: [], description: 'Moda izleyicileri' },
  appearance: {
    hair: '',
    skin: '',
    eyes: '',
    face: '',
    body: '',
    signature: '',
  },
  changeNote: '',
};

beforeEach(() => {
  state.user = { id: 'user-1' };
  state.role = 'editor';
  state.rows = {};
  state.writes = [];
  state.rpc.mockReset();
});

describe('wizard API yetkisi', () => {
  const calls = [
    ['taslak oluşturma', () => createDraft(req(draftBody))],
    ['taslak güncelleme', () => updateDraft(req(draftBody), ctx())],
    ['persona kaydı', () => savePersona(req(personaBody), ctx())],
    ['karakter prompt’u', () => savePrompt(req({ body: 'prompt' }), ctx())],
    ['tamamlama', () => completeWizard(req({}), ctx())],
  ] as const;

  it.each(calls)('%s oturumsuz 401 döner', async (_name, call) => {
    state.user = null;
    expect((await call()).status).toBe(401);
  });

  it.each(calls)('%s viewer için 403 döner ve yazmaz', async (_name, call) => {
    state.role = 'viewer';
    expect((await call()).status).toBe(403);
    expect(state.writes).toHaveLength(0);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});

describe('POST /api/influencers', () => {
  it('geçersiz slug için 400 döner', async () => {
    const res = await createDraft(req({ ...draftBody, slug: 'Büyük Harf' }));
    expect(res.status).toBe(400);
    expect(state.writes).toHaveLength(0);
  });

  it('slug çakışmasında 409 döner', async () => {
    state.rows.influencers = {
      data: null,
      error: { code: '23505', message: 'dup' },
    };
    expect((await createDraft(req(draftBody))).status).toBe(409);
  });

  it('taslağı draft durumunda oluşturur', async () => {
    state.rows.influencers = { data: { id: ID, slug: 'deniz' }, error: null };
    expect((await createDraft(req(draftBody))).status).toBe(201);
    expect(state.writes[0]).toMatchObject({
      table: 'influencers',
      op: 'insert',
      values: { slug: 'deniz', status: 'draft' },
    });
  });
});

describe('PATCH /api/influencers/[id]/draft', () => {
  it('geçersiz id için 404 döner', async () => {
    expect((await updateDraft(req(draftBody), ctx('abc'))).status).toBe(404);
  });

  it('taslak olmayan kayıt için 404 döner', async () => {
    state.rows.influencers = { data: null, error: null };
    expect((await updateDraft(req(draftBody), ctx())).status).toBe(404);
  });
});

describe('POST /api/influencers/[id]/wizard-persona', () => {
  it('zorunlu alanlar boşsa 400 döner', async () => {
    const res = await savePersona(req({ ...personaBody, tone: '' }), ctx());
    expect(res.status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('versiyonu create_persona_version ile oluşturur', async () => {
    state.rows.influencers = { data: { slug: 'deniz' }, error: null };
    state.rpc.mockResolvedValue({ data: { version: 1 }, error: null });
    expect((await savePersona(req(personaBody), ctx())).status).toBe(201);
    expect(state.rpc).toHaveBeenCalledWith(
      'create_persona_version',
      expect.objectContaining({ p_influencer_id: ID }),
    );
    expect(state.writes).toHaveLength(0);
  });
});

describe('POST /api/influencers/[id]/character-prompt', () => {
  it('prompt kütüphanesine character soyu olarak RPC ile kaydeder', async () => {
    state.rows.influencers = { data: { id: ID, name: 'Deniz' }, error: null };
    state.rpc.mockResolvedValue({ data: { version: 2 }, error: null });
    const res = await savePrompt(req({ body: 'Deniz adlı karakter' }), ctx());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ version: 2 });
    expect(state.rpc).toHaveBeenCalledWith(
      'create_prompt_version',
      expect.objectContaining({
        p_category: 'character',
        p_key: 'character',
        p_title: 'Deniz · karakter prompt’u',
        p_influencer_id: ID,
      }),
    );
    // Versiyon istemcide hesaplanıp doğrudan insert edilmez
    expect(state.writes).toHaveLength(0);
  });

  it('taslak değilse 404 döner', async () => {
    state.rows.influencers = { data: null, error: null };
    expect((await savePrompt(req({ body: 'x' }), ctx())).status).toBe(404);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('boş prompt için 400 döner', async () => {
    expect((await savePrompt(req({ body: '  ' }), ctx())).status).toBe(400);
  });
});

describe('POST /api/influencers/[id]/complete-wizard', () => {
  it('avatar seçilmemişse 400 döner', async () => {
    state.rows.influencers = {
      data: { slug: 'deniz', avatar_asset_id: null },
      error: null,
    };
    expect((await completeWizard(req({}), ctx())).status).toBe(400);
  });
});
