'use client';

import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Clapperboard,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { getPanelGreeting } from '@ai-influencer/shared';
import { EmptyState, StatCard } from '@/components/ui';

const activity = [
  {
    icon: UsersRound,
    title: 'Influencer stüdyosu',
    detail: 'Karakterlerinizi yönetin',
    href: '/influencers',
  },
  {
    icon: Clapperboard,
    title: 'İçerik akışı',
    detail: 'Üretim adımlarını takip edin',
    href: '/content',
  },
  {
    icon: CalendarDays,
    title: 'Yayın takvimi',
    detail: 'Planınızı tek yerde görün',
    href: '/calendar',
  },
];

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="eyebrow">
            <Sparkles size={15} /> AI INFLUENCER STUDIO
          </span>
          <h1>
            İçerik üretiminiz için <span>tek bir stüdyo.</span>
          </h1>
          <p>
            {getPanelGreeting()} Karakterlerinizi, yayın planınızı ve
            performansınızı buradan yönetin.
          </p>
          <Link className="button button-primary" href="/influencers">
            Stüdyoya göz at <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="welcome-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-outer" />
          <div className="orbit-ring orbit-ring-inner" />
          <div className="orbit-core">
            <Sparkles size={30} />
          </div>
          <span className="orbit-dot orbit-dot-one" />
          <span className="orbit-dot orbit-dot-two" />
        </div>
      </section>

      <section aria-label="Genel bakış" className="stats-grid">
        <StatCard
          label="Influencer"
          value="0"
          detail="İlk karakterinizi oluşturun"
          icon={UsersRound}
          tone="violet"
        />
        <StatCard
          label="Planlanan içerik"
          value="0"
          detail="Yayın takviminiz hazır"
          icon={CalendarDays}
          tone="blue"
        />
        <StatCard
          label="Toplam izlenme"
          value="—"
          detail="Hesaplar bağlandığında görünür"
          icon={Activity}
          tone="mint"
        />
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BAŞLANGIÇ</p>
            <h2>Çalışma alanınız</h2>
          </div>
          <span className="soft-badge">
            <span className="status-dot" /> Kurulum aşamasında
          </span>
        </div>
        <div className="quick-links">
          {activity.map(({ icon: Icon, title, detail, href }) => (
            <a className="quick-link" href={href} key={href}>
              <span className="quick-link-icon">
                <Icon size={19} />
              </span>
              <span className="quick-link-copy">
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <ArrowUpRight className="quick-link-arrow" size={16} />
            </a>
          ))}
        </div>
        <EmptyState
          title="Henüz içerik yok"
          description="İlk influencer ve içerik kayıtlarınız eklendiğinde özetler burada görünecek."
        />
      </section>
    </div>
  );
}
