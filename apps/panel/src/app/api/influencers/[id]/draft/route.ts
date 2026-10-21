import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { influencerDraftSchema } from '@/lib/influencer-wizard';
import { influencerIdFrom } from '@/lib/persona-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = await influencerIdFrom(context);
    if (!id) return jsonError('Influencer bulunamadı.', 404);
    const body = await parseJson(request, influencerDraftSchema);
    if (!body.ok) return body.response;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('influencers')
      .update(body.data)
      .eq('id', id)
      .eq('status', 'draft')
      .select('id, name, slug, niche, language, status')
      .maybeSingle();
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Bu slug zaten kullanılıyor.' },
        { status: 409 },
      );
    }
    if (error) throw error;
    if (!data)
      return jsonError('Taslak bulunamadı veya artık düzenlenemiyor.', 404);

    revalidatePath('/influencers');
    revalidatePath(`/influencers/${encodeURIComponent(data.slug)}/setup`);
    return NextResponse.json({ influencer: data });
  } catch (error) {
    return apiError(error);
  }
}
