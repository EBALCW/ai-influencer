import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { analyticsHref } from '@/lib/analytics/links';
import {
  CHECKPOINT_HOURS,
  checkpointLabel,
  formatCount,
} from '@/lib/analytics/metrics';
import { getAnalyticsOverview } from '@/lib/analytics/queries';
import { parseTargetHours } from '@/lib/analytics/schemas';
import { AnalyticsStat } from './stat';
import { LearningPanel } from './learning-panel';
import { PostPicker } from './post-picker';
import { SegmentTables } from './segment-tables';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string; h?: string }>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const inf = typeof params.inf === 'string' ? params.inf : '';
  const targetHours = parseTargetHours(params.h);
  const overview = await getAnalyticsOverview({
    slug: inf || undefined,
    targetHours,
  });
  const { segments, influencer } = overview;
  const metric = `${checkpointLabel(targetHours)} izlenme`;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">BÜYÜME</p>
          <h1>Analitik</h1>
          <p>
            {influencer ? `${influencer.name} · ` : 'Tüm influencer’lar · '}
            Postları açıp ayrıntısına bakın, 2–4 postu yan yana karşılaştırın ve
            segmentlerden öğrenim çıkarın.{' '}
            <Link
              className="text-accent underline"
              href={analyticsHref('/analytics/reports', inf)}
            >
              Haftalık rapor ve CSV/PDF dışa aktarma
            </Link>
            {' · '}
            <Link
              className="text-accent underline"
              href={analyticsHref('/analytics/performance', inf)}
            >
              Performans takibi ve ilk test dalgası
            </Link>
          </p>
        </div>
        <nav aria-label="Kontrol noktası" className="flex flex-wrap gap-2">
          {CHECKPOINT_HOURS.map((hours) => (
            <Link
              aria-current={hours === targetHours ? 'true' : undefined}
              className={
                hours === targetHours
                  ? 'button button-primary'
                  : 'button button-quiet'
              }
              href={analyticsHref('/analytics', inf, { h: hours })}
              key={hours}
            >
              {checkpointLabel(hours)}
            </Link>
          ))}
        </nav>
      </header>

      {!overview.validInfluencer ? (
        <section className="section-card section-empty-card">
          <EmptyState
            title="Influencer bulunamadı"
            description="Seçili influencer silinmiş veya adres hatalı. Üst menüden başka bir influencer seçin."
          />
        </section>
      ) : segments.overall.posts === 0 ? (
        <section className="section-card section-empty-card">
          <EmptyState
            title="Henüz yayınlanmış post yok"
            description="Postlar ve metrik snapshot’ları içe aktarıldığında analizler burada görünecek."
          />
        </section>
      ) : (
        <>
          <section className="stats-grid" aria-label="Analitik özeti">
            <AnalyticsStat
              label="Yayınlanan post"
              value={formatCount(segments.overall.posts)}
              detail={`${formatCount(segments.overall.measured)} postta ${metric} ölçümü var`}
              icon="Send"
            />
            <AnalyticsStat
              label={`Medyan ${metric}`}
              value={formatCount(segments.overall.median)}
              detail="Segment endeksleri bu değere göre"
              icon="BarChart3"
              tone="blue"
            />
            <AnalyticsStat
              label={`Ortalama ${metric}`}
              value={formatCount(segments.overall.average)}
              detail="Uç değerlerden etkilenir; medyanla birlikte okuyun"
              icon="Eye"
              tone="mint"
            />
          </section>

          <section className="section-card" aria-labelledby="segments-title">
            <h2 id="segments-title" className="text-base font-semibold">
              Segment analizi
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Endeks = segment medyanı / genel medyan. 1× üstü segment tipik
              postunuzdan iyi performans gösteriyor. Ölçümü olmayan postlar
              medyana katılmaz.
            </p>
            <SegmentTables result={segments} />
          </section>

          <section className="section-card" aria-labelledby="posts-title">
            <h2 id="posts-title" className="mb-3 text-base font-semibold">
              Son postlar
            </h2>
            <PostPicker
              inf={inf}
              posts={overview.recent}
              targetHours={targetHours}
            />
          </section>
        </>
      )}

      {overview.validInfluencer && (
        <LearningPanel
          canWrite={member.role !== 'viewer'}
          emptyHint={
            influencer
              ? 'Henüz öğrenim yok. Bir post veya segment hakkında not ekleyin.'
              : 'Henüz öğrenim yok. Eklemek için üst menüden bir influencer seçin.'
          }
          influencerId={influencer?.id}
          learnings={overview.learnings}
        />
      )}
    </div>
  );
}
