// Görsel/video üretim sağlayıcısı sözleşmesi (ADR 0002, #47, #150). Worker sadece bu arayüzü
// bilir; sağlayıcıya özgü endpoint/alan ayrıntıları adaptörde kalır.

export type GenerationMode =
  'text_to_image' | 'image_to_video' | 'video_to_video';

/** Referans dosya: kısa ömürlü imzalı URL + MIME türü (assets.mime_type). */
export type InputFile = { url: string; mimeType: string | null };

/** Worker'ın Storage'dan okuduğu referans dosyalar. */
export type InputMedia = { images: InputFile[]; video: InputFile | null };

/** Sağlayıcının indirebileceği URL'ler (gerekirse sağlayıcıya yüklenmiş kopyalar). */
export type PreparedInputs = { imageUrls: string[]; videoUrl: string | null };

/** Sağlayıcıya gönderilecek iş. `id` = generations.id, Idempotency-Key olarak kullanılır. */
export type SubmitJob = {
  id: string;
  mode: GenerationMode;
  prompt: string;
  negative: string | null;
  seed: number | null;
  /** Video çözünürlüğü: '480p' | '720p' | '1080p' (video_to_video). */
  resolution: string;
  /** Görsel çözünürlüğü: '2K' | '4K' (text_to_image). */
  imageResolution: string;
  /** Görsel en-boy oranı (ör. '9:16'); null = model varsayılanı. */
  aspectRatio: string | null;
  durationSeconds: number | null;
  /** Referans görseller (sağlayıcının indirebileceği URL). */
  imageUrls: string[];
  /** Referans video (video_to_video). */
  videoUrl: string | null;
  /** Modele özgü ek alanlar (params.model_params). Sır içermez. */
  modelParams: Record<string, string | number | boolean>;
};

export type ProviderJobStatus =
  'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type PollResult = {
  status: ProviderJobStatus;
  /** 0–100; sağlayıcı bildirmiyorsa null. */
  progress: number | null;
  /** succeeded durumunda indirilecek sonuç dosyası. */
  resultUrl: string | null;
  /** URL uzantısından tahmin edilen tür; indirilen dosyanın Content-Type'ı önceliklidir. */
  contentType: string | null;
  /** Sağlayıcı bildiriyorsa harcanan kredi (Higgsfield USD faturalar, null döner). */
  credits: number | null;
  /** Çıktı URL'lerinin çalışmayı bırakacağı an (ISO). Bilinmiyorsa null. */
  expiresAt: string | null;
  /** Kullanıcıya gösterilebilir kısa hata (sağlayıcı yanıtının tamamı değil). */
  error: string | null;
};

export interface GenerationProvider {
  /** generations.tool değeri. */
  readonly id: string;
  /**
   * Referans dosyaları sağlayıcının indirebileceği hale getirir (ör. sağlayıcıya yükleme).
   * Tanımlı değilse imzalı URL'ler olduğu gibi gönderilir.
   */
  prepareInputs?(media: InputMedia): Promise<PreparedInputs>;
  /** Gönderimden önce tahmini tutar (USD). Desteklenmiyorsa tanımlanmaz. */
  estimate?(job: SubmitJob): Promise<number | null>;
  submit(job: SubmitJob): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<PollResult>;
  /** Sadece başlamamış iş iptal edilebilir; aksi halde ProviderError('not_cancelable'). */
  cancel(providerJobId: string): Promise<void>;
}

export type ProviderErrorCode =
  | 'not_configured'
  | 'auth_failed'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'invalid_request'
  | 'not_found'
  | 'not_cancelable'
  | 'timeout'
  | 'unavailable';

const messages: Record<ProviderErrorCode, string> = {
  not_configured: 'Bu üretim modu için sağlayıcı modeli yapılandırılmamış.',
  auth_failed: 'Üretim sağlayıcısı anahtarı reddetti.',
  insufficient_credits: 'Sağlayıcı hesabında yeterli bakiye yok.',
  rate_limited:
    'Sağlayıcı kuyruğu dolu; istek bekleme süresinden sonra tekrar gönderilecek.',
  invalid_request: 'Sağlayıcı üretim parametrelerini kabul etmedi.',
  not_found: 'Üretim işi veya model sağlayıcıda bulunamadı.',
  not_cancelable: 'İş başladığı için sağlayıcıda iptal edilemedi.',
  timeout: 'Üretim sağlayıcısı zamanında yanıt vermedi.',
  unavailable: 'Üretim sağlayıcısına şu an ulaşılamıyor.',
};

/** Geçici hatalar: aynı iş geri çekilmeyle tekrar denenir. */
const retryable = new Set<ProviderErrorCode>([
  'rate_limited',
  'timeout',
  'unavailable',
]);

export type ProviderErrorOptions = {
  /** Mesaja eklenen kısa açıklama (sağlayıcı gövdesi değil, adaptörün kendi metni). */
  detail?: string;
  /** Sağlayıcının istediği bekleme (Retry-After, saniye). */
  retryAfterSeconds?: number | null;
  /** Destek için sağlayıcı çağrı kimliği (X-Correlation-ID). Sır değildir. */
  correlationId?: string | null;
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;
  readonly correlationId: string | null;
  constructor(code: ProviderErrorCode, options: ProviderErrorOptions = {}) {
    const correlationId = options.correlationId ?? null;
    super(
      [
        messages[code],
        options.detail,
        correlationId ? `(destek kimliği: ${correlationId})` : undefined,
      ]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable.has(code);
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.correlationId = correlationId;
  }
}

/**
 * HTTP durum kodu → hata kodu. Sağlayıcı mesajı ayrıştırılmaz (ADR 0002). Higgsfield
 * (Errors and retries, 2026-10-24): 400 geçersiz parametre (kalıcı), 429 kuyruk dolu
 * (`Retry-After` sonra tekrar), 423/500/503 geçici.
 */
export function providerErrorFromStatus(
  status: number,
  options: ProviderErrorOptions = {},
): ProviderError {
  if (status === 401) return new ProviderError('auth_failed', options);
  if (status === 402 || status === 403)
    return new ProviderError('insufficient_credits', options);
  if (status === 404) return new ProviderError('not_found', options);
  if (status === 400 || status === 422)
    return new ProviderError('invalid_request', options);
  if (status === 429) return new ProviderError('rate_limited', options);
  return new ProviderError('unavailable', options);
}
