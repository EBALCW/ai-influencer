import Link from 'next/link';
import { dashboardFilter } from '@/lib/dashboard/metrics';
import { getDashboard } from '@/lib/dashboard/queries';
import { Dashboard } from './dashboard';

/**
 * AI influencer modülünün performans özeti (#54). #200 ile ana ekrandan (`/`) buraya taşındı;
 * eski filtreli adresler (`/?range=…`) ana ekrandan buraya yönlenir.
 */
export default async function InfluencerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let filter;
  try {
    filter = dashboardFilter(await searchParams);
  } catch {
    return (
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-semibold">Genel bakış</h1>
        <p role="alert" className="my-4">
          Geçersiz filtre. Platformu ve 1–366 günlük gerçek bir tarih aralığını
          seçin.
        </p>
        <Link className="button button-primary" href="/influencers/overview">
          Filtreleri sıfırla
        </Link>
      </section>
    );
  }
  const data = await getDashboard(filter);
  return <Dashboard key={JSON.stringify(filter)} data={data} filter={filter} />;
}
