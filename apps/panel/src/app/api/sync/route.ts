import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  isSyncRequestResult,
  syncRequestResponses,
  syncRequestSchema,
} from '@/lib/sync/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * "Şimdi senkronize et" (#53). Kullanıcının oturumuyla `request_sync` RPC'sini çağırır;
 * RPC yetkiyi (owner/editor) tekrar denetler, 2 dakikalık kısıtlamayı uygular ve
 * sync-dispatch Edge Function'ını Vault'taki sırla pg_net üzerinden kuyruğa alır.
 * Panel CRON_SECRET'ı hiç görmez, service role kullanılmaz.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, syncRequestSchema);
  if (!body.ok) return body.response;
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc(
      'request_sync',
      body.data.accountId ? { p_account_id: body.data.accountId } : {},
    );
    if (error) {
      if (error.code === '42501') {
        return jsonError('editor yetkisi gerekli.', 403);
      }
      throw new Error(`Senkronizasyon istenemedi: ${error.message}`);
    }
    if (!isSyncRequestResult(data)) {
      throw new Error('Senkronizasyon isteği beklenmeyen yanıt döndürdü.');
    }
    const { status, message } = syncRequestResponses[data];
    return NextResponse.json(
      { result: data, message },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
