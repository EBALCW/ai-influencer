import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { getReport } from '@/lib/reports/queries';
import { formatPeriod } from '@/lib/reports/weekly';
import { AiSummaryButton, ExportLinks, PrintButton } from '../report-actions';
import { NextActions } from '../next-actions';
import { ReportSummaryView } from '../report-summary';

const updatedFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

/** Kayıtlı rapor. Yazdırma görünümü panel kabuğunu gizler (globals.css @media print). */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [member, { id }] = await Promise.all([requireTeamMember(), params]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const report = await getReport(id);
  if (!report) notFound();
  const canWrite = member.role !== 'viewer';
  const backHref = `/analytics/reports?date=${report.periodStart}${
    report.influencer
      ? `&inf=${encodeURIComponent(report.influencer.slug)}`
      : ''
  }`;

  return (
    <article className="page-stack" aria-labelledby="report-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">HAFTALIK RAPOR</p>
          <h1 id="report-title">
            {report.influencer?.name ?? 'Tüm influencer’lar'}
          </h1>
          <p>
            {formatPeriod({ from: report.periodStart, to: report.periodEnd })}{' '}
            (Türkiye saati) ·{' '}
            {report.automatic ? 'Otomatik oluşturuldu' : 'Elle oluşturuldu'} ·
            Son güncelleme {updatedFormat.format(new Date(report.updatedAt))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link className="button button-quiet" href={backHref}>
            ← Raporlar
          </Link>
          <PrintButton />
        </div>
      </header>

      <ExportLinks
        from={report.periodStart}
        influencerSlug={report.influencer?.slug ?? null}
        to={report.periodEnd}
      />

      {report.summary ? (
        <ReportSummaryView summary={report.summary} />
      ) : (
        <section className="section-card">
          <EmptyState
            title="Rapor özeti okunamadı"
            description="Bu rapor eski veya tanınmayan bir biçimde kaydedilmiş. Raporlar sayfasından yeniden oluşturabilirsin."
          />
        </section>
      )}

      <NextActions
        actions={report.actions}
        canWrite={canWrite}
        reportId={report.id}
      />

      <section aria-labelledby="ai-summary-title" className="section-card">
        <h2
          className="mb-3 text-base font-semibold text-text"
          id="ai-summary-title"
        >
          AI özeti ve öneriler
        </h2>
        {report.aiSummary ? (
          <p className="mb-3 whitespace-pre-line text-sm text-text">
            {report.aiSummary}
          </p>
        ) : (
          <p className="mb-3 text-sm text-muted">
            {report.influencer
              ? 'Henüz AI özeti yok. Claude yalnız bu rapordaki sayıları yorumlar, yeni sayı üretmez.'
              : 'AI özeti influencer bazında üretilir. Üst menüden bir influencer seçip onun raporunu aç.'}
          </p>
        )}
        {canWrite && report.influencer && report.summary && (
          <AiSummaryButton
            hasSummary={!!report.aiSummary}
            reportId={report.id}
          />
        )}
      </section>
    </article>
  );
}
