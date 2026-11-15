import { redirect } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { getActiveSeriesOptions } from '@/lib/explainer/queries';
import { EpisodeForm } from '../../episode-form';
import { SubHeader } from '../../page-header';

export default async function NewEpisodePage({
  searchParams,
}: {
  searchParams: Promise<{ series?: string }>;
}) {
  const [{ role }, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  if (role === 'viewer') redirect('/explainers');
  const series = await getActiveSeriesOptions();
  // Adresteki seri yalnız listede (bu çalışma alanında, etkin) varsa seçili gelir.
  const initial = series.find((item) => item.id === params.series);
  return (
    <div className="page-stack">
      <SubHeader
        crumbs={[
          { href: '/explainers', label: 'ANLATIM VİDEOLARI' },
          ...(initial
            ? [
                {
                  href: `/explainers/series/${initial.id}`,
                  label: initial.name,
                },
              ]
            : []),
        ]}
        description="Konuyu yazın; sonraki ekranda senaryoyu ve kaynak notlarını girip onaya gönderirsiniz. Seri seçmek zorunlu değil."
        title={initial ? 'Yeni bölüm' : 'Yeni video'}
      />
      <section className="section-card">
        <EpisodeForm initialSeriesId={initial?.id ?? ''} series={series} />
      </section>
    </div>
  );
}
