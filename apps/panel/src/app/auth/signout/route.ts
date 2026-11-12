import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const allowedErrors = new Set(['not_allowed', 'not_configured']);

function loginUrl(request: NextRequest, error?: string | null) {
  const target = new URL('/login', request.nextUrl.origin);
  if (error && allowedErrors.has(error))
    target.searchParams.set('error', error);
  return target;
}

/** Çıkış butonu (form POST). Oturum çerezleri SameSite=Lax: başka siteden POST oturumu taşımaz. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Supabase yapılandırılmamışsa kapatılacak oturum da yok
  }
  // 303: POST'tan sonra /login'e GET ile git
  return NextResponse.redirect(
    loginUrl(request, request.nextUrl.searchParams.get('error')),
    303,
  );
}

/**
 * Server Component'ler cookie silemediği için üye olmayan kullanıcı requireTeamMember()
 * tarafından buraya GET ile (`?error=not_allowed`) yönlendirilir. GET başka sitedeki bir
 * bağlantı/görselle de tetiklenebildiği için (CSRF) oturum yalnız kullanıcı gerçekten ekip
 * üyesi değilse kapatılır; üyenin oturumuna dokunulmaz. Diğer GET'ler çıkış yapmaz.
 */
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('error') !== 'not_allowed')
    return NextResponse.redirect(new URL('/', request.nextUrl.origin), 303);

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.redirect(loginUrl(request, 'not_configured'), 303);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: member, error } = await supabase
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!error && member)
      return NextResponse.redirect(new URL('/', request.nextUrl.origin), 303);
  }
  await supabase.auth.signOut();
  return NextResponse.redirect(loginUrl(request, 'not_allowed'), 303);
}
