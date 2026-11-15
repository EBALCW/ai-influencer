import { notFound, redirect } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { getSeries } from '@/lib/explainer/queries';
import { SubHeader } from '../../../page-header';
import { SeriesForm } from '../../../series-form';

export default async function EditSeriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ role }, { id }] = await Promise.all([requireTeamMember(), params]);
  if (role === 'viewer') redirect(`/explainers/series/${id}`);
  const series = await getSeries(id);
  if (!series) notFound();
  return (
    <div className="page-stack">
      <SubHeader
        crumbs={[
          { href: '/explainers', label: 'ANLATIM VİDEOLARI' },
          { href: `/explainers/series/${series.id}`, label: series.name },
        ]}
        description="Değişiklik yeni bölümleri ve henüz üretime gönderilmemiş bölümleri etkiler; üretime alınmış işlerin ayarları dondurulmuştur."
        title="Seriyi düzenle"
      />
      <section className="section-card">
        <SeriesForm series={series} />
      </section>
    </div>
  );
}
