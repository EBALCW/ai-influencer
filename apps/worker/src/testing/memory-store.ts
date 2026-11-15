// Testler için bellek içi kasa. Üretim kodunda seçilemez: gerçek kasa yoksa program durur.
import type { CredentialStore } from '../lib/credential-store.ts';

export function createMemoryStore(
  initial: Record<string, string> = {},
): CredentialStore & { items: Map<string, string>; writes: number } {
  const items = new Map(Object.entries(initial));
  const store = {
    label: 'bellek (test)',
    items,
    writes: 0,
    available: async () => ({ ok: true }) as const,
    get: async (account: string) => items.get(account) ?? null,
    set: async (account: string, secret: string) => {
      store.writes += 1;
      items.set(account, secret);
    },
    delete: async (account: string) => {
      items.delete(account);
    },
  };
  return store;
}
