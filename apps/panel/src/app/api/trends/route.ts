import { NextResponse } from 'next/server';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { refreshResearch, trendDbError } from '@/lib/research/api';
import { trendSchema } from '@/lib/research/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Trend arşivine kayıt ekler (#10). En az editor. Platform verilmezse linkten
 * bulunur; `created_by` trigger ile dolar, istemciden alınmaz.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(request, trendSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('trends')
      .insert(parsed.data)
      .select('*')
      .single();
    if (error) return trendDbError(error);
    refreshResearch();
    return NextResponse.json({ trend: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
