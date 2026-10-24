import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '../auth-api';
import { createSupabaseServerClient } from '../supabase/server';
import { createSupabaseAdminClient } from '../supabase/admin';
import { oauthPlatformSchema } from './state';
import { providerConfig, revokeToken, OAuthProviderError } from './providers';
const packageSchema = z.object({
  nonce: z.uuid(),
  token: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().optional(),
  }),
});
export async function disconnectOAuth(request: NextRequest, id: string) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const fail = (error: string, status: number) =>
    NextResponse.json(
      { error },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return fail('İstek kaynağı geçersiz.', 403);
  if (!z.uuid().safeParse(id).success) return fail('Hesap geçersiz.', 400);
  try {
    const db = await createSupabaseServerClient();
    const { data: a, error } = await db
      .from('social_accounts')
      .select('id,platform,influencer_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('db');
    if (!a) return fail('Hesap bulunamadı.', 404);
    const cfg = providerConfig(oauthPlatformSchema.parse(a.platform));
    const { data: inf, error: infError } = await db
      .from('influencers')
      .select('slug')
      .eq('id', a.influencer_id)
      .single();
    if (infError || !inf) throw new Error('db');
    const admin = createSupabaseAdminClient();
    const { data: raw, error: beginError } = await admin.rpc(
      'oauth_revoke_begin',
      {
        p_account_id: id,
        p_user_id: auth.user.id,
        p_influencer_id: a.influencer_id,
      },
    );
    if (beginError)
      return fail(
        'Hesap işlemi sürüyor veya bağlantı kaldırılamadı; üç dakika sonra tekrar deneyin.',
        409,
      );
    if (raw !== null) {
      const bound = packageSchema.safeParse(raw);
      if (!bound.success) throw new Error('package');
      await revokeToken(cfg, bound.data.token);
      const { data: done, error: finishError } = await admin.rpc(
        'oauth_revoke_finish',
        { p_account_id: id, p_nonce: bound.data.nonce },
      );
      if (finishError || done !== true)
        return fail(
          'Sağlayıcı izni kaldırıldı; yerel temizliği tamamlamak için tekrar deneyin.',
          409,
        );
    }
    return NextResponse.redirect(
      new URL(
        `/influencers/${encodeURIComponent(inf.slug)}?tab=accounts&inf=${encodeURIComponent(inf.slug)}`,
        cfg.origin,
      ),
      303,
    );
  } catch (error) {
    return fail(
      error instanceof OAuthProviderError
        ? error.message
        : 'Bağlantı kaldırma tamamlanamadı.',
      error instanceof OAuthProviderError ? 502 : 500,
    );
  }
}
