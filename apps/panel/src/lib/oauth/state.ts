import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const oauthPlatformSchema = z.enum(['instagram', 'youtube', 'tiktok']);
export type OAuthPlatform = z.infer<typeof oauthPlatformSchema>;
const contextSchema = z.object({
  userId: z.uuid(),
  influencerId: z.uuid(),
  platform: oauthPlatformSchema,
});
export type OAuthContext = z.infer<typeof contextSchema>;
export type OAuthTransaction = OAuthContext & {
  verifier: string;
  expiresAt: number;
};

/** Sunucu deposu. consume koşullu, atomik silme/RETURNING yapmalıdır.
 * Eşleşmeyen kullanıcı/platform/karakter kaydı tüketmemeli; TTL depoda da uygulanmalı.
 * Üretimde process belleği veya yalnız cookie kullanılamaz (çok worker/replay).
 */
export interface OAuthStateStore {
  save(hash: string, value: OAuthTransaction): Promise<void>;
  consume(
    hash: string,
    context: OAuthContext,
    now: number,
  ): Promise<OAuthTransaction | null>;
}
export const OAUTH_STATE_TTL_MS = 10 * 60_000;
const digest = (value: string) =>
  createHash('sha256').update(value).digest('base64url');

/** RFC 7636 S256. Verifier yalnız sunucuda; authorization URL'e challenge gider. */
export function pkceChallenge(verifier: string): string {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))
    throw new Error('PKCE doğrulayıcısı geçersiz.');
  return digest(verifier);
}

export async function beginOAuth(
  store: OAuthStateStore,
  input: OAuthContext,
  now = Date.now(),
) {
  const context = contextSchema.parse(input);
  if (!Number.isFinite(now)) throw new Error('OAuth zamanı geçersiz.');
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  await store.save(digest(state), {
    ...context,
    verifier,
    expiresAt: now + OAUTH_STATE_TTL_MS,
  });
  return {
    state,
    challenge: pkceChallenge(verifier),
    challengeMethod: 'S256' as const,
  };
}

export async function consumeOAuth(
  store: OAuthStateStore,
  state: unknown,
  input: OAuthContext,
  now = Date.now(),
) {
  const context = contextSchema.parse(input);
  if (
    typeof state !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    !Number.isFinite(now)
  )
    return null;
  const result = await store.consume(digest(state), context, now);
  // Hatalı bir store adaptörü bile farklı hesap/oturumdan token değişimine yol açmamalı.
  if (
    !result ||
    !Number.isFinite(result.expiresAt) ||
    result.userId !== context.userId ||
    result.influencerId !== context.influencerId ||
    result.platform !== context.platform ||
    result.expiresAt <= now ||
    result.expiresAt > now + OAUTH_STATE_TTL_MS
  )
    return null;
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(result.verifier)) return null;
  return { verifier: result.verifier, influencerId: result.influencerId };
}
