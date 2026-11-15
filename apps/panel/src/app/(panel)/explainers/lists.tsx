import Link from 'next/link';
import {
  EXPLAINER_KIND_LABELS,
  episodeLabel,
  isExplainerKind,
} from '@ai-influencer/shared';
import type { EpisodeListItem, RequestListItem } from '@/lib/explainer/queries';
import { Badge, FactGapBadge, StatusBadge, formatDate } from './shared';

export function kindLabel(kind: string | null): string {
  return kind && isExplainerKind(kind)
    ? EXPLAINER_KIND_LABELS[kind]
    : 'Karışık';
}

/** Bölüm / tekil video listesi: numara, başlık, tür, durum, kaynak eksiği, son değişiklik. */
export function EpisodeTable({
  episodes,
  caption,
  numbered,
  actions,
}: {
  episodes: EpisodeListItem[];
  caption: string;
  numbered: boolean;
  actions?: (episode: EpisodeListItem) => React.ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {numbered && <th scope="col">Bölüm</th>}
            <th scope="col">Başlık</th>
            <th scope="col">Tür</th>
            <th scope="col">Durum</th>
            <th scope="col">Son değişiklik</th>
            {actions && <th scope="col">İşlem</th>}
          </tr>
        </thead>
        <tbody>
          {episodes.map((episode) => (
            <tr key={episode.id}>
              {numbered && (
                <td className="whitespace-nowrap">
                  {episodeLabel(episode.episode_number) ?? '—'}
                </td>
              )}
              <td>
                <Link
                  className="font-medium text-text underline-offset-2 hover:text-accent hover:underline"
                  href={`/explainers/episodes/${episode.id}`}
                >
                  {episode.title}
                </Link>
              </td>
              <td>{kindLabel(episode.kind)}</td>
              <td>
                <span className="flex flex-wrap gap-1">
                  <StatusBadge status={episode.status} />
                  <FactGapBadge
                    hasNotes={episode.has_fact_notes}
                    hasScript={episode.script_version > 0}
                    unsourced={episode.unsourced_claim_count}
                  />
                </span>
              </td>
              <td className="whitespace-nowrap text-muted">
                {formatDate(episode.updated_at)}
              </td>
              {actions && <td>{actions(episode)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RequestList({ requests }: { requests: RequestListItem[] }) {
  return (
    <ul className="m-0 list-none divide-y divide-line-soft p-0">
      {requests.map((request) => (
        <li
          className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
          key={request.id}
        >
          <span className="min-w-0 flex-1">
            <Link
              className="block truncate text-sm font-medium text-text hover:text-accent"
              href={`/explainers/topics/${request.id}`}
            >
              {request.prompt}
            </Link>
            <span className="block text-xs text-muted">
              {request.seriesName ?? 'Tekil video'} ·{' '}
              {formatDate(request.created_at)}
            </span>
          </span>
          <Badge tone={request.open > 0 ? 'attention' : 'muted'}>
            {request.total === 0
              ? 'Öneri yok'
              : `${request.total} öneri · ${request.open} karar bekliyor`}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
