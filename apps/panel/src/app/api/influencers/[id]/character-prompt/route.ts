import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  CHARACTER_PROMPT_KEY,
  characterPromptTitle,
} from '@/lib/influencer-wizard-prompt';
import { influencerIdFrom } from '@/lib/persona-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const promptSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  variables: z.record(z.string(), z.string()).default({}),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = await influencerIdFrom(context);
    if (!id) return jsonError('Influencer bulunamadı.', 404);
    const parsed = await parseJson(request, promptSchema);
    if (!parsed.ok) return parsed.response;

    const supabase = await createSupabaseServerClient();
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('id, name')
      .eq('id', id)
      .eq('status', 'draft')
      .maybeSingle();
    if (influencerError) throw influencerError;
    if (!influencer) return jsonError('Taslak bulunamadı.', 404);

    // Versiyon numarasını RPC verir (advisory lock): eşzamanlı iki kayıt çakışmaz.
    const { data, error } = await supabase.rpc('create_prompt_version', {
      p_category: 'character',
      p_key: CHARACTER_PROMPT_KEY,
      p_title: characterPromptTitle(influencer.name),
      p_body: parsed.data.body,
      p_variables: parsed.data.variables,
      p_influencer_id: id,
      p_change_note: 'Influencer sihirbazı',
    });
    if (error?.code === '42501')
      return jsonError('Prompt kaydetmek için editor yetkisi gerekir.', 403);
    if (error) throw error;
    return NextResponse.json({ version: data.version }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
