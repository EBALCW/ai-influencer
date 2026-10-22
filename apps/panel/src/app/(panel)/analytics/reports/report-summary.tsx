'use client';

import { Coins, Eye, Heart, UsersRound, Video } from 'lucide-react';
import { EmptyState, StatCard } from '@/components/ui';
import { formatMoney } from '@/lib/costs/money';
import {
  formatCount,
  formatRate,
  formatSigned,
  isEmptySummary,
  type ReportPost,
  type ReportSummary,
} from '@/lib/reports/weekly';

const dateTime = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

const stageLabels: Record<string, string> = {
  idea: 'Fikir',
  script: 'Senaryo',
  production: 'Üretim',
  qc: 'Kalite kontrol',
  edit: 'Kurgu',
  scheduled: 'Planlandı',
  published: 'Yayında',
};

function PostList({ title, posts }: { title: string; posts: ReportPost[] }) {
  return (
    <section className="section-card" aria-label={title}>
      <h2 className="mb-3 text-base font-semibold text-text">{title}</h2>
      {posts.length ? (
        <ol className="m-0 grid list-none gap-3 p-0">
          {posts.map((post) => (
            <li
              key={post.postId}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-2 text-sm last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-text">
                  {post.caption?.trim() || 'Caption yok'}
                </span>
                <span className="text-xs text-muted">
                  {post.platform} · {post.handle} ·{' '}
                  {dateTime.format(new Date(post.publishedAt))}
                </span>
              </span>
              <span className="text-xs text-muted">
                {formatCount(post.views)} izlenme ·{' '}
                {formatCount(post.engagement)} etkileşim
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">Bu listede gösterilecek post yok.</p>
      )}
    </section>
  );
}

export function ReportSummaryView({ summary }: { summary: ReportSummary }) {
  const money = (value: number | null | undefined) =>
    formatMoney(value ?? null, summary.currency);
  const { followers, cost } = summary;

  if (isEmptySummary(summary))
    return (
      <section className="section-card">
        <EmptyState
          title="Bu dönem için veri yok"
          description="Seçili dönemde yayın, metrik, takipçi ölçümü veya maliyet kaydı bulunmuyor. Veriler geldikçe rapor burada oluşur."
        />
      </section>
    );

  return (
    <>
      <section className="stats-grid" aria-label="Dönem KPI'ları">
        <StatCard
          label="Takipçi değişimi"
          value={formatSigned(followers.delta)}
          detail={
            followers.end == null
              ? 'Takipçi ölçümü yok'
              : `${formatCount(followers.end)} takipçi · ${followers.accountsWithBaseline}/${followers.accounts} hesapta karşılaştırma`
          }
          icon={UsersRound}
        />
        <StatCard
          label="İzlenme"
          value={formatCount(summary.views)}
          detail={
            summary.postsWithoutBaseline
              ? `${summary.postsWithoutBaseline} eski post başlangıç ölçümü olmadığı için sayılmadı`
              : 'Dönem içinde kazanılan izlenme'
          }
          icon={Eye}
          tone="blue"
        />
        <StatCard
          label="Etkileşim"
          value={formatCount(summary.engagement)}
          detail={`Etkileşim oranı ${formatRate(summary.engagementRate)} (beğeni + yorum + paylaşım + kaydetme)`}
          icon={Heart}
          tone="mint"
        />
        <StatCard
          label="Yayınlanan post"
          value={formatCount(summary.postsPublished)}
          detail="Dönem içinde yayınlanan içerik"
          icon={Video}
        />
        <StatCard
          label="Maliyet"
          value={money(cost.total)}
          detail={
            cost.missingRateCount
              ? `${cost.missingRateCount} kaydın kuru eksik, toplam hesaplanamadı`
              : `${cost.entryCount} maliyet kaydı`
          }
          icon={Coins}
          tone="blue"
        />
        <StatCard
          label="Video başına maliyet"
          value={money(cost.perVideo)}
          detail={`${summary.currency} cinsinden`}
          icon={Coins}
          tone="mint"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PostList title="En iyi içerikler" posts={summary.topPosts} />
        <PostList title="En zayıf içerikler" posts={summary.bottomPosts} />
      </div>

      <section className="section-card" aria-label="Gelecek dönem planı">
        <h2 className="mb-3 text-base font-semibold text-text">
          Gelecek dönem planı
        </h2>
        {summary.nextPeriod.items.length ? (
          <ul className="m-0 grid list-none gap-2 p-0 text-sm">
            {summary.nextPeriod.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap justify-between gap-2"
              >
                <span className="text-text">{item.title}</span>
                <span className="text-xs text-muted">
                  {stageLabels[item.stage] ?? item.stage} ·{' '}
                  {dateTime.format(new Date(item.scheduledAt))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Gelecek dönem için planlanmış içerik yok.
          </p>
        )}
      </section>

      <section className="section-card" aria-label="Öğrenimler">
        <h2 className="mb-3 text-base font-semibold text-text">Öğrenimler</h2>
        {summary.learnings.items.length ? (
          <>
            <ul className="m-0 grid list-none gap-2 p-0 text-sm">
              {summary.learnings.items.map((item) => (
                <li key={item.id} className="text-text">
                  {item.body}
                  {item.tags.length > 0 && (
                    <span className="ml-2 text-xs text-muted">
                      {item.tags.map((tag) => `#${tag}`).join(' ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {summary.learnings.count > summary.learnings.items.length && (
              <p className="mt-2 text-xs text-muted">
                Toplam {summary.learnings.count} öğrenim; en yeni{' '}
                {summary.learnings.items.length} tanesi gösteriliyor.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            Bu dönemde öğrenim notu yazılmamış. Notlar Analitik sayfasından
            eklenir.
          </p>
        )}
      </section>
    </>
  );
}
