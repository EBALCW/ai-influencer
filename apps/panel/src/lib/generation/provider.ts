import type {
  GenerationJob,
  ImageRequest,
  ImageToVideoRequest,
  SubmitOptions,
  VideoToVideoRequest,
} from './types';

/**
 * Görsel/video üretim sağlayıcısı sözleşmesi. Tüm işler asenkrondur:
 * gönderim bir iş kimliği döner, sonuç `getStatus` ile (veya webhook) alınır.
 * Uygulamalar girdiyi Zod şemasıyla doğrular, hatada `GenerationError` atar.
 */
export interface GenerationProvider {
  /** `generations.tool` kolonuna yazılan sağlayıcı adı. */
  readonly id: string;
  generateImage(
    request: ImageRequest,
    options?: SubmitOptions,
  ): Promise<GenerationJob>;
  imageToVideo(
    request: ImageToVideoRequest,
    options?: SubmitOptions,
  ): Promise<GenerationJob>;
  videoToVideo(
    request: VideoToVideoRequest,
    options?: SubmitOptions,
  ): Promise<GenerationJob>;
  getStatus(providerJobId: string): Promise<GenerationJob>;
  /** Sadece başlamamış (queued) işler iptal edilebilir; aksi halde `not_cancelable`. */
  cancel(providerJobId: string): Promise<GenerationJob>;
}
