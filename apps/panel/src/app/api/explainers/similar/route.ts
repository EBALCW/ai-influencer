import { NextResponse } from 'next/server';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { explainerDbError } from '@/lib/explainer/api';
import { similarQuerySchema } from '@/lib/explainer/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Benzer konu araması (`find_similar_topics`, #202 kancası): yeni konu yazılırken ya da öneri
 * seçilirken "bunu daha önce yaptık mı" uyarısı. Engellemez. SECURITY INVOKER: RLS çağıranın
 * çalışma alanıyla sınırlar; viewer da okuyabilir.
 */
export async function GET(request: Request) {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const parsed = similarQuerySchema.safeParse({
    title: url.searchParams.get('title') ?? '',
    ...(url.searchParams.get('exclude')
      ? { exclude: url.searchParams.get('exclude') }
      : {}),
  });
  if (!parsed.success) return jsonError('İstek doğrulanamadı.', 400);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('find_similar_topics', {
      p_title: parsed.data.title,
      p_limit: 5,
      ...(parsed.data.exclude
        ? { p_exclude_episode_id: parsed.data.exclude }
        : {}),
    });
    if (error) return explainerDbError(error);
    return NextResponse.json({ similar: data });
  } catch (error) {
    return apiError(error);
  }
}
