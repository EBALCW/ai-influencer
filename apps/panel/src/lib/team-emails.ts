import 'server-only';
import { createSupabaseAdminClient } from './supabase/admin';

/**
 * Verilen kullanıcı id'lerinden SADECE ekip üyesi olanların e-postalarını döndürür.
 *
 * Service role gerekir: e-posta auth.users'ta durur ve RLS ile okunamaz. Ekip üyesi
 * olmayan id'ler (ör. ekipten çıkarılmış biri) sorgulanmaz, sonuçta yer almaz.
 * Service role tanımlı değilse boş Map döner; çağıran "bilinmiyor" gösterir.
 */
export async function getTeamMemberEmails(
  userIds: Array<string | null | undefined>,
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
