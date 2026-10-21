import { NextResponse, type NextRequest } from 'next/server';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { influencerDraftSchema } from '@/lib/influencer-wizard';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const body = await parseJson(request, influencerDraftSchema);
    if (!body.ok) return body.response;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('influencers')
      .insert({ ...body.data, status: 'draft' })
      .select('id, name, slug, niche, language, status')
      .single();
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Bu slug zaten kullanılıyor.' },
        { status: 409 },
      );
    }
    if (error) throw error;
    return NextResponse.json({ influencer: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
