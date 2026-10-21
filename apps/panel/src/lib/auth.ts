import { redirect } from 'next/navigation';
import type { TeamRole } from '@ai-influencer/shared';
import { createSupabaseServerClient } from './supabase/server';

export async function requireTeamMember() {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect('/login?error=not_configured');
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) redirect('/login');

  const user = userResult.user;
  let { data: member, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  // The first invited Auth account bootstraps the empty single-team workspace.
  if (!member && !error) {
    const { data: canBootstrap } = await supabase.rpc('is_initial_owner_setup');
    if (canBootstrap) {
      await supabase.from('team_members').insert({
        user_id: user.id,
        role: 'owner',
        created_by: user.id,
      });
      const refreshed = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      member = refreshed.data;
      error = refreshed.error;
    }
  }

  if (error || !member) {
    await supabase.auth.signOut();
    redirect('/login?error=not_allowed');
  }

  return { user, role: member.role as TeamRole };
}

export async function requireOwner() {
  const member = await requireTeamMember();
  if (member.role !== 'owner') redirect('/?error=owner_required');
  return member;
}
