import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import {
  isSamePromptContent,
  MAX_BUNDLE_BYTES,
  parsePromptBundle,
  type PromptImportResult,
} from '@/lib/prompt-bundle';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Panelden indirilmiş prompt paketini içe aktarır (#46). En az editor.
 *
 * Paket önce bütünüyle doğrulanır (Zod + influencer slug'ları); bir hata varsa hiçbir
 * şey yazılmaz ve 400 döner. Sonra her prompt için `create_prompt_version` RPC'si ile
 * yeni versiyon oluşturulur: soy yoksa v1, varsa bir sonraki versiyon. Eski versiyonlar
 * değişmez. Son versiyonla içerik olarak aynı olan prompt atlanır (tekrar yüklemede
 * gereksiz versiyon birikmesin).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;

    let file: FormDataEntryValue | null;
    try {
      file = (await request.formData()).get('file');
    } catch {
      return jsonError('Dosya yüklenemedi.', 400);
    }
    if (!(file instanceof File) || file.size === 0)
      return jsonError('Bir prompt paketi (.json) seçin.', 400);
    if (file.size > MAX_BUNDLE_BYTES)
      return jsonError('Dosya en fazla 1 MB olabilir.', 400);

    const parsed = parsePromptBundle(await file.text());
    if (!parsed.ok)
      return NextResponse.json(
        { error: parsed.errors[0], errors: parsed.errors.slice(0, 20) },
        { status: 400 },
      );

    const supabase = await createSupabaseServerClient();
    const slugs = [
      ...new Set(
        parsed.prompts
          .map((entry) => entry.influencer)
          .filter((slug): slug is string => !!slug),
      ),
    ];
    const influencerIds = new Map<string, string>();
    if (slugs.length) {
      const { data, error } = await supabase
        .from('influencers')
        .select('id, slug')
        .in('slug', slugs);
      if (error) throw new Error(`Influencer okunamadı: ${error.message}`);
      for (const row of data ?? []) influencerIds.set(row.slug, row.id);
      const missing = slugs.filter((slug) => !influencerIds.has(slug));
      if (missing.length)
        return jsonError(
          `Bu ortamda olmayan influencer: ${missing.join(', ')}`,
          400,
        );
    }

    const { data: lineages, error: lineageError } = await supabase
      .from('prompt_lineages')
      .select('category, key, influencer_id, title, body, negative, variables');
    if (lineageError)
      throw new Error(`Prompt'lar okunamadı: ${lineageError.message}`);
    const latest = new Map(
      (lineages ?? []).map((row) => [
        `${row.influencer_id ?? ''}/${row.category}/${row.key}`,
        row,
      ]),
    );

    const result: PromptImportResult = { created: 0, unchanged: 0, failed: [] };
    for (const entry of parsed.prompts) {
      const influencerId = entry.influencer
        ? influencerIds.get(entry.influencer)!
        : null;
      const current = latest.get(
        `${influencerId ?? ''}/${entry.category}/${entry.key}`,
      );
      if (current && isSamePromptContent(entry, current)) {
        result.unchanged += 1;
        continue;
      }
      const { error } = await supabase.rpc('create_prompt_version', {
        p_category: entry.category,
        p_key: entry.key,
        p_title: entry.title,
        p_body: entry.body,
        p_negative: entry.negative,
        p_variables: entry.variables,
        p_influencer_id: influencerId ?? undefined,
        p_change_note: entry.changeNote || 'Dosyadan içe aktarıldı',
      });
      if (error) {
        if (error.code === '42501')
          return jsonError('Bu işlem için düzenleme yetkisi gerekir.', 403);
        console.warn('[prompts:import]', error.code ?? 'unknown');
        result.failed.push({
          title: entry.title,
          message:
            error.code === '23514'
              ? 'Kayıt kurallara uymuyor.'
              : 'Kaydedilemedi.',
        });
        continue;
      }
      result.created += 1;
    }

    if (result.created) revalidatePath('/prompts');
    return NextResponse.json(result, {
      status: result.failed.length && !result.created ? 500 : 200,
    });
  } catch (error) {
    return apiError(error);
  }
}
