import Link from 'next/link';
import { analyticsHref, platformLabels } from '@/lib/analytics/links';
import {
  bestIndex,
  CHECKPOINT_HOURS,
  checkpointLabel,
  engagementRate,
  formatCount,
  formatDateTime,
  formatPercent,
  formatRatio,
  performanceScore,
  primaryScore,
  segmentKeyLabel,
} from '@/lib/analytics/metrics';
import { getPostsForCompare } from '@/lib/analytics/queries';
import { parseCompareIds, type PostAnalytics } from '@/lib/analytics/schemas';
import { ViewsChart } from '../views-chart';

type Row = {
  label: string;
  values: Array<number | null>;
  format: (value: number | null) => string;
  /** Yüksek değer iyi mi? Değilse en iyi işaretlenmez. */
  highlight: boolean;
};

function shortLabel(post: PostAnalytics, index: number) {
  const caption = post.post.caption.trim();
  const text = caption.length > 32 ? `${caption.slice(0, 31)}…` : caption;
  return `${index + 1}. ${text || 'Açıklamasız post'}`;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[]; inf?: string }>;
}) {
  const params = await searchParams;
  const inf = typeof params.inf === 'string' ? params.inf : '';
  const parsed = parseCompareIds(params.ids);
  const posts = parsed.ok ? await getPostsForCompare(parsed.ids) : [];
  const missing = parsed.ok && posts.some((post) => post === null);
  const error = !parsed.ok
    ? parsed.error
    : missing
      ? 'Seçilen postlardan biri bulunamadı veya erişim yetkiniz yok.'
      : null;

  const header = (
    <header className="page-heading">
      <div>
        <p className="eyebrow">
          <Link className="text-accent" href={analyticsHref('/analytics', inf)}>
            ← Analitik
          </Link>
        </p>
        <h1>Post karşılaştırma</h1>
        <p>2–4 postu aynı kontrol noktalarında yan yana inceleyin.</p>
      </div>
    </header>
  );

  if (error)
    return (
      <div className="page-stack">
        {header}
        <section className="section-card" role="alert">
          <h2 className="text-base font-semibold">Karşılaştırma yapılamadı</h2>
          <p className="mt-1 text-sm text-text">{error}</p>
          <Link
            className="button button-quiet mt-3"
            href={analyticsHref('/analytics', inf)}
          >
            Post seçimine dön
          </Link>
        </section>
      </div>
    );

  const list = posts as PostAnalytics[];
  const latest = list.map((p) => p.snapshots.at(-1) ?? null);
  const checkpointRows: Row[] = CHECKPOINT_HOURS.map((hours) => ({
    label: `${checkpointLabel(hours)} izlenme`,
    values: list.map(
      (p) => p.checkpoints.find((c) => c.hours === hours)?.views ?? null,
    ),
    format: formatCount,
    highlight: true,
  }));
  const rows: Row[] = [
    ...checkpointRows,
    {
      label: 'Son izlenme',
      values: latest.map((s) => s?.views ?? null),
      format: formatCount,
      highlight: true,
    },
    {
      label: 'Etkileşim oranı',
      values: latest.map((s) => engagementRate(s)),
      format: formatPercent,
      highlight: true,
    },
    {
      label: 'Tamamlanma oranı',
      values: latest.map((s) => s?.completionRate ?? null),
      format: formatPercent,
      highlight: true,
    },
    {
      label: 'Performans skoru (hesap medyanına göre)',
      values: list.map((p) => primaryScore(p.checkpoints)?.score ?? null),
      format: formatRatio,
      highlight: true,
    },
    {
      label: '24 sa skor',
      values: list.map((p) => {
        const c = p.checkpoints.find((item) => item.hours === 24);
        return performanceScore(c?.views, c?.median);
      }),
      format: formatRatio,
      highlight: true,
    },
    {
      label: 'Süre (sn)',
      values: list.map((p) => p.post.durationS),
      format: (v) => (v === null ? '—' : String(v)),
      highlight: false,
    },
  ];

  return (
    <div className="page-stack">
      {header}
      <ViewsChart
        title="İzlenme eğrileri"
        description="Her post kendi yayın anından itibaren; aynı saat ekseninde."
        series={list.map((p, i) => ({
          label: shortLabel(p, i),
          points: p.snapshots
            .filter((s) => s.hours !== null)
            .map((s) => ({ hours: s.hours!, views: s.views })),
        }))}
      />
      <section className="section-card" aria-labelledby="compare-title">
        <h2 id="compare-title" className="mb-3 text-base font-semibold">
          Yan yana
        </h2>
        <div className="overflow-x-auto">
          <table
            aria-label="Post karşılaştırma tablosu"
            className="w-full text-left text-sm"
          >
            <thead>
              <tr>
                <th scope="col" className="p-2 text-xs text-muted">
                  Ölçü
                </th>
                {list.map((p, i) => (
                  <th scope="col" className="p-2 align-top" key={p.post.id}>
                    <Link
                      className="text-accent underline-offset-2 hover:underline"
                      href={analyticsHref(`/analytics/posts/${p.post.id}`, inf)}
                    >
                      {shortLabel(p, i)}
                    </Link>
                    <span className="block text-xs font-normal text-muted">
                      {platformLabels[p.post.platform]} · {p.post.handle}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <th scope="row" className="p-2 font-normal text-muted">
                  Yayın
                </th>
                {list.map((p) => (
                  <td className="p-2" key={p.post.id}>
                    {formatDateTime(p.post.publishedAt)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-line">
                <th scope="row" className="p-2 font-normal text-muted">
                  Format / kanca
                </th>
                {list.map((p) => (
                  <td className="p-2" key={p.post.id}>
                    {p.content
                      ? `${segmentKeyLabel('format', p.content.format)} · ${segmentKeyLabel('hook_type', p.content.hookType ?? '')}`
                      : 'İçerik kartı yok'}
                  </td>
                ))}
              </tr>
              {rows.map((row) => {
                const best = row.highlight ? bestIndex(row.values) : null;
                return (
                  <tr className="border-t border-line" key={row.label}>
                    <th scope="row" className="p-2 font-normal text-muted">
                      {row.label}
                    </th>
                    {row.values.map((value, i) => (
                      <td
                        className={
                          i === best ? 'p-2 font-semibold text-accent' : 'p-2'
                        }
                        key={list[i]!.post.id}
                      >
                        {row.format(value)}
                        {i === best && (
                          <span className="ml-1 text-xs">★ en yüksek</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
