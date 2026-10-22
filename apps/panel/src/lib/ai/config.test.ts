import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.data, error: state.error }),
        }),
      }),
    }),
  }),
}));
const { getAiConfig, readAiSettings } = await import('./config');
const config = {
  model: 'claude-fixture',
  pricing: {
    currency: 'USD',
    inputPerMTok: '4',
    outputPerMTok: '20',
    cacheReadPerMTok: '0.2',
    cacheWritePerMTok: '5',
    cacheWrite1hPerMTok: '8',
  },
};
beforeEach(() => {
  state.data = { value: config };
  state.error = null;
  vi.stubEnv('ANTHROPIC_API_KEY', 'fixture-key');
});
afterEach(() => vi.unstubAllEnvs());
describe('AI config', () => {
  it('anahtar yoksa null', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(await getAiConfig()).toBeNull();
  });
  it('model ve fiyat ayarlardan gelir; env modelini kullanmaz', async () => {
    vi.stubEnv('ANTHROPIC_MODEL', 'ignored-model');
    expect(await getAiConfig()).toEqual({ ...config, apiKey: 'fixture-key' });
  });
  it('boş veya geçersiz ayarda sabit modele dönmez', async () => {
    state.data = null;
    expect(await getAiConfig()).toBeNull();
    state.data = { value: { model: 'x' } };
    expect(await readAiSettings()).toBeNull();
  });
  it('DB hatası yutulmaz ve iç hata gösterilmez', async () => {
    state.error = { message: 'private details' };
    await expect(readAiSettings()).rejects.toThrow('AI ayarları okunamadı.');
  });
});
