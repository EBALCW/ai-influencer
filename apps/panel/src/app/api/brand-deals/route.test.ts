// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSupabaseMock,
  type SupabaseMockState,
} from '../test-supabase-mock';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
const state = vi.hoisted(() => ({}) as SupabaseMockState);
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => createSupabaseMock(state),
}));

const brands = await import('../brands/route');
const brandById = await import('../brands/[id]/route');
const deals = await import('./route');
const dealById = await import('./[id]/route');
const links = await import('./[id]/content-items/route');

const DEAL = '10000000-0000-4000-8000-0000000000d1';
const BRAND = '10000000-0000-4000-8000-0000000000b1';
const INF = '10000000-0000-4000-8000-000000000001';
const CONTENT = '10000000-0000-4000-8000-0000000000c1';

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
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  Object.assign(state, {
    user: { id: 'user-1' },
    role: 'editor',
    writes: [],
    result: { data: { id: 'row-1' }, error: null },
  });
});

describe('POST /api/brands', () => {
  const valid = {
    name: 'Örnek Marka',
    website: 'https://example.invalid',
    contactEmail: '',
    notes: 'Hedef marka: kozmetik',
  };

  it('oturum yoksa 401, viewer 403; hiçbir şey yazılmaz', async () => {
    state.user = null;
    expect((await brands.POST(req('/api/brands', 'POST', valid))).status).toBe(
      401,
    );
    state.user = { id: 'user-1' };
    state.role = 'viewer';
    expect((await brands.POST(req('/api/brands', 'POST', valid))).status).toBe(
      403,
    );
    state.role = null;
    expect((await brands.POST(req('/api/brands', 'POST', valid))).status).toBe(
      403,
    );
    expect(state.writes).toHaveLength(0);
  });

  it('geçersiz girdi 400 (boş ad, javascript: site, bozuk e-posta)', async () => {
    for (const body of [
      { ...valid, name: '  ' },
      { ...valid, website: 'javascript:alert(1)' },
      { ...valid, contactEmail: 'yok' },
      '{',
    ])
      expect((await brands.POST(req('/api/brands', 'POST', body))).status).toBe(
        400,
      );
    expect(state.writes).toHaveLength(0);
  });

  it('editor kaydeder; boş e-posta null olur, created_by gönderilmez', async () => {
    const response = await brands.POST(req('/api/brands', 'POST', valid));
    expect(response.status).toBe(201);
    expect(state.writes[0]).toMatchObject({
      table: 'brands',
      op: 'insert',
      values: { name: 'Örnek Marka', contact_email: null },
    });
    expect(state.writes[0]?.values).not.toHaveProperty('created_by');
  });

  it('aynı ad 409', async () => {
    state.result = { data: null, error: { code: '23505', message: 'dup' } };
    expect((await brands.POST(req('/api/brands', 'POST', valid))).status).toBe(
      409,
    );
  });

  it('PATCH notları günceller; geçersiz id 404, viewer 403', async () => {
    const ok = await brandById.PATCH(
      req(`/api/brands/${BRAND}`, 'PATCH', { notes: 'yeni not' }),
      ctx(BRAND),
    );
    expect(ok.status).toBe(200);
    expect(state.writes[0]?.values).toEqual({ notes: 'yeni not' });
    // Gönderilmeyen alan (notes) varsayılanla ezilmez
    await brandById.PATCH(
      req(`/api/brands/${BRAND}`, 'PATCH', { contactName: 'Ayşe' }),
      ctx(BRAND),
    );
    expect(state.writes[1]?.values).toEqual({ contact_name: 'Ayşe' });
    expect(
      (
        await brandById.PATCH(
          req('/api/brands/x', 'PATCH', { notes: 'a' }),
          ctx('x'),
        )
      ).status,
    ).toBe(404);
    state.role = 'viewer';
    expect(
      (
        await brandById.PATCH(
          req(`/api/brands/${BRAND}`, 'PATCH', { notes: 'a' }),
          ctx(BRAND),
        )
      ).status,
    ).toBe(403);
  });
});

