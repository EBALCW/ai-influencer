import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@ai-influencer/shared';
import { getSupabasePublicConfig } from './config';

const publicPaths = new Set(['/login', '/auth/callback', '/access-denied']);

function copyAuthResponse(source: NextResponse, destination: NextResponse) {
  for (const cookie of source.cookies.getAll()) destination.cookies.set(cookie);
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = source.headers.get(header);
    if (value) destination.headers.set(header, value);
  }
  return destination;
}

export async function updateSupabaseSession(request: NextRequest) {
  const isPublicPath = publicPaths.has(request.nextUrl.pathname);
  const config = getSupabasePublicConfig();

  if (!config) {
    if (isPublicPath) return NextResponse.next({ request });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '?setup=required';
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (request.nextUrl.pathname === '/auth/callback') return response;

  if (!claims?.sub) {
    if (isPublicPath) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    if (error) loginUrl.searchParams.set('reason', 'session');
    return copyAuthResponse(response, NextResponse.redirect(loginUrl));
  }

  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', claims.sub)
    .maybeSingle();

  const mayEnter = !membershipError && membership !== null;

  if (!mayEnter) {
    if (request.nextUrl.pathname === '/access-denied') return response;
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = '/access-denied';
    deniedUrl.search = membershipError ? '?reason=check' : '';
    return copyAuthResponse(response, NextResponse.redirect(deniedUrl));
  }

  if (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/access-denied'
  ) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return copyAuthResponse(response, NextResponse.redirect(homeUrl));
  }

  return response;
}
