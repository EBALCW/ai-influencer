import { NextResponse, type NextRequest } from 'next/server';
import type { TeamRole } from '@ai-influencer/shared';
import { requireApiOwner } from '@/lib/auth-api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const allowedRoles: TeamRole[] = ['owner', 'editor', 'viewer'];

export async function GET() {
  try {
    const auth = await requireApiOwner();
    if (!auth.ok) return auth.response;
    const admin = createSupabaseAdminClient();
    const [
      { data: users, error: usersError },
      { data: members, error: membersError },
    ] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from('team_members').select('user_id, role, created_at'),
    ]);
    if (usersError || membersError) throw new Error('Ekip listesi alınamadı.');

    const byId = new Map(
      users.users.map((user) => [user.id, user.email ?? 'E-posta yok']),
    );
    const result = members.map((member) => ({
      userId: member.user_id,
      email: byId.get(member.user_id) ?? 'Kullanıcı',
      role: member.role,
      createdAt: member.created_at,
    }));
    return NextResponse.json({ members: result });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiOwner();
    if (!auth.ok) return auth.response;
    const body: unknown = await request.json();
    if (!isInviteRequest(body)) {
      return NextResponse.json(
        { error: 'Geçerli e-posta ve rol gerekli.' },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      body.email.trim().toLowerCase(),
      {
        redirectTo: new URL('/auth/callback', request.url).toString(),
      },
    );
    if (error || !data.user) {
      return NextResponse.json(
        {
          error:
            'Davet gönderilemedi. E-posta daha önce davet edilmiş olabilir.',
        },
        { status: 400 },
      );
    }

    const { error: memberError } = await admin.from('team_members').insert({
      user_id: data.user.id,
      role: body.role,
      created_by: auth.user.id,
    });
    if (memberError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        { error: 'Davet gönderilemedi. Üyelik kaydı oluşturulamadı.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function isInviteRequest(
  value: unknown,
): value is { email: string; role: TeamRole } {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) &&
    typeof body.role === 'string' &&
    allowedRoles.includes(body.role as TeamRole)
  );
}

function apiError(error: unknown) {
  if (error && typeof error === 'object' && 'digest' in error) throw error;
  const message = error instanceof Error ? error.message : '';
  const status = message.includes('yapılandırması eksik') ? 503 : 500;
  return NextResponse.json(
    {
      error: status === 503 ? message : 'İşlem tamamlanamadı.',
    },
    { status },
  );
}