describe('POST /api/brand-deals', () => {
  const valid = {
    brandId: BRAND,
    influencerId: INF,
    fee: '1500.50',
    currency: 'TRY',
  };

  it('editor deal açar; ücret string gider, aşama lead', async () => {
    const response = await deals.POST(req('/api/brand-deals', 'POST', valid));
    expect(response.status).toBe(201);
    expect(state.writes[0]).toMatchObject({
      table: 'brand_deals',
      values: { fee: '1500.50', currency: 'TRY', stage: 'lead' },
    });
  });

  it('float ücret, 3 ondalık, bilinmeyen para birimi ve aşama 400', async () => {
    for (const body of [
      { ...valid, fee: 1500.5 },
      { ...valid, fee: '1.234' },
      { ...valid, currency: 'XYZ' },
      { ...valid, stage: 'won' },
    ])
      expect(
        (await deals.POST(req('/api/brand-deals', 'POST', body))).status,
      ).toBe(400);
    expect(state.writes).toHaveLength(0);
  });

  it('viewer 403', async () => {
    state.role = 'viewer';
    expect(
      (await deals.POST(req('/api/brand-deals', 'POST', valid))).status,
    ).toBe(403);
    expect(state.writes).toHaveLength(0);
  });
});

describe('PATCH /api/brand-deals/[id]', () => {
  const patch = (body: unknown, id = DEAL) =>
    dealById.PATCH(req(`/api/brand-deals/${id}`, 'PATCH', body), ctx(id));

  it('aşama değişikliği (pipeline) yalnız stage yazar', async () => {
    state.result = {
      data: { id: DEAL, stage: 'paid', paid_at: '2026-10-22', updated_at: 'x' },
      error: null,
    };
    const response = await patch({ stage: 'paid' });
    expect(response.status).toBe(200);
    expect(state.writes[0]?.values).toEqual({ stage: 'paid' });
    expect(await response.json()).toMatchObject({
      deal: { paid_at: '2026-10-22' },
    });
  });

  it('viewer deal düzenleyemez: 403 ve yazma yok', async () => {
    state.role = 'viewer';
    expect((await patch({ stage: 'lost' })).status).toBe(403);
    expect(state.writes).toHaveLength(0);
  });

  it('brief, teslimatlar ve ücret doğrulanır', async () => {
    expect(
      (
        await patch({
          brief: { product: 'Ürün', usageRights: '3 ay' },
          deliverables: [{ title: '1 Reels', done: true }],
          fee: null,
        })
      ).status,
    ).toBe(200);
    expect(state.writes[0]?.values).toEqual({
      brief: { product: 'Ürün', usageRights: '3 ay' },
      deliverables: [{ title: '1 Reels', done: true }],
      fee: null,
    });
    expect((await patch({ brief: { unknown: 'x' } })).status).toBe(400);
    expect((await patch({ deliverables: [{ title: '' }] })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ created_by: 'someone' })).status).toBe(400);
  });

  it('ödeme tarihi paid dışı aşamayla birlikte 400', async () => {
    expect(
      (await patch({ stage: 'delivered', paidAt: '2026-10-01' })).status,
    ).toBe(400);
    expect((await patch({ stage: 'paid', paidAt: '2026-10-01' })).status).toBe(
      200,
    );
  });

  it('bulunamayan deal 404 (geçersiz id ve 0 satır)', async () => {
    expect((await patch({ stage: 'lead' }, 'nope')).status).toBe(404);
    state.result = {
      data: null,
      error: { code: 'PGRST116', message: '0 rows' },
    };
    expect((await patch({ stage: 'lead' })).status).toBe(404);
  });
});

describe('/api/brand-deals/[id]/content-items', () => {
  const call = (method: 'POST' | 'DELETE', body: unknown) =>
    links[method](
      req(`/api/brand-deals/${DEAL}/content-items`, method, body),
      ctx(DEAL),
    );

  it('içerik bağlar ve bağlantıyı kaldırır', async () => {
    expect((await call('POST', { contentItemId: CONTENT })).status).toBe(201);
    expect(state.writes[0]).toMatchObject({
      table: 'brand_deal_content_items',
      op: 'insert',
      values: { brand_deal_id: DEAL, content_item_id: CONTENT },
    });
    expect((await call('DELETE', { contentItemId: CONTENT })).status).toBe(204);
    expect(state.writes[1]).toMatchObject({ op: 'delete' });
  });

  it('başka influencer içeriği 422, tekrar 409, viewer 403, bozuk id 400', async () => {
    state.result = { data: null, error: { code: '23514', message: 'x' } };
    expect((await call('POST', { contentItemId: CONTENT })).status).toBe(422);
    state.result = { data: null, error: { code: '23505', message: 'x' } };
    expect((await call('POST', { contentItemId: CONTENT })).status).toBe(409);
    expect((await call('POST', { contentItemId: 'x' })).status).toBe(400);
    state.role = 'viewer';
    expect((await call('DELETE', { contentItemId: CONTENT })).status).toBe(403);
  });
});
