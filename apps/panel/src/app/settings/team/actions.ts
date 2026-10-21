'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { TeamRole } from '@ai-influencer/shared';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSiteUrl } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const teamPath = '/settings/team';
const validRoles = new Set<TeamRole>(['owner', 'editor', 'viewer']);

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsResult } = await supabase.auth.getClaims();
  const userId = claimsResult?.claims?.sub;
  if (!userId) redirect('/login');

  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (membership?.role !== 'owner') redirect('/');
  return { supabase, userId };
}

export async function inviteTeamMember(formData: FormData) {
  const { supabase, userId } = await requireOwner();
  const admin = createSupabaseAdminClient();
  if (!admin) redirect(`${teamPath}?result=service-key`);

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const role = String(formData.get('role') ?? 'viewer') as TeamRole;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validRoles.has(role)) {
    redirect(`${teamPath}?result=error`);
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback`,
  });
  if (error || !data.user) redirect(`${teamPath}?result=error`);

  const { error: membershipError } = await supabase
    .from('team_members')
    .insert({
      user_id: data.user.id,
      role,
      created_by: userId,
    });

  if (membershipError) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect(`${teamPath}?result=error`);
  }

  revalidatePath(teamPath);
  redirect(`${teamPath}?result=invited`);
}

export async function updateTeamMemberRole(formData: FormData) {
  const { supabase, userId } = await requireOwner();
  const targetUserId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '') as TeamRole;
  if (!targetUserId || !validRoles.has(role) || targetUserId === userId) {
    redirect(`${teamPath}?result=error`);
  }

  const { error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('user_id', targetUserId);
  if (error) redirect(`${teamPath}?result=error`);

  revalidatePath(teamPath);
  redirect(`${teamPath}?result=role-updated`);
}

export async function removeTeamMember(formData: FormData) {
  const { supabase, userId } = await requireOwner();
  const targetUserId = String(formData.get('userId') ?? '');
  if (!targetUserId || targetUserId === userId) {
    redirect(`${teamPath}?result=error`);
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('user_id', targetUserId);
  if (error) redirect(`${teamPath}?result=error`);

  revalidatePath(teamPath);
  redirect(`${teamPath}?result=removed`);
}
