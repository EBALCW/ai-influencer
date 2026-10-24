'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AlertTriangle, FileDown } from 'lucide-react';
import type { TeamRole } from '@ai-influencer/shared';
import { EmptyState, Toast } from '@/components/ui';
import type { BrandsOverview, DealCard } from '@/lib/brands/queries';
import { pipelineTotals } from '@/lib/brands/revenue';
import {
  dealCurrencies,
  dealStages,
  type DealStage,
} from '@/lib/brands/schemas';
import { formatMoney } from '@/lib/costs/money';
import { shiftMonth } from '@/lib/costs/period';
import { brandRequest, fieldClass, labelClass, useMutation } from './request';

const monthFormat = new Intl.DateTimeFormat('tr-TR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthLabel = (month: string) =>
  monthFormat.format(new Date(`${month}-01T00:00:00Z`));

export function BrandsView({
  overview,
  role,
  month,
}: {
  overview: BrandsOverview;
  role: TeamRole;
  month: string;
}) {
  const canEdit = role !== 'viewer';
  const mutation = useMutation();
  const slug = overview.influencer?.slug;

  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { inf: slug, cur: overview.currency, month, ...changes };
    for (const [key, value] of Object.entries(next))
      if (value) params.set(key, value);
    return `/brands?${params.toString()}`;
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YÖNETİM</p>
          <h1>Markalar</h1>
          <p>
            {overview.influencer
              ? `${overview.influencer.name} · `
              : 'Tüm influencer’lar · '}
            marka listesi, deal pipeline’ı ve gelir raporu.
          </p>
        </div>
        <Link
          className="button button-primary"
          href={`/brands/media-kit${slug ? `?inf=${encodeURIComponent(slug)}` : ''}`}
        >
          <FileDown aria-hidden="true" size={16} /> Medya kiti
        </Link>
      </header>

      <Pipeline
        canEdit={canEdit}
        deals={overview.deals}
        mutation={mutation}
        slug={slug}
      />

      {canEdit && (
        <section className="section-card" aria-labelledby="new-deal-title">
          <h2 id="new-deal-title" className="mb-3 text-base font-semibold">
            Yeni deal
          </h2>
          <DealForm overview={overview} mutation={mutation} />
        </section>
      )}

      <BrandList overview={overview} canEdit={canEdit} mutation={mutation} />

      <section className="section-card" aria-labelledby="revenue-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="revenue-title" className="text-base font-semibold">
            Gelir raporu ({overview.currency})
          </h2>
          <nav
            aria-label="Gelir raporu dönemi ve para birimi"
            className="flex flex-wrap gap-2"
          >
            <Link
              className="button button-quiet"
              href={href({ month: shiftMonth(month, -1) })}
            >
              ← Önceki ay
            </Link>
            <Link
              className="button button-quiet"
              href={href({ month: shiftMonth(month, 1) })}
            >
              Sonraki ay →
            </Link>
            {dealCurrencies.map((item) => (
              <Link
                key={item}
                aria-current={item === overview.currency ? 'true' : undefined}
                className={
                  item === overview.currency
                    ? 'button button-primary'
                    : 'button button-quiet'
                }
                href={href({ cur: item })}
              >
                {item}
              </Link>
            ))}
          </nav>
        </div>
        <RevenueTable overview={overview} />
      </section>

      {mutation.message && (
        <Toast
          message={mutation.message.text}
          tone={mutation.message.error ? 'error' : 'success'}
          onDismiss={mutation.clearMessage}
        />
      )}
    </div>
  );
}

type Mutation = ReturnType<typeof useMutation>;

