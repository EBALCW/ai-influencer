import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { requireApiRole } from '../auth-api';
import { createSupabaseServerClient } from '../supabase/server';
import { createSupabaseAdminClient } from '../supabase/admin';
import { beginOAuth, consumeOAuth, oauthPlatformSchema } from './state';
import { createOAuthStateStore } from './store';
import {
  accountIdentity,
  authorizationUrl,
  exchangeCode,
  OAuthProviderError,
  providerConfig,
} from './providers';
const binding = z.object({
  state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  influencerId: z.uuid(),
});
const cookieName = (platform: string) => `social_oauth_${platform}`;
const cookiePath = (platform: string) => `/api/oauth/${platform}/callback`;
const secureHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};
function failure(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: secureHeaders },
  );
}
function handled(error: unknown) {
  return error instanceof OAuthProviderError
    ? failure(error.message, 503)
    : failure('Sosyal hesap bağlantısı tamamlanamadı.', 500);
}
export async function startOAuth(request: NextRequest, rawPlatform: string) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const platform = oauthPlatformSchema.safeParse(rawPlatform);
  if (!platform.success) return failure('Platform bulunamadı.', 404);
  // Başlatma POST'tur. Başka siteden gönderilen form bağlantı state'i oluşturamaz.
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return failure('İstek kaynağı geçersiz.', 403);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failure('Form geçersiz.', 400);
  }
  const inf = z.uuid().safeParse(form.get('influencerId'));
  if (!inf.success) return failure('Influencer geçersiz.', 400);
  try {
    const cfg = providerConfig(platform.data);
    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('influencers')
      .select('id')
      .eq('id', inf.data)
      .maybeSingle();
    if (error) throw new Error('db');
    if (!data) return failure('Influencer bulunamadı.', 404);
    const transaction = await beginOAuth(createOAuthStateStore(), {
      userId: auth.user.id,
      influencerId: inf.data,
      platform: platform.data,
    });
    const response = NextResponse.redirect(
      authorizationUrl(cfg, transaction.state, transaction.challenge),
      303,
    );
    for (const [name, value] of Object.entries(secureHeaders))
      response.headers.set(name, value);
    response.cookies.set(
      cookieName(platform.data),
      JSON.stringify({ state: transaction.state, influencerId: inf.data }),
      {
        httpOnly: true,
        secure: cfg.origin.startsWith('https:'),
        sameSite: 'lax',
        path: cookiePath(platform.data),
        maxAge: 600,
      },
    );
    return response;
  } catch (error) {
    return handled(error);
  }
}
export async function callbackOAuth(request: NextRequest, rawPlatform: string) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const platform = oauthPlatformSchema.safeParse(rawPlatform);
  if (!platform.success) return failure('Platform bulunamadı.', 404);
  const finish = (response: NextResponse) => {
    response.cookies.set(cookieName(platform.data), '', {
      path: cookiePath(platform.data),
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
    });
    return response;
  };
  try {
    const cfg = providerConfig(platform.data);
    let cookie: unknown;
    try {
      cookie = JSON.parse(
        request.cookies.get(cookieName(platform.data))?.value ?? 'null',
      );
    } catch {
      return finish(failure('OAuth state geçersiz.', 400));
    }
    const bound = binding.safeParse(cookie);
    const states = request.nextUrl.searchParams.getAll('state');
    const state = states[0];
    if (
      !bound.success ||
      states.length !== 1 ||
      !state ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      state.length !== bound.data.state.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(bound.data.state))
    )
      return finish(failure('OAuth state geçersiz.', 400));
    const consumed = await consumeOAuth(createOAuthStateStore(), state, {
      userId: auth.user.id,
      influencerId: bound.data.influencerId,
      platform: platform.data,
    });
    if (!consumed)
      return finish(
        failure('OAuth başlangıcı kullanılmış veya süresi dolmuş.', 400),
      );
    if (request.nextUrl.searchParams.has('error'))
      return finish(failure('Sağlayıcı yetkilendirmesi iptal edildi.', 400));
    const codes = request.nextUrl.searchParams.getAll('code');
    const code = z.string().min(1).max(4096).safeParse(codes[0]);
    if (codes.length !== 1 || !code.success)
      return finish(failure('Yetkilendirme kodu geçersiz.', 400));
    const token = await exchangeCode(cfg, code.data, consumed.verifier);
    const identity = await accountIdentity(cfg, token);
    const db = await createSupabaseServerClient();
    const { data: influencer, error: infError } = await db
      .from('influencers')
      .select('id,slug')
      .eq('id', consumed.influencerId)
      .maybeSingle();
    if (infError) throw new Error('db');
    if (!influencer) return finish(failure('Influencer bulunamadı.', 404));
    const { data: existing, error: lookupError } = await db
      .from('social_accounts')
      .select('id,influencer_id')
      .eq('platform', platform.data)
      .eq('external_id', identity.id)
      .maybeSingle();
    if (lookupError) throw new Error('db');
    if (existing && existing.influencer_id !== influencer.id)
      return finish(failure('Bu sosyal hesap başka influencer’a bağlı.', 409));
    let accountId = existing?.id;
    if (!accountId) {
      const { data, error } = await db
        .from('social_accounts')
        .insert({
          influencer_id: influencer.id,
          platform: platform.data,
          external_id: identity.id,
          handle: identity.handle,
        })
        .select('id')
        .single();
      if (error || !data)
        return finish(
          failure(
            'Hesap kaydı oluşturulamadı; bağlantıyı yeniden başlatın.',
            409,
          ),
        );
      accountId = data.id;
    }
    // Service role yalnız Vault RPC'sinde kullanılır. Hesap sahipliği yukarıda RLS oturumuyla doğrulandı.
    const { error } = await createSupabaseAdminClient().rpc(
      'oauth_connect_token',
      {
        p_account_id: accountId,
        p_user_id: auth.user.id,
        p_influencer_id: influencer.id,
        p_platform: platform.data,
        p_external_id: identity.id,
        p_token: {
          access_token: token.access_token,
          refresh_token: token.refresh_token!,
          scope: token.scope,
          ...(token.token_type ? { token_type: token.token_type } : {}),
        },
        p_expires_at: new Date(
          Date.now() + token.expires_in * 1000,
        ).toISOString(),
      },
    );
    if (error) throw new Error('vault');
    const response = NextResponse.redirect(
      new URL(
        `/influencers/${encodeURIComponent(influencer.slug)}?tab=accounts&inf=${encodeURIComponent(influencer.slug)}`,
        cfg.origin,
      ),
      303,
    );
    for (const [key, value] of Object.entries(secureHeaders))
      response.headers.set(key, value);
    return finish(response);
  } catch (error) {
    return finish(handled(error));
  }
}
