import { NextResponse, type NextRequest } from 'next/server';
import type { TeamRole } from '@ai-influencer/shared';
import { requireApiOwner } from '@/lib/auth-api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiOwner();
    if (!auth.ok) return auth.response;
    const { userId } = await context.params;
    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: 'Kendi rolünü değiştiremezsin.' },
        { status: 400 },
      );
    }
    const body: unknown = await request.json();
    const role =
      body && typeof body === 'object'
        ? (body as { role?: unknown }).role
        : null;
    if (role !== 'owner' && role !== 'editor' && role !== 'viewer') {
      return NextResponse.json({ error: 'Rol geçersiz.' }, { status: 400 });
    }

    const { error } = await createSupabaseAdminClient()
      .from('team_members')
      .update({ role: role as TeamRole })
      .eq('user_id', userId);
    if (error)
      return NextResponse.json(
        { error: 'Rol değiştirilemedi.' },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiOwner();
    if (!auth.ok) return auth.response;
    const { userId } = await context.params;
    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: 'Kendi üyeliğini buradan kaldıramazsın.' },
        { status: 400 },
      );
    }

    const { error } = await createSupabaseAdminClient()
      .from('team_members')
      .delete()
      .eq('user_id', userId);
    if (error)
      return NextResponse.json({ error: 'Üye çıkarılamadı.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
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