function Pipeline({
  deals,
  canEdit,
  mutation,
  slug,
}: {
  deals: DealCard[];
  canEdit: boolean;
  mutation: Mutation;
  slug?: string;
}) {
  const totals = pipelineTotals(deals);
  const disabled = !canEdit || mutation.pending;

  function move(deal: DealCard, stage: DealStage) {
    if (disabled || deal.stage === stage) return;
    void mutation.run(
      () => brandRequest(`/api/brand-deals/${deal.id}`, 'PATCH', { stage }),
      `${deal.brandName}: aşama güncellendi.`,
    );
  }

  return (
    <section className="section-card" aria-labelledby="pipeline-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pipeline-title" className="text-base font-semibold">
          Deal pipeline
        </h2>
        <p className="text-sm text-muted" aria-label="Pipeline toplamı">
          Pipeline (kaybedilenler hariç):{' '}
          {totals.length
            ? totals
                .map((item) => formatMoney(item.total, item.currency))
                .join(' · ')
            : '—'}
        </p>
      </div>
      {deals.length === 0 ? (
        <EmptyState
          title="Henüz deal yok"
          description="Bir marka ekleyip ilk deal’i açtığında burada aşamalara göre görünecek."
        />
      ) : (
        <div className="overflow-x-auto pb-2" aria-busy={mutation.pending}>
          <div className="grid min-w-[1200px] grid-cols-6 gap-3">
            {dealStages.map(([stage, label]) => {
              const items = deals.filter((deal) => deal.stage === stage);
              return (
                <section
                  key={stage}
                  aria-label={`${label} sütunu`}
                  className="min-h-48 rounded-2xl border border-line bg-surface-raised p-3"
                  onDragOver={(event) => {
                    if (!disabled) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData(
                      'application/x-deal-id',
                    );
                    const deal = deals.find((item) => item.id === id);
                    if (deal) move(deal, stage);
                  }}
                >
                  <h3 className="mb-3 text-sm font-semibold">
                    {label}{' '}
                    <span className="font-normal text-muted">
                      ({items.length})
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {items.map((deal) => (
                      <article
                        key={deal.id}
                        data-testid={`deal-card-${deal.id}`}
                        draggable={!disabled}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            'application/x-deal-id',
                            deal.id,
                          );
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        className="rounded-xl border border-line bg-surface p-3 text-sm shadow-sm"
                      >
                        <Link
                          className="font-semibold text-text hover:underline"
                          href={`/brands/${deal.id}${slug ? `?inf=${encodeURIComponent(slug)}` : ''}`}
                        >
                          {deal.brandName}
                        </Link>
                        <p className="mt-1 text-xs text-muted">
                          {deal.influencerName}
                        </p>
                        <p className="mt-1 text-xs">
                          {deal.fee === null
                            ? 'Ücret girilmedi'
                            : formatMoney(deal.fee, deal.currency)}
                        </p>
                        {deal.dueDate && (
                          <p className="mt-1 text-xs text-muted">
                            Son tarih: {deal.dueDate}
                          </p>
                        )}
                        {deal.paidAt && (
                          <p className="mt-1 text-xs text-muted">
                            Ödeme: {deal.paidAt}
                          </p>
                        )}
                        <label className="mt-2 block text-xs text-muted">
                          Aşama
                          <select
                            aria-label={`${deal.brandName} aşaması`}
                            className={fieldClass}
                            disabled={disabled}
                            value={deal.stage}
                            onChange={(event) =>
                              move(deal, event.target.value as DealStage)
                            }
                          >
                            {dealStages.map(([key, text]) => (
                              <option key={key} value={key}>
                                {text}
                              </option>
                            ))}
                          </select>
                        </label>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function DealForm({
  overview,
  mutation,
}: {
  overview: BrandsOverview;
  mutation: Mutation;
}) {
  if (!overview.brands.length || !overview.influencers.length)
    return (
      <p className="text-sm text-muted">
        Deal açmak için önce bir marka ve bir influencer olmalı.
      </p>
    );
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const fee = String(data.get('fee') ?? '')
      .trim()
      .replace(',', '.');
    const ok = await mutation.run(
      () =>
        brandRequest('/api/brand-deals', 'POST', {
          brandId: data.get('brandId'),
          influencerId: data.get('influencerId'),
          fee: fee || null,
          currency: data.get('currency'),
          dueDate: data.get('dueDate') || null,
          notes: data.get('notes') ?? '',
        }),
      'Deal açıldı.',
    );
    if (ok) form.reset();
  }
  return (
    <form
      aria-label="Yeni deal formu"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={onSubmit}
    >
      <label className={labelClass}>
        Marka
        <select className={fieldClass} name="brandId" required>
          {overview.brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Influencer
        <select
          className={fieldClass}
          defaultValue={overview.influencer?.id}
          name="influencerId"
          required
        >
          {overview.influencers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Ücret
        <input
          className={fieldClass}
          inputMode="decimal"
          name="fee"
          placeholder="1500.00"
        />
      </label>
      <label className={labelClass}>
        Para birimi
        <select className={fieldClass} defaultValue="USD" name="currency">
          {dealCurrencies.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Son teslim tarihi
        <input className={fieldClass} name="dueDate" type="date" />
      </label>
      <label className={labelClass}>
        Not
        <input className={fieldClass} maxLength={5000} name="notes" />
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          className="button button-primary"
          disabled={mutation.pending}
          type="submit"
        >
          Deal aç
        </button>
      </div>
    </form>
  );
}

function BrandList({
  overview,
  canEdit,
  mutation,
}: {
  overview: BrandsOverview;
  canEdit: boolean;
  mutation: Mutation;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await mutation.run(
      () =>
        brandRequest('/api/brands', 'POST', {
          name: data.get('name'),
          website: data.get('website') ?? '',
          contactName: data.get('contactName') ?? '',
          contactEmail: data.get('contactEmail') ?? '',
          notes: data.get('notes') ?? '',
        }),
      'Marka eklendi.',
    );
    if (ok) form.reset();
  }

  return (
    <section className="section-card" aria-labelledby="brands-title">
      <h2 id="brands-title" className="mb-3 text-base font-semibold">
        Marka listesi ve hedef markalar
      </h2>
      {overview.brands.length === 0 ? (
        <EmptyState
          title="Henüz marka yok"
          description="Çalıştığın veya hedeflediğin markaları araştırma notlarıyla birlikte ekle."
        />
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
          {overview.brands.map((brand) => (
            <li
              key={brand.id}
              className="rounded-xl border border-line bg-surface p-3 text-sm"
              aria-label={brand.name}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong>{brand.name}</strong>
                <span className="text-xs text-muted">
                  {brand.dealCount === 0
                    ? 'Hedef marka'
                    : `${brand.dealCount} deal · ${brand.openDealCount} açık`}
                </span>
              </div>
              {brand.website && /^https?:\/\//i.test(brand.website) && (
                <a
                  className="mt-1 block text-xs text-accent underline"
                  href={brand.website}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {brand.website}
                </a>
              )}
              {(brand.contact_name || brand.contact_email) && (
                <p className="mt-1 text-xs text-muted">
                  {[brand.contact_name, brand.contact_email]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {editing === brand.id ? (
                <form
                  className="mt-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const notes = String(
                      new FormData(event.currentTarget).get('notes') ?? '',
                    );
                    const ok = await mutation.run(
                      () =>
                        brandRequest(`/api/brands/${brand.id}`, 'PATCH', {
                          notes,
                        }),
                      'Notlar kaydedildi.',
                    );
                    if (ok) setEditing(null);
                  }}
                >
                  <label className={labelClass}>
                    {brand.name} araştırma notları
                    <textarea
                      className={fieldClass}
                      defaultValue={brand.notes}
                      maxLength={5000}
                      name="notes"
                      rows={4}
                    />
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="button button-primary"
                      disabled={mutation.pending}
                      type="submit"
                    >
                      Notları kaydet
                    </button>
                    <button
                      className="button button-quiet"
                      onClick={() => setEditing(null)}
                      type="button"
                    >
                      Vazgeç
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {brand.notes || (
                      <span className="text-muted">Araştırma notu yok.</span>
                    )}
                  </p>
                  {canEdit && (
                    <button
                      className="button button-quiet mt-2"
                      onClick={() => setEditing(brand.id)}
                      type="button"
                    >
                      {brand.name} notlarını düzenle
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          aria-label="Marka ekle"
          className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
          onSubmit={onCreate}
        >
          <label className={labelClass}>
            Marka adı
            <input
              className={fieldClass}
              maxLength={120}
              name="name"
              required
            />
          </label>
          <label className={labelClass}>
            Web sitesi
            <input
              className={fieldClass}
              name="website"
              placeholder="https://"
              type="url"
            />
          </label>
          <label className={labelClass}>
            İletişim kişisi
            <input className={fieldClass} maxLength={120} name="contactName" />
          </label>
          <label className={labelClass}>
            İletişim e-postası
            <input className={fieldClass} name="contactEmail" type="email" />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Araştırma notları
            <textarea
              className={fieldClass}
              maxLength={5000}
              name="notes"
              rows={3}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              className="button button-primary"
              disabled={mutation.pending}
              type="submit"
            >
              Marka ekle
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function RevenueTable({ overview }: { overview: BrandsOverview }) {
  const { rows, totals } = overview.revenue;
  const money = (value: string | null) =>
    value === null ? 'Eksik kur' : formatMoney(value, overview.currency);
  return (
    <>
      {(totals.missingRateCount > 0 || totals.costMissingRateCount > 0) && (
        <p role="alert" className="mb-3 text-sm text-text">
          <AlertTriangle aria-hidden="true" className="mr-2 inline" size={16} />
          Bazı kayıtların {overview.currency} kuru tanımlı değil; yanlış toplam
          göstermemek için ilgili aylar gizlendi. Kur eklemek için{' '}
          <Link className="underline" href="/costs">
            Maliyetler
          </Link>{' '}
          sayfasını kullan.
        </p>
      )}
      <div className="table-scroll">
        <table className="data-table" aria-label="Aylık gelir ve kâr/zarar">
          <thead>
            <tr>
              <th scope="col">Ay</th>
              <th scope="col">Gelir</th>
              <th scope="col">Maliyet</th>
              <th scope="col">Kâr / zarar</th>
              <th scope="col">Ödenen deal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <th scope="row">{monthLabel(row.month)}</th>
                <td>{money(row.revenue)}</td>
                <td>{money(row.cost)}</td>
                <td>{money(row.profit)}</td>
                <td>
                  {row.dealCount}
                  {row.unpricedCount > 0 &&
                    ` (${row.unpricedCount} ücreti girilmemiş)`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Toplam</th>
              <td>{money(totals.revenue)}</td>
              <td>{money(totals.cost)}</td>
              <td>{money(totals.profit)}</td>
              <td>{totals.dealCount}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Gelir ödeme tarihine (paid_at) göre, ödeme günündeki kurla hesaplanır.
        Kaybedilen ve ödenmemiş deal’ler dahil edilmez.
      </p>
    </>
  );
}
