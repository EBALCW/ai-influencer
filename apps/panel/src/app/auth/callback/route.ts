import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/safe-redirect';
import { getSupabasePublicEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.nextUrl.origin));

  const code = request.nextUrl.searchParams.get('code');
  if (!getSupabasePublicEnv()) return redirectTo('/login?error=not_configured');
  if (!code) return redirectTo('/login?error=not_allowed');

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return redirectTo('/login?error=not_allowed');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectTo('/login?error=not_allowed');

  // Üyelik sadece owner tarafından (Ayarlar → Ekip) veya ilk kurulumda
  // `pnpm owner:create` ile oluşturulur; burada kimse kendini ekleyemez.
  const { data: member } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    await supabase.auth.signOut();
    return redirectTo('/login?error=not_allowed');
  }

  return redirectTo(safeNextPath(request.nextUrl.searchParams.get('next')));
}
