import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { TeamRole } from '@ai-influencer/shared';
import { createSupabaseServerClient } from './supabase/server';

export type TeamMember = {
  user: { id: string; email: string | null };
  role: TeamRole;
};

/**
 * Oturum açmış ve `team_members` tablosunda kaydı olan kullanıcıyı döndürür.
 * Aynı istekte layout ve sayfa birlikte çağırdığında tek sorgu yapılır (cache).
 * Üye değilse oturum /auth/signout ile kapatılır (Server Component cookie yazamaz).
 */
export const requireTeamMember = cache(async (): Promise<TeamMember> => {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect('/login?error=not_configured');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect('/login');

  const { data: member, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !member) redirect('/auth/signout?error=not_allowed');

  return {
    user: { id: user.id, email: user.email ?? null },
    role: member.role as TeamRole,
  };
});

export async function requireOwner(): Promise<TeamMember> {
  const member = await requireTeamMember();
  if (member.role !== 'owner') redirect('/?error=owner_required');
  return member;
}
