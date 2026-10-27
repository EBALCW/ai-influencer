import Link from 'next/link';
import { FileDown } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import {
  NO_DATA,
  buildMediaKit,
  formatCount,
  formatDate,
  formatPercent,
  formatPriceRange,
  formatSeconds,
  formatSigned,
  platformLabel,
} from '@/lib/media-kit/build';
import { loadMediaKitInput } from '@/lib/media-kit/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Medya kiti önizlemesi: PDF ile aynı veri (`buildMediaKit`). Her sayı ölçümlerden
 * gelir; veri yoksa "veri yok" yazılır. PDF `/api/media-kit/<slug>` ile tek tıkla iner.
 */
export default async function MediaKitPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string }>;
}) {
  const [, { inf }] = await Promise.all([requireTeamMember(), searchParams]);
  const supabase = await createSupabaseServerClient();

  if (!inf) {
    const { data, error } = await supabase
      .from('influencers')
      .select('name, slug')
      .neq('status', 'archived')
      .order('name');
    if (error)
      throw new Error(`Influencer listesi alınamadı: ${error.message}`);
    return (
      <div className="page-stack">
        <Heading
          title="Medya kiti"
          subtitle="Kiti oluşturmak için bir influencer seç."
        />
        <section className="section-card" aria-label="Influencer seç">
          {data?.length ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {data.map((item) => (
                <li key={item.slug}>
                  <Link
                    className="button button-quiet"
                    href={`/brands/media-kit?inf=${encodeURIComponent(item.slug)}`}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Influencer yok"
              description="Medya kiti için önce bir influencer oluştur."
            />
          )}
        </section>
      </div>
    );
  }

  const input = await loadMediaKitInput(inf, new Date(), supabase);
  if (!input)
    return (
      <div className="page-stack">
        <Heading title="Medya kiti" subtitle="Influencer bulunamadı." />
        <EmptyState
          title="Influencer bulunamadı"
          description="Seçili influencer silinmiş veya erişimin yok."
        />
      </div>
    );
  const kit = buildMediaKit(input);
  const period = `${formatDate(kit.period.from)} – ${formatDate(kit.period.to)}`;

  return (
    <div className="page-stack">
      <Heading
        title={`${kit.influencer.name} · Medya kiti`}
        subtitle={`Veri aralığı: ${period} (son ${kit.period.days} gün, Türkiye saati)`}
        action={
          <a
            className="button button-primary"
            download
            href={`/api/media-kit/${encodeURIComponent(kit.influencer.slug)}`}
          >
            <FileDown aria-hidden="true" size={16} /> PDF indir
          </a>
        }
      />

      <section className="section-card" aria-labelledby="ai-title">
        <h2 id="ai-title" className="mb-2 text-base font-semibold">
          AI açıklaması
        </h2>
        <p className="text-sm">{kit.aiDisclosure}</p>
        {kit.influencer.bio && (
          <p className="mt-2 text-sm text-muted">{kit.influencer.bio}</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="section-card" aria-labelledby="followers-title">
          <h2 id="followers-title" className="mb-2 text-base font-semibold">
            Takipçi
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Toplam takipçi</dt>
            <dd className="m-0 font-semibold">
              {formatCount(kit.followers.total)}
            </dd>
            <dt className="text-muted">Son {kit.period.days} günde değişim</dt>
            <dd className="m-0 font-semibold">
              {formatSigned(kit.followers.change)}
            </dd>
            {kit.followers.accounts.map((account) => (
              <div
                className="contents"
                key={`${account.platform}-${account.handle}`}
              >
                <dt className="text-muted">
                  {platformLabel(account.platform)} {account.handle}
                </dt>
                <dd className="m-0">
                  {account.followers === null
                    ? NO_DATA
                    : `${formatCount(account.followers)} (${formatDate(account.capturedAt!)})`}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="section-card" aria-labelledby="performance-title">
          <h2 id="performance-title" className="mb-2 text-base font-semibold">
            İçerik performansı
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Dönemde yayınlanan içerik</dt>
            <dd className="m-0 font-semibold">
              {formatCount(kit.content.postCount)}
            </dd>
            <dt className="text-muted">Ortalama izlenme</dt>
            <dd className="m-0 font-semibold">
              {formatCount(kit.content.avgViews)}
            </dd>
            <dt className="text-muted">Etkileşim oranı</dt>
            <dd className="m-0 font-semibold">
              {formatPercent(kit.content.engagementRate)}
            </dd>
            <dt className="text-muted">Ortalama izlenme süresi</dt>
            <dd className="m-0 font-semibold">
              {formatSeconds(kit.content.avgWatchTimeS)}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-muted">
            {kit.content.measuredPostCount}/{kit.content.postCount} içeriğin
            ölçümü var; ölçümsüz içerik ortalamaya girmez.
          </p>
        </section>
      </div>

      <section className="section-card" aria-labelledby="top-title">
        <h2 id="top-title" className="mb-2 text-base font-semibold">
          En iyi içerikler
        </h2>
        {kit.topPosts.length === 0 ? (
          <p className="text-sm text-muted">{NO_DATA}</p>
        ) : (
          <ol className="m-0 grid gap-2 pl-5 text-sm">
            {kit.topPosts.map((post) => (
              <li key={`${post.publishedAt}-${post.caption}`}>
                <strong>{post.caption || 'Başlıksız içerik'}</strong>{' '}
                <span className="text-muted">
                  · {platformLabel(post.platform)} {post.handle} ·{' '}
                  {formatDate(post.publishedAt)} · {formatCount(post.views)}{' '}
                  izlenme · etkileşim {formatPercent(post.engagementRate)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="section-card" aria-labelledby="audience-title">
        <h2 id="audience-title" className="mb-2 text-base font-semibold">
          Kitle
        </h2>
        <p className="text-sm text-muted">
          Yaş, cinsiyet ve ülke dağılımı: {NO_DATA} (platform kitle verisi henüz
          toplanmıyor).
        </p>
      </section>

      <section className="section-card" aria-labelledby="services-title">
        <h2 id="services-title" className="mb-2 text-base font-semibold">
          Hizmetler ve fiyat aralıkları
        </h2>
        <p className="mb-2 text-sm text-muted">
          {kit.pricing.tier
            ? `Kademe: ${kit.pricing.tier} (güncel toplam takipçiye göre)`
            : `Kademe: ${NO_DATA} (takipçi ölçümü yok; fiyat teklif üzerine)`}
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-[1fr_auto]">
          {kit.pricing.services.map((service) => (
            <div className="contents" key={service.key}>
              <dt>
                <span className="font-medium">{service.label}</span>
                <span className="block text-xs text-muted">
                  {service.description}
                </span>
              </dt>
              <dd className="m-0 font-semibold">
                {formatPriceRange(service.range, kit.pricing.currency)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">
          {kit.pricing.note} Gerekçe ve kaynaklar: docs/monetization.md.
        </p>
      </section>

      <section className="section-card" aria-labelledby="contact-title">
        <h2 id="contact-title" className="mb-2 text-base font-semibold">
          İletişim
        </h2>
        {kit.contact.email ? (
          <p className="text-sm">
            İş birliği e-postası:{' '}
            <a className="font-semibold" href={`mailto:${kit.contact.email}`}>
              {kit.contact.email}
            </a>
          </p>
        ) : (
          <p className="text-sm text-muted">
            İş birliği e-postası: {NO_DATA}. Sunucu ortamında
            MEDIA_KIT_CONTACT_EMAIL tanımlanınca kitte görünür.
          </p>
        )}
      </section>
    </div>
  );
}

function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">MARKALAR</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className="button button-quiet" href="/brands">
          ← Markalar
        </Link>
        {action}
      </div>
    </header>
  );
}
