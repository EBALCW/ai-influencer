// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

type DbError = { code: string; message: string; hint?: string };
const state = vi.hoisted(() => ({
  user: { id: 'editor' } as { id: string } | null,
  role: 'editor' as string | null,
  rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcError: null as DbError | null,
  /** `.from(tablo)…maybeSingle()` yanıtları */
  rows: {} as Record<string, unknown>,
}));

function builder(table: string) {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'order', 'limit'])
    chain[name] = () => chain;
  chain.maybeSingle = async () =>
    table === 'team_members'
      ? {
          data: state.role ? { role: state.role, workspace_id: 'ws' } : null,
          error: null,
        }
      : { data: state.rows[table] ?? null, error: null };
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
        : { data: { id: 'row' }, error: null };
    },
  }),
}));

const series = await import('./series/route');
const seriesItem = await import('./series/[id]/route');
const topicRequests = await import('./topic-requests/route');
const suggestions = await import('./topic-requests/[id]/suggestions/route');
const pick = await import('./suggestions/[id]/pick/route');
const reject = await import('./suggestions/[id]/reject/route');
const episodes = await import('./episodes/route');
const move = await import('./episodes/[id]/move/route');
const script = await import('./episodes/[id]/script/route');
const approve = await import('./episodes/[id]/approve/route');
const jobs = await import('./episodes/[id]/jobs/route');
const cancel = await import('./episodes/[id]/jobs/[jobId]/cancel/route');
const similar = await import('./similar/route');

