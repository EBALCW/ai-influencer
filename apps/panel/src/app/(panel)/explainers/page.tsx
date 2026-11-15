import Link from 'next/link';
import { Lightbulb, Plus, Video } from 'lucide-react';
import { VISUAL_ROUTE_LABELS, isVisualRoute } from '@ai-influencer/shared';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { getExplainerOverview } from '@/lib/explainer/queries';
import { EpisodeTable, RequestList, kindLabel } from './lists';
import { card, formatDate } from './format';
import { Badge } from './shared';

/**
 * Anlatım modülü (#216 modeli üzerinde, #217 / #218 arayüzü): seriler, tekil videolar ve konu
 * istekleri. Seri isteğe bağlıdır; karakter istenmez.
 */
export default async function ExplainersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const [{ role }, overview, params] = await Promise.all([
    requireTeamMember(),
    getExplainerOverview(),
    searchParams,
  ]);
  const canWrite = role !== 'viewer';
  const showArchived = params.show === 'archived';
  const archivedCount = overview.series.filter(
    (series) => series.status === 'archived',
  ).length;
  const series = overview.series.filter(
    (item) => showArchived || item.status === 'active',
  );
  const standalone = overview.standalone.filter(
    (episode) => showArchived || !episode.archived_at,
  );
  const empty =
    overview.series.length === 0 &&
    overview.standalone.length === 0 &&
    overview.requests.length === 0;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">MODÜL</p>
          <h1>Anlatım videoları</h1>
          <p>
            Bir olayı ya da bir şeyin nasıl çalıştığını anlatan seslendirmeli
            dikey videolar. Seri isteğe bağlı; karakter gerekmez.
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <Link className="button" href="/explainers/topics/new">
              <Lightbulb aria-hidden="true" size={15} /> Konu önerisi iste
            </Link>
            <Link className="button" href="/explainers/episodes/new">
              <Video aria-hidden="true" size={15} /> Tekil video
            </Link>
            <Link
              className="button button-primary mt-0!"
              href="/explainers/series/new"
            >
              <Plus aria-hidden="true" size={15} /> Yeni seri
            </Link>
          </div>
        )}
      </header>

      {empty && (
        <section className="section-card section-empty-card">
          <EmptyState
            title="İlk anlatım videonuzu başlatın"
            description={
              canWrite
                ? 'Konu belliyse “Tekil video” ile doğrudan senaryoya geçin. Fikir arıyorsanız “Konu önerisi iste” ile bir istek açıp önerileri karşılaştırın. Aynı formatta devam edecekseniz (Bölüm 1, 2, 3…) önce bir seri açın: stil, ses ve dil bir kez seçilir.'
                : 'Ekip bir seri ya da video açtığında burada listelenir.'
            }
            action={
              canWrite ? (
                <Link
                  className="button button-primary"
                  href="/explainers/episodes/new"
                >
                  Tekil video başlat
                </Link>
              ) : undefined
            }
          />
        </section>
      )}

      {!empty && (
        <>
          <section aria-labelledby="explainer-series" className="section-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">BÖLÜM 1, 2, 3…</p>
                <h2 id="explainer-series">Seriler</h2>
              </div>
              {archivedCount > 0 && (
                <Link
                  className="button button-quiet"
                  href={
                    showArchived ? '/explainers' : '/explainers?show=archived'
                  }
                >
                  {showArchived
                    ? 'Arşivdekileri gizle'
                    : `Arşivdekileri göster (${archivedCount})`}
                </Link>
              )}
            </div>
            {series.length === 0 ? (
              <p className="mt-4 mb-0 text-sm text-muted">
                Henüz seri yok. Seri zorunlu değil: tekil video aynı akışla
                üretilir. Aynı tema ve stille birden çok bölüm yapacaksanız seri
                açın.
              </p>
            ) : (
              <ul className="mt-4 mb-0 grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
                {series.map((item) => (
                  <li key={item.id}>
                    <article
                      aria-label={`Seri: ${item.name}`}
                      className={`${card} flex h-full flex-col gap-2`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="m-0 text-sm font-semibold">
                          <Link
                            className="text-text hover:text-accent"
                            href={`/explainers/series/${item.id}`}
                          >
                            {item.name}
                          </Link>
                        </h3>
                        {item.status === 'archived' && (
                          <Badge tone="muted">Arşivde</Badge>
                        )}
                      </div>
                      <p className="m-0 line-clamp-2 text-sm text-muted">
                        {item.theme || 'Tema yazılmadı.'}
                      </p>
                      <dl className="m-0 mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted">Tür</dt>
                        <dd className="m-0">{kindLabel(item.kind)}</dd>
                        <dt className="text-muted">Görsel</dt>
                        <dd className="m-0">
                          {item.visual_route && isVisualRoute(item.visual_route)
                            ? VISUAL_ROUTE_LABELS[item.visual_route]
                            : 'Seçilmedi'}
                          {item.style_key ? ` · ${item.style_key}` : ''}
                        </dd>
                        <dt className="text-muted">Ses</dt>
                        <dd className="m-0">
                          {item.voice_name ?? 'Seçilmedi'}
                        </dd>
                        <dt className="text-muted">Bölüm</dt>
                        <dd className="m-0">{item.episodeCount}</dd>
                        <dt className="text-muted">Son işlem</dt>
                        <dd className="m-0">{formatDate(item.lastActivity)}</dd>
                      </dl>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="explainer-standalone"
            className="section-card"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">SERİSİZ</p>
                <h2 id="explainer-standalone">Tekil videolar</h2>
              </div>
            </div>
            {standalone.length === 0 ? (
              <p className="mt-4 mb-0 text-sm text-muted">
                Tekil video yok. Seriye bağlı olmayan tek seferlik videolar
                burada durur.
              </p>
            ) : (
              <EpisodeTable
                caption="Tekil videolar"
                episodes={standalone}
                numbered={false}
              />
            )}
          </section>

          <section
            aria-labelledby="explainer-requests"
            className="section-card"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">FİKİR</p>
                <h2 id="explainer-requests">Konu istekleri</h2>
              </div>
            </div>
            {overview.requests.length === 0 ? (
              <p className="mt-4 mb-0 text-sm text-muted">
                Konu isteği yok. Kısa bir istek yazıp önerileri yan yana
                karşılaştırabilir, seçtiğinizi tek tıkla bölüme
                çevirebilirsiniz.
              </p>
            ) : (
              <RequestList requests={overview.requests} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
