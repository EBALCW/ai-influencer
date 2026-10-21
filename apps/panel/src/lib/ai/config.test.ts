import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { DEFAULT_AI_MODEL, getAiConfig } = await import('./config');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAiConfig', () => {
  it('anahtar yoksa null döner', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(getAiConfig()).toBeNull();
  });

  it('model tanımlı değilse varsayılanı kullanır', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_MODEL', '');
    expect(getAiConfig()).toEqual({
      apiKey: 'test-key',
      model: DEFAULT_AI_MODEL,
    });
  });

  it('ANTHROPIC_MODEL ile model değiştirilebilir', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
    expect(getAiConfig()?.model).toBe('claude-sonnet-5-5');
  });
});
