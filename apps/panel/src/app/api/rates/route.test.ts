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

function call(body: unknown) {
  return POST(
    new Request('http://127.0.0.1:3000/api/rates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
}

const exchange = {
  kind: 'exchange',
  currency: 'USD',
  baseCurrency: 'TRY',
  rate: '40.25',
  validOn: '2026-10-01',
};

beforeEach(() => {
  Object.assign(state, {
    user: { id: 'owner-1' },
    role: 'owner',
    writes: [],
    result: { data: { id: 'rate-1' }, error: null },
  });
});

describe('POST /api/rates', () => {
  it('editor oran ekleyemez (403)', async () => {
    state.role = 'editor';
    expect((await call(exchange)).status).toBe(403);
    expect(state.writes).toHaveLength(0);
  });

  it('owner kur ekler', async () => {
    expect((await call(exchange)).status).toBe(201);
    expect(state.writes[0]).toMatchObject({
      table: 'exchange_rates',
      values: { currency: 'USD', base_currency: 'TRY', rate: '40.25' },
    });
  });

  it('owner kredi fiyatı ekler', async () => {
    const response = await call({
      kind: 'credit',
      tool: 'higgsfield',
      currency: 'USD',
      rate: '0.05',
      validFrom: '2026-10-01',
    });
    expect(response.status).toBe(201);
    expect(state.writes[0]).toMatchObject({
      table: 'credit_rates',
      values: { tool: 'higgsfield', rate_per_credit: '0.05' },
    });
  });

  it('aynı para birimi 400, aynı tarih 409', async () => {
    expect((await call({ ...exchange, baseCurrency: 'USD' })).status).toBe(400);
    state.result = { data: null, error: { code: '23505', message: 'dup' } };
    expect((await call(exchange)).status).toBe(409);
  });
});
