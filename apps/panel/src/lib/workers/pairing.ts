import 'server-only';
import { createClient } from '@supabase/supabase-js';
import {
  sealForMachine,
  type Database,
  type PairingRequest,
} from '@ai-influencer/shared';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSupabasePublicEnv } from '@/lib/supabase/env';
import type { createSupabaseServerClient } from '@/lib/supabase/server';
import { sessionIdFromAccessToken } from './session-id';

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type PairingStart =
  | { status: 'pending'; pairingId: string }
  | { status: 'too_many_pending' }
  | { status: 'already_used' }
  | { status: 'stale' };

/**
 * Eşleme satırını kullanıcının kendi oturumuyla açar. Yetki, "makine oturumu eşleyemez" kuralı
 * ve sınırlar (üye başına 3, alan başına 10 bekleyen eşleme) veritabanındadır
 * (`begin_worker_pairing`). Eşleme satırını açan tek çağrı budur.
 */
export async function beginPairing(
  supabase: ServerClient,
  request: PairingRequest,
): Promise<PairingStart> {
  const { data, error } = await supabase.rpc('begin_worker_pairing', {
    p_verifier: request.verifier,
    p_public_key: request.publicKey,
    p_name: request.name,
    p_platform: request.platform,
    p_started_at: new Date(request.startedAt * 1000).toISOString(),
  });
  if (error) throw new Error('Eşleme başlatılamadı.');
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.status === 'pending' && typeof row.pairing_id === 'string')
    return { status: 'pending', pairingId: row.pairing_id };
  if (
    row.status === 'too_many_pending' ||
    row.status === 'already_used' ||
    row.status === 'stale'
  )
    return { status: row.status };
  throw new Error('Eşleme başlatılamadı.');
}

/**
 * Onaylayan üye için AYRI bir Auth oturumu açar ve onu makineye bağlar.
 *
 * 1. Service role ile üyenin e-postasına tek kullanımlık giriş özeti üretilir (e-posta gitmez).
 * 2. Özet hemen burada doğrulanır: yeni oturum (kendi `session_id`'siyle) panel sunucusunda doğar.
 * 3. `complete_worker_pairing` oturumu makine oturumu olarak kaydeder; ancak ondan sonra
 *    yenileme token'ı, makinenin açık anahtarına mühürlenmiş olarak teslim için bırakılır.
 *
 * Service role RLS'i aşar: tamamlama çekirdeği üyeyi, rolünü ve alanını kendisi doğrular.
 * Token'lar loglanmaz ve yanıtta dönmez.
 */
export async function completePairing(input: {
  pairingId: string;
  publicKey: string;
  user: { id: string; email?: string | null };
}): Promise<{ workerId: string; name: string; platform: string }> {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error('Supabase sunucu yapılandırması eksik.');
  if (!input.user.email)
    throw new Error('Makine eşlemek için hesabın e-posta adresi olmalı.');

  const admin = createSupabaseAdminClient();
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: input.user.email,
  });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash || link.data.user?.id !== input.user.id)
    throw new Error('Makine oturumu açılamadı.');

  // Ayrı istemci: doğrulanan oturum service role istemcisine ya da kullanıcının çerezlerine bulaşmaz.
  const machine = createClient<Database>(env.url, env.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const verified = await machine.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  const session = verified.data.session;
  if (verified.error || !session || session.user.id !== input.user.id)
    throw new Error('Makine oturumu açılamadı.');

  try {
    const sessionId = sessionIdFromAccessToken(session.access_token);
    if (!sessionId) throw new Error('Oturum kimliği okunamadı.');
    const { data, error } = await admin.rpc('complete_worker_pairing', {
      p_pairing_id: input.pairingId,
      p_user_id: input.user.id,
      p_session_id: sessionId,
      p_token_ciphertext: await sealForMachine(
        input.publicKey,
        session.refresh_token,
      ),
    });
    const row = (data ?? {}) as Record<string, unknown>;
    if (
      error ||
      typeof row.worker_id !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.platform !== 'string'
    )
      throw new Error('Eşleme tamamlanamadı.');
    return { workerId: row.worker_id, name: row.name, platform: row.platform };
  } catch (error) {
    // Bağlanamayan oturum açık kalmasın (hâlâ sıradan bir üye oturumu).
    const closed = await admin.auth.admin.signOut(
      session.access_token,
      'local',
    );
    if (closed.error)
      console.error('[workers] bağlanamayan makine oturumu kapatılamadı');
    throw error;
  }
}
