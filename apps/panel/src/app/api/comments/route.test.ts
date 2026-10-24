// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Gelen kutusu API'si (#61): durum, yanıt kuyruğu (idempotent), yorumdan lead. Gerçek
// requireApiRole çalışır; veritabanı yanıtları tablo+işlem bazında sıralı olarak verilir.
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

type Result = {
  data: unknown;
  error: { code?: string; message: string } | null;
};
const state = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  role: 'editor' as string | null,
  responses: {} as Record<string, Result[]>,
  calls: [] as {
    table: string;
    op: string;
    values?: unknown;
    filters: unknown[][];
  }[],
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
      const call = {
        table,
        op: 'select',
        values: undefined as unknown,
        filters: [] as unknown[][],
      };
      const resolve = async (): Promise<Result> => {
        state.calls.push(call);
        if (table === 'team_members')
          return {
            data: state.role ? { role: state.role } : null,
            error: null,
          };
        return (
          state.responses[`${table}:${call.op}`]?.shift() ?? {
            data: null,
            error: null,
          }
        );
      };
      const chain: Record<string, unknown> = {};
      for (const method of ['eq', 'neq', 'is', 'in', 'ilike', 'order', 'limit'])
        chain[method] = (...args: unknown[]) => {
          call.filters.push([method, ...args]);
          return chain;
        };
      chain.select = () => chain;
      chain.maybeSingle = resolve;
      chain.single = resolve;
      chain.then = (
        ok: (r: Result) => unknown,
        fail: (e: unknown) => unknown,
      ) => resolve().then(ok, fail);
      const write = (op: string) => (values?: unknown) => {
        call.op = op;
        call.values = values;
        return chain;
      };
      return {
        select: () => chain,
        insert: write('insert'),
        update: write('update'),
        delete: write('delete'),
      };
    },
  }),
}));

const status = await import('./[id]/route');
const reply = await import('./[id]/reply/route');
const lead = await import('./[id]/lead/route');

