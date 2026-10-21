import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { createClaudeClient } from '@/lib/ai/claude';
import { getAiConfig } from '@/lib/ai/config';
import { AiError } from '@/lib/ai/errors';
import { aiRateLimiter } from '@/lib/ai/rate-limit';
import { suggestRequestSchema } from '@/lib/ai/schemas';
import { suggest } from '@/lib/ai/suggest';

/**
 * AI önerisi (persona, caption). Öneri kaydedilmez; istemci kullanıcıya gösterir,
 * kullanıcı onaylarsa forma yazar. Model çıktısı hiçbir aksiyonu otomatik tetiklemez.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;

    const body = await parseJson(request, suggestRequestSchema);
    if (!body.ok) return body.response;

    const config = getAiConfig();
    if (!config) {
      const error = new AiError('not_configured');
      return jsonError(error.message, error.status);
    }

    const limit = aiRateLimiter.check(auth.user.id);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Çok fazla AI isteği. Biraz bekleyip tekrar dene.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    }

    const result = await suggest(body.data, {
      client: createClaudeClient(config.apiKey),
      model: config.model,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiError) {
      // Sadece kod ve sağlayıcı istek kimliği loglanır; anahtar veya içerik yazılmaz
      console.warn('[ai]', error.code, error.requestId ?? '-');
      return jsonError(error.message, error.status);
    }
    return apiError(error);
  }
}
