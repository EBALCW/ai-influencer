import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { restoreInputSchema } from '@/lib/persona';
import { influencerIdFrom, personaRpcError } from '@/lib/persona-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

/** Eski bir versiyonu geri alır: içeriği kopyalanarak YENİ bir versiyon oluşturulur. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const influencerId = await influencerIdFrom(context);
    if (!influencerId) return jsonError('Influencer bulunamadı.', 404);
    const body = await parseJson(request, restoreInputSchema);
    if (!body.ok) return body.response;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('restore_persona_version', {
      p_influencer_id: influencerId,
      p_version: body.data.version,
      p_change_note: body.data.changeNote ?? '',
    });
    const mapped = personaRpcError(error);
    if (mapped) return mapped;
    if (error) throw new Error(`Versiyon geri alınamadı: ${error.message}`);

    revalidatePath('/influencers/[slug]', 'page');
    return NextResponse.json({ version: data.version }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
