'use client';
import Link from 'next/link';
import { Activity, Clapperboard, Coins, Eye, UsersRound } from 'lucide-react';
import { DataTable, EmptyState, StatCard } from '@/components/ui';
import { DashboardChart } from '@/components/dashboard-chart';
import {
  changePercent,
  engagementRate,
  metricNumber,
  metricPercent,
  platformNames,
  platforms,
  signedNumber,
  type DashboardFilter,
} from '@/lib/dashboard/metrics';
import type { DashboardData } from '@/lib/dashboard/schema';
import { formatMoney } from '@/lib/costs/money';

const card = 'rounded-2xl border border-line bg-surface p-5';
const stageNames: Record<string, string> = {
  idea: 'Fikir',
  script: 'Senaryo',
  production: 'Üretim',
  qc: 'Kalite kontrol',
  edit: 'Kurgu',
  scheduled: 'Planlandı',
};
const trDate = (value: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
function href(path: string, inf?: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...extra, ...(inf ? { inf } : {}) });
  return `${path}${q.size ? `?${q}` : ''}`;
}
function Ranking({
  title,
  rows,
}: {
  title: string;
  rows: DashboardData['best'];
}) {
  return (
    <section className={card} aria-label={title}>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <DataTable
        rows={rows.map((r) => ({
          post: r.caption || r.id,
          platform: platformNames[r.platform],
          views: r.views,
        }))}
        columns={[
          { key: 'post', label: 'Post' },
          { key: 'platform', label: 'Platform' },
          {
            key: 'views',
            label: '24s izlenme',
            render: (v) => metricNumber(Number(v)),
          },
        ]}
        pageSize={5}
        emptyMessage="24–30 saat ölçümü olan post yok."
      />
    </section>
  );
}
function ContentList({
  title,
  rows,
  count,
  inf,
}: {
  title: string;
  rows: DashboardData['today'];
  count: number;
  inf?: string;
}) {
  return (
    <section className={card} aria-label={title}>
      <div className="mb-3 flex flex-wrap justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {title} ({metricNumber(count)})
        </h2>
        <Link className="text-sm text-accent" href={href('/calendar', inf)}>
          Takvimi aç
        </Link>
      </div>
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <Link
                className="text-accent"
                href={href('/content', inf ?? r.slug)}
              >
                {r.title}
              </Link>
              <span className="text-sm text-muted">
                {stageNames[r.stage] ?? r.stage} ·{' '}
                {r.scheduled_at
                  ? `${trDate(r.scheduled_at)} (İstanbul)`
                  : 'Zamanlanmadı'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Kayıt yok.</p>
      )}
      {count > rows.length && (
        <p className="mt-3 text-sm text-muted">
          İlk {rows.length} kayıt gösteriliyor. Tümünü içerik akışında
          görebilirsiniz.
        </p>
      )}
    </section>
  );
}
export function Dashboard({
  data: d,
  filter: f,
}: {
  data: DashboardData;
  filter: DashboardFilter;
}) {
  const rate = engagementRate(d.interactions, d.engagementViews);
  const singleCost = d.costs.length === 1 ? d.costs[0] : undefined;
  const days = d.daily.map((r) => r.day);
  const followers = platforms
    .filter((p) =>
      d.daily.some((r) => r.followers.some((v) => v.platform === p)),
    )
    .map((p) => ({
      label: platformNames[p],
      values: d.daily.map(
        (r) => r.followers.find((v) => v.platform === p)?.value ?? null,
      ),
    }));
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-accent">
            PERFORMANS VE YAYIN
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Genel bakış</h1>
          <p className="mt-2 text-sm text-muted">
            {f.from} – {f.to} · UTC tarih aralığı; yayın saatleri İstanbul.
          </p>
        </div>
        <Link className="button button-quiet" href={href('/content', f.inf)}>
          İçerik akışını aç
        </Link>
      </header>
      <form
        action="/"
        method="get"
        aria-label="Dashboard filtreleri"
        className={`${card} flex flex-wrap items-end gap-4`}
      >
        {f.inf && <input type="hidden" name="inf" value={f.inf} />}
        <label className="grid gap-2 text-sm">
          Platform
          <select
            name="platform"
            aria-label="Platform"
            defaultValue={f.platform}
            className="rounded-lg border border-line bg-canvas p-2"
          >
            <option value="all">Tüm platformlar</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {platformNames[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Tarih aralığı
          <select
            name="range"
            aria-label="Tarih aralığı"
            defaultValue={f.range}
            className="rounded-lg border border-line bg-canvas p-2"
          >
            <option value="7">Son 7 gün</option>
            <option value="30">Son 30 gün</option>
            <option value="90">Son 90 gün</option>
            <option value="custom">Özel aralık</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Başlangıç (özel)
          <input
            type="date"
            name="from"
            aria-label="Başlangıç (özel)"
            defaultValue={f.from}
            className="rounded-lg border border-line bg-canvas p-2"
          />
        </label>
        <label className="grid gap-2 text-sm">
          Bitiş (özel)
          <input
            type="date"
            name="to"
            aria-label="Bitiş (özel)"
            defaultValue={f.to}
            className="rounded-lg border border-line bg-canvas p-2"
          />
        </label>
        <button className="button button-primary" type="submit">
          Filtreleri uygula
        </button>
      </form>
      {!d.validInfluencer ? (
        <EmptyState
          title="Influencer bulunamadı"
          description="Bu seçim için erişilebilir kayıt yok."
          action={
            <Link className="button button-primary" href="/">
              Tüm influencer’ları göster
            </Link>
          }
        />
      ) : (
        <>
          {d.accounts === 0 && (
            <EmptyState
              title="Bağlı sosyal hesap yok"
              description="Hesap ekleyip bağlantısını tamamladığınızda ölçümler burada görünür. OAuth kurulumu henüz tamamlanmamış olabilir."
              action={
                <Link
                  className="button button-primary"
                  href={
                    f.inf
                      ? href(`/influencers/${f.inf}`, f.inf, {
                          tab: 'accounts',
                        })
                      : '/influencers'
                  }
                >
                  Hesap bağla
                </Link>
              }
            />
          )}
          <section
            aria-label="Dashboard KPI"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
          >
            <StatCard
              label="Toplam takipçi"
              value={metricNumber(d.followers)}
              detail={`${signedNumber(d.followerChange)} (${metricPercent(changePercent(d.followerChange, d.followers))}) · ${d.accountsMeasured}/${d.accounts} hesap ölçüldü`}
              icon={UsersRound}
            />
            <StatCard
              label="Dönem izlenmesi"
              value={metricNumber(d.views)}
              detail="Ölçülen günlük sayaç artışları"
              icon={Eye}
              tone="blue"
            />
            <StatCard
              label="Ortalama etkileşim"
              value={metricPercent(rate)}
              detail={`${d.postsMeasured}/${d.published} post ölçüldü; izlenmeye göre ağırlıklı`}
              icon={Activity}
              tone="mint"
            />
            <StatCard
              label="Paylaşılan video"
              value={metricNumber(d.published)}
              detail="Dönemde yayınlanan platform postları"
              icon={Clapperboard}
            />
            <StatCard
              label="Video başına maliyet"
              value={
                singleCost
                  ? formatMoney(singleCost.perVideo, singleCost.currency)
                  : d.costs.length > 1
                    ? 'Para birimi bazında'
                    : '—'
              }
              detail={
                f.platform !== 'all'
                  ? 'Platforma maliyet ataması yok'
                  : 'Aşağıdaki para birimi dökümüne bakın'
              }
              icon={Coins}
              tone="mint"
            />
          </section>
          <section className={card} aria-label="Ölçüm kapsamı">
            <h2 className="font-semibold">Ölçüm kapsamı</h2>
            <p className="mt-2 text-sm text-muted">
              İzlenme, UTC gününün son sayacı ile önceki ölçüm farkıdır; negatif
              fark sıfırlanır. Ölçümsüz gün sıfır sayılmaz. Dönem başı ölçümü
              eksik {d.postsWithoutBaseline} eski postun ilk ölçümü artışa
              katılmaz. Eksik günler ve geciken senkronizasyon nedeniyle bu
              değerler gözlenen kapsamı gösterir.
            </p>
            <p className="mt-2 text-sm text-muted">
              Etkileşim = (beğeni + yorum + paylaşım + kaydetme) / izlenme ×
              100. Kart dönemde yayınlanan postların son ölçümünü, trend her gün
              ölçülen postların gün sonu değerini kullanır. Takipçi grafiği son
              bilinen ölçümü taşır.
            </p>
          </section>
          <section className="grid gap-4 xl:grid-cols-3">
            <DashboardChart
              title="Takipçi büyümesi"
              description="Platform bazında son bilinen toplam takipçi; eksik hesap ölçümü varsa boşluk."
              days={days}
              series={followers}
            />
            <DashboardChart
              title="Günlük izlenme"
              description="O UTC gününde gözlenen artış; geciken ölçüm yakalandığı güne yazılır."
              days={days}
              series={[
                { label: 'İzlenme', values: d.daily.map((r) => r.views) },
              ]}
              bars
            />
            <DashboardChart
              title="Etkileşim trendi"
              description="Gün içinde ölçülen postların ağırlıklı etkileşim oranı (%)."
              days={days}
              series={[
                {
                  label: 'Etkileşim (%)',
                  values: d.daily.map((r) =>
                    engagementRate(r.interactions, r.engagement_views),
                  ),
                },
              ]}
            />
          </section>
          <section className={card} aria-label="Dönem maliyetleri">
            <h2 className="text-lg font-semibold">Dönem maliyetleri</h2>
            <p className="my-2 text-sm text-muted">
              Dönem harcaması / dönemdeki platform post sayısı. Farklı para
              birimleri ayrı tutulur; doğrudan video maliyeti ataması değildir.
            </p>
            {d.costs.length ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">Para birimi</th>
                    <th className="p-2">Toplam</th>
                    <th className="p-2">Video başına</th>
                  </tr>
                </thead>
                <tbody>
                  {d.costs.map((c) => (
                    <tr key={c.currency} className="border-t border-line">
                      <th className="p-2">{c.currency}</th>
                      <td className="p-2">
                        {formatMoney(c.total, c.currency)}
                      </td>
                      <td className="p-2">
                        {formatMoney(c.perVideo, c.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">
                {f.platform !== 'all'
                  ? 'Maliyet kayıtları platforma bağlanmadığı için bu filtrede maliyet hesaplanamaz.'
                  : 'Bu dönemde maliyet kaydı yok.'}
              </p>
            )}
            <Link
              className="mt-3 inline-block text-sm text-accent"
              href={href('/costs', f.inf, { month: f.from.slice(0, 7) })}
            >
              Maliyetleri aç
            </Link>
          </section>
          <p className="text-sm text-muted">
            24s sıralaması: dönemde yayınlanan postların ilk 24–30 saat ölçümü.
            Bu ölçümü olmayan postlar sıralanmaz.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Ranking title="En iyi 5 post" rows={d.best} />
            <Ranking title="En düşük 5 post" rows={d.worst} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ContentList
              title="Bugünün yayın planı"
              rows={d.today}
              count={d.todayCount}
              inf={f.inf}
            />
            <ContentList
              title="Bekleyen işler"
              rows={d.pending}
              count={d.pendingCount}
              inf={f.inf}
            />
          </div>
          <section className={card} aria-label="Platform karşılaştırması">
            <h2 className="mb-3 text-lg font-semibold">
              Aynı içerik, farklı platformlar
            </h2>
            <p className="mb-3 text-sm text-muted">
              Dönemde yayınlanan postların son kümülatif izlenmesi. Platform
              filtresi karşılaştırmaya da uygulanır. En fazla 50 içerik
              gösterilir.
            </p>
            <DataTable
              rows={d.comparisons.map((c) => ({
                title: c.title,
                instagram:
                  c.posts
                    .filter((r) => r.platform === 'instagram')
                    .map((r) => metricNumber(r.views))
                    .join(' / ') || '—',
                youtube:
                  c.posts
                    .filter((r) => r.platform === 'youtube')
                    .map((r) => metricNumber(r.views))
                    .join(' / ') || '—',
                tiktok:
                  c.posts
                    .filter((r) => r.platform === 'tiktok')
                    .map((r) => metricNumber(r.views))
                    .join(' / ') || '—',
              }))}
              columns={[
                { key: 'title', label: 'İçerik' },
                ...platforms.map((p) => ({ key: p, label: platformNames[p] })),
              ]}
              emptyMessage="Aynı içeriğe bağlı, farklı platformlarda yayın bulunamadı."
            />
          </section>
        </>
      )}
    </div>
  );
}
