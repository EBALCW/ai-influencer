import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TeamRole } from '@ai-influencer/shared';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { getInfluencerBySlug } from '@/lib/influencers';
import { StatusControls } from '../status-controls';
import { getTeamMemberEmails } from '@/lib/team-emails';
import { DetailStats } from './detail-stats';
import { PersonaTab } from './persona-tab';

const tabs = [
  ['general', 'Genel'],
  ['persona', 'Persona'],
  ['references', 'Referanslar'],
  ['prompts', "Prompt'lar"],
  ['accounts', 'Hesaplar'],
  ['content', 'İçerikler'],
  ['analytics', 'Analitik'],
  ['costs', 'Maliyet'],
] as const;
const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  paused: 'Duraklatıldı',
  archived: 'Arşiv',
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(
        new Date(value),
      )
    : 'Tarih yok';
function RecordList({
  rows,
}: {
  rows: Array<{ title: string; detail: string }>;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="Henüz kayıt yok"
        description="Bu influencer için bu bölümde gösterilecek veri bulunmuyor."
      />
    );
  return (
    <div className="data-table-wrap">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kayıt</th>
              <th>Detay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.title}-${index}`}>
                <td>{row.title}</td>
                <td>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function InfluencerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    inf?: string;
    tab?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const [{ slug }, query, member] = await Promise.all([
    params,
    searchParams,
    requireTeamMember(),
  ]);
  const data = await getInfluencerBySlug(slug);
  if (!data) notFound();
  const tab = tabs.some(([key]) => key === query.tab) ? query.tab! : 'general';
  const selectedSlug = query.inf ?? '';
  const tabHref = (key: string) =>
    `/influencers/${encodeURIComponent(slug)}?${new URLSearchParams({ ...(selectedSlug ? { inf: selectedSlug } : {}), tab: key })}`;
  const { influencer, listItem } = data;

  let content;
  if (tab === 'general') {
    content = (
      <div className="page-stack">
        <DetailStats
          followers={listItem.followers}
          views7d={listItem.views7d}
          posts={data.posts.length}
          generations={data.generations.length}
        />
        <section className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YAYINLAR</p>
              <h2>Son 5 post</h2>
            </div>
          </div>
          <RecordList
            rows={data.posts.map((post) => ({
              title: post.caption || post.external_id || 'Başlıksız post',
              detail: date(post.published_at),
            }))}
          />
        </section>
        <section className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ÜRETİM</p>
              <h2>Son üretimler</h2>
            </div>
          </div>
          <RecordList
            rows={data.generations.map((generation) => ({
              title: `${generation.type} · ${generation.tool}`,
              detail: `${generation.status} · ${date(generation.created_at)}`,
            }))}
          />
        </section>
      </div>
    );
  } else if (tab === 'persona') {
    const emails = await getTeamMemberEmails(
      data.personas.map((persona) => persona.created_by),
    );
    content = (
      <PersonaTab
        authorEmails={Object.fromEntries(emails)}
        canEdit={(member.role as TeamRole) !== 'viewer'}
        compare={{ from: query.from, to: query.to, inf: selectedSlug }}
        currentUserId={member.user.id}
        hrefWith={(extra) =>
          `/influencers/${encodeURIComponent(slug)}?${new URLSearchParams({ ...(selectedSlug ? { inf: selectedSlug } : {}), tab: 'persona', ...extra })}`
        }
        influencerId={influencer.id}
        personas={data.personas}
      />
    );
  } else if (tab === 'references') {
    content = (
      <RecordList
        rows={data.assets.map((asset) => ({
          title: asset.storage_path.split('/').at(-1) ?? asset.storage_path,
          detail: `${asset.kind} · ${asset.qc_status}`,
        }))}
      />
    );
  } else if (tab === 'prompts') {
    content = (
      <div className="page-stack">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Bu influencer&apos;a özel prompt&apos;lar. Global prompt&apos;lar,
            versiyonlar ve içe/dışa aktarma kütüphanededir.
          </p>
          <Link
            className="button button-quiet"
            href={`/prompts?inf=${encodeURIComponent(influencer.slug)}`}
          >
            Prompt kütüphanesinde aç
          </Link>
        </div>
        <RecordList
          rows={data.prompts.map((prompt) => ({
            title: `${prompt.category} · v${prompt.version}`,
            detail: prompt.body,
          }))}
        />
      </div>
    );
  } else if (tab === 'accounts') {
    content = (
      <RecordList
        rows={data.accounts.map((account) => ({
          title: `${account.platform} · ${account.handle}`,
          detail: account.status,
        }))}
      />
    );
  } else if (tab === 'content') {
    content = (
      <RecordList
        rows={data.posts.map((post) => ({
          title: post.caption || post.external_id || 'Başlıksız post',
          detail: date(post.published_at),
        }))}
      />
    );
  } else if (tab === 'costs') {
    content = (
      <RecordList
        rows={data.costs.map((cost) => ({
          title: cost.description || cost.category,
          detail: `${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cost.currency }).format(Number(cost.amount))} · ${date(cost.incurred_on)}`,
        }))}
      />
    );
  } else {
    content = (
      <EmptyState
        title="Henüz analitik yok"
        description="Analitik verileri bağlandığında bu sekmede gösterilecek."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <Link
              className="hover:underline"
              href={`/influencers${selectedSlug ? `?inf=${encodeURIComponent(selectedSlug)}` : ''}`}
            >
              INFLUENCER’LAR
            </Link>
          </p>
          <h1>{influencer.name}</h1>
          <p>
            {influencer.niche || 'Niş belirtilmemiş'} ·{' '}
            <span className="soft-badge">
              {statusLabels[influencer.status]}
            </span>
          </p>
        </div>
        <StatusControls
          id={influencer.id}
          status={influencer.status}
          canEdit={(member.role as TeamRole) !== 'viewer'}
        />
      </header>
      <nav
        aria-label="Influencer detay sekmeleri"
        className="flex flex-wrap gap-2 border-b border-line pb-3"
      >
        {tabs.map(([key, label]) => (
          <Link
            aria-current={tab === key ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm ${tab === key ? 'bg-surface text-primary font-semibold' : 'text-muted hover:text-primary'}`}
            href={
              key === 'references'
                ? `/influencers/${encodeURIComponent(slug)}/assets${selectedSlug ? `?inf=${encodeURIComponent(selectedSlug)}` : ''}`
                : tabHref(key)
            }
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>
      {content}
    </div>
  );
}
