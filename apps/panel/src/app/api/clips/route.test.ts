// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

type DbError = { code: string; message: string };
type Call = { table: string; op: string; args: unknown[] };
const state = vi.hoisted(() => ({
  user: { id: 'editor' } as { id: string } | null,
  role: 'editor' as string | null,
  calls: [] as Call[],
  rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcError: null as DbError | null,
  writeError: null as DbError | null,
  missing: false,
}));

function builder(table: string) {
  let op = 'select';
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'insert', 'update', 'delete', 'eq'])
    chain[name] = (...args: unknown[]) => {
      if (['insert', 'update', 'delete'].includes(name)) op = name;
      state.calls.push({ table, op: name, args });
      return chain;
    };
  const result = () => {
    if (table === 'team_members')
      return { data: state.role ? { role: state.role } : null, error: null };
    if (state.writeError) return { data: null, error: state.writeError };
    if (state.missing)
      return { data: op === 'delete' ? [] : null, error: null };
    return { data: op === 'delete' ? [{ id: 'x' }] : { id: 'x' }, error: null };
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

const { POST: createSource } = await import('../clip-sources/route');
const { PATCH: patchSource, DELETE: deleteSource } =
  await import('../clip-sources/[id]/route');
const { POST: createClip } = await import('./route');
const { PATCH: patchClip, DELETE: deleteClip } = await import('./[id]/route');
const { POST: backlog } = await import('./[id]/backlog/route');

const id = '80000000-0000-4000-8000-000000000001';
const influencer = '10000000-0000-4000-8000-000000000001';
const ctx = { params: Promise.resolve({ id }) };
const badCtx = { params: Promise.resolve({ id: 'bad' }) };
const json = (body: unknown, method = 'POST') =>
  new Request('http://localhost/api/clips', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const writes = (table: string) =>
  state.calls.filter(
    (call) =>
      call.table === table && ['insert', 'update', 'delete'].includes(call.op),
  );
const source = {
  video_url: 'https://youtu.be/demoClip001',
  channel_name: 'Demo Kanal',
  title: 'Demo yayın',
};
const clip = {
  source_id: id,
  title: 'Demo klip',
  start_seconds: 90,
  end_seconds: 150,
};
const error = async (response: Response) =>
  ((await response.json()) as { error: string }).error;

beforeEach(() => {
  state.user = { id: 'editor' };
  state.role = 'editor';
  state.calls = [];
  state.rpc = [];
  state.rpcError = null;
  state.writeError = null;
  state.missing = false;
});

describe('klip yazma yetkisi', () => {
  it('viewer ve ekip dışı 403, oturumsuz 401; veritabanına yazılmaz', async () => {
    const all = () => [
      createSource(json(source)),
      patchSource(json({ title: 'x' }, 'PATCH'), ctx),
      deleteSource(json({}, 'DELETE'), ctx),
      createClip(json(clip)),
      patchClip(json({ status: 'approved' }, 'PATCH'), ctx),
      deleteClip(json({}, 'DELETE'), ctx),
      backlog(json({}), ctx),
    ];
    for (const role of ['viewer', null]) {
      state.role = role;
      for (const response of await Promise.all(all()))
        expect(response.status).toBe(403);
    }
    state.user = null;
    for (const response of await Promise.all(all()))
      expect(response.status).toBe(401);
    expect(writes('clip_sources')).toEqual([]);
    expect(writes('clips')).toEqual([]);
    expect(state.rpc).toEqual([]);
  });
});

describe('/api/clip-sources', () => {
  it('linki kanonik biçimde ve video id ile ekler', async () => {
    const response = await createSource(json(source));
    expect(response.status).toBe(201);
    expect(writes('clip_sources')[0]?.args[0]).toEqual({
      platform: 'youtube',
      video_id: 'demoClip001',
      video_url: 'https://www.youtube.com/watch?v=demoClip001',
      channel_name: 'Demo Kanal',
      channel_url: null,
      title: 'Demo yayın',
      duration_seconds: null,
      notes: '',
    });
  });

  it('YouTube dışı link ve istemci izin/audit alanı 400; aynı video 409', async () => {
    for (const body of [
      { ...source, video_url: 'https://example.invalid/watch?v=demoClip001' },
      { ...source, permission_status: 'granted', permission_ref: 'X' },
      { ...source, created_by: 'spoof' },
    ])
      expect((await createSource(json(body))).status).toBe(400);
    expect(writes('clip_sources')).toEqual([]);
    state.writeError = { code: '23505', message: 'duplicate key' };
    const response = await createSource(json(source));
    expect(response.status).toBe(409);
    expect(await error(response)).toBe('Bu video zaten kaynak listesinde.');
  });

  it('izin: referanssız veya e-postalı “verildi” 400, referanslı 200', async () => {
    for (const body of [
      { permission_status: 'granted' },
      { permission_status: 'granted', permission_ref: '' },
      { permission_status: 'granted', permission_ref: 'kisi@example.invalid' },
      { permission_checked_by: id },
    ])
      expect((await patchSource(json(body, 'PATCH'), ctx)).status).toBe(400);
    expect(writes('clip_sources')).toEqual([]);
    const response = await patchSource(
      json(
        { permission_status: 'granted', permission_ref: 'IZIN-2026-001' },
        'PATCH',
      ),
      ctx,
    );
    expect(response.status).toBe(200);
    expect(writes('clip_sources')[0]?.args[0]).toEqual({
      permission_status: 'granted',
      permission_ref: 'IZIN-2026-001',
    });
  });

  it('geçersiz id ve bulunamayan kayıt 404; veritabanı kuralı 422', async () => {
    expect(
      (await patchSource(json({ title: 'x' }, 'PATCH'), badCtx)).status,
    ).toBe(404);
    expect((await deleteSource(json({}, 'DELETE'), badCtx)).status).toBe(404);
    state.missing = true;
    expect((await patchSource(json({ title: 'x' }, 'PATCH'), ctx)).status).toBe(
      404,
    );
    expect((await deleteSource(json({}, 'DELETE'), ctx)).status).toBe(404);
    state.missing = false;
    expect((await deleteSource(json({}, 'DELETE'), ctx)).status).toBe(204);
    state.writeError = {
      code: '23514',
      message: 'Video süresi mevcut kliplerin bitişinden kısa olamaz.',
    };
    const response = await patchSource(
      json({ duration_seconds: 10 }, 'PATCH'),
      ctx,
    );
    expect(response.status).toBe(422);
    expect(await error(response)).toBe(
      'Video süresi mevcut kliplerin bitişinden kısa olamaz.',
    );
  });
});

describe('/api/clips', () => {
  it('klip adayını ekler; durum ve kart bağlantısı istemciden alınmaz', async () => {
    const response = await createClip(
      json({ ...clip, influencer_id: influencer, hook: ' Kanca ' }),
    );
    expect(response.status).toBe(201);
    expect(writes('clips')[0]?.args[0]).toEqual({
      ...clip,
      influencer_id: influencer,
      hook: 'Kanca',
      notes: '',
    });
    for (const body of [
      { ...clip, end_seconds: 271 },
      { ...clip, end_seconds: 90 },
      { ...clip, status: 'rendered' },
      { ...clip, content_item_id: id },
    ])
      expect((await createClip(json(body))).status).toBe(400);
    expect(writes('clips')).toHaveLength(1);
  });

  it('veritabanı aralık hatasını 422 ve anlaşılır mesajla döner', async () => {
    state.writeError = {
      code: '23514',
      message: 'Klip bitişi video süresini aşamaz.',
    };
    const response = await createClip(json(clip));
    expect(response.status).toBe(422);
    expect(await error(response)).toBe('Klip bitişi video süresini aşamaz.');
    state.writeError = {
      code: '23514',
      message:
        'new row for relation "clips" violates check constraint "clips_range_valid"',
    };
    expect(await error(await createClip(json(clip)))).toMatch(/180 sn/);
  });

  it('durum değiştirir; geçersiz durum 400, geçersiz id 404', async () => {
    expect(
      (await patchClip(json({ status: 'rejected' }, 'PATCH'), ctx)).status,
    ).toBe(200);
    expect(writes('clips')[0]?.args[0]).toEqual({ status: 'rejected' });
    expect(
      (await patchClip(json({ status: 'used' }, 'PATCH'), ctx)).status,
    ).toBe(400);
    expect(
      (await patchClip(json({ content_item_id: id }, 'PATCH'), ctx)).status,
    ).toBe(400);
    expect(
      (await patchClip(json({ status: 'approved' }, 'PATCH'), badCtx)).status,
    ).toBe(404);
    expect((await deleteClip(json({}, 'DELETE'), ctx)).status).toBe(204);
  });
});

describe('POST /api/clips/[id]/backlog', () => {
  it('RPC’yi çağırır ve içerik kartı id’sini döner', async () => {
    const response = await backlog(json({ influencer_id: influencer }), ctx);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      content_item_id: '20000000-0000-4000-8000-000000000009',
    });
    expect(state.rpc).toEqual([
      {
        name: 'push_clip_to_backlog',
        args: { p_clip_id: id, p_influencer_id: influencer },
      },
    ]);
    await backlog(json({}), ctx);
    expect(state.rpc[1]?.args).toEqual({ p_clip_id: id });
  });

  it('izinsiz kaynak 422, ikinci aktarım 409, bilinmeyen klip 404', async () => {
    state.rpcError = {
      code: '23514',
      message: 'Kaynağın izni onaylanmadan klip backlog’a aktarılamaz.',
    };
    let response = await backlog(json({}), ctx);
    expect(response.status).toBe(422);
    expect(await error(response)).toBe(
      'Kaynağın izni onaylanmadan klip backlog’a aktarılamaz.',
    );
    state.rpcError = {
      code: '23505',
      message: 'Bu klip zaten backlog’a aktarıldı.',
    };
    response = await backlog(json({}), ctx);
    expect(response.status).toBe(409);
    expect(await error(response)).toBe('Bu klip zaten backlog’a aktarıldı.');
    state.rpcError = { code: 'P0002', message: 'Klip bulunamadı.' };
    expect((await backlog(json({}), ctx)).status).toBe(404);
    state.rpcError = { code: '22023', message: 'Klip için influencer seçin.' };
    expect((await backlog(json({}), ctx)).status).toBe(422);
    expect((await backlog(json({}), badCtx)).status).toBe(404);
    expect((await backlog(json({ title: 'x' }), ctx)).status).toBe(400);
  });
});
