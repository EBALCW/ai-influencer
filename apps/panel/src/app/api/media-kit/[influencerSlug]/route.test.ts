// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSupabaseMock,
  type SupabaseMockState,
} from '../../test-supabase-mock';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({}) as SupabaseMockState);
const loadInput = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => createSupabaseMock(state),
}));
vi.mock('@/lib/media-kit/queries', () => ({ loadMediaKitInput: loadInput }));

const { GET } = await import('./route');

const call = (slug: string) =>
  GET(new Request(`http://127.0.0.1:3000/api/media-kit/${slug}`), {
    params: Promise.resolve({ influencerSlug: slug }),
  });

beforeEach(() => {
  Object.assign(state, {
    user: { id: 'user-1' },
    role: 'viewer',
    writes: [],
    result: { data: null, error: null },
  });
  loadInput.mockReset();
  loadInput.mockResolvedValue({
    asOf: '2026-10-20T00:00:00.000Z',
    influencer: {
      name: 'Demo Creator',
      slug: 'demo-creator',
      niche: null,
      bio: null,
    },
    accounts: [],
    accountSnapshots: [],
    posts: [],
    metricSnapshots: [],
  });
});

describe('GET /api/media-kit/[influencerSlug]', () => {
  it('viewer PDF indirebilir (200, application/pdf, ek olarak)', async () => {
    const response = await call('demo-creator');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="medya-kiti-demo-creator-\d{4}-\d{2}-\d{2}\.pdf"$/,
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(loadInput).toHaveBeenCalledWith('demo-creator', expect.any(Date));
  });

  it('oturum yoksa 401, ekip dışıysa 403; veri okunmaz', async () => {
    state.user = null;
    expect((await call('demo-creator')).status).toBe(401);
    state.user = { id: 'user-2' };
    state.role = null;
    expect((await call('demo-creator')).status).toBe(403);
    expect(loadInput).not.toHaveBeenCalled();
  });

  it('bilinmeyen veya bozuk slug 404 (dosya adına enjeksiyon yok)', async () => {
    loadInput.mockResolvedValue(null);
    expect((await call('yok')).status).toBe(404);
    expect((await call('a"b')).status).toBe(404);
    expect((await call('../x')).status).toBe(404);
  });
});
