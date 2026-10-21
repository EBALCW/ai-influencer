import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { personaInputSchema, toPersonaPayload } from '@/lib/persona';
import { influencerIdFrom, personaRpcError } from '@/lib/persona-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Yeni persona versiyonu oluşturur. Versiyon numarası, is_current ve değiştiren kişi
 * veritabanında (create_persona_version RPC, created_by trigger'ı) belirlenir;
 * istemciden alınmaz.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const influencerId = await influencerIdFrom(context);
    if (!influencerId) return jsonError('Influencer bulunamadı.', 404);
    const body = await parseJson(request, personaInputSchema);
    if (!body.ok) return body.response;

    const supabase = await createSupabaseServerClient();
    // Bilinmeyen jsonb anahtarlarını korumak için güncel versiyon okunur
    const { data: current, error: currentError } = await supabase
      .from('influencer_personas')
      .select('*')
      .eq('influencer_id', influencerId)
      .eq('is_current', true)
      .maybeSingle();
    if (currentError)
      throw new Error(`Güncel persona okunamadı: ${currentError.message}`);

    const { data, error } = await supabase.rpc('create_persona_version', {
      p_influencer_id: influencerId,
      ...toPersonaPayload(body.data, current),
    });
    const mapped = personaRpcError(error);
    if (mapped) return mapped;
    if (error) throw new Error(`Persona kaydedilemedi: ${error.message}`);

    revalidatePath('/influencers/[slug]', 'page');
    return NextResponse.json({ version: data.version }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
