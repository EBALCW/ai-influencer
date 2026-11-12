import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
import { createOAuthStateStore } from './store';
import type { createSupabaseAdminClient } from '../supabase/admin';
const value = {
  userId: '11111111-1111-4111-8111-111111111111',
  influencerId: '22222222-2222-4222-8222-222222222222',
  platform: 'youtube' as const,
  verifier: 'v'.repeat(43),
  expiresAt: 600000,
};
function setup(data: unknown = value, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const store = createOAuthStateStore({ rpc } as unknown as ReturnType<
    typeof createSupabaseAdminClient
  >);
  return { rpc, store };
}
describe('OAuth RPC deposu', () => {
  it('hash ve bağlam ile yazar; expiry ISO gönderilir', async () => {
    const { store, rpc } = setup();
    await store.save('hash', value);
    expect(rpc).toHaveBeenCalledWith('oauth_state_save', {
      p_hash: 'hash',
      p_user_id: value.userId,
      p_influencer_id: value.influencerId,
      p_platform: 'youtube',
      p_verifier: value.verifier,
      p_expires_at: new Date(value.expiresAt).toISOString(),
    });
  });
  it('veritabanı saatini kullanır; null ve geçerli cevabı işler', async () => {
    const { store, rpc } = setup();
    expect(await store.consume('hash', value, 0)).toEqual(value);
    expect(rpc).toHaveBeenCalledWith('oauth_state_consume', {
      p_hash: 'hash',
      p_user_id: value.userId,
      p_influencer_id: value.influencerId,
      p_platform: 'youtube',
    });
    expect(await setup(null).store.consume('hash', value, 0)).toBeNull();
  });
  it('DB hata ayrıntısı/verifier dışarı çıkmaz; bozuk yanıt reddedilir', async () => {
    const { store } = setup(null, { message: 'private-secret' });
    await expect(store.save('hash', value)).rejects.toThrow(
      'OAuth başlangıcı saklanamadı.',
    );
    await expect(store.consume('hash', value, 0)).rejects.toThrow(
      'OAuth başlangıcı doğrulanamadı.',
    );
    await expect(setup({}).store.consume('hash', value, 0)).rejects.toThrow(
      'OAuth başlangıç yanıtı geçersiz.',
    );
  });
});
