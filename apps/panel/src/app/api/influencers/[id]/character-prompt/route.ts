import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const promptSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  variables: z.record(z.string(), z.string()).default({}),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return jsonError('Influencer bulunamadı.', 404);
    }
    const parsed = await parseJson(request, promptSchema);
    if (!parsed.ok) return parsed.response;
    const supabase = await createSupabaseServerClient();
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('id')
      .eq('id', id)
      .eq('status', 'draft')
      .maybeSingle();
    if (influencerError) throw influencerError;
    if (!influencer) return jsonError('Taslak bulunamadı.', 404);

    const { data: previous, error: previousError } = await supabase
      .from('prompts')
      .select('version')
      .eq('influencer_id', id)
      .eq('category', 'character')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousError) throw previousError;

    const { error } = await supabase.from('prompts').insert({
      influencer_id: id,
      category: 'character',
      version: (previous?.version ?? 0) + 1,
      body: parsed.data.body,
      variables: parsed.data.variables,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
