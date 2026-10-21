import { NextResponse, type NextRequest } from 'next/server';
import { isAllowedBootstrapEmail, isSafeNextPath } from '@/lib/auth-redirect';
import { getSiteUrl, getSupabasePublicConfig } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedPath = request.nextUrl.searchParams.get('next');
  const nextPath = isSafeNextPath(requestedPath) ? requestedPath : '/';
  const siteUrl = getSiteUrl();

  if (!getSupabasePublicConfig() || !code) {
    return redirect(siteUrl, '/login?reason=session');
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return redirect(siteUrl, '/login?reason=session');

  const { data: claimsResult } = await supabase.auth.getClaims();
  const userId = claimsResult?.claims?.sub;
  if (!userId) return redirect(siteUrl, '/login?reason=session');

  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) {
    await supabase.auth.signOut();
    return redirect(siteUrl, '/access-denied?reason=check');
  }

  if (!membership) {
    const claimEmail = claimsResult.claims.email;
    const initialOwnerEmail = process.env.SUPABASE_INITIAL_OWNER_EMAIL;
    if (
      typeof claimEmail !== 'string' ||
      !isAllowedBootstrapEmail(claimEmail, initialOwnerEmail)
    ) {
      await supabase.auth.signOut();
      return redirect(siteUrl, '/access-denied');
    }

    // Only the preconfigured first-owner email can use the database's
    // initial-owner policy. All later nonmembers are rejected by RLS.
    const { error: bootstrapError } = await supabase
      .from('team_members')
      .insert({
        user_id: userId,
        role: 'owner',
      });

    if (bootstrapError) {
      await supabase.auth.signOut();
      return redirect(siteUrl, '/access-denied');
    }
  }

  return redirect(siteUrl, nextPath);
}

function redirect(siteUrl: string, path: string) {
  const response = NextResponse.redirect(new URL(path, siteUrl));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
