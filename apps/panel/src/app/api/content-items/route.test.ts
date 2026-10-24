// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contentSchema } from '@/lib/content/schemas';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const state = vi.hoisted(() => ({
  user: { id: 'editor' } as { id: string } | null,
  role: 'editor' as string | null,
  error: null as { code: string; message: string; hint?: string } | null,
  existing: null as Record<string, unknown> | null,
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));
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
          maybeSingle: async () => ({
            data:
              table === 'team_members'
                ? state.role
                  ? { role: state.role }
                  : null
                : state.existing,
            error: null,
          }),
        };
        return chain;
      },
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.calls.push({ name, args });
      if (state.error) return { data: null, error: state.error };
      if (name === 'content_item_details')
        return {
          data: [
            {
              id: '10000000-0000-4000-8000-000000000002',
              warnings: [],
              asset_ids: [],
              generation_ids: [],
              posts: [],
            },
          ],
          error: null,
        };
      return {
        data: { ...state.existing, ...(args.p_values as object) },
        error: null,
      };
    },
  }),
}));
const { POST } = await import('./route');
const { PATCH } = await import('./[id]/route');
const { POST: link } = await import('./[id]/post/route');
const id = '10000000-0000-4000-8000-000000000002';
const input = contentSchema.parse({
  influencer_id: '10000000-0000-4000-8000-000000000001',
  title: 'Fikir',
});
function req(body: unknown) {
  return new Request('http://localhost/api/content-items', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id }) };
beforeEach(() => {
  state.user = { id: 'editor' };
  state.role = 'editor';
  state.error = null;
  state.calls = [];
  state.existing = {
    ...input,
    id,
    created_at: '2026-10-21T00:00:00Z',
    updated_at: '2026-10-21T00:00:00Z',
    created_by: 'editor',
  };
});

describe('içerik mutasyonları', () => {
  it('oturumsuz, viewer ve ekip dışı kullanıcılar RPC çağramaz', async () => {
    for (const role of ['viewer', null]) {
      state.role = role;
      expect((await POST(req(input))).status).toBe(403);
      expect((await PATCH(req({ stage: 'script' }), ctx)).status).toBe(403);
      expect((await link(req({ post_id: id }), ctx)).status).toBe(403);
    }
    state.user = null;
    expect((await POST(req(input))).status).toBe(401);
    expect(state.calls).toEqual([]);
  });
  it('eksik checklist ile doğrudan Planlandı PATCH isteği 422 döner', async () => {
    expect((await PATCH(req({ stage: 'scheduled' }), ctx)).status).toBe(422);
    expect(state.calls).toEqual([]);
  });
  it('düşük puanı edit’e normalize eder ve istemcinin audit alanlarını yazmaz', async () => {
    const r = await POST(
      req({
        ...input,
        stage: 'qc',
        checklist: { hookScore: 2 },
        created_by: 'spoof',
      }),
    );
    expect(r.status).toBe(201);
    expect(state.calls[0]?.args.p_values).toMatchObject({ stage: 'edit' });
    expect(state.calls[0]?.args.p_values).not.toHaveProperty('created_by');
  });
  it('v2v kaynak ve puanlayan engellerini (HINT) anlaşılır 422 mesajına çevirir', async () => {
    state.error = {
      code: '23514',
      message: 'db',
      hint: 'source_missing',
    };
    let r = await PATCH(req({ stage: 'script' }), ctx);
    expect(r.status).toBe(422);
    expect(((await r.json()) as { error: string }).error).toMatch(
      /Video-to-video içerikte kaynak bilgisi/,
    );
    state.error = { code: '23514', message: 'db', hint: 'scorer_is_producer' };
    r = await PATCH(req({ stage: 'script' }), ctx);
    expect(r.status).toBe(422);
    expect(((await r.json()) as { error: string }).error).toMatch(
      /Puanlayan kişi üreten kişiden farklı/,
    );
  });
  it('kaynak alanlarını RPC’ye taşır, üçüncü kişi kaynakta lisans ister, kontrol edeni istemciden almaz', async () => {
    const bad = await POST(
      req({ ...input, source_type: 'third_party', source_owner: '@kanal' }),
    );
    expect(bad.status).toBe(422);
    expect(state.calls).toEqual([]);
    expect((await POST(req({ ...input, source_type: 'pirated' }))).status).toBe(
      400,
    );
    const ok = await POST(
      req({
        ...input,
        source_type: 'stock',
        source_owner: 'Stok sağlayıcı',
        source_license: 'Lisans 42',
        source_checked_by: 'spoof',
        checklist_scored_by: 'spoof',
      }),
    );
    expect(ok.status).toBe(201);
    expect(state.calls[0]?.args.p_values).toMatchObject({
      source_type: 'stock',
      source_owner: 'Stok sağlayıcı',
      source_license: 'Lisans 42',
    });
    expect(state.calls[0]?.args.p_values).not.toHaveProperty(
      'source_checked_by',
    );
    expect(state.calls[0]?.args.p_values).not.toHaveProperty(
      'checklist_scored_by',
    );
  });
  it('UUID, URL ve katı PATCH gövdesi doğrulanır', async () => {
    expect(
      (await POST(req({ ...input, source_url: 'javascript:alert(1)' }))).status,
    ).toBe(400);
    expect((await PATCH(req({ created_by: id }), ctx)).status).toBe(400);
    expect(
      (
        await PATCH(req({ stage: 'script' }), {
          params: Promise.resolve({ id: 'bad' }),
        })
      ).status,
    ).toBe(404);
  });
  it('mevcut kayıt yoksa 404, eşzamanlı kayıt çakışmasında 409 döner', async () => {
    state.existing = null;
    expect((await PATCH(req({ stage: 'script' }), ctx)).status).toBe(404);
    state.existing = { ...input, id, updated_at: '2026-10-21T00:00:00Z' };
    state.error = { code: '40001', message: 'stale' };
    expect((await PATCH(req({ stage: 'script' }), ctx)).status).toBe(409);
  });
  it('medya dizileri ve optimistic-lock sürümü RPC’ye gider', async () => {
    expect(
      (
        await PATCH(
          req({ asset_ids: [id], generation_ids: [], stage: 'script' }),
          ctx,
        )
      ).status,
    ).toBe(200);
    expect(state.calls[0]).toMatchObject({
      name: 'save_content_item',
      args: {
        p_asset_ids: [id],
        p_generation_ids: [],
        p_expected_updated_at: '2026-10-21T00:00:00Z',
      },
    });
  });
  it('yalnız aşama taşırken mevcut saat dilimini, hedef hesabı ve notları korur', async () => {
    state.existing = {
      ...state.existing,
      timezone: 'America/New_York',
      notes: 'Korunacak not',
      target_account_id: id,
      scheduled_at: '2026-11-10T12:00:00Z',
    };
    expect((await PATCH(req({ stage: 'script' }), ctx)).status).toBe(200);
    expect(state.calls[0]?.args.p_values).toMatchObject({
      timezone: 'America/New_York',
      notes: 'Korunacak not',
      target_account_id: id,
      scheduled_at: '2026-11-10T12:00:00Z',
    });
  });
});
