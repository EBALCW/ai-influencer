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

const { PUT } = await import('./route');

const valid = {
  influencerId: null,
  month: '2026-10',
  amount: '500',
  currency: 'USD',
  warnRatio: '0.8',
};

function call(body: unknown) {
  return PUT(
    new Request('http://127.0.0.1:3000/api/budgets', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
}

beforeEach(() => {
  Object.assign(state, {
    user: { id: 'owner-1' },
    role: 'owner',
    writes: [],
    existing: null,
    result: { data: { id: 'budget-1' }, error: null },
  });
});

describe('PUT /api/budgets', () => {
  it('editor ve viewer bütçe değiştiremez (403)', async () => {
    for (const role of ['editor', 'viewer']) {
      state.role = role;
      expect((await call(valid)).status).toBe(403);
    }
    expect(state.writes).toHaveLength(0);
  });

  it('ay ayın ilk günü olarak yazılır, yoksa eklenir (201)', async () => {
    const response = await call(valid);
    expect(response.status).toBe(201);
    expect(state.writes[0]).toMatchObject({
      table: 'budgets',
      op: 'insert',
      values: { month: '2026-10-01', influencer_id: null, amount: '500' },
    });
  });

  it('varsa günceller (200)', async () => {
    state.existing = { id: 'budget-1' };
    const response = await call({ ...valid, amount: '750' });
    expect(response.status).toBe(200);
    expect(state.writes[0]).toMatchObject({
      table: 'budgets',
      op: 'update',
      values: { amount: '750' },
    });
  });

  it('geçersiz bütçe 400, yarış durumunda tekil ihlali 409', async () => {
    expect((await call({ ...valid, amount: '0' })).status).toBe(400);
    expect((await call({ ...valid, month: '2026-13' })).status).toBe(400);
    state.result = { data: null, error: { code: '23505', message: 'dup' } };
    expect((await call(valid)).status).toBe(409);
  });
});
