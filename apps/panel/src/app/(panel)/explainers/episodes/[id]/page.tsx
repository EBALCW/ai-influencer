import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  EXPLAINER_KIND_LABELS,
  episodeLabel,
  isExplainerKind,
} from '@ai-influencer/shared';
import { requireTeamMember } from '@/lib/auth';
import {
  EPISODE_STEPS,
  currentStep,
  episodeStatusView,
} from '@/lib/explainer/model';
import { getActiveSeriesOptions, getEpisode } from '@/lib/explainer/queries';
import { ArchiveButton } from '../../controls';
import { EpisodeSettings } from '../../episode-settings';
import { EpisodeWorkspace } from '../../episode-workspace';
import { ReadOnlyNote, SubHeader } from '../../page-header';
import { ProductionPanel } from '../../production-panel';
import { FactGapBadge, StatusBadge } from '../../shared';

/**
 * Bölüm / tekil video sayfası: senaryo ve kaynak notları, onay, üretim, sürüm geçmişi, ayarlar.
 * Üstteki şerit akışta nerede olunduğunu ve sıradaki adımı söyler.
 */
export default async function EpisodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ role, workspaceId }, { id }] = await Promise.all([
    requireTeamMember(),
    params,
  ]);
  const [detail, seriesOptions] = await Promise.all([
    getEpisode(id, workspaceId),
    getActiveSeriesOptions(),
  ]);
  if (!detail) notFound();
  const { episode, series, request } = detail;
  const canWrite = role !== 'viewer';
  const view = episodeStatusView(episode.status);
  const number = episodeLabel(episode.episode_number);
  const reached = currentStep(episode.status);
  const archived = episode.archived_at !== null;
  const brief = (
    [
      ['Özet', episode.summary],
      ['Kanca', episode.hook],
      ['Ekranda ne gösterilecek', episode.visual_idea],
    ] as const
  ).filter(([, value]) => value.trim() !== '');

  return (
    <div className="page-stack">
      <SubHeader
        crumbs={[
          { href: '/explainers', label: 'ANLATIM VİDEOLARI' },
          ...(series
            ? [{ href: `/explainers/series/${series.id}`, label: series.name }]
            : []),
        ]}
        description={
          <>
            {series ? `${series.name} · ${number}` : 'Tekil video'} ·{' '}
            {isExplainerKind(episode.kind)
              ? EXPLAINER_KIND_LABELS[episode.kind]
              : 'Tür yok'}{' '}
            · {episode.language}
            {request && (
              <>
                {' · '}
                <Link
                  className="underline"
                  href={`/explainers/topics/${request.id}`}
                >
                  konu isteğinden
                </Link>
              </>
            )}
          </>
        }
        title={number ? `${number}: ${episode.title}` : episode.title}
      >
        <StatusBadge status={episode.status} />
        <FactGapBadge
          hasNotes={
            Array.isArray(episode.fact_notes) && episode.fact_notes.length > 0
          }
          hasScript={episode.script_version > 0}
          unsourced={episode.unsourced_claim_count}
        />
        {canWrite && (
          <ArchiveButton
            archived={archived}
            subject="Bölüm"
            url={`/api/explainers/episodes/${episode.id}/archive`}
          />
        )}
      </SubHeader>
      {!canWrite && <ReadOnlyNote />}

      <section aria-label="Akış" className="section-card">
        <ol className="m-0 flex list-none flex-wrap gap-2 p-0 text-xs">
          {EPISODE_STEPS.map((step, index) => {
            const state =
              reached < 0
                ? 'todo'
                : index < reached
                  ? 'done'
                  : index === reached
                    ? 'current'
                    : 'todo';
            return (
              <li
                aria-current={state === 'current' ? 'step' : undefined}
                className={`rounded-full border px-3 py-1 ${
                  state === 'done'
                    ? 'border-mint text-mint'
                    : state === 'current'
                      ? 'border-accent font-semibold text-accent'
                      : 'border-line text-muted'
                }`}
                key={step}
              >
                {state === 'done' ? '✓ ' : `${index + 1}. `}
                {step}
                {state === 'done' && <span className="sr-only"> (tamam)</span>}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 mb-0 text-sm text-text">
          <strong>Sıradaki adım:</strong> {view.next}
        </p>
        {brief.length > 0 && (
          <dl className="mt-4 mb-0 grid gap-3 border-t border-line-soft pt-4 text-sm sm:grid-cols-3">
            {brief.map(([term, value]) => (
              <div key={term}>
                <dt className="text-xs text-muted">{term}</dt>
                <dd className="m-0 break-words whitespace-pre-wrap">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <EpisodeWorkspace canWrite={canWrite} detail={detail} />
      <ProductionPanel canWrite={canWrite} detail={detail} />
      {canWrite && !archived && (
        <EpisodeSettings
          episode={episode}
          key={episode.updated_at}
          series={series}
          seriesOptions={seriesOptions}
        />
      )}
    </div>
  );
}
