import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  VISUAL_ROUTE_LABELS,
  canMoveEpisode,
  isEpisodeStatus,
  isVisualRoute,
} from '@ai-influencer/shared';
import { requireTeamMember } from '@/lib/auth';
import {
  getActiveSeriesOptions,
  getSeriesDetail,
} from '@/lib/explainer/queries';
import { ArchiveButton, MoveEpisode } from '../../controls';
import { EpisodeTable, RequestList, kindLabel } from '../../lists';
import { ReadOnlyNote, SubHeader } from '../../page-header';
import { CAPTION_MODES, captionMode } from '../../production-values';
import { Badge } from '../../shared';

/** Seri ayrıntısı: varsayılanlar, sırayla bölümler, bölüm ekleme ve taşıma, serinin konu istekleri. */
export default async function SeriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ role }, { id }] = await Promise.all([requireTeamMember(), params]);
  const [detail, options] = await Promise.all([
    getSeriesDetail(id),
    getActiveSeriesOptions(),
  ]);
  if (!detail) notFound();
  const { series, episodes, requests } = detail;
  const canWrite = role !== 'viewer';
  const archived = series.status === 'archived';
  const mode = captionMode(series.caption_style);
  const defaults: Array<[string, string]> = [
    ['Tür tercihi', kindLabel(series.kind)],
    ['Dil', series.language],
    [
      'Görsel yol',
      series.visual_route && isVisualRoute(series.visual_route)
        ? VISUAL_ROUTE_LABELS[series.visual_route]
        : 'Seçilmedi',
    ],
    ['Görsel stil', series.style_key ?? 'Seçilmedi'],
    ['Ses', series.voice_name ?? 'Seçilmedi'],
    ['Konuşma hızı', series.voice_rate ?? 'Varsayılan'],
    [
      'Altyazı stili',
      CAPTION_MODES.find((item) => item.value === mode)?.label ?? 'Varsayılan',
    ],
  ];

  return (
    <div className="page-stack">
      <SubHeader
        crumbs={[{ href: '/explainers', label: 'ANLATIM VİDEOLARI' }]}
        description={series.theme || 'Tema yazılmadı.'}
        title={series.name}
      >
        {archived && <Badge tone="muted">Arşivde</Badge>}
        {canWrite && (
          <>
            {!archived && (
              <>
                <Link
                  className="button"
                  href={`/explainers/topics/new?series=${series.id}`}
                >
                  Konu önerisi iste
                </Link>
                <Link
                  className="button button-primary mt-0!"
                  href={`/explainers/episodes/new?series=${series.id}`}
                >
                  Bölüm ekle
                </Link>
              </>
            )}
            <Link
              className="button"
              href={`/explainers/series/${series.id}/edit`}
            >
              Düzenle
            </Link>
            <ArchiveButton
              archived={archived}
              subject="Seri"
              url={`/api/explainers/series/${series.id}/archive`}
            />
          </>
        )}
      </SubHeader>
      {!canWrite && <ReadOnlyNote />}
      {archived && (
        <p
          className="m-0 rounded-xl border border-line bg-surface-raised p-3 text-sm text-text"
          role="note"
        >
          Seri arşivde: yeni bölüm ve konu isteği açılamaz. Mevcut bölümler
          yerinde durur.
        </p>
      )}

      <section aria-labelledby="series-episodes" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SIRAYLA</p>
            <h2 id="series-episodes">Bölümler</h2>
          </div>
        </div>
        {episodes.length === 0 ? (
          <p className="mt-4 mb-0 text-sm text-muted">
            Bu seride henüz bölüm yok.{' '}
            {canWrite && !archived
              ? 'Konu belliyse “Bölüm ekle”, fikir arıyorsanız “Konu önerisi iste” ile başlayın. İlk bölüm “Bölüm 1” olur.'
              : ''}
          </p>
        ) : (
          <EpisodeTable
            actions={
              canWrite
                ? (episode) =>
                    isEpisodeStatus(episode.status) &&
                    canMoveEpisode(episode.status) ? (
                      <MoveEpisode
                        currentSeriesId={series.id}
                        episodeId={episode.id}
                        options={options}
                        title={episode.title}
                      />
                    ) : (
                      <span className="text-xs text-muted">Taşınamaz</span>
                    )
                : undefined
            }
            caption={`${series.name} bölümleri`}
            episodes={episodes}
            numbered
          />
        )}
      </section>

      <section aria-labelledby="series-defaults" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HER BÖLÜM DEVRALIR</p>
            <h2 id="series-defaults">Üretim varsayılanları</h2>
          </div>
        </div>
        <dl className="mt-4 mb-0 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {defaults.map(([term, value]) => (
            <div key={term}>
              <dt className="text-xs text-muted">{term}</dt>
              <dd className="m-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="series-requests" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FİKİR</p>
            <h2 id="series-requests">Bu serinin konu istekleri</h2>
          </div>
        </div>
        {requests.length === 0 ? (
          <p className="mt-4 mb-0 text-sm text-muted">
            Bu seri için konu isteği yok.
          </p>
        ) : (
          <RequestList requests={requests} />
        )}
      </section>
    </div>
  );
}
