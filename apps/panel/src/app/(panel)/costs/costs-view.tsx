'use client';

import Link from 'next/link';
import { AlertTriangle, Coins, Eye, OctagonX, Video } from 'lucide-react';
import type { TeamRole } from '@ai-influencer/shared';
import { DataTable, EmptyState, StatCard } from '@/components/ui';
import { budgetLevel, budgetPercent } from '@/lib/costs/budget';
import { formatMoney } from '@/lib/costs/money';
import { shiftMonth, todayIso } from '@/lib/costs/period';
import type { CostOverview } from '@/lib/costs/queries';
import {
  costCategoryLabels,
  supportedCurrencies,
  type CostCategory,
} from '@/lib/costs/schemas';
import { BarChart } from './bar-chart';
import { BudgetForm, CostEntryForm, RateForm } from './cost-forms';

const levelText = {
  ok: 'Bütçe içinde',
  warning: '⚠ Uyarı eşiği aşıldı',
  exceeded: '⛔ Bütçe aşıldı',
  unknown: 'Eksik kur: hesaplanamadı',
} as const;

export function CostsView({
  overview,
  role,
}: {
  overview: CostOverview;
  role: TeamRole;
}) {
  const { summary, currency, period, influencer } = overview;
  const money = (value: string | null) => formatMoney(value, currency);
  const canWrite = role !== 'viewer';
  const today = todayIso();

  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = {
      month: period.month,
      cur: currency,
      inf: influencer?.slug,
      ...changes,
    };
    for (const [key, value] of Object.entries(next))
      if (value) params.set(key, value);
    return `/costs?${params.toString()}`;
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YÖNETİM</p>
          <h1>Maliyetler</h1>
          <p>
            {influencer ? `${influencer.name} · ` : 'Tüm influencer’lar · '}
            {period.month} dönemi, {currency} cinsinden.
          </p>
        </div>
        <nav
          aria-label="Dönem ve para birimi"
          className="flex flex-wrap items-center gap-2"
        >
          <Link
            className="button button-quiet"
            href={href({ month: shiftMonth(period.month, -1) })}
          >
            ← Önceki ay
          </Link>
          <Link
            className="button button-quiet"
            href={href({ month: shiftMonth(period.month, 1) })}
          >
            Sonraki ay →
          </Link>
          {supportedCurrencies.map((item) => (
            <Link
              key={item}
              aria-current={item === currency ? 'true' : undefined}
              className={
                item === currency
                  ? 'button button-primary'
                  : 'button button-quiet'
              }
              href={href({ cur: item })}
            >
              {item}
            </Link>
          ))}
        </nav>
      </header>

      {summary.missingRateCount > 0 && (
        <p role="alert" className="section-card text-sm text-text">
          <AlertTriangle aria-hidden="true" className="mr-2 inline" size={16} />
          {summary.missingRateCount} kaydın {currency} kuru tanımlı değil.
          Yanlış toplam göstermemek için toplamlar gizlendi. Kur eklemek için
          aşağıdaki Oranlar bölümünü kullan.
        </p>
      )}

      <section className="stats-grid" aria-label="Dönem özeti">
        <StatCard
          label="Toplam maliyet"
          value={money(summary.total)}
          detail={`${summary.entryCount} kayıt`}
          icon={Coins}
        />
        <StatCard
          label="Video başına maliyet"
          value={money(summary.costPerVideo)}
          detail={`${summary.videoCount} video yayınlandı`}
          icon={Video}
          tone="blue"
        />
        <StatCard
          label="1000 izlenme başına"
          value={money(summary.costPer1000Views)}
          detail={`${new Intl.NumberFormat('tr-TR').format(summary.views)} izlenme`}
          icon={Eye}
          tone="mint"
        />
        <StatCard
          label="Başarısız üretim"
          value={
            summary.failedRatio === null
              ? '—'
              : `%${(Number(summary.failedRatio) * 100).toFixed(1)}`
          }
          detail={`${summary.failedGenerationCount}/${summary.generationCount} üretim · ${money(summary.failedCost)}`}
          icon={OctagonX}
        />
      </section>

      <section className="section-card" aria-labelledby="budgets-title">
        <h2 id="budgets-title" className="mb-3 text-base font-semibold">
          Bütçeler ({period.month})
        </h2>
        {overview.budgets.length ? (
          <ul className="m-0 grid list-none gap-4 p-0">
            {overview.budgets.map((budget) => {
              const level = budgetLevel(budget.ratio, budget.warnRatio);
              const percent = budgetPercent(budget.ratio);
              const name = budget.influencerName ?? 'Tüm ekip';
              return (
                <li key={budget.budgetId}>
                  <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium text-text">{name}</span>
                    <span className="text-muted">
                      {formatMoney(budget.spent, budget.currency)} /{' '}
                      {formatMoney(budget.amount, budget.currency)} ·{' '}
                      {levelText[level]}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${name} bütçe kullanımı`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-valuetext={`%${percent} · ${levelText[level]}`}
                    className="h-2 overflow-hidden rounded-full bg-line"
                  >
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Bu ay için bütçe yok"
            description={
              role === 'owner'
                ? 'Aşağıdan aylık bütçe tavanı tanımlayabilirsin.'
                : 'Bütçe tavanını ekip sahibi (owner) tanımlar.'
            }
          />
        )}
      </section>

      <section
        className="section-card grid gap-6 lg:grid-cols-2"
        aria-label="Grafikler"
      >
        {overview.daily.length ? (
          <BarChart
            title="Günlük harcama"
            rows={overview.daily.map((row) => ({
              label: row.day.slice(5),
              value: row.total === null ? null : Number(row.total),
              display: row.total === null ? 'eksik kur' : money(row.total),
            }))}
          />
        ) : (
          <EmptyState
            title="Bu dönemde harcama yok"
            description="Maliyet kaydı girildikçe günlük grafik oluşur."
          />
        )}
        {overview.byCategory.length ? (
          <BarChart
            title="Kategori dağılımı"
            rows={overview.byCategory.map((row) => ({
              label:
                costCategoryLabels[row.category as CostCategory] ??
                row.category,
              value: row.total === null ? null : Number(row.total),
              display: row.total === null ? 'eksik kur' : money(row.total),
            }))}
          />
        ) : (
          <EmptyState
            title="Kategori verisi yok"
            description="Kayıt girildikçe dağılım görünür."
          />
        )}
      </section>

      <section className="section-card" aria-labelledby="recent-title">
        <h2 id="recent-title" className="mb-3 text-base font-semibold">
          Son kayıtlar
        </h2>
        <DataTable
          rows={overview.recent.map((row) => ({
            date: row.incurred_on,
            influencer: row.influencerName,
            category:
              costCategoryLabels[row.category as CostCategory] ?? row.category,
            description: row.description,
            amount: formatMoney(row.amount, row.currency),
          }))}
          columns={[
            { key: 'date', label: 'Tarih' },
            { key: 'influencer', label: 'Influencer' },
            { key: 'category', label: 'Kategori' },
            { key: 'description', label: 'Açıklama' },
            { key: 'amount', label: 'Tutar' },
          ]}
          emptyMessage="Bu dönemde maliyet kaydı yok"
        />
      </section>

      {canWrite && (
        <section className="section-card" aria-labelledby="add-cost-title">
          <h2 id="add-cost-title" className="mb-3 text-base font-semibold">
            Maliyet ekle
          </h2>
          <CostEntryForm
            influencers={overview.influencers}
            defaultInfluencerId={influencer?.id}
            today={today}
          />
        </section>
      )}

      {role === 'owner' && (
        <section className="section-card grid gap-6" aria-label="Ayarlar">
          <div>
            <h2 className="mb-3 text-base font-semibold">Bütçe tanımla</h2>
            <BudgetForm
              influencers={overview.influencers}
              month={period.month}
            />
          </div>
          <div>
            <h2 className="mb-3 text-base font-semibold">Oranlar</h2>
            <RateForm today={today} />
            {(overview.exchangeRates.length > 0 ||
              overview.creditRates.length > 0) && (
              <ul className="mt-4 grid list-none gap-1 p-0 text-sm text-muted">
                {overview.exchangeRates.map((rate) => (
                  <li key={rate.id}>
                    {rate.valid_on}: 1 {rate.currency} = {rate.rate}{' '}
                    {rate.base_currency}
                  </li>
                ))}
                {overview.creditRates.map((rate) => (
                  <li key={rate.id}>
                    {rate.valid_from}: 1 {rate.tool} kredisi ={' '}
                    {rate.ratePerCredit} {rate.currency}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
