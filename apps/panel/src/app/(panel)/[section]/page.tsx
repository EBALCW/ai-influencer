import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui';

const sections: Record<
  string,
  { title: string; description: string; icon: string }
> = {
  influencers: {
    title: 'Influencer’lar',
    description: 'Karakterlerinizi, profillerinizi ve bağlı hesapları yönetin.',
    icon: '✦',
  },
  content: {
    title: 'İçerik',
    description: 'Fikirden yayına içerik üretim adımlarını takip edin.',
    icon: '▤',
  },
  calendar: {
    title: 'Takvim',
    description: 'Planlanan ve yayınlanan içerikleri takvimde görüntüleyin.',
    icon: '▦',
  },
  analytics: {
    title: 'Analitik',
    description: 'Platform performansını ve büyüme metriklerini inceleyin.',
    icon: '⌁',
  },
  production: {
    title: 'Üretim',
    description: 'Görsel ve video üretimlerinizi buradan takip edin.',
    icon: '▷',
  },
  costs: {
    title: 'Maliyetler',
    description: 'Üretim ve abonelik maliyetlerinizi tek yerde izleyin.',
    icon: '₺',
  },
  brands: {
    title: 'Markalar',
    description: 'Marka iş birliklerini ve medya kitinizi yönetin.',
    icon: '◇',
  },
};

// Bölümler sabit; listede olmayan adres doğrudan 404 döner.
// (Layout'taki Suspense sayfayı stream ettiği için notFound() tek başına 200 + "bulunamadı" içeriği döndürüyordu.)
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const page = sections[section];
  if (!page) notFound();

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ÇALIŞMA ALANI</p>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <span className="section-hero-icon" aria-hidden="true">
          {page.icon}
        </span>
      </header>
      <section className="section-card section-empty-card">
        <EmptyState
          title={`${page.title} alanı hazır`}
          description="Bu bölüm için kayıt bulunmuyor. Modül tamamlandığında içerikleriniz burada listelenecek."
        />
      </section>
    </div>
  );
}
