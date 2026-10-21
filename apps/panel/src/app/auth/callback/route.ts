import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNextPath(path: string | null) {
  return path?.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code || !getSupabasePublicEnv()) {
    return NextResponse.redirect(
      new URL('/login?error=not_configured', request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      new URL('/login?error=not_allowed', request.url),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.redirect(
      new URL('/login?error=not_allowed', request.url),
    );

  let { data: member } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    const { data: canBootstrap } = await supabase.rpc('is_initial_owner_setup');
    if (canBootstrap) {
      await supabase.from('team_members').insert({
        user_id: user.id,
        role: 'owner',
        created_by: user.id,
      });
      const refreshed = await supabase
        .from('team_members')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      member = refreshed.data;
    }
  }

  if (!member) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL('/login?error=not_allowed', request.url),
    );
  }

  return NextResponse.redirect(
    new URL(
      safeNextPath(request.nextUrl.searchParams.get('next')),
      request.url,
    ),
  );
}
