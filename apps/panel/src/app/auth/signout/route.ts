import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const allowedErrors = new Set(['not_allowed', 'not_configured']);

async function signOut(request: NextRequest) {
  const error = request.nextUrl.searchParams.get('error');
  const target = new URL('/login', request.nextUrl.origin);
  if (error && allowedErrors.has(error))
    target.searchParams.set('error', error);

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Supabase yapılandırılmamışsa kapatılacak oturum da yok
  }
  // 303: POST'tan sonra /login'e GET ile git
  return NextResponse.redirect(target, 303);
}

/** Çıkış butonu (form POST). */
export const POST = signOut;

/**
 * Server Component'ler cookie silemediği için üye olmayan kullanıcı
 * requireTeamMember() tarafından buraya GET ile yönlendirilir.
 */
export const GET = signOut;
