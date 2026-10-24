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

const postId = '30000000-0000-4000-8000-000000000001';
const valid = { body: 'Soru kancası ilk saatte iyi çalıştı.', postId };

function call(body: unknown) {
  return POST(
    new Request('http://127.0.0.1:3000/api/learnings', {
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
    result: { data: { id: 'learning-1', body: valid.body }, error: null },
  });
});

describe('POST /api/learnings', () => {
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

  it('boş metin, bağlamsız not ve bozuk JSON 400', async () => {
    expect((await call({ ...valid, body: '   ' })).status).toBe(400);
    expect((await call({ body: 'not' })).status).toBe(400);
    expect((await call({ ...valid, postId: 'abc' })).status).toBe(400);
    expect((await call('{')).status).toBe(400);
    expect(state.writes).toHaveLength(0);
  });

  it('editor kaydeder; metin kırpılır, created_by gönderilmez', async () => {
    const response = await call({ ...valid, body: `  ${valid.body}  ` });
    expect(response.status).toBe(201);
    expect(state.writes[0]).toMatchObject({
      table: 'learnings',
      op: 'insert',
      values: {
        body: valid.body,
        post_id: postId,
        influencer_id: null,
        tags: [],
      },
    });
    expect(state.writes[0]?.values).not.toHaveProperty('created_by');
  });

  it('RLS reddi 403, eksik post 400, başka influencer 422', async () => {
    state.result = { data: null, error: { code: '42501', message: 'rls' } };
    expect((await call(valid)).status).toBe(403);
    state.result = { data: null, error: { code: '23503', message: 'fk' } };
    expect((await call(valid)).status).toBe(400);
    state.result = { data: null, error: { code: '23514', message: 'check' } };
    expect((await call(valid)).status).toBe(422);
  });
});
