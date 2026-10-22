import Link from 'next/link';
import { requireTeamMember } from '@/lib/auth';
import { listAlerts } from '@/lib/alerts/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NotificationList } from './notification-list';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string }>;
}) {
  await requireTeamMember();
  const inf = (await searchParams).inf;
  const db = await createSupabaseServerClient();
  const { alerts, unread } = await listAlerts(db, 100);
  const settingsHref = `/settings/notifications${
    inf ? `?inf=${encodeURIComponent(inf)}` : ''
  }`;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ÇALIŞMA ALANI</p>
          <h1>Bildirimler</h1>
          <p>
            Viral eşik, takipçi kilometre taşı, token süresi, senkronizasyon
            hatası, bütçe ve yayın saati uyarıları. Okundu bilgisi kişiye
            özeldir.
          </p>
        </div>
        <Link className="button" href={settingsHref}>
          Bildirim ayarları
        </Link>
      </header>
      <NotificationList alerts={alerts} unread={unread} />
    </div>
  );
}
