'use client';

import { Activity, Coins, UsersRound, Video } from 'lucide-react';
import { StatCard } from '@/components/ui';

export function DetailStats({
  followers,
  views7d,
  posts,
  generations,
}: {
  followers: number;
  views7d: number;
  posts: number;
  generations: number;
}) {
  const count = (value: number) =>
    new Intl.NumberFormat('tr-TR', {
      notation: value > 9999 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(value);

  return (
    <section className="stats-grid">
      <StatCard
        label="Toplam takipçi"
        value={count(followers)}
        detail="Bağlı hesapların son snapshot toplamı"
        icon={UsersRound}
      />
      <StatCard
        label="Son 7 gün izlenme"
        value={count(views7d)}
        detail="Kümülatif sayaç farkı"
        icon={Activity}
        tone="blue"
      />
      <StatCard
        label="Son postlar"
        value={String(posts)}
        detail="En yeni yayınlar"
        icon={Video}
        tone="mint"
      />
      <StatCard
        label="Üretimler"
        value={String(generations)}
        detail="Son üretim kayıtları"
        icon={Coins}
      />
    </section>
  );
}
