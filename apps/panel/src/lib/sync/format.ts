import { z } from 'zod';

/** "Şimdi senkronize et" isteği: hesap verilmezse tüm bağlı hesaplar. */
export const syncRequestSchema = z
  .object({ accountId: z.uuid().optional() })
  .strict();

export type SyncRequestResult =
  'queued' | 'throttled' | 'not_configured' | 'not_found';

/** public.request_sync dönüşü → HTTP durumu ve kullanıcı mesajı. */
export const syncRequestResponses: Record<
  SyncRequestResult,
  { status: number; message: string }
> = {
  queued: {
    status: 202,
    message: 'Senkronizasyon başlatıldı. Sonuç birkaç dakika içinde listede.',
  },
  throttled: {
    status: 429,
    message: 'Az önce senkronizasyon istendi. 2 dakika sonra tekrar deneyin.',
  },
  not_configured: {
    status: 503,
    message:
      'Senkronizasyon bu ortamda yapılandırılmamış (Vault: project_url, cron_secret).',
  },
  not_found: { status: 404, message: 'Bağlı hesap bulunamadı.' },
};

export function isSyncRequestResult(
  value: unknown,
): value is SyncRequestResult {
  return (
    typeof value === 'string' && Object.hasOwn(syncRequestResponses, value)
  );
}

const jobs: Record<string, string> = {
  metrics: 'Metrik snapshot',
  posts: 'Yeni postlar',
  accounts: 'Hesap istatistikleri',
  manual: 'Manuel',
  comments: 'Yorumlar', // #61
  comment_reply: 'Yorum yanıtı', // #61
};
const statuses: Record<string, string> = {
  running: 'Çalışıyor',
  succeeded: 'Başarılı',
  partial: 'Kısmi',
  failed: 'Başarısız',
};
const platforms: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

export const jobLabel = (job: string) => jobs[job] ?? job;
export const statusLabel = (status: string) => statuses[status] ?? status;
export const platformLabel = (platform: string | null) =>
  platform ? (platforms[platform] ?? platform) : '—';

/** Çalışma süresi: "12 sn", "3 dk 5 sn"; bitmemişse null. */
export function formatDuration(
  startedAt: string,
  finishedAt: string | null,
): string | null {
  if (!finishedAt) return null;
  const ms = Date.parse(finishedAt) - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} sn`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds ? `${minutes} dk ${seconds} sn` : `${minutes} dk`;
}
