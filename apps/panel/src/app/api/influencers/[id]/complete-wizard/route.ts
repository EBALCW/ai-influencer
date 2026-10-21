import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { influencerIdFrom } from '@/lib/persona-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CHARACTER_PROMPT_KEY } from '@/lib/influencer-wizard-prompt';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const influencerId = await influencerIdFrom(context);
    if (!influencerId) return jsonError('Influencer bulunamadı.', 404);

    const supabase = await createSupabaseServerClient();
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('slug, avatar_asset_id')
      .eq('id', influencerId)
      .eq('status', 'draft')
      .maybeSingle();
    if (influencerError) throw influencerError;
    if (!influencer) return jsonError('Taslak bulunamadı.', 404);
    if (!influencer.avatar_asset_id)
      return jsonError('Özet öncesinde bir avatar seçin.', 400);

    const [
      { data: persona, error: personaError },
      { data: prompt, error: promptError },
      { count: referenceCount, error: assetsError },
      { data: avatar, error: avatarError },
    ] = await Promise.all([
      supabase
        .from('influencer_personas')
        .select('id')
        .eq('influencer_id', influencerId)
        .eq('is_current', true)
        .maybeSingle(),
      supabase
        .from('prompts')
        .select('id')
        .eq('influencer_id', influencerId)
        .eq('category', 'character')
        .eq('key', CHARACTER_PROMPT_KEY)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('assets')
        .select('id', { count: 'exact', head: true })
        .eq('influencer_id', influencerId)
        .eq('kind', 'reference'),
      supabase
        .from('assets')
        .select('id')
        .eq('id', influencer.avatar_asset_id)
        .eq('influencer_id', influencerId)
        .eq('kind', 'reference')
        .maybeSingle(),
    ]);
    // Gerçek hatayı fırlat: apiError loglar, genel bir mesajla maskelemek teşhisi zorlaştırır.
    const stepError = personaError ?? promptError ?? assetsError ?? avatarError;
    if (stepError) throw stepError;
    if (!persona) return jsonError('Persona bilgilerini tamamlayın.', 400);
    if (!prompt) return jsonError('Karakter prompt’unu kaydedin.', 400);
    if (!referenceCount)
      return jsonError('En az bir referans görsel yükleyin.', 400);
    if (!avatar) return jsonError('Bir referans görselini avatar seçin.', 400);

    revalidatePath(`/influencers/${encodeURIComponent(influencer.slug)}`);
    revalidatePath('/influencers');
    return NextResponse.json({
      completed: true,
      status: 'draft',
      referenceCount,
    });
  } catch (error) {
    return apiError(error);
  }
}
