import {
  EPISODE_STATUS_LABELS,
  WORKER_OFFLINE_AFTER_SECONDS,
  episodeLabel,
  isEpisodeStatus,
  type ModuleId,
} from '@ai-influencer/shared';

/**
 * Ana ekrandaki "son üretimler" (#200): modüller arası tek liste. Her modül bugün var olan
 * kendi tablosundan okunur (bölümler, klipler, influencer üretimleri) ve tarihe göre birleşir.
 */
export type ActivityItem = {
  id: string;
  module: ModuleId;
  title: string;
  /** Kısa bağlam: seri ve bölüm, kaynak video, influencer. */
  detail: string;
  status: string;
  href: string;
  at: string;
};

export const HOME_ACTIVITY_LIMIT = 8;

/** En yeni önce; aynı anda olanlar kimliğe göre kararlı sıralanır. */
export function mergeActivity(
  lists: readonly (readonly ActivityItem[])[],
  limit = HOME_ACTIVITY_LIMIT,
): ActivityItem[] {
  return lists
    .flat()
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function episodeActivity(row: {
  id: string;
  title: string;
  status: string;
  episode_number: number | null;
  updated_at: string;
  series: { name: string } | null;
}): ActivityItem {
  const label = episodeLabel(row.episode_number);
  return {
    id: `episode:${row.id}`,
    module: 'explainer',
    title: row.title,
    detail: row.series
      ? [row.series.name, label].filter(Boolean).join(' · ')
      : 'Tekil video',
    status: isEpisodeStatus(row.status)
      ? EPISODE_STATUS_LABELS[row.status]
      : row.status,
    href: `/explainers/episodes/${row.id}`,
    at: row.updated_at,
  };
}

export type MachineSummary = { total: number; online: number };

/** İptal edilmemiş makineler ve son 90 saniyede kalp atışı gelenler. */
export function summarizeMachines(
  workers: readonly {
    last_seen_at: string | null;
    revoked_at: string | null;
  }[],
  now: Date,
): MachineSummary {
  const active = workers.filter((worker) => !worker.revoked_at);
  const threshold = now.getTime() - WORKER_OFFLINE_AFTER_SECONDS * 1000;
  return {
    total: active.length,
    online: active.filter(
      (worker) =>
        worker.last_seen_at !== null &&
        new Date(worker.last_seen_at).getTime() >= threshold,
    ).length,
  };
}

export function machineLabel(summary: MachineSummary): string {
  if (summary.total === 0) return 'Üretim makinesi bağlı değil';
  if (summary.online === 0) return 'Üretim makinesi çevrimdışı';
  return `${summary.online} üretim makinesi çevrimiçi`;
}
