import { NextResponse } from 'next/server';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { clipDbError, refreshClips } from '@/lib/clips/api';
import { clipSourceSchema } from '@/lib/clips/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Klip kaynağı (yayıncı videosu) ekler (#173). En az editor. Link kanonik
 * YouTube biçimine çevrilir; izin `pending` başlar ve ayrıca işaretlenir.
 * `created_by` trigger ile dolar, istemciden alınmaz.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(request, clipSourceSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('clip_sources')
      .insert(parsed.data)
      .select('*')
      .single();
    if (error) return clipDbError(error);
    refreshClips();
    return NextResponse.json({ source: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
