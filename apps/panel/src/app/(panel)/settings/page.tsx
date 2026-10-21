import Link from 'next/link';
import { ArrowUpRight, UsersRound } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { requireTeamMember } from '@/lib/auth';
import { canManageTeam } from '@/lib/team-roles';

export default async function SettingsPage() {
  const { role } = await requireTeamMember();

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ÇALIŞMA ALANI</p>
          <h1>Ayarlar</h1>
          <p>Çalışma alanı ve ekip tercihlerinizi yönetin.</p>
        </div>
        <span className="section-hero-icon" aria-hidden="true">
          ⚙
        </span>
      </header>
      {canManageTeam(role) && (
        <section className="section-card">
          <div className="quick-links">
            <Link className="quick-link" href="/settings/team">
              <span className="quick-link-icon">
                <UsersRound size={19} />
              </span>
              <span className="quick-link-copy">
                <strong>Ekip</strong>
                <small>Üyeleri davet et ve rollerini yönet</small>
              </span>
              <ArrowUpRight className="quick-link-arrow" size={16} />
            </Link>
          </div>
        </section>
      )}
      <section className="section-card section-empty-card">
        <EmptyState
          title="Ayarlar alanı hazır"
          description="Bu bölüm için kayıt bulunmuyor. Modül tamamlandığında içerikleriniz burada listelenecek."
        />
      </section>
    </div>
  );
}
