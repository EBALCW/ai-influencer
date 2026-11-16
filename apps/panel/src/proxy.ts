import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@ai-influencer/shared';
import { isCrossOriginApiMutation } from './lib/same-origin';
import { getSupabasePublicEnv } from './lib/supabase/env';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // CSRF: değiştirici API istekleri yalnız panelin kendi origin'inden kabul edilir (#254).
  // Oturum denetiminden önce çalışır; uçlardaki yetki denetimleri aynen sürer.
  if (isCrossOriginApiMutation(request)) {
    return NextResponse.json(
      { error: 'Geçersiz istek kaynağı.' },
      { status: 403 },
    );
  }
  if (path === '/login' || path.startsWith('/auth/')) {
    return NextResponse.next();
  }

  const env = getSupabasePublicEnv();
  if (!env) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if ((error || !data.user) && !path.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
