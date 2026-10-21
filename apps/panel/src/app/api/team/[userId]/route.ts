import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { roleUpdateSchema, userIdSchema } from '@/lib/team-schemas';

type RouteContext = { params: Promise<{ userId: string }> };

// Son owner'ın düşürülmesi/silinmesi veritabanında trigger ile engellenir (23514)
const LAST_OWNER = '23514';

async function targetUserId(context: RouteContext) {
  const { userId } = await context.params;
  return userIdSchema.safeParse(userId).success ? userId : null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiRole('owner');
    if (!auth.ok) return auth.response;
    const userId = await targetUserId(context);
    if (!userId) return jsonError('Kullanıcı bulunamadı.', 404);
    if (userId === auth.user.id) {
      return jsonError('Kendi rolünü değiştiremezsin.', 400);
    }
    const body = await parseJson(request, roleUpdateSchema);
    if (!body.ok) return body.response;

    const { data, error } = await createSupabaseAdminClient()
      .from('team_members')
      .update({ role: body.data.role })
      .eq('user_id', userId)
      .select('user_id');
    if (error?.code === LAST_OWNER) {
      return jsonError('Ekipte en az bir owner kalmalı.', 409);
    }
    if (error) return jsonError('Rol değiştirilemedi.', 409);
    if (!data.length) return jsonError('Üye bulunamadı.', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiRole('owner');
    if (!auth.ok) return auth.response;
    const userId = await targetUserId(context);
    if (!userId) return jsonError('Kullanıcı bulunamadı.', 404);
    if (userId === auth.user.id) {
      return jsonError('Kendi üyeliğini buradan kaldıramazsın.', 400);
    }

    const { data, error } = await createSupabaseAdminClient()
      .from('team_members')
      .delete()
      .eq('user_id', userId)
      .select('user_id');
    if (error?.code === LAST_OWNER) {
      return jsonError('Ekipte en az bir owner kalmalı.', 409);
    }
    if (error) return jsonError('Üye çıkarılamadı.', 409);
    if (!data.length) return jsonError('Üye bulunamadı.', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
