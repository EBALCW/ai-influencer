'use client';

import { BarChart3, Coins, Eye, Gauge, Heart, Send } from 'lucide-react';
import { StatCard } from '@/components/ui';

// StatCard istemci bileşeni; ikon (fonksiyon) Server Component'ten geçirilemez.
const icons = { BarChart3, Coins, Eye, Gauge, Heart, Send };

export function AnalyticsStat({
  icon,
  ...props
}: Omit<Parameters<typeof StatCard>[0], 'icon'> & {
  icon: keyof typeof icons;
}) {
  return <StatCard {...props} icon={icons[icon]} />;
}
