// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const state = vi.hoisted(() => ({
  user: { id: 'editor' } as { id: string } | null,
  role: 'editor' as string | null,
  error: null as { code: string; message: string; hint?: string } | null,
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
    from: () => ({
      select: () => {
        const chain = {
          eq: () => chain,
          maybeSingle: async () => ({
            data: state.role ? { role: state.role } : null,
            error: null,
          }),
        };
        return chain;
      },
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.calls.push({ name, args });
      if (state.error) return { data: null, error: state.error };
      return { data: '20000000-0000-4000-8000-000000000009', error: null };
    },
  }),
}));
const { POST: publish } = await import('./route');
const { POST: cancel } =
  await import('../../../publish-jobs/[id]/cancel/route');

const id = '10000000-0000-4000-8000-000000000002';
const ctx = { params: Promise.resolve({ id }) };
function req(body: unknown) {
  return new Request(`http://localhost/api/content-items/${id}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const now = {
  mode: 'now',
  title: 'Sabah rutini',
  caption: 'Merhaba',
  tags: ['ai'],
};

beforeEach(() => {
  state.user = { id: 'editor' };
  state.role = 'editor';
  state.error = null;
  state.calls = [];
});

describe('POST /api/content-items/[id]/publish', () => {
  it('oturumsuz, viewer ve ekip dışı kullanıcı iş açamaz', async () => {
    for (const role of ['viewer', null]) {
      state.role = role;
      expect((await publish(req(now), ctx)).status).toBe(403);
      expect((await cancel(req({}), ctx)).status).toBe(403);
    }
    state.user = null;
    expect((await publish(req(now), ctx)).status).toBe(401);
    expect(state.calls).toEqual([]);
  });

  it('şimdi yayınla yalnız iş açar (sağlayıcı çağrısı yok) ve 201 döner', async () => {
    const r = await publish(req(now), ctx);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({
      job_id: '20000000-0000-4000-8000-000000000009',
    });
    expect(state.calls).toEqual([
      {
        name: 'enqueue_publish_job',
        args: {
          p_content_id: id,
          p_title: 'Sabah rutini',
          p_caption: 'Merhaba',
          p_tags: ['ai'],
        },
      },
    ]);
  });

  it('planla yayın zamanını UTC olarak iletir; geçmiş zaman 422', async () => {
    const at = new Date(Date.now() + 3_600_000).toISOString();
    expect(
      (await publish(req({ ...now, mode: 'schedule', scheduled_at: at }), ctx))
        .status,
    ).toBe(201);
    expect(state.calls[0]?.args.p_scheduled_for).toBe(at);
    state.calls = [];
    const past = await publish(
      req({ ...now, mode: 'schedule', scheduled_at: '2020-01-01T00:00:00Z' }),
      ctx,
    );
    expect(past.status).toBe(422);
    expect(state.calls).toEqual([]);
  });

  it('check-list veya AI etiketi eksikse 422 ve anlaşılır mesaj', async () => {
    state.error = { code: '23514', message: 'x', hint: 'checklist_incomplete' };
    const r = await publish(req(now), ctx);
    expect(r.status).toBe(422);
    expect((await r.json()).error).toContain('kontrol listesi');
    state.error = { code: '23514', message: 'x', hint: 'ai_label_missing' };
    expect((await (await publish(req(now), ctx)).json()).error).toContain(
      'AI etiketi',
    );
    state.error = { code: '23514', message: 'x', hint: 'no_final_video' };
    expect((await publish(req(now), ctx)).status).toBe(422);
    state.error = {
      code: '23514',
      message: 'x',
      hint: 'account_not_connected',
    };
    expect((await publish(req(now), ctx)).status).toBe(422);
  });

  it('aynı içerik için ikinci iş 409', async () => {
    state.error = { code: '23505', message: 'dup', hint: 'already_queued' };
    expect((await publish(req(now), ctx)).status).toBe(409);
    state.error = { code: '23505', message: 'dup', hint: 'already_published' };
    expect((await (await publish(req(now), ctx)).json()).error).toBe(
      'İçerik zaten yayında.',
    );
  });

  it('gövde katı doğrulanır: bilinmeyen alan, eksik zaman, kötü etiket, kötü id', async () => {
    expect(
      (await publish(req({ ...now, status: 'published' }), ctx)).status,
    ).toBe(400);
    expect((await publish(req({ ...now, mode: 'schedule' }), ctx)).status).toBe(
      400,
    );
    expect(
      (await publish(req({ ...now, tags: ['<script>'] }), ctx)).status,
    ).toBe(400);
    expect((await publish(req({ ...now, title: '' }), ctx)).status).toBe(400);
    expect(
      (await publish(req({ ...now, title: 'x'.repeat(101) }), ctx)).status,
    ).toBe(400);
    expect(
      (await publish(req(now), { params: Promise.resolve({ id: 'bad' }) }))
        .status,
    ).toBe(404);
    expect(state.calls).toEqual([]);
  });
});

describe('POST /api/publish-jobs/[id]/cancel', () => {
  it('kuyruktaki işi iptal eder; işlenen iş 409, bilinmeyen 404', async () => {
    expect((await cancel(req({}), ctx)).status).toBe(200);
    expect(state.calls[0]).toEqual({
      name: 'cancel_publish_job',
      args: { p_id: id },
    });
    state.error = { code: '55000', message: 'no' };
    expect((await cancel(req({}), ctx)).status).toBe(409);
    state.error = { code: 'P0002', message: 'no' };
    expect((await cancel(req({}), ctx)).status).toBe(404);
    expect(
      (await cancel(req({}), { params: Promise.resolve({ id: 'bad' }) }))
        .status,
    ).toBe(404);
  });
});