const id = 'd2160000-0000-4000-8000-000000000001';
const other = 'd2160000-0000-4000-8000-000000000002';
const ctx = { params: Promise.resolve({ id }) };
const badCtx = { params: Promise.resolve({ id: 'bad' }) };
const json = (body: unknown, method = 'POST') =>
  new Request('http://localhost/api/explainers', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const body = async (response: Response) =>
  (await response.json()) as { error?: string; code?: string };

beforeEach(() => {
  state.user = { id: 'editor' };
  state.role = 'editor';
  state.rpc = [];
  state.rpcError = null;
  state.rows = {};
});

describe('yetki', () => {
  const writes: Array<[string, () => Promise<Response>]> = [
    ['seri', () => series.POST(json({ name: 'Seri' }))],
    ['seri düzenleme', () => seriesItem.PATCH(json({ name: 'X' }), ctx)],
    ['istek', () => topicRequests.POST(json({ prompt: 'Havacılık' }))],
    [
      'öneri',
      () =>
        suggestions.POST(
          json({ suggestions: [{ title: 'A', kind: 'event' }] }),
          ctx,
        ),
    ],
    ['seçim', () => pick.POST(json({}), ctx)],
    ['eleme', () => reject.POST(json({}), ctx)],
    ['bölüm', () => episodes.POST(json({ title: 'A', kind: 'event' }))],
    ['taşıma', () => move.POST(json({ series_id: null }), ctx)],
    ['senaryo', () => script.PUT(json({ script_text: 'x' }, 'PUT'), ctx)],
    ['onay', () => approve.POST(json({ script_version: 1 }), ctx)],
    ['üretim', () => jobs.POST(json({ kind: 'explainer.render' }), ctx)],
    [
      'iptal',
      () =>
        cancel.POST(json({}), {
          params: Promise.resolve({ id, jobId: other }),
        }),
    ],
  ];

  it.each(writes)('viewer %s yazamaz (403), RPC çağrılmaz', async (_, call) => {
    state.role = 'viewer';
    expect((await call()).status).toBe(403);
    expect(state.rpc).toEqual([]);
  });

  it.each(writes)('oturumsuz %s isteği 401', async (_, call) => {
    state.user = null;
    expect((await call()).status).toBe(401);
    expect(state.rpc).toEqual([]);
  });

  it('viewer benzer konuları ve güncel senaryoyu okuyabilir', async () => {
    state.role = 'viewer';
    const response = await similar.GET(
      new Request('http://localhost/api/explainers/similar?title=Plan%C3%B6r'),
    );
    expect(response.status).toBe(200);
    expect(state.rpc[0]).toEqual({
      name: 'find_similar_topics',
      args: { p_title: 'Planör', p_limit: 5 },
    });
    state.rows.episodes = { id, script_version: 3 };
    expect((await script.GET(json({}), ctx)).status).toBe(200);
  });
});

describe('girdi doğrulama', () => {
  it('çalışma alanı ya da onay alanı gönderilemez (bilinmeyen alan 400)', async () => {
    for (const call of [
      () => series.POST(json({ name: 'Seri', workspace_id: other })),
      () =>
        episodes.POST(
          json({ title: 'A', kind: 'event', script_approved_by: other }),
        ),
      () =>
        script.PUT(
          json({ script_text: 'x', script_approved_at: 'now' }, 'PUT'),
          ctx,
        ),
      () => approve.POST(json({ script_version: 1, approved_by: other }), ctx),
      () =>
        jobs.POST(
          json({ kind: 'explainer.render', required_capabilities: [] }),
          ctx,
        ),
    ]) {
      expect((await call()).status).toBe(400);
    }
    expect(state.rpc).toEqual([]);
  });

  it('http(s) olmayan kaynak adresi reddedilir', async () => {
    const response = await script.PUT(
      json(
        {
          script_text: 'x',
          fact_notes: [
            { claim: 'İddia', sources: [{ url: 'javascript:alert(1)' }] },
          ],
        },
        'PUT',
      ),
      ctx,
    );
    expect(response.status).toBe(400);
    const added = await suggestions.POST(
      json({
        suggestions: [
          {
            title: 'A',
            kind: 'event',
            source_candidates: [{ url: 'data:text/html,x' }],
          },
        ],
      }),
      ctx,
    );
    expect(added.status).toBe(400);
    expect(state.rpc).toEqual([]);
  });

  it('uuid olmayan kimlik 404 döner', async () => {
    expect((await pick.POST(json({}), badCtx)).status).toBe(404);
    expect(
      (await script.PUT(json({ script_text: 'x' }, 'PUT'), badCtx)).status,
    ).toBe(404);
    expect(state.rpc).toEqual([]);
  });
});

describe('RPC çağrıları', () => {
  it('seri: ad ve ayarlar; çalışma alanı argümanı yok', async () => {
    const response = await series.POST(
      json({ name: ' Nasıl Çalışır ', settings: { visual_route: 'skia' } }),
    );
    expect(response.status).toBe(201);
    expect(state.rpc).toEqual([
      {
        name: 'create_series',
        args: { p_name: 'Nasıl Çalışır', p_settings: { visual_route: 'skia' } },
      },
    ]);
  });

  it('tekil video seri argümanı olmadan açılır', async () => {
    await episodes.POST(json({ title: 'Planör', kind: 'how_it_works' }));
    expect(state.rpc[0]).toEqual({
      name: 'create_episode',
      args: { p_title: 'Planör', p_kind: 'how_it_works' },
    });
  });

  it('seri dışına taşıma: seri argümanı gönderilmez', async () => {
    await move.POST(json({ series_id: null }), ctx);
    expect(state.rpc[0]?.args).toEqual({ p_episode_id: id });
    await move.POST(json({ series_id: other }), ctx);
    expect(state.rpc[1]?.args).toEqual({
      p_episode_id: id,
      p_series_id: other,
    });
  });

  it('senaryo kaydı iyimser kilit sürümünü taşır', async () => {
    await script.PUT(
      json(
        {
          script_text: 'Metin',
          fact_notes: [],
          sensitivity_flags: ['real_event'],
          sensitivity_note: '',
          expected_version: 4,
        },
        'PUT',
      ),
      ctx,
    );
    expect(state.rpc[0]).toEqual({
      name: 'save_episode_script',
      args: {
        p_episode_id: id,
        p_script_text: 'Metin',
        p_fact_notes: [],
        p_sensitivity_flags: ['real_event'],
        p_sensitivity_note: '',
        p_expected_version: 4,
      },
    });
  });

  it('script: null yapılandırılmış senaryoyu açık bayrakla temizler; nesne ise yazar', async () => {
    await script.PUT(
      json({ script_text: 'Metin', script: null, expected_version: 4 }, 'PUT'),
      ctx,
    );
    expect(state.rpc[0]).toEqual({
      name: 'save_episode_script',
      args: {
        p_episode_id: id,
        p_script_text: 'Metin',
        p_clear_script: true,
        p_expected_version: 4,
      },
    });
    await script.PUT(
      json({ script_text: 'Metin', script: { scenes: [] } }, 'PUT'),
      ctx,
    );
    expect(state.rpc[1]).toEqual({
      name: 'save_episode_script',
      args: {
        p_episode_id: id,
        p_script_text: 'Metin',
        p_script: { scenes: [] },
      },
    });
  });

  it('çakışma 409 ve istemci koduyla döner; ham mesaj gitmez', async () => {
    state.rpcError = {
      code: '55000',
      hint: 'version_conflict',
      message: 'Senaryo bu arada değişti (sürüm 5).',
    };
    const response = await script.PUT(
      json({ script_text: 'x', expected_version: 4 }, 'PUT'),
      ctx,
    );
    expect(response.status).toBe(409);
    expect(await body(response)).toEqual({
      code: 'version_conflict',
      error: expect.stringMatching(/başka biri değiştirdi/),
    });
  });

  it('onay: okunan sürüm ve eksik kabulü; onaylayan istekten alınmaz', async () => {
    await approve.POST(
      json({ script_version: 3, acknowledge_fact_gaps: true }),
      ctx,
    );
    expect(state.rpc[0]).toEqual({
      name: 'approve_episode_script',
      args: {
        p_episode_id: id,
        p_script_version: 3,
        p_acknowledge_fact_gaps: true,
      },
    });
    state.rpcError = { code: '23514', hint: 'fact_gaps', message: 'x' };
    const refused = await approve.POST(json({ script_version: 3 }), ctx);
    expect(refused.status).toBe(422);
    expect((await body(refused)).code).toBe('fact_gaps');
  });

  it('ham kısıt hatası kullanıcıya gösterilmez', async () => {
    state.rpcError = {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "series_workspace_name_key"',
    };
    const response = await series.POST(json({ name: 'Seri' }));
    expect(response.status).toBe(409);
    expect(await body(response)).toEqual({
      error: 'Bu adda bir seri zaten var.',
    });
  });
});

describe('üretime gönder', () => {
  it('yetenekleri bölümün yolundan (yoksa seriden) sunucuda hesaplar', async () => {
    state.rows.episodes = {
      visual_route: null,
      series: { visual_route: 'hyperframes' },
    };
    const response = await jobs.POST(json({ kind: 'explainer.render' }), ctx);
    expect(response.status).toBe(201);
    expect(state.rpc).toEqual([
      {
        name: 'enqueue_episode_job',
        args: {
          p_episode_id: id,
          p_kind: 'explainer.render',
          p_required_capabilities: [
            'voice.edge-tts',
            'captions.burn',
            'render.hyperframes',
          ],
        },
      },
    ]);
  });

  it('kısmi üretim stop_at ile gider', async () => {
    state.rows.episodes = { visual_route: 'skia', series: null };
    await jobs.POST(json({ kind: 'explainer.render', stop_at: 'voice' }), ctx);
    expect(state.rpc[0]?.args).toMatchObject({
      p_stop_at: 'voice',
      p_required_capabilities: ['voice.edge-tts'],
    });
  });

  it.each([
    ['ön hazırlık türü', { kind: 'explainer.script' }, 400],
    ['başka modülün türü', { kind: 'clip.cut' }, 400],
    ['bilinmeyen aşama', { kind: 'explainer.render', stop_at: 'yok' }, 400],
  ])('%s reddedilir', async (_, payload, status) => {
    state.rows.episodes = { visual_route: 'skia', series: null };
    expect((await jobs.POST(json(payload), ctx)).status).toBe(status);
    expect(state.rpc).toEqual([]);
  });

  it('yol seçilmemişse ya da üretim aşaması yoksa 422', async () => {
    state.rows.episodes = { visual_route: null, series: null };
    const none = await jobs.POST(json({ kind: 'explainer.render' }), ctx);
    expect(none.status).toBe(422);
    expect((await body(none)).error).toMatch(/görsel yolu seçin/);
    state.rows.episodes = { visual_route: 'stock', series: null };
    expect(
      (await jobs.POST(json({ kind: 'explainer.render' }), ctx)).status,
    ).toBe(422);
    expect(state.rpc).toEqual([]);
  });

  it('onaysız senaryoda veritabanı reddi 409 olarak döner', async () => {
    state.rows.episodes = { visual_route: 'skia', series: null };
    state.rpcError = {
      code: '42501',
      hint: 'script_approval_required',
      message: 'Senaryo onaylanmadan üretim başlatılamaz.',
    };
    const response = await jobs.POST(json({ kind: 'explainer.render' }), ctx);
    expect(response.status).toBe(409);
  });

  it('iptal: iş bu bölüme ait değilse 404, RPC çağrılmaz', async () => {
    const params = { params: Promise.resolve({ id, jobId: other }) };
    expect((await cancel.POST(json({}), params)).status).toBe(404);
    expect(state.rpc).toEqual([]);
    state.rows.jobs = { id: other };
    expect((await cancel.POST(json({}), params)).status).toBe(200);
    expect(state.rpc[0]).toEqual({
      name: 'request_cancel_job',
      args: { p_job_id: other },
    });
  });
});
