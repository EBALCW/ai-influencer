import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { getReportsOverview } from '@/lib/reports/queries';
import {
  formatPeriod,
  localDate,
  resolvePeriod,
  shiftPeriod,
  weekStart,
} from '@/lib/reports/weekly';
import { ExportLinks, GenerateReportButton } from './report-actions';
import { ReportSummaryView } from './report-summary';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string; inf?: string }>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const period = resolvePeriod(params);
  const overview = await getReportsOverview({
    period,
    influencerSlug: params.inf,
  });
  const { influencer, summary } = overview;
  const canWrite = member.role !== 'viewer';
  const thisWeek = weekStart(localDate(new Date()));

  const href = (changes: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const next = {
      period: period.kind,
      date: period.from,
      inf: influencer?.slug,
      ...changes,
    };
    for (const [key, value] of Object.entries(next))
      if (value) query.set(key, value);
    return `/analytics/reports?${query.toString()}`;
  };
  const reportHref = (id: string) =>
    `/analytics/reports/${id}${influencer ? `?inf=${encodeURIComponent(influencer.slug)}` : ''}`;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ANALİTİK · RAPORLAR</p>
          <h1>{period.kind === 'week' ? 'Haftalık rapor' : 'Aylık rapor'}</h1>
          <p>
            {influencer ? influencer.name : 'Tüm influencer’lar'} ·{' '}
            {formatPeriod(period)} (Türkiye saati)
          </p>
        </div>
        <nav
          aria-label="Rapor dönemi"
          className="flex flex-wrap items-center gap-2"
        >
          <Link
            className="button button-quiet"
            href={href({ date: shiftPeriod(period, -1) })}
          >
            ← Önceki {period.kind === 'week' ? 'hafta' : 'ay'}
          </Link>
          <Link
            className="button button-quiet"
            href={href({ date: shiftPeriod(period, 1) })}
          >
            Sonraki {period.kind === 'week' ? 'hafta' : 'ay'} →
          </Link>
          {(['week', 'month'] as const).map((kind) => (
            <Link
              aria-current={kind === period.kind ? 'true' : undefined}
              className={
                kind === period.kind
                  ? 'button button-primary'
                  : 'button button-quiet'
              }
              href={href({ period: kind })}
              key={kind}
            >
              {kind === 'week' ? 'Hafta' : 'Ay'}
            </Link>
          ))}
        </nav>
      </header>

      <section
        aria-label="Rapor işlemleri"
        className="section-card flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-3">
          {period.kind === 'week' && overview.current && (
            <Link
              className="button button-quiet"
              href={reportHref(overview.current.id)}
            >
              Kayıtlı raporu aç
            </Link>
          )}
          {period.kind === 'week' && canWrite && period.from <= thisWeek && (
            <GenerateReportButton
              influencerId={influencer?.id ?? null}
              influencerSlug={influencer?.slug ?? null}
              label={
                overview.current ? 'Raporu güncelle' : 'Haftalık raporu oluştur'
              }
              periodStart={period.from}
            />
          )}
          {period.kind === 'month' && (
            <p className="text-sm text-muted">
              Aylık görünüm canlı hesaplanır; kayıtlı raporlar haftalıktır.
            </p>
          )}
        </div>
        <ExportLinks
          from={period.from}
          influencerSlug={influencer?.slug ?? null}
          to={period.to}
        />
      </section>

      {summary ? (
        <ReportSummaryView summary={summary} />
      ) : (
        <section className="section-card">
          <EmptyState
            title="Rapor hesaplanamadı"
            description="Seçili influencer bulunamadı veya özet okunamadı."
          />
        </section>
      )}

      <section aria-labelledby="saved-reports" className="section-card">
        <h2
          className="mb-3 text-base font-semibold text-text"
          id="saved-reports"
        >
          Kayıtlı haftalık raporlar
        </h2>
        {overview.saved.length ? (
          <ul className="m-0 grid list-none gap-2 p-0 text-sm">
            {overview.saved.map((report) => (
              <li
                className="flex flex-wrap justify-between gap-2"
                key={report.id}
              >
                <Link
                  className="text-accent underline"
                  href={reportHref(report.id)}
                >
                  {formatPeriod({
                    from: report.periodStart,
                    to: report.periodEnd,
                  })}
                </Link>
                <span className="text-xs text-muted">
                  {report.hasAiSummary ? 'AI özeti var' : 'AI özeti yok'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Kayıtlı rapor yok"
            description="Raporlar her pazartesi 09:00'da (Türkiye) geçen hafta için otomatik oluşur. İstersen yukarıdan tek tıkla da oluşturabilirsin."
          />
        )}
      </section>
    </div>
  );
}
