import { z } from 'zod';
import type { Row } from '@ai-influencer/shared';

/** Panelde okunan yayın işi alanları. `provider_upload_url` API rollerine kapalıdır, seçilmez. */
export const PUBLISH_JOB_COLUMNS =
  'id,content_item_id,account_id,platform,status,scheduled_for,title,attempts,max_attempts,next_attempt_at,error,external_id,published_post_id,finished_at,created_at';
export type PublishJobView = Pick<
  Row<'publish_jobs'>,
  | 'id'
  | 'content_item_id'
  | 'account_id'
  | 'platform'
  | 'status'
  | 'scheduled_for'
  | 'title'
  | 'attempts'
  | 'max_attempts'
  | 'next_attempt_at'
  | 'error'
  | 'external_id'
  | 'published_post_id'
  | 'finished_at'
  | 'created_at'
>;
export type PublishJobStatus = PublishJobView['status'];

export const publishStatusLabels: Record<PublishJobStatus, string> = {
  queued: 'Kuyrukta',
  processing: 'İşleniyor',
  published: 'Yayınlandı',
  failed: 'Başarısız',
  manual_required: 'Elle yayın gerekli',
  cancelled: 'İptal edildi',
};

export const openPublishStatuses: PublishJobStatus[] = ['queued', 'processing'];

/** Kartın en güncel yayın işi (oluşturulma zamanına göre). */
export function latestJob(
  jobs: PublishJobView[],
  contentId: string,
): PublishJobView | null {
  return (
    jobs
      .filter((j) => j.content_item_id === contentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

const tag = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .refine((t) => !/[<>,]/.test(t), 'Etiket <, > veya virgül içeremez.');

/** "Şimdi yayınla" / "Planla" isteği. Route yalnız iş açar; sağlayıcı API'si çağrılmaz. */
export const publishRequestSchema = z
  .object({
    mode: z.enum(['now', 'schedule']),
    scheduled_at: z.string().datetime({ offset: true }).optional(),
    title: z.string().trim().min(1).max(100),
    caption: z.string().max(2200).default(''),
    tags: z.array(tag).max(30).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === 'schedule' && !value.scheduled_at) {
      ctx.addIssue({
        code: 'custom',
        message: 'Planlama için yayın zamanı gerekli.',
      });
    }
    if (value.mode === 'now' && value.scheduled_at) {
      ctx.addIssue({ code: 'custom', message: 'Şimdi yayınla zaman almaz.' });
    }
  });
export type PublishRequest = z.infer<typeof publishRequestSchema>;

/** Virgülle ayrılmış etiket metni → etiket listesi (#, boşluk ve tekrar temizlenir). */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(',')) {
    const t = raw.trim().replace(/^#/, '');
    if (t) seen.add(t);
  }
  return [...seen];
}

/** Yayın engelinin makine okunur nedeni (migration HINT) → kullanıcı mesajı ve HTTP kodu. */
const blockers: Record<string, string> = {
  checklist_incomplete:
    'Yayın öncesi kontrol listesi tamamlanmadı; tüm maddeleri işaretleyin ve iki puanı en az 3 yapın.',
  ai_label_missing: 'Yayın öncesi “AI etiketi” maddesi işaretlenmeli.',
  no_final_video: 'İçeriğe bağlı bir final video gerekli.',
  account_not_connected: 'Hedef hesap bağlı değil; önce hesabı bağlayın.',
  unsupported_platform: 'Bu platform için otomatik yayın yok.',
  no_target_account: 'Önce hedef hesap seçin.',
};
export function publishBlocker(error: {
  code?: string;
  hint?: string | null;
}): { status: number; message: string } | null {
  if (error.code === '23514' && error.hint && blockers[error.hint]) {
    return { status: 422, message: blockers[error.hint]! };
  }
  if (error.code === '23505' && error.hint === 'already_published') {
    return { status: 409, message: 'İçerik zaten yayında.' };
  }
  if (error.code === '23505') {
    return {
      status: 409,
      message: 'Bu içerik için açık veya yayınlanmış bir iş zaten var.',
    };
  }
  if (error.code === '55000') {
    return { status: 409, message: 'Yalnız kuyruktaki iş iptal edilebilir.' };
  }
  return null;
}
