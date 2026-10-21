import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, Coins, UsersRound, Video } from 'lucide-react';
import type { TeamRole } from '@ai-influencer/shared';
import { EmptyState, StatCard } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { getInfluencerBySlug } from '@/lib/influencers';
import { StatusControls } from '../status-controls';

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
const count = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    notation: value > 9999 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);

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
  searchParams: Promise<{ inf?: string; tab?: string }>;
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
        <section className="stats-grid">
          <StatCard
            label="Toplam takipçi"
            value={count(listItem.followers)}
            detail="Bağlı hesapların son snapshot toplamı"
            icon={UsersRound}
          />
          <StatCard
            label="Son 7 gün izlenme"
            value={count(listItem.views7d)}
            detail="Kümülatif sayaç farkı"
            icon={Activity}
            tone="blue"
          />
          <StatCard
            label="Son postlar"
            value={String(data.posts.length)}
            detail="En yeni yayınlar"
            icon={Video}
            tone="mint"
          />
          <StatCard
            label="Üretimler"
            value={String(data.generations.length)}
            detail="Son üretim kayıtları"
            icon={Coins}
          />
        </section>
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
    const current =
      data.personas.find((persona) => persona.is_current) ?? data.personas[0];
    content = current ? (
      <section className="section-card space-y-4">
        <h2 className="text-lg font-semibold">Persona · v{current.version}</h2>
        <p className="whitespace-pre-wrap text-secondary">
          {current.bio || 'Biyografi girilmemiş.'}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted">Ton</dt>
            <dd>{current.tone || 'Belirtilmemiş'}</dd>
          </div>
          <div>
            <dt className="text-muted">Kanca özellikleri</dt>
            <dd>{current.hook_traits.join(', ') || 'Belirtilmemiş'}</dd>
          </div>
          <div>
            <dt className="text-muted">Kişilik</dt>
            <dd>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(current.personality, null, 2)}
              </pre>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Hedef kitle</dt>
            <dd>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(current.audience, null, 2)}
              </pre>
            </dd>
          </div>
        </dl>
      </section>
    ) : (
      <EmptyState
        title="Persona kaydı yok"
        description="Persona sürümü eklendiğinde burada görüntülenecek."
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
      <RecordList
        rows={data.prompts.map((prompt) => ({
          title: `${prompt.category} · v${prompt.version}`,
          detail: prompt.body,
        }))}
      />
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
            href={tabHref(key)}
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
