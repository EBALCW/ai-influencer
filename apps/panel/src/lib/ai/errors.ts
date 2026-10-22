import Anthropic from '@anthropic-ai/sdk';

export type AiErrorCode =
  | 'not_configured'
  | 'auth_failed'
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'refused'
  | 'invalid_output'
  | 'bad_request'
  | 'billing_failed';

const userMessages: Record<AiErrorCode, { status: number; message: string }> = {
  billing_failed: {
    status: 503,
    message:
      'AI kullanım maliyeti kaydedilemedi. Tekrar denemeden maliyet kayıtlarını kontrol edin.',
  },
  not_configured: {
    status: 503,
    message:
      'AI asistanı yapılandırılmamış. ANTHROPIC_API_KEY ve Ayarlar → AI alanını kontrol edin.',
  },
  auth_failed: {
    status: 503,
    message: 'AI sağlayıcısı anahtarı reddetti. Yöneticiye haber ver.',
  },
  rate_limited: {
    status: 429,
    message: 'AI sağlayıcısı şu an yoğun. Biraz sonra tekrar dene.',
  },
  timeout: {
    status: 504,
    message: 'AI yanıtı zamanında gelmedi. Tekrar dene.',
  },
  unavailable: {
    status: 502,
    message: 'AI sağlayıcısına ulaşılamadı. Biraz sonra tekrar dene.',
  },
  refused: {
    status: 422,
    message:
      'Model bu isteğe yanıt vermedi. Girdiyi değiştirip tekrar deneyebilirsin.',
  },
  invalid_output: {
    status: 502,
    message: 'Model beklenen biçimde yanıt vermedi. Tekrar dene.',
  },
  bad_request: {
    status: 400,
    message: 'AI isteği geçersiz bulundu.',
  },
};

/** Kullanıcıya gösterilebilecek, iç ayrıntı içermeyen AI hatası. */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;
  /** Destek için sağlayıcının istek kimliği; anahtar veya yanıt içeriği taşımaz. */
  readonly requestId: string | null;

  constructor(code: AiErrorCode, requestId: string | null = null) {
    super(userMessages[code].message);
    this.name = 'AiError';
    this.code = code;
    this.status = userMessages[code].status;
    this.requestId = requestId;
  }
}

/**
 * SDK hatalarını AiError'a çevirir. En özelden en genele doğru sıralı;
 * hata mesajı içeriğine bakılmaz (typed sınıflar kullanılır).
 */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError('timeout');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError('unavailable');
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new AiError('auth_failed', error.requestID ?? null);
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new AiError('auth_failed', error.requestID ?? null);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError('rate_limited', error.requestID ?? null);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError('bad_request', error.requestID ?? null);
  }
  if (error instanceof Anthropic.APIError) {
    // 5xx, 529 (overloaded) ve diğer durum kodları
    return new AiError('unavailable', error.requestID ?? null);
  }
  // APIError dışındaki SDK hataları: yapılandırılmış çıktı ayrıştırılamadı
  if (error instanceof Anthropic.AnthropicError) {
    return new AiError('invalid_output');
  }
  return new AiError('unavailable');
}
