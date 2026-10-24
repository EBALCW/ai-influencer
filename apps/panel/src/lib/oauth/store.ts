import 'server-only';
import { z } from 'zod';
import { createSupabaseAdminClient } from '../supabase/admin';
import { oauthPlatformSchema, type OAuthStateStore } from './state';

const transaction = z.object({
  userId: z.uuid(),
  influencerId: z.uuid(),
  platform: oauthPlatformSchema,
  verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  expiresAt: z.number().finite(),
});

// Service role yalnız private state RPC'leri için: verifier istemciye/RLS oturumuna açılmaz.
export function createOAuthStateStore(
  client = createSupabaseAdminClient(),
): OAuthStateStore {
  return {
    async save(hash, value) {
      const { error } = await client.rpc('oauth_state_save', {
        p_hash: hash,
        p_user_id: value.userId,
        p_influencer_id: value.influencerId,
        p_platform: value.platform,
        p_verifier: value.verifier,
        p_expires_at: new Date(value.expiresAt).toISOString(),
      });
      if (error) throw new Error('OAuth başlangıcı saklanamadı.');
    },
    async consume(hash, context) {
      const { data, error } = await client.rpc('oauth_state_consume', {
        p_hash: hash,
        p_user_id: context.userId,
        p_influencer_id: context.influencerId,
        p_platform: context.platform,
      });
      if (error) throw new Error('OAuth başlangıcı doğrulanamadı.');
      if (data === null) return null;
      const parsed = transaction.safeParse(data);
      if (!parsed.success) throw new Error('OAuth başlangıç yanıtı geçersiz.');
      return parsed.data;
    },
  };
}
