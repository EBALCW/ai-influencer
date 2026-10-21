import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { inviteSchema } from '@/lib/team-schemas';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function GET() {
  try {
    const auth = await requireApiRole('owner');
    if (!auth.ok) return auth.response;

    const admin = createSupabaseAdminClient();
    const { data: members, error } = await admin
      .from('team_members')
      .select('user_id, role, created_at')
      .order('created_at');
    if (error) throw new Error('Ekip listesi alınamadı.');

    // Sadece ekip üyelerinin e-postalarını getir (tüm auth kullanıcılarını listelemek yerine)
    const emails = await Promise.all(
      members.map(async (member) => {
        const { data } = await admin.auth.admin.getUserById(member.user_id);
        return data.user?.email ?? null;
      }),
    );

    return NextResponse.json({
      members: members.map((member, index) => ({
        userId: member.user_id,
        email: emails[index] ?? 'E-posta yok',
        role: member.role,
        createdAt: member.created_at,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('owner');
    if (!auth.ok) return auth.response;
    const body = await parseJson(request, inviteSchema);
    if (!body.ok) return body.response;
    const { email, role } = body.data;

    const admin = createSupabaseAdminClient();
    // Host header'ına güvenmeden, isteğin geldiği origin'e dön (Supabase redirect allowlist'i de kontrol eder)
    const redirectTo = new URL(
      '/auth/callback',
      request.nextUrl.origin,
    ).toString();

    let userId: string;
    let invited = false;
    const existing = await findUserIdByEmail(admin, email);
    if (existing) {
      // Daha önce çıkarılmış veya dashboard'dan eklenmiş kullanıcı: sadece üyeliği oluştur
      userId = existing;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });
      if (error || !data.user) return jsonError('Davet gönderilemedi.', 400);
      userId = data.user.id;
      invited = true;
    }

    const { error: memberError } = await admin.from('team_members').insert({
      user_id: userId,
      role,
      created_by: auth.user.id,
    });
    if (memberError) {
      // Yeni davet ettiğimiz kullanıcıyı geri al; mevcut kullanıcıya dokunma
      if (invited) await admin.auth.admin.deleteUser(userId);
      return memberError.code === '23505'
        ? jsonError('Bu kişi zaten ekipte.', 409)
        : jsonError('Üyelik kaydı oluşturulamadı.', 400);
    }

    return NextResponse.json({ ok: true, invited }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

async function findUserIdByEmail(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error('Kullanıcılar sorgulanamadı.');
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}
