import { redirect } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { getActiveSeriesOptions } from '@/lib/explainer/queries';
import { SubHeader } from '../../page-header';
import { TopicRequestForm } from '../../topic-request-form';

export default async function NewTopicRequestPage({
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
        description="Kısa bir istek yazın; önerileri yan yana görüp birini bölüme çevirirsiniz. Elenenler saklanır."
        title="Konu önerisi iste"
      />
      <section className="section-card">
        <TopicRequestForm initialSeriesId={initial?.id ?? ''} series={series} />
      </section>
    </div>
  );
}
