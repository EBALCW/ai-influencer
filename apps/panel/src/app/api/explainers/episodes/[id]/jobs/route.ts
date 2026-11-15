import { NextResponse } from 'next/server';
import { isJobKind, isVisualRoute } from '@ai-influencer/shared';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import {
  PRODUCTION_JOB_KINDS,
  requiredCapabilities,
  stageKeys,
} from '@/lib/explainer/model';
import { episodeJobSchema } from '@/lib/explainer/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string }> };

/**
 * "Üretime gönder" (`enqueue_episode_job`). İstemci yalnız türü ve duracağı aşamayı seçer;
 * aşamalar veritabanında sabittir, parametreler orada dondurulur, gereken makine yetenekleri
 * burada bölümün geçerli görsel yolundan (bölüm → seri) hesaplanır. Senaryo onaylı değilse
 * veritabanı reddeder (409).
 */
export async function POST(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('Bölüm bulunamadı.', 404);
  const parsed = await parseJson(request, episodeJobSchema);
  if (!parsed.ok) return parsed.response;
  const { kind, stop_at: stopAt } = parsed.data;
  if (!isJobKind(kind) || !PRODUCTION_JOB_KINDS.includes(kind))
    return jsonError('Geçersiz iş türü.', 400);
  if (stopAt !== null && !stageKeys(kind).includes(stopAt))
    return jsonError('Geçersiz aşama.', 400);
  try {
    const supabase = await createSupabaseServerClient();
    const { data: episode, error: readError } = await supabase
      .from('episodes')
      .select('visual_route, series(visual_route)')
      .eq('id', id)
      .maybeSingle();
    if (readError) return explainerDbError(readError);
    if (!episode) return jsonError('Bölüm bulunamadı.', 404);
    const route = episode.visual_route ?? episode.series?.visual_route ?? null;
    if (!route || !isVisualRoute(route))
      return jsonError(
        'Üretimden önce görsel yolu seçin (seride ya da bölüm ayarlarında).',
        422,
      );
    const capabilities = requiredCapabilities(kind, route, stopAt);
    if (!capabilities)
      return jsonError(
        'Seçili görsel yolun üretim aşaması henüz yok. Başka bir yol seçin.',
        422,
      );
    const { data, error } = await supabase.rpc('enqueue_episode_job', {
      p_episode_id: id,
      p_kind: kind,
      p_required_capabilities: capabilities,
      ...(stopAt ? { p_stop_at: stopAt } : {}),
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ job: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
