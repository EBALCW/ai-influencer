import { NextResponse } from 'next/server';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { clipDbError, refreshClips } from '@/lib/clips/api';
import { clipSchema } from '@/lib/clips/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Kaynağa klip adayı ekler (#173). En az editor. Aralık (en fazla 180 sn, video
 * süresini aşamaz) veritabanında da denetlenir; durum `candidate` başlar.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(request, clipSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('clips')
      .insert(parsed.data)
      .select('*')
      .single();
    if (error) return clipDbError(error);
    refreshClips();
    return NextResponse.json({ clip: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
