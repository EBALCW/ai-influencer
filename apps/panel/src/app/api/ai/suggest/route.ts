import { NextResponse, type NextRequest } from 'next/server';
import { jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClaudeClient } from '@/lib/ai/claude';
import { getAiConfig } from '@/lib/ai/config';
import { AiError } from '@/lib/ai/errors';
import { aiRateLimiter } from '@/lib/ai/rate-limit';
import { aiApiRequestSchema, type AiTask } from '@/lib/ai/schemas';
import { suggest } from '@/lib/ai/suggest';
import { recordAiUsage } from '@/lib/ai/usage-cost';
const categories = {
  persona: 'character',
  caption: 'caption',
  script: 'short_film',
  weekly: 'research',
} as const;
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const body = await parseJson(request, aiApiRequestSchema);
    if (!body.ok) return body.response;
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
    const db = await createSupabaseServerClient();
    const { influencerId, request: input } = body.data;
    const inf = await db
      .from('influencers')
      .select('id')
      .eq('id', influencerId)
      .maybeSingle();
    if (inf.error) throw new Error('influencer_read');
    if (!inf.data) return jsonError('Influencer bulunamadı.', 404);
    const source = async (task: AiTask) => {
      const p = await db
        .from('prompts')
        .select('id,version,body')
        .eq('category', categories[task])
        .or(`influencer_id.eq.${influencerId},influencer_id.is.null`)
        .order('influencer_id', { ascending: true, nullsFirst: false })
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (p.error || !p.data?.body.trim()) throw new AiError('not_configured');
      return p.data;
    };
    // Veri okuma/prompt çözme çağrıdan önce tamamlanır; sadece sayısal özet gönderilir.
    let metrics: unknown;
    if (input.task === 'weekly') {
      const summary = await db.rpc('ai_weekly_summary', {
        p_influencer_id: influencerId,
      });
      if (summary.error) throw new Error('weekly_read');
      metrics = summary.data;
    }
    const result = await suggest(input, {
      client: createClaudeClient(config.apiKey),
      model: config.model,
      source,
      metrics,
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
    });
    return NextResponse.json(result);
  } catch (error) {
    // Sağlayıcı/SDK hata nesnesi kullanıcı girdisi veya anahtar taşıyabilir.
    console.warn('[ai]', error instanceof AiError ? error.code : 'internal');
    return error instanceof AiError
      ? jsonError(error.message, error.status)
      : jsonError('AI isteği tamamlanamadı.', 500);
  }
}
