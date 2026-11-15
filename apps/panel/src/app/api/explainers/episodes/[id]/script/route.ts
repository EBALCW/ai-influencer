import { NextResponse } from 'next/server';
import type { Json } from '@ai-influencer/shared';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import { getEpisodeScript } from '@/lib/explainer/queries';
import { scriptSaveSchema } from '@/lib/explainer/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string }> };

/** Senaryo paketinin güncel hâli: çakışmada "güncel sürümle karşılaştır" bunu okur. Ekip okur. */
export async function GET(_request: Request, context: Context) {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('Bölüm bulunamadı.', 404);
  try {
    const script = await getEpisodeScript(id);
    if (!script) return jsonError('Bölüm bulunamadı.', 404);
    return NextResponse.json({ script });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Senaryo paketini kaydeder (`save_episode_script`). `expected_version` iyimser kilittir: bölüm
 * o sürümde değilse 409 + `code: version_conflict` döner, hiçbir şey yazılmaz. İçerik değiştiyse
 * veritabanı yeni sürüm açar ve onayı siler.
 */
export async function PUT(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('Bölüm bulunamadı.', 404);
  const parsed = await parseJson(request, scriptSaveSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('save_episode_script', {
      p_episode_id: id,
      p_script_text: input.script_text,
      ...(input.fact_notes ? { p_fact_notes: input.fact_notes } : {}),
      // JSON null PostgREST'te SQL NULL olur ("dokunma"); `script: null` bu yüzden açık
      // bayrakla (`p_clear_script`) temizler.
      ...(input.script
        ? { p_script: input.script as Json }
        : input.script === null
          ? { p_clear_script: true }
          : {}),
      ...(input.sensitivity_flags
        ? { p_sensitivity_flags: input.sensitivity_flags }
        : {}),
      ...(input.sensitivity_note !== undefined
        ? { p_sensitivity_note: input.sensitivity_note }
        : {}),
      ...(input.expected_version !== undefined
        ? { p_expected_version: input.expected_version }
        : {}),
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ episode: data });
  } catch (error) {
    return apiError(error);
  }
}
