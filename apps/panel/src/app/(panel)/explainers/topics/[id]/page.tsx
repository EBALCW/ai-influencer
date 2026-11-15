import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { getTopicRequest } from '@/lib/explainer/queries';
import { kindLabel } from '../../lists';
import { ReadOnlyNote, SubHeader } from '../../page-header';
import { formatDate } from '../../format';
import { Suggestions } from '../../suggestions';

/** Konu isteği ve önerileri (#217'nin AI'sız kısmı): elle ekle, karşılaştır, seç ya da ele. */
export default async function TopicRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ role }, { id }] = await Promise.all([requireTeamMember(), params]);
  const detail = await getTopicRequest(id);
  if (!detail) notFound();
  const { request, series } = detail;
  const canWrite = role !== 'viewer';
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
            {series ? `Seri: ${series.name}` : 'Tekil video'} · Tür tercihi:{' '}
            {kindLabel(request.kind)} · {formatDate(request.created_at)}
          </>
        }
        title="Konu önerileri"
      >
        {canWrite && (
          <Link
            className="button"
            href={`/explainers/topics/new${series ? `?series=${series.id}` : ''}`}
          >
            Yeni istek
          </Link>
        )}
      </SubHeader>
      {!canWrite && <ReadOnlyNote />}
      <section aria-labelledby="topic-prompt" className="section-card">
        <h2 className="m-0 text-xs font-medium text-muted" id="topic-prompt">
          İstek
        </h2>
        <p className="mt-2 mb-0 text-sm break-words whitespace-pre-wrap text-text">
          {request.prompt}
        </p>
        {series?.status === 'archived' && (
          <p className="mt-3 mb-0 text-sm text-text" role="note">
            Seri arşivde: bu istekten yeni bölüm açılamaz. Önce seriyi arşivden
            çıkarın.
          </p>
        )}
      </section>
      <Suggestions canWrite={canWrite} detail={detail} />
    </div>
  );
}
