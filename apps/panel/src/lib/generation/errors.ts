export type GenerationErrorCode =
  | 'not_configured'
  | 'auth_failed'
  | 'insufficient_credits'
  | 'rejected'
  | 'invalid_request'
  | 'not_found'
  | 'not_cancelable'
  | 'budget_exceeded'
  | 'timeout'
  | 'unavailable';

const userMessages: Record<
  GenerationErrorCode,
  { status: number; message: string }
> = {
  not_configured: {
    status: 503,
    message: 'Üretim sağlayıcısı yapılandırılmamış.',
  },
  auth_failed: {
    status: 503,
    message: 'Üretim sağlayıcısı anahtarı reddetti. Yöneticiye haber ver.',
  },
  insufficient_credits: {
    status: 402,
    message: 'Sağlayıcı hesabında yeterli kredi yok.',
  },
  rejected: {
    status: 400,
    message:
      'Sağlayıcı isteği kabul etmedi (parametreler veya eşzamanlı iş sınırı). Biraz sonra tekrar dene.',
  },
  invalid_request: {
    status: 400,
    message: 'Üretim isteği geçersiz.',
  },
  not_found: {
    status: 404,
    message: 'Üretim işi veya model bulunamadı.',
  },
  not_cancelable: {
    status: 409,
    message: 'İş başladığı için artık iptal edilemiyor.',
  },
  budget_exceeded: {
    status: 402,
    message: 'Kredi limiti aşılıyor. Owner onayı gerekli.',
  },
  timeout: {
    status: 504,
    message: 'Üretim sağlayıcısı zamanında yanıt vermedi.',
  },
  unavailable: {
    status: 502,
    message: 'Üretim sağlayıcısına şu an ulaşılamıyor.',
  },
};

/** Kullanıcıya gösterilebilecek, sağlayıcı yanıtı veya anahtar içermeyen hata. */
export class GenerationError extends Error {
  readonly code: GenerationErrorCode;
  readonly status: number;

  constructor(code: GenerationErrorCode) {
    super(userMessages[code].message);
    this.name = 'GenerationError';
    this.code = code;
    this.status = userMessages[code].status;
  }
}

/**
 * HTTP durum kodunu hata koduna çevirir. Sağlayıcı dokümanları hata
 * mesajını ayrıştırmamayı öneriyor; sadece durum koduna bakılır.
 */
export function generationErrorFromStatus(status: number): GenerationError {
  if (status === 401) return new GenerationError('auth_failed');
  if (status === 402 || status === 403) {
    return new GenerationError('insufficient_credits');
  }
  if (status === 404) return new GenerationError('not_found');
  if (status === 422) return new GenerationError('invalid_request');
  if (status === 400 || status === 429) return new GenerationError('rejected');
  return new GenerationError('unavailable');
}
