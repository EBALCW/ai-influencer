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

  let { data: member } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // Boş çalışma alanında ilk giren davetli kullanıcı owner olur (RLS de bunu sadece tablo boşken izin verir)
  if (!member) {
    const { data: canBootstrap } = await supabase.rpc('is_initial_owner_setup');
    if (canBootstrap) {
      await supabase.from('team_members').insert({
        user_id: user.id,
        role: 'owner',
        created_by: user.id,
      });
      ({ data: member } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle());
    }
  }

  if (!member) {
    await supabase.auth.signOut();
    return redirectTo('/login?error=not_allowed');
  }

  return redirectTo(safeNextPath(request.nextUrl.searchParams.get('next')));
}
