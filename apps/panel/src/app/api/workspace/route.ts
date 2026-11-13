import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { workspaceUpdateSchema } from '@/lib/workspace-schemas';

/**
 * Çalışma alanını yeniden adlandırır. Yalnız owner.
 * Kullanıcı oturumuyla (RLS) yazılır: `workspaces_owner_update` yalnız çağıranın kendi alanını
 * ve yalnız `name` kolonunu açar. Hedef alan istekten değil oturumdan gelir.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireApiRole('owner');
    if (!auth.ok) return auth.response;
    const body = await parseJson(request, workspaceUpdateSchema);
    if (!body.ok) return body.response;

    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('workspaces')
      .update({ name: body.data.name })
      .eq('id', auth.workspaceId)
      .select('id, name');
    if (error) {
      if (error.code === '42501')
        return jsonError('owner yetkisi gerekli.', 403);
      if (error.code === '23514')
        return jsonError('Çalışma alanı adı geçersiz.', 400);
      return apiError(error);
    }
    const saved = data[0];
    if (!saved) return jsonError('Çalışma alanı bulunamadı.', 404);
    revalidatePath('/settings');
    return NextResponse.json({ ok: true, name: saved.name });
  } catch (error) {
    return apiError(error);
  }
}
