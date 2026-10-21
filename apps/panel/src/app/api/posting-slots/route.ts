import { NextResponse } from 'next/server';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { contentDbError, refreshContent } from '@/lib/content/api';
import { slotSchema } from '@/lib/content/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(request, slotSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('posting_slots')
      .insert(parsed.data)
      .select('*')
      .single();
    if (error) return contentDbError(error);
    refreshContent();
    return NextResponse.json({ slot: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
