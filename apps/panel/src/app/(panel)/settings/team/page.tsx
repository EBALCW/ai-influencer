import { requireOwner } from '@/lib/auth';
import { TeamManager } from './team-manager';

export default async function TeamSettingsPage() {
  const { user } = await requireOwner();

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">AYARLAR</p>
          <h1>Ekip</h1>
          <p>Üyeleri davet et ve erişim rollerini yönet.</p>
        </div>
      </header>
      <section className="section-card">
        <TeamManager currentUserId={user.id} />
      </section>
    </div>
  );
}
