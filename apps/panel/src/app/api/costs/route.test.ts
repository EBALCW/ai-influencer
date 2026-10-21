// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import {
  createSupabaseMock,
  type SupabaseMockState,
} from '../test-supabase-mock';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({}) as SupabaseMockState);
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => createSupabaseMock(state),
}));

const { POST } = await import('./route');

const valid = {
  influencerId: '10000000-0000-4000-8000-000000000001',
  category: 'subscription',
  description: 'Higgsfield aylık',
  amount: '19.99',
  currency: 'USD',
  incurredOn: '2026-10-01',
};

function call(body: unknown) {
  return POST(
    new Request('http://127.0.0.1:3000/api/costs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );
}

beforeEach(() => {
  Object.assign(state, {
    user: { id: 'user-1' },
    role: 'editor',
    writes: [],
    result: { data: { id: 'cost-1' }, error: null },
  });
});

describe('POST /api/costs', () => {
  it('oturum yoksa 401', async () => {
    state.user = null;
    expect((await call(valid)).status).toBe(401);
    expect(state.writes).toHaveLength(0);
  });

  it('viewer 403 alır ve hiçbir şey yazılmaz', async () => {
    state.role = 'viewer';
    expect((await call(valid)).status).toBe(403);
    expect(state.writes).toHaveLength(0);
  });

  it('geçersiz gövde 400 (float tutar, bilinmeyen kategori, bozuk JSON)', async () => {
    expect((await call({ ...valid, amount: 19.99 })).status).toBe(400);
    expect((await call({ ...valid, category: 'gift' })).status).toBe(400);
    expect((await call('{')).status).toBe(400);
    expect(state.writes).toHaveLength(0);
  });

  it('editor kaydeder; tutar string olarak gider, created_by gönderilmez', async () => {
    const response = await call(valid);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'cost-1' });
    expect(state.writes[0]).toMatchObject({
      table: 'costs',
      op: 'insert',
      values: { amount: '19.99', currency: 'USD', category: 'subscription' },
    });
    expect(state.writes[0]?.values).not.toHaveProperty('created_by');
  });

  it('RLS reddi 403, eksik influencer 400 olur', async () => {
    state.result = { data: null, error: { code: '42501', message: 'rls' } };
    expect((await call(valid)).status).toBe(403);
    state.result = { data: null, error: { code: '23503', message: 'fk' } };
    expect((await call(valid)).status).toBe(400);
  });
});
