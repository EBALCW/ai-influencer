import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { jsonError, requireApiRole } from '@/lib/auth-api';
import { createClaudeClient } from '@/lib/ai/claude';
import { getAiConfig } from '@/lib/ai/config';
import { AiError } from '@/lib/ai/errors';
import { libraryPromptSource } from '@/lib/ai/prompt-source';
import { aiRateLimiter } from '@/lib/ai/rate-limit';
import { suggest } from '@/lib/ai/suggest';
import { recordAiUsage } from '@/lib/ai/usage-cost';
import { formatAiSummary } from '@/lib/reports/ai-summary';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Raporun AI özeti ve önerileri (#48 asistanı, "weekly" görevi).
 * Claude'a yalnız raporda saklanan, veritabanının hesapladığı özet verilir;
 * model yeni sayı üretmez. Token maliyeti `costs`'a (ai_api) yazılır.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = z
      .string()
      .uuid()
      .safeParse((await context.params).id);
    if (!id.success) return jsonError('Rapor bulunamadı.', 404);

    const db = await createSupabaseServerClient();
    const report = await db
      .from('reports')
      .select('id, influencer_id, summary')
      .eq('id', id.data)
      .maybeSingle();
    if (report.error) throw new Error('report_read');
    if (!report.data) return jsonError('Rapor bulunamadı.', 404);
    const influencerId = report.data.influencer_id;
    if (!influencerId)
      return jsonError(
        'AI özeti influencer bazında üretilir; tek bir influencer seçin.',
        422,
      );

    const config = await getAiConfig();
    if (!config) throw new AiError('not_configured');
    const limit = aiRateLimiter.check(auth.user.id);
    if (!limit.ok)
      return NextResponse.json(
        { error: 'Çok fazla AI isteği. Biraz bekleyip tekrar dene.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );

    const result = await suggest(
      { task: 'weekly', input: { language: 'tr' } },
      {
        client: createClaudeClient(config.apiKey),
        model: config.model,
        source: libraryPromptSource(db, influencerId),
        metrics: report.data.summary,
        onUsage: async (usage, model) => {
          try {
            await recordAiUsage(db, {
              influencerId,
              model,
              usage,
              pricing: config.pricing,
              incurredOn: new Date().toISOString().slice(0, 10),
            });
          } catch {
            throw new AiError('billing_failed');
          }
        },
      },
    );
    if (result.task !== 'weekly') throw new AiError('invalid_output');

    const aiSummary = formatAiSummary(result.suggestion);
    const saved = await db
      .from('reports')
      .update({ ai_summary: aiSummary })
      .eq('id', id.data)
      .select('id')
      .maybeSingle();
    if (saved.error) throw new Error('report_write');
    if (!saved.data) return jsonError('editor yetkisi gerekli.', 403);

    revalidatePath(`/analytics/reports/${id.data}`);
    return NextResponse.json({ aiSummary, model: result.model });
  } catch (error) {
    // Sağlayıcı/SDK hata nesnesi kullanıcı girdisi veya anahtar taşıyabilir.
    console.warn(
      '[reports-ai]',
      error instanceof AiError ? error.code : 'internal',
    );
    return error instanceof AiError
      ? jsonError(error.message, error.status)
      : jsonError('AI özeti oluşturulamadı.', 500);
  }
}
