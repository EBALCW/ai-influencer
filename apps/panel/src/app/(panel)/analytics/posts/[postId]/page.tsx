import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Coins, Eye, Gauge, Heart } from 'lucide-react';
import { EmptyState, StatCard } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { analyticsHref, platformLabels } from '@/lib/analytics/links';
import {
  checkpointLabel,
  engagementRate,
  FIRST_WAVE_THRESHOLD,
  firstWave,
  formatCount,
  formatDateTime,
  formatPercent,
  formatRatio,
  MIN_BASELINE_POSTS,
  performanceScore,
  primaryScore,
  scoreTone,
  scoreToneLabels,
  segmentKeyLabel,
} from '@/lib/analytics/metrics';
import { postCostDisplay } from '@/lib/analytics/cost-display';
import {
  getLearnings,
  getPostAnalytics,
  getPostCostForDetail,
} from '@/lib/analytics/queries';
import { supportedCurrencies } from '@/lib/costs/schemas';
import { LearningPanel } from '../../learning-panel';
import { ViewsChart } from '../../views-chart';

const stageLabels: Record<string, string> = {
  idea: 'Fikir',
  script: 'Senaryo',
  production: 'Üretim',
  qc: 'Kalite kontrol',
  edit: 'Düzenleme',
  scheduled: 'Planlandı',
  published: 'Yayında',
};

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ inf?: string; cur?: string }>;
}) {
  const [{ postId }, query, member] = await Promise.all([
    params,
    searchParams,
    requireTeamMember(),
  ]);
  const inf = typeof query.inf === 'string' ? query.inf : '';
  const currency = (supportedCurrencies as readonly string[]).includes(
    query.cur ?? '',
  )
    ? (query.cur as string)
    : 'USD';
  const [data, learnings, postCost] = await Promise.all([
    getPostAnalytics(postId),
    getLearnings({ postId }),
    getPostCostForDetail(postId, currency),
  ]);
  const cost = postCostDisplay(postCost);
  // Layout varlığı doğruladı; arada silinirse yine 404 (stream başlamışsa 200 olabilir)
  if (!data) notFound();

  const { post, content, checkpoints } = data;
  const latest = data.snapshots.at(-1) ?? null;
  const primary = primaryScore(checkpoints);
  const tone = scoreTone(primary?.score ?? null);
  const wave = firstWave(checkpoints);
  const rate = engagementRate(latest);
  const caption = post.caption.trim();
  const timeline = data.snapshots
    .filter((s) => s.hours !== null)
    .map((s) => ({ hours: s.hours!, views: s.views }));
  const medianCurve = checkpoints
    .filter((c) => c.median !== null && c.measured > 0)
    .map((c) => ({ hours: c.hours, views: c.median! }));

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <Link
              className="text-accent"
              href={analyticsHref('/analytics', inf)}
            >
              ← Analitik
            </Link>
          </p>
          <h1>Post detayı</h1>
          <p>
            {data.influencer.name} · {platformLabels[post.platform]}{' '}
            {post.handle} · {formatDateTime(post.publishedAt)}
          </p>
        </div>
      </header>

      <section
        aria-labelledby="first-wave-title"
        className="section-card"
        role="status"
      >
        <h2 id="first-wave-title" className="text-base font-semibold">
          İlk test dalgası
        </h2>
        <p className="mt-1 text-sm text-text">
          {wave.status === 'below' &&
            `⚠ Eşik altında: ${checkpointLabel(wave.hours)} izlenme hesap medyanının ${formatRatio(wave.ratio)} katı (eşik ${formatRatio(FIRST_WAVE_THRESHOLD)}).`}
          {wave.status === 'passed' &&
            `✓ Eşiği geçti: ${checkpointLabel(wave.hours)} izlenme hesap medyanının ${formatRatio(wave.ratio)} katı (eşik ${formatRatio(FIRST_WAVE_THRESHOLD)}).`}
          {wave.status === 'pending' &&
            'İlk 5 saate ait ölçüm yok; karar verilemiyor.'}
          {wave.status === 'insufficient' &&
            `Kıyas için en az ${MIN_BASELINE_POSTS} ölçülmüş geçmiş post gerekiyor.`}
        </p>
      </section>

      <section className="stats-grid" aria-label="Post özeti">
        <StatCard
          label="Son izlenme"
          value={formatCount(latest?.views)}
          detail={
            latest
              ? `${data.snapshots.length} snapshot · ${formatDateTime(latest.capturedAt)}`
              : 'Henüz ölçüm yok'
          }
          icon={Eye}
        />
        <StatCard
          label="Etkileşim oranı"
          value={formatPercent(rate)}
          detail={
            latest
              ? `${formatCount(latest.likes)} beğeni · ${formatCount(latest.comments)} yorum · ${formatCount(latest.shares)} paylaşım · ${formatCount(latest.saves)} kayıt`
              : 'Henüz ölçüm yok'
          }
          icon={Heart}
          tone="mint"
        />
        <StatCard
          label="Performans skoru"
          value={formatRatio(primary?.score)}
          detail={
            primary
              ? `${checkpointLabel(primary.hours)} izlenme / hesap medyanı · ${scoreToneLabels[tone]}`
              : scoreToneLabels.unknown
          }
          icon={Gauge}
          tone="blue"
        />
        <StatCard
          label="Maliyet"
          value={cost.value}
          detail={cost.detail}
          icon={Coins}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ViewsChart
          title="Snapshot zaman çizelgesi"
          description={`Yayından sonra kümülatif izlenme. Kesikli çizgi aynı hesabın son ${data.baselinePosts} postunun kontrol noktası medyanı.`}
          series={[
            { label: 'Bu post', points: timeline },
            ...(medianCurve.length
              ? [{ label: 'Hesap medyanı', points: medianCurve }]
              : []),
          ]}
        />
        <section className="section-card" aria-labelledby="preview-title">
          <h2 id="preview-title" className="text-base font-semibold">
            Önizleme
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text">
            {caption || 'Bu postun açıklaması yok.'}
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Yayın saati</dt>
            <dd>{formatDateTime(post.publishedAt)}</dd>
            <dt className="text-muted">Süre</dt>
            <dd>{post.durationS === null ? '—' : `${post.durationS} sn`}</dd>
            <dt className="text-muted">Tür</dt>
            <dd>{post.isShort ? 'Kısa video' : 'Uzun video'}</dd>
          </dl>
          {post.url && /^https?:\/\//.test(post.url) && (
            <a
              className="button button-quiet mt-3"
              href={post.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Platformda aç
            </a>
          )}
        </section>
      </div>

      <section className="section-card" aria-labelledby="checkpoints-title">
        <h2 id="checkpoints-title" className="text-base font-semibold">
          Hesap ortalamasına göre
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Kıyas: aynı hesabın bu posttan önceki son {data.baselinePosts} postu.
          Skor = bu postun izlenmesi / kıyas medyanı.
        </p>
        <div className="overflow-x-auto">
          <table
            aria-label="Kontrol noktaları"
            className="w-full text-left text-sm"
          >
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="p-2">
                  Kontrol noktası
                </th>
                <th scope="col" className="p-2">
                  Bu post
                </th>
                <th scope="col" className="p-2">
                  Hesap medyanı
                </th>
                <th scope="col" className="p-2">
                  Hesap ortalaması
                </th>
                <th scope="col" className="p-2">
                  Skor
                </th>
                <th scope="col" className="p-2">
                  Ölçülen kıyas postu
                </th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((c) => (
                <tr className="border-t border-line" key={c.hours}>
                  <th scope="row" className="p-2 font-normal">
                    {checkpointLabel(c.hours)}
                  </th>
                  <td className="p-2">{formatCount(c.views)}</td>
                  <td className="p-2">{formatCount(c.median)}</td>
                  <td className="p-2">{formatCount(c.average)}</td>
                  <td className="p-2">
                    {formatRatio(performanceScore(c.views, c.median))}
                  </td>
                  <td className="p-2">{c.measured}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card" aria-labelledby="content-title">
        <h2 id="content-title" className="text-base font-semibold">
          Bağlı içerik
        </h2>
        {content ? (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted">Başlık</dt>
            <dd>{content.title}</dd>
            <dt className="text-muted">Format</dt>
            <dd>{segmentKeyLabel('format', content.format)}</dd>
            <dt className="text-muted">Kanca türü</dt>
            <dd>{segmentKeyLabel('hook_type', content.hookType ?? '')}</dd>
            <dt className="text-muted">Aşama</dt>
            <dd>{stageLabels[content.stage] ?? content.stage}</dd>
            <dt className="text-muted">Prompt</dt>
            <dd>
              {data.prompts.length ? (
                <ul className="m-0 list-none p-0">
                  {data.prompts.map((prompt) => (
                    <li key={prompt.id}>
                      <Link
                        className="text-accent underline-offset-2 hover:underline"
                        href={analyticsHref(`/prompts/${prompt.id}`, inf)}
                      >
                        {prompt.title} (v{prompt.version})
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                'Bağlı üretimde prompt yok'
              )}
            </dd>
            <dt className="text-muted">Üretim maliyeti</dt>
            <dd>
              {cost.value} <span className="text-muted">({cost.detail})</span>
            </dd>
          </dl>
        ) : (
          <EmptyState
            title="İçerik kartı bağlı değil"
            description="Bu post bir içerik kartıyla eşleştirilmemiş. İçerik akışında kartı açıp ‘Yayınlanmış postu eşleştir’ ile bağlayabilirsiniz."
            action={
              <Link
                className="button button-quiet"
                href={analyticsHref('/content', inf)}
              >
                İçerik akışına git
              </Link>
            }
          />
        )}
      </section>

      <LearningPanel
        canWrite={member.role !== 'viewer'}
        emptyHint="Bu post için henüz öğrenim yok."
        learnings={learnings}
        postId={post.id}
      />
    </div>
  );
}