const ID = '61000000-0000-4000-8000-000000000001';
const INF = '10000000-0000-4000-8000-000000000001';
const req = (url: string, method: string, body?: unknown) =>
  new Request(`http://127.0.0.1:3000${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body:
      body === undefined
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body),
  });
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const respond = (key: string, ...results: Result[]) => {
  state.responses[key] = results;
};
const writes = () => state.calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  state.user = { id: 'user-1' };
  state.role = 'editor';
  state.responses = {};
  state.calls = [];
});

describe('PATCH /api/comments/[id]', () => {
  const patch = (body: unknown, id = ID) =>
    status.PATCH(req(`/api/comments/${id}`, 'PATCH', body), ctx(id));

  it('oturum yok 401, viewer/ekip dışı 403; yazım yok', async () => {
    state.user = null;
    expect((await patch({ status: 'read' })).status).toBe(401);
    state.user = { id: 'viewer' };
    state.role = 'viewer';
    expect((await patch({ status: 'hidden' })).status).toBe(403);
    state.role = null;
    expect((await patch({ status: 'read' })).status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('geçersiz id/gövde 400; "replied" panelden verilemez', async () => {
    expect((await patch({ status: 'read' }, 'x')).status).toBe(400);
    expect((await patch({ status: 'replied' })).status).toBe(400);
    expect((await patch({ status: 'read', text: 'x' })).status).toBe(400);
    expect((await patch('{')).status).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it('okundu/gizli yazılır; satır yoksa 404', async () => {
    respond('comments:update', {
      data: { id: ID, status: 'hidden' },
      error: null,
    });
    const ok = await patch({ status: 'hidden' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ id: ID, status: 'hidden' });
    expect(writes()[0]).toMatchObject({
      table: 'comments',
      values: { status: 'hidden' },
    });
    expect((await patch({ status: 'read' })).status).toBe(404);
  });
});

describe('POST /api/comments/[id]/reply', () => {
  const post = (body: unknown, id = ID) =>
    reply.POST(req(`/api/comments/${id}/reply`, 'POST', body), ctx(id));
  const comment = (platform = 'youtube', commentStatus = 'new') =>
    respond('comments:select', {
      data: { id: ID, platform, status: commentStatus },
      error: null,
    });

  it('viewer 403 ve hiçbir şey kuyruğa girmez', async () => {
    state.role = 'viewer';
    expect((await post({ body: 'Teşekkürler!' })).status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('boş veya 1000 karakterden uzun yanıt 400', async () => {
    expect((await post({ body: '   ' })).status).toBe(400);
    expect((await post({ body: 'a'.repeat(1001) })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it('yorum yoksa 404, TikTok 422', async () => {
    expect((await post({ body: 'Selam' })).status).toBe(404);
    comment('tiktok');
    expect((await post({ body: 'Selam' })).status).toBe(422);
    expect(writes()).toHaveLength(0);
  });

  it('kuyruğa alır (202), yalnız comment_id + body yazar, yorumu okundu yapar', async () => {
    comment();
    respond('comment_replies:insert', {
      data: { id: 'reply-1', status: 'queued' },
      error: null,
    });
    const r = await post({ body: '  Teşekkürler!  ' });
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ id: 'reply-1', status: 'queued' });
    const [insert, read] = writes();
    expect(insert).toMatchObject({
      table: 'comment_replies',
      values: { comment_id: ID, body: 'Teşekkürler!' },
    });
    expect(Object.keys(insert!.values as object).sort()).toEqual([
      'body',
      'comment_id',
    ]);
    expect(read).toMatchObject({
      table: 'comments',
      values: { status: 'read' },
    });
  });

  it('çift tıklama: ikinci istek yeni yanıt açmaz, mevcut yanıtı 200 ile döner', async () => {
    comment('instagram', 'read');
    respond('comment_replies:insert', {
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    respond('comment_replies:select', {
      data: { id: 'reply-1', status: 'sending' },
      error: null,
    });
    const r = await post({ body: 'Teşekkürler!' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      id: 'reply-1',
      status: 'sending',
      duplicate: true,
    });
    expect(writes().filter((w) => w.op === 'insert')).toHaveLength(1);
  });

  it('RLS reddi 403; beklenmeyen hata 500 ve ayrıntı sızmaz', async () => {
    comment();
    respond('comment_replies:insert', {
      data: null,
      error: { code: '42501', message: 'rls' },
    });
    expect((await post({ body: 'x' })).status).toBe(403);
    comment();
    respond('comment_replies:insert', {
      data: null,
      error: { code: 'XX000', message: 'private detail' },
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await post({ body: 'x' });
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('private detail');
    errorLog.mockRestore();
  });
});

describe('POST /api/comments/[id]/lead', () => {
  const post = (body: unknown) =>
    lead.POST(req(`/api/comments/${ID}/lead`, 'POST', body), ctx());
  const comment = (dealId: string | null = null) =>
    respond('comments:select', {
      data: {
        id: ID,
        platform: 'instagram',
        author_name: 'uydurma.marka',
        published_at: '2026-10-21T10:00:00Z',
        brand_deal_id: dealId,
        posts: { url: 'https://example.invalid/ig/01' },
        social_accounts: { influencer_id: INF },
      },
      error: null,
    });

  it('viewer 403; marka seçimi zorunlu (biri ya da diğeri)', async () => {
    state.role = 'viewer';
    expect((await post({ brandName: 'X' })).status).toBe(403);
    state.role = 'editor';
    expect((await post({})).status).toBe(400);
    expect(
      (
        await post({
          brandName: 'X',
          brandId: '10000000-0000-4000-8000-0000000000b1',
        })
      ).status,
    ).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it('yeni markayla lead açar, yorumu deal’e bağlar; yorum metni CRM’e kopyalanmaz', async () => {
    comment();
    respond('brands:insert', { data: { id: 'brand-1' }, error: null });
    respond('brand_deals:insert', { data: { id: 'deal-1' }, error: null });
    respond('comments:update', { data: { id: ID }, error: null });
    const r = await post({ brandName: 'Örnek Marka' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ dealId: 'deal-1' });
    const [brand, deal, link] = writes();
    expect(brand).toMatchObject({
      table: 'brands',
      values: { name: 'Örnek Marka' },
    });
    expect(deal).toMatchObject({
      table: 'brand_deals',
      values: { brand_id: 'brand-1', influencer_id: INF, stage: 'lead' },
    });
    expect(String((deal!.values as { notes: string }).notes)).toContain(
      'Instagram yorumu',
    );
    expect(link).toMatchObject({
      table: 'comments',
      values: { brand_deal_id: 'deal-1' },
    });
  });

  it('aynı adlı marka varsa yeniden oluşturmaz', async () => {
    comment();
    respond('brands:select', { data: { id: 'brand-9' }, error: null });
    respond('brand_deals:insert', { data: { id: 'deal-2' }, error: null });
    expect((await post({ brandName: 'örnek marka' })).status).toBe(201);
    expect(writes().map((w) => w.table)).toEqual(['brand_deals', 'comments']);
    expect(writes()[0]).toMatchObject({ values: { brand_id: 'brand-9' } });
  });

  it('yorum zaten bir deal’e bağlıysa 409 ve dealId; yorum yoksa 404', async () => {
    comment('deal-0');
    const r = await post({ brandName: 'X' });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ dealId: 'deal-0' });
    expect((await post({ brandName: 'X' })).status).toBe(404);
    expect(writes()).toHaveLength(0);
  });
});
