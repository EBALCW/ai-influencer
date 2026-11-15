import { redirect } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { SubHeader } from '../../page-header';
import { SeriesForm } from '../../series-form';

export default async function NewSeriesPage() {
  const { role } = await requireTeamMember();
  if (role === 'viewer') redirect('/explainers');
  return (
    <div className="page-stack">
      <SubHeader
        crumbs={[{ href: '/explainers', label: 'ANLATIM VİDEOLARI' }]}
        description="Aynı tema ve stille devam eden videolar için (Bölüm 1, 2, 3…). Stil, ses ve dil bir kez seçilir; her bölüm bunları devralır."
        title="Yeni seri"
      />
      <section className="section-card">
        <SeriesForm />
      </section>
    </div>
  );
}
