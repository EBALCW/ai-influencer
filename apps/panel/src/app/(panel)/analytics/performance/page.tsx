import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { analyticsHref, platformLabels } from '@/lib/analytics/links';
import {
  formatCount,
  formatDateTime,
  formatPercent,
  formatRatio,
} from '@/lib/analytics/metrics';
import {
  groupCounts,
  groupLabels,
  MIN_ANALYZED_POSTS,
  medianSideLabels,
  performanceSegments,
  type PerformanceGroup,
} from '@/lib/analytics/performance';
import {
  getPerformanceOverview,
  PERFORMANCE_POST_LIMIT,
} from '@/lib/analytics/performance-queries';
import { AnalyticsStat } from '../stat';
import { PerformanceSettingsForm } from './settings-form';

const groupMarks: Record<PerformanceGroup, string> = {
  viral: '▲',
  normal: '●',
  stuck: '▼',
  pending: '…',
};

const decimal = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

/**
 * Performans takibi (#24) ve ilk test dalgası analizi (#25). Google Sheets
 * takip tablosunun yerini alır: her post için 1/5/24 sa izlenme, hesaplanan
 * oranlar, hesabın son N postunun medyanına göre konum ve takıldı/normal/patladı
 * grubu; altında grup bazında segment tablosu.
 */
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string }>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const inf = typeof params.inf === 'string' ? params.inf : '';
  const overview = await getPerformanceOverview({ slug: inf || undefined });
  const { settings, posts } = overview;
  const counts = groupCounts(posts);
  const analyzed = posts.length - counts.pending;
  const segments = performanceSegments(posts);
  const k = settings.baselinePosts;

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
          <h1>Performans takibi</h1>
          <p>
            {overview.influencer
              ? `${overview.influencer.name} · `
              : 'Tüm influencer’lar · '}
            Her postun ilk dalga, 24 saat ve hesap medyanına göre durumu.
            Haftalık özet, takipçi değişimi ve video başına maliyet{' '}
            <Link
              className="text-accent underline"
              href={analyticsHref('/analytics/reports', inf)}
            >
              haftalık raporda
            </Link>
            .
          </p>
        </div>
      </header>

      <section aria-labelledby="thresholds-title" className="section-card">
        <h2 className="text-base font-semibold" id="thresholds-title">
          Eşikler
        </h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-text">
          <li>
            <strong>Takıldı:</strong> ilk {settings.stuckWithinHours} saatte{' '}
            {formatCount(settings.stuckViews)} izlenmenin altı.
          </li>
          <li>
            <strong>Patladı:</strong> 24 sa izlenme ≥ hesap medyanı ×{' '}
            {decimal.format(settings.viralMultiplier)}.
          </li>
          <li>
            <strong>Kıyas:</strong> aynı hesabın bu posttan önceki son {k}{' '}
            postunun 24 sa medyanı (en az 3 ölçülmüş post gerekir).
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted">
          {overview.settingsSaved
            ? 'Kayıtlı eşikler kullanılıyor.'
            : 'Varsayılan eşikler kullanılıyor (issue #25 önerisi).'}{' '}
          Hesap büyüdükçe takıldı eşiğini güncelleyin.
          {member.role !== 'owner' && ' Eşikleri yalnız owner değiştirebilir.'}
        </p>
        {member.role === 'owner' && (
          <PerformanceSettingsForm settings={settings} />
        )}
      </section>

      {!overview.validInfluencer ? (
        <section className="section-card section-empty-card">
          <EmptyState
            title="Influencer bulunamadı"
            description="Seçili influencer silinmiş veya adres hatalı. Üst menüden başka bir influencer seçin."
          />
        </section>
      ) : posts.length === 0 ? (
        <section className="section-card section-empty-card">
          <EmptyState
            title="Henüz yayınlanmış post yok"
            description="Postlar ve metrik snapshot’ları içe aktarıldığında performans tablosu burada görünecek."
          />
        </section>
      ) : (
        <>
          <section aria-label="Grup özeti" className="stats-grid">
            <AnalyticsStat
              detail={`24 sa ≥ medyan × ${decimal.format(settings.viralMultiplier)}`}
              icon="Gauge"
              label={groupLabels.viral}
              tone="mint"
              value={formatCount(counts.viral)}
            />
            <AnalyticsStat
              detail="Eşiği geçti, patlamadı"
              icon="BarChart3"
              label={groupLabels.normal}
              tone="blue"
              value={formatCount(counts.normal)}
            />
            <AnalyticsStat
              detail={`İlk ${settings.stuckWithinHours} sa < ${formatCount(settings.stuckViews)} izlenme`}
              icon="Eye"
              label={groupLabels.stuck}
              value={formatCount(counts.stuck)}
            />
            <AnalyticsStat
              detail="1/5/24 sa ölçümü yok"
              icon="Send"
              label={groupLabels.pending}
              value={formatCount(counts.pending)}
            />
          </section>

          {analyzed < MIN_ANALYZED_POSTS && (
            <p className="section-card text-sm text-text" role="note">
              Şimdilik {analyzed} post ölçüldü. En az {MIN_ANALYZED_POSTS} video
              ölçülmeden segmentlerden genelleme yapmayın.
            </p>
          )}

          <section aria-labelledby="posts-title" className="section-card">
            <h2 className="text-base font-semibold" id="posts-title">
              Post performansı
            </h2>
            <p className="mb-3 mt-1 text-sm text-muted">
              Etkileşim = (beğeni + yorum + paylaşım + kayıt) / izlenme, son
              ölçüme göre. Tamamlanma: platform oranı, yoksa ort. izlenme süresi
              / video süresi (yaklaşık).
              {overview.totalPosts > posts.length &&
                ` Son ${PERFORMANCE_POST_LIMIT} post gösteriliyor (toplam ${formatCount(overview.totalPosts)}).`}
            </p>
            <div className="overflow-x-auto">
              <table
                aria-label="Post performans tablosu"
                className="w-full text-left text-sm"
              >
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="p-2" scope="col">
                      Post
                    </th>
                    <th className="p-2" scope="col">
                      Yayın
                    </th>
                    <th className="p-2" scope="col">
                      1 sa
                    </th>
                    <th className="p-2" scope="col">
                      5 sa
                    </th>
                    <th className="p-2" scope="col">
                      24 sa
                    </th>
                    <th className="p-2" scope="col">
                      24 sa / 1 sa
                    </th>
                    <th className="p-2" scope="col">
                      Medyan (son {k})
                    </th>
                    <th className="p-2" scope="col">
                      Medyana göre
                    </th>
                    <th className="p-2" scope="col">
                      Etkileşim
                    </th>
                    <th className="p-2" scope="col">
                      Paylaşım
                    </th>
                    <th className="p-2" scope="col">
                      Paylaşım + kayıt
                    </th>
                    <th className="p-2" scope="col">
                      Tamamlanma
                    </th>
                    <th className="p-2" scope="col">
                      Grup
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr className="border-t border-line" key={post.id}>
                      <th className="max-w-xs p-2 font-normal" scope="row">
                        <Link
                          className="block truncate text-accent underline-offset-2 hover:underline"
                          href={analyticsHref(
                            `/analytics/posts/${post.id}`,
                            inf,
                          )}
                        >
                          {post.caption.trim() || 'Açıklamasız post'}
                        </Link>
                        <span className="text-xs text-muted">
                          {platformLabels[post.platform]} · {post.handle}
                        </span>
                      </th>
                      <td className="whitespace-nowrap p-2">
                        {formatDateTime(post.publishedAt)}
                      </td>
                      <td className="p-2">{formatCount(post.views1)}</td>
                      <td className="p-2">{formatCount(post.views5)}</td>
                      <td className="p-2">{formatCount(post.views24)}</td>
                      <td className="p-2">{formatRatio(post.growth)}</td>
                      <td className="p-2">
                        {formatCount(post.baselineMedian24)}
                      </td>
                      <td className="whitespace-nowrap p-2">
                        {medianSideLabels[post.side]}
                        {post.score !== null && ` (${formatRatio(post.score)})`}
                      </td>
                      <td className="p-2">
                        {formatPercent(post.engagementRate)}
                      </td>
                      <td className="p-2">{formatPercent(post.shareRate)}</td>
                      <td className="p-2">
                        {formatPercent(post.shareSaveRate)}
                      </td>
                      <td className="p-2">{formatPercent(post.completion)}</td>
                      <td className="whitespace-nowrap p-2">
                        <span aria-hidden="true">
                          {groupMarks[post.group]}{' '}
                        </span>
                        {groupLabels[post.group]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="segments-title" className="section-card">
            <h2 className="text-base font-semibold" id="segments-title">
              Segment analizi (gruplara göre)
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Her segmentte kaç postun takıldığı, normal kaldığı ve patladığı;
              medyan 24 sa izlenme ve ortalama oranlar. Ses türü post
              detayından, kanca türü ve format içerik kartından, check-list
              puanı (kanca + etkileşim, 10 üzerinden) kartın kontrol listesinden
              gelir.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {segments.map((table) => (
                <div
                  className="overflow-x-auto rounded-xl border border-line p-3"
                  key={table.dimension}
                >
                  <table
                    aria-label={`${table.label} performans segmentleri`}
                    className="w-full text-left text-sm"
                  >
                    <caption className="mb-2 text-left font-semibold text-text">
                      {table.label}
                    </caption>
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="p-2" scope="col">
                          Segment
                        </th>
                        <th className="p-2" scope="col">
                          Post
                        </th>
                        <th className="p-2" scope="col">
                          {groupLabels.stuck}
                        </th>
                        <th className="p-2" scope="col">
                          {groupLabels.normal}
                        </th>
                        <th className="p-2" scope="col">
                          {groupLabels.viral}
                        </th>
                        <th className="p-2" scope="col">
                          Medyan 24 sa
                        </th>
                        <th className="p-2" scope="col">
                          Ort. etkileşim
                        </th>
                        <th className="p-2" scope="col">
                          Ort. paylaşım + kayıt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row) => (
                        <tr className="border-t border-line" key={row.key}>
                          <th className="p-2 font-normal" scope="row">
                            {row.label}
                          </th>
                          <td className="p-2">{formatCount(row.posts)}</td>
                          <td className="p-2">{formatCount(row.stuck)}</td>
                          <td className="p-2">{formatCount(row.normal)}</td>
                          <td className="p-2">{formatCount(row.viral)}</td>
                          <td className="p-2">{formatCount(row.median24)}</td>
                          <td className="p-2">
                            {formatPercent(row.avgEngagement)}
                          </td>
                          <td className="p-2">
                            {formatPercent(row.avgShareSave)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">
              Öğrenimleri{' '}
              <Link
                className="text-accent underline"
                href={analyticsHref('/analytics', inf)}
              >
                analitik sayfasındaki öğrenim notlarına
              </Link>{' '}
              tarihli yazın: Gözlem · Kanıt (post linkleri, sayılar) · Aksiyon ·
              güven (düşük/orta/yüksek).
            </p>
          </section>
        </>
      )}
    </div>
  );
}
