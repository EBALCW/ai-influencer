import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui';
import { sections } from './sections';

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
