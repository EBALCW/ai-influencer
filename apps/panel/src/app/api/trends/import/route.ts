import { NextResponse } from 'next/server';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { todayIso } from '@/lib/costs/period';
import { refreshResearch } from '@/lib/research/api';
import {
  MAX_TREND_CSV_BYTES,
  parseTrendCsv,
  type TrendImportResult,
} from '@/lib/research/csv';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const scopeKey = (url: string, influencerId: string | null) =>
  `${influencerId ?? ''} ${url}`;

/**
 * `research/trends.csv` biçimindeki dosyayı içe aktarır (#10). En az editor.
 * Geçerli satırlar eklenir; hatalı satırlar satır numarasıyla raporlanır.
 * Aynı kapsamda zaten arşivde olan link (veya dosyada tekrar eden) atlanır,
 * böylece düzeltilen dosya tekrar yüklenebilir.
 */
export async function POST(request: Request) {
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
      return jsonError('Bir CSV dosyası seçin.', 400);
    if (file.size > MAX_TREND_CSV_BYTES)
      return jsonError('Dosya en fazla 2 MB olabilir.', 400);

    const supabase = await createSupabaseServerClient();
    const influencers = await supabase.from('influencers').select('id, slug');
    if (influencers.error)
      throw new Error(`Influencer okunamadı: ${influencers.error.message}`);
    const slugs = new Map(
      (influencers.data ?? []).map((row) => [row.slug, row.id]),
    );

    const parsed = parseTrendCsv(await file.text(), slugs);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const errors = [...parsed.errors];
    const existing = new Set<string>();
    const urls = [...new Set(parsed.rows.map((row) => row.input.url))];
    for (let i = 0; i < urls.length; i += 100) {
      const { data, error } = await supabase
        .from('trends')
        .select('url, influencer_id')
        .in('url', urls.slice(i, i + 100));
      if (error) throw new Error(`Arşiv okunamadı: ${error.message}`);
      for (const row of data ?? [])
        existing.add(scopeKey(row.url, row.influencer_id));
    }

    let skipped = 0;
    const today = todayIso();
    const pending: Array<{
      line: number;
      values: (typeof parsed.rows)[number]['input'] & { captured_on: string };
    }> = [];
    for (const row of parsed.rows) {
      const key = scopeKey(row.input.url, row.input.influencer_id);
      if (existing.has(key)) {
        skipped += 1;
        continue;
      }
      existing.add(key);
      // Toplu insert'te bütün satırlar aynı anahtarlara sahip olmalı.
      pending.push({
        line: row.line,
        values: { ...row.input, captured_on: row.input.captured_on ?? today },
      });
    }

    let created = 0;
    if (pending.length) {
      const batch = await supabase
        .from('trends')
        .insert(pending.map((row) => row.values));
      if (!batch.error) created = pending.length;
      else if (batch.error.code === '42501')
        return jsonError('Editor yetkisi gerekli.', 403);
      else {
        // Eşzamanlı ekleme veya DB kuralı: satır satır dene, hatayı satıra yaz.
        for (const row of pending) {
          const { error } = await supabase.from('trends').insert(row.values);
          if (!error) created += 1;
          else if (error.code === '23505') skipped += 1;
          else
            errors.push({
              line: row.line,
              message:
                error.code === '23514'
                  ? 'Kayıt kurallara uymuyor.'
                  : 'Kaydedilemedi.',
            });
        }
      }
    }

    if (created) refreshResearch();
    errors.sort((a, b) => a.line - b.line);
    const result: TrendImportResult = {
      created,
      skipped,
      errors: errors.slice(0, 200),
      ignoredColumns: parsed.ignoredColumns,
    };
    return NextResponse.json(result, {
      status: created || skipped || !errors.length ? 200 : 422,
    });
  } catch (error) {
    return apiError(error);
  }
}
