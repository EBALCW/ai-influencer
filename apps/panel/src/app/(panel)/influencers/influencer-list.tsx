'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Camera, CirclePlay, Music2, Search, UsersRound } from 'lucide-react';
import type { InfluencerListItem } from '@/lib/influencers';
import { EmptyState } from '@/components/ui';

const statusLabels = {
  draft: 'Taslak',
  active: 'Aktif',
  paused: 'Duraklatıldı',
  archived: 'Arşiv',
} as const;

const platformLabels: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};
const platformIcons: Record<string, typeof Camera> = {
  instagram: Camera,
  youtube: CirclePlay,
  tiktok: Music2,
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr'))
    .join('');
}

function number(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    notation: value > 9999 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function InfluencerList({
  influencers,
  selectedSlug,
}: {
  influencers: InfluencerListItem[];
  selectedSlug: string;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('current');
  const [niche, setNiche] = useState('all');
  const niches = useMemo(
    () =>
      [
        ...new Set(
          influencers
            .map((item) => item.niche)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [influencers],
  );
  const filtered = influencers.filter((item) => {
    const needle = search.trim().toLocaleLowerCase('tr');
    return (
      (!needle ||
        `${item.name} ${item.niche ?? ''} ${item.slug}`
          .toLocaleLowerCase('tr')
          .includes(needle)) &&
      (status === 'all' ||
        (status === 'current' && item.status !== 'archived') ||
        item.status === status) &&
      (niche === 'all' || item.niche === niche)
    );
  });
  const infQuery = selectedSlug
    ? `?inf=${encodeURIComponent(selectedSlug)}`
    : '';

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">STÜDYO</p>
          <h1>Influencer’lar</h1>
          <p>Karakterleri, bağlı hesapları ve güncel performansı yönetin.</p>
        </div>
        <span className="soft-badge">
          <UsersRound size={15} /> {influencers.length} kayıt
        </span>
      </header>

      <section className="section-card">
        <div className="flex flex-wrap items-center gap-3">
          <label className="table-search min-w-56 flex-1">
            <Search size={16} />
            <input
              aria-label="Influencer ara"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ad veya nişe göre ara…"
              value={search}
            />
          </label>
          <label className="sr-only" htmlFor="influencer-status">
            Duruma göre filtrele
          </label>
          <select
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-primary"
            id="influencer-status"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="current">Aktif ve arşiv dışı</option>
            <option value="all">Tüm durumlar</option>
            <option value="draft">Taslak</option>
            <option value="active">Aktif</option>
            <option value="paused">Duraklatıldı</option>
            <option value="archived">Arşiv</option>
          </select>
          <label className="sr-only" htmlFor="influencer-niche">
            Nişe göre filtrele
          </label>
          <select
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-primary"
            id="influencer-niche"
            onChange={(event) => setNiche(event.target.value)}
            value={niche}
          >
            <option value="all">Tüm nişler</option>
            {niches.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        {filtered.length ? (
          <div className="data-table-wrap mt-5">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Influencer</th>
                    <th>Durum</th>
                    <th>Platformlar</th>
                    <th>Takipçi</th>
                    <th>Son 7 gün izlenme</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="profile-avatar">
                            {initials(item.name)}
                          </span>
                          <span>
                            <Link
                              className="font-semibold text-primary hover:underline"
                              href={`/influencers/${encodeURIComponent(item.slug)}${infQuery}`}
                            >
                              {item.name}
                            </Link>
                            <span className="block text-xs text-muted">
                              {item.niche || 'Niş belirtilmemiş'}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="soft-badge">
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td>
                        {item.platforms.length ? (
                          <div
                            aria-label="Bağlı platformlar"
                            className="flex items-center gap-3"
                          >
                            {item.platforms.map((platform) => {
                              const Icon = platformIcons[platform];
                              const label =
                                platformLabels[platform] ?? platform;
                              return (
                                <span
                                  aria-label={label}
                                  key={platform}
                                  title={label}
                                >
                                  {Icon ? (
                                    <Icon aria-hidden="true" size={16} />
                                  ) : (
                                    label
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{number(item.followers)}</td>
                      <td>{number(item.views7d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>{filtered.length} kayıt</span>
            </div>
          </div>
        ) : (
          <EmptyState
            title={
              influencers.length
                ? 'Eşleşen influencer yok'
                : 'Henüz influencer yok'
            }
            description={
              influencers.length
                ? 'Arama veya filtreleri değiştirip tekrar deneyin.'
                : 'Yeni influencer kayıtları eklendiğinde burada görüntülenir.'
            }
          />
        )}
      </section>
    </div>
  );
}
