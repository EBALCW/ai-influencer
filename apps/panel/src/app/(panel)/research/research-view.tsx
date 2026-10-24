'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { Archive, Download, ListChecks, Plus, Send, Star } from 'lucide-react';
import { EmptyState, StatCard, Toast } from '@/components/ui';
import type {
  ResearchInfluencer,
  ResearchWorkspace,
  TrendItem,
} from '@/lib/research/queries';
import {
  formatLabels,
  platformLabels,
  researchSorts,
  sortLabels,
  statusLabels,
  trendFormats,
  trendPlatforms,
  trendStatuses,
  type ResearchQuery,
  type TrendFormat,
  type TrendPlatform,
  type TrendStatus,
} from '@/lib/research/schemas';
import { TrendForm } from './trend-form';
import { TrendImport } from './trend-import';

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';
const label = 'block text-xs font-medium text-muted';
const numberFormat = new Intl.NumberFormat('tr-TR', { notation: 'compact' });

function filterParams(filter: ResearchQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter))
    if (
      value !== undefined &&
      value !== '' &&
      !(key === 'sort' && value === 'score')
    )
      params.set(key, String(value));
  return params;
}

function BacklogPanel({
  trend,
  influencers,
  defaultInfluencerId,
  onDone,
}: {
  trend: TrendItem;
  influencers: ResearchInfluencer[];
  defaultInfluencerId?: string;
  onDone: (message: string, tone?: 'success' | 'error') => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const fixed = trend.influencer_id;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/trends/${trend.id}/backlog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencer_id: fixed
            ? null
            : String(data.get('influencer_id') || '') || null,
          title: String(data.get('title') ?? ''),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? 'Aktarılamadı.');
      router.refresh();
      onDone('Fikir içerik backlog’una (Fikir sütunu) aktarıldı.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Aktarılamadı.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      aria-label="Backlog'a aktar"
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={submit}
    >
      <label className={label}>
        Influencer
        {fixed ? (
          <input
            className={field}
            disabled
            value={trend.influencer?.name ?? 'Özel influencer'}
          />
        ) : (
          <select
            className={field}
            defaultValue={defaultInfluencerId ?? influencers[0]?.id}
            name="influencer_id"
            required
          >
            {influencers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className={`${label} sm:col-span-2`}>
        Kart başlığı (boşsa uyarlama fikri)
        <input
          className={field}
          defaultValue={trend.adaptation_idea.slice(0, 200)}
          maxLength={200}
          name="title"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button
          className="button button-primary"
          disabled={pending || (!fixed && !influencers.length)}
          type="submit"
        >
          <Send size={16} /> {pending ? 'Aktarılıyor…' : 'Fikir kartı oluştur'}
        </button>
        <button
          className="button button-quiet"
          onClick={() => onDone('')}
          type="button"
        >
          Vazgeç
        </button>
        {error && (
          <p className="text-sm text-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

export function ResearchView({
  workspace,
  filter,
  canWrite,
}: {
  workspace: ResearchWorkspace;
  filter: ResearchQuery;
  canWrite: boolean;
}) {
  const { trends, totals, influencers, selected } = workspace;
  const [editing, setEditing] = useState<string | null>(null);
  const [pushing, setPushing] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);
  const done = (message: string, tone: 'success' | 'error' = 'success') => {
    setEditing(null);
    setPushing(null);
    if (message) setToast({ message, tone });
  };
  const exportQuery = filterParams(filter).toString();
  const contentHref = (slug?: string) =>
    slug ? `/content?inf=${encodeURIComponent(slug)}` : '/content';
  const editingTrend = trends.find((item) => item.id === editing);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ARAŞTIRMA</p>
          <h1>Araştırma</h1>
          <p>
            Trend ve viral içerik arşivi
            {selected ? ` · ${selected.name} + global trendler` : ''}. Yüksek
            puanlı fikirleri içerik backlog’una aktar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            className="button button-quiet"
            download
            href={`/api/trends/export${exportQuery ? `?${exportQuery}` : ''}`}
          >
            <Download size={16} /> CSV indir
          </a>
          {canWrite && (
            <button
              className="button button-primary"
              onClick={() => {
                setPushing(null);
                setEditing('new');
              }}
              type="button"
            >
              <Plus size={16} /> Yeni trend
            </button>
          )}
        </div>
      </header>

      {toast && (
        <Toast
          message={toast.message}
          onDismiss={() => setToast(null)}
          tone={toast.tone}
        />
      )}

      <section aria-label="Arşiv özeti" className="stats-grid">
        <StatCard
          detail="#10 hedefi: en az 30 kayıt"
          icon={Archive}
          label="Arşivdeki trend"
          value={String(totals.all)}
        />
        <StatCard
          detail="Uyarlama puanı 4-5"
          icon={Star}
          label="Güçlü fikir"
          tone="blue"
          value={String(totals.strong)}
        />
        <StatCard
          detail="Backlog adayı"
          icon={ListChecks}
          label="Seçildi"
          tone="mint"
          value={String(totals.shortlisted)}
        />
        <StatCard
          detail="Fikir kartı açıldı"
          icon={Send}
          label="Backlog’da"
          value={String(totals.used)}
        />
      </section>

      {canWrite && editing && (
        <section aria-labelledby="trend-form-title" className="section-card">
          <h2 className="mb-3 text-base font-semibold" id="trend-form-title">
            {editingTrend ? 'Trendi düzenle' : 'Yeni trend'}
          </h2>
          <TrendForm
            key={editing}
            defaultInfluencerId={selected?.id}
            influencers={influencers}
            onDone={done}
            trend={editingTrend}
          />
        </section>
      )}

      <section aria-labelledby="trend-list-title" className="section-card">
        <h2 className="mb-3 text-base font-semibold" id="trend-list-title">
          Trend arşivi
        </h2>
        <form
          action="/research"
          aria-label="Trend filtreleri"
          className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-7"
          method="get"
        >
          {selected && <input name="inf" type="hidden" value={selected.slug} />}
          <label className={label}>
            Durum
            <select
              className={field}
              defaultValue={filter.status ?? ''}
              name="status"
            >
              <option value="">Tümü</option>
              {trendStatuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Platform
            <select
              className={field}
              defaultValue={filter.platform ?? ''}
              name="platform"
            >
              <option value="">Tümü</option>
              {trendPlatforms.map((item) => (
                <option key={item} value={item}>
                  {platformLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Format
            <select
              className={field}
              defaultValue={filter.format ?? ''}
              name="format"
            >
              <option value="">Tümü</option>
              {trendFormats.map((item) => (
                <option key={item} value={item}>
                  {formatLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Kapsam
            <select
              className={field}
              defaultValue={filter.scope ?? ''}
              name="scope"
            >
              <option value="">Tümü</option>
              <option value="global">Global</option>
              <option value="specific">Influencer’a özel</option>
            </select>
          </label>
          <label className={label}>
            En az puan
            <select
              className={field}
              defaultValue={filter.min ? String(filter.min) : ''}
              name="min"
            >
              <option value="">Hepsi</option>
              {[5, 4, 3, 2].map((item) => (
                <option key={item} value={item}>
                  {item}+
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Sırala
            <select className={field} defaultValue={filter.sort} name="sort">
              {researchSorts.map((item) => (
                <option key={item} value={item}>
                  {sortLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="button button-primary" type="submit">
              Filtrele
            </button>
            <Link
              className="button button-quiet"
              href={selected ? `/research?inf=${selected.slug}` : '/research'}
            >
              Temizle
            </Link>
          </div>
        </form>

        {trends.length === 0 ? (
          <EmptyState
            description={
              totals.all
                ? 'Bu filtreyle eşleşen trend yok.'
                : 'Henüz trend kaydı yok. “Yeni trend” ile ekleyin veya research/trends.csv dosyasını içe aktarın.'
            }
            title="Trend bulunamadı"
          />
        ) : (
          <div className="table-scroll">
            <table aria-label="Trendler" className="data-table">
              <thead>
                <tr>
                  <th scope="col">Puan</th>
                  <th scope="col">Trend</th>
                  <th scope="col">İzlenme</th>
                  <th scope="col">Neden viral</th>
                  <th scope="col">Ses / trend</th>
                  <th scope="col">Kapsam</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Tarih</th>
                  {canWrite && <th scope="col">İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {trends.map((trend) => (
                  <Fragment key={trend.id}>
                    <tr>
                      <td>
                        <strong>{trend.adaptation_score ?? '—'}</strong>
                        <span className="sr-only">/5</span>
                      </td>
                      <td className="max-w-xs">
                        <a
                          className="font-medium text-text underline"
                          href={trend.url}
                          rel="noopener noreferrer nofollow"
                          target="_blank"
                        >
                          {platformLabels[trend.platform as TrendPlatform] ??
                            trend.platform}
                          {trend.account_handle
                            ? ` · ${trend.account_handle}`
                            : ''}
                        </a>
                        <div className="text-xs text-muted">
                          {formatLabels[trend.format as TrendFormat] ??
                            trend.format}
                          {trend.duration_s !== null
                            ? ` · ${trend.duration_s} sn`
                            : ''}
                          {trend.source === 'claude' ? ' · Claude' : ''}
                        </div>
                        {trend.adaptation_idea && (
                          <div className="text-xs text-muted">
                            Fikir: {trend.adaptation_idea}
                          </div>
                        )}
                      </td>
                      <td>
                        {trend.views === null
                          ? '—'
                          : numberFormat.format(trend.views)}
                      </td>
                      <td className="max-w-xs text-sm">
                        {trend.why_viral || '—'}
                      </td>
                      <td className="max-w-[12rem] text-sm">
                        {trend.sound || '—'}
                      </td>
                      <td>{trend.influencer?.name ?? 'Global'}</td>
                      <td>
                        {statusLabels[trend.status as TrendStatus] ??
                          trend.status}
                        {trend.content_item_id && (
                          <div>
                            <Link
                              className="text-xs underline"
                              href={contentHref(
                                trend.influencer?.slug ?? selected?.slug,
                              )}
                            >
                              İçerik kartına git
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{trend.captured_on}</td>
                      {canWrite && (
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button
                              aria-label={`Düzenle: ${trend.url}`}
                              className="button button-quiet"
                              onClick={() => {
                                setPushing(null);
                                setEditing(trend.id);
                              }}
                              type="button"
                            >
                              Düzenle
                            </button>
                            {!trend.content_item_id &&
                              trend.status !== 'rejected' && (
                                <button
                                  aria-label={`Backlog'a aktar: ${trend.url}`}
                                  className="button button-primary"
                                  onClick={() => {
                                    setEditing(null);
                                    setPushing(trend.id);
                                  }}
                                  type="button"
                                >
                                  Backlog’a aktar
                                </button>
                              )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {canWrite && pushing === trend.id && (
                      <tr>
                        <td colSpan={9}>
                          <BacklogPanel
                            defaultInfluencerId={selected?.id}
                            influencers={influencers}
                            onDone={done}
                            trend={trend}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {workspace.truncated && (
          <p className="mt-3 text-sm text-muted">
            İlk {trends.length} kayıt gösteriliyor; daraltmak için filtre
            kullanın veya CSV indirin.
          </p>
        )}
      </section>

      {canWrite && (
        <section aria-labelledby="trend-import-title" className="section-card">
          <h2 className="mb-3 text-base font-semibold" id="trend-import-title">
            CSV içe aktar
          </h2>
          <TrendImport />
        </section>
      )}
    </div>
  );
}
