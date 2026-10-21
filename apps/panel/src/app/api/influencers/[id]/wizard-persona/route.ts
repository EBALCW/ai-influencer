import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { personaInputSchema, toPersonaPayload } from '@/lib/persona';
import { influencerIdFrom, personaRpcError } from '@/lib/persona-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const wizardSchema = personaInputSchema.extend({
  bio: z.string().trim().min(1, 'Karakter hikâyesi gerekli.'),
  tone: z.string().trim().min(1, 'Ses tonu gerekli.'),
  audience: personaInputSchema.shape.audience.extend({
    description: z.string().trim().min(1, 'Hedef kitle açıklaması gerekli.'),
  }),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const influencerId = await influencerIdFrom(context);
    if (!influencerId) return jsonError('Influencer bulunamadı.', 404);
    const body = await parseJson(request, wizardSchema);
    if (!body.ok) return body.response;

    const supabase = await createSupabaseServerClient();
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('slug')
      .eq('id', influencerId)
      .eq('status', 'draft')
      .maybeSingle();
    if (influencerError) throw influencerError;
    if (!influencer) return jsonError('Taslak bulunamadı.', 404);

    const { data: current, error: currentError } = await supabase
      .from('influencer_personas')
      .select('*')
      .eq('influencer_id', influencerId)
      .eq('is_current', true)
      .maybeSingle();
    if (currentError) throw currentError;

    const { data, error } = await supabase.rpc('create_persona_version', {
      p_influencer_id: influencerId,
      ...toPersonaPayload(body.data, current),
    });
    const mapped = personaRpcError(error);
    if (mapped) return mapped;
    if (error) throw error;
    revalidatePath(`/influencers/${encodeURIComponent(influencer.slug)}/setup`);
    return NextResponse.json({ version: data.version }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
