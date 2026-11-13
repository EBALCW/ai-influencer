import 'server-only';
import { createSupabaseAdminClient } from './supabase/admin';

/**
 * Verilen kullanıcı id'lerinden SADECE `workspaceId` alanının üyesi olanların e-postalarını
 * döndürür.
 *
 * Service role gerekir: e-posta auth.users'ta durur ve RLS ile okunamaz. Service role RLS'i
 * aştığı için alan filtresi burada açıkça uygulanır: başka bir çalışma alanının üyesi ya da
 * ekipten çıkarılmış biri sorgulanmaz, sonuçta yer almaz.
 * Service role tanımlı değilse boş Map döner; çağıran "bilinmiyor" gösterir.
 */
export async function getTeamMemberEmails(
  userIds: Array<string | null | undefined>,
  workspaceId: string,
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (!ids.length) return emails;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return emails;
  }
  const { data: members, error } = await admin
    .from('team_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .in('user_id', ids);
  if (error) throw new Error('Ekip üyeleri alınamadı.');

  await Promise.all(
    members.map(async ({ user_id }) => {
      const { data } = await admin.auth.admin.getUserById(user_id);
      if (data.user?.email) emails.set(user_id, data.user.email);
    }),
  );
  return emails;
}
