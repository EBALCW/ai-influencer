import type { PromptStats } from '@/lib/prompts';

const percent = new Intl.NumberFormat('tr-TR', {
  style: 'percent',
  maximumFractionDigits: 0,
});
const decimal = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

/** "67% (2/3)" — biten üretim yoksa "—" (0% değil). */
export function formatRate(stats: PromptStats | null | undefined): string {
  if (!stats || stats.success_rate === null) return '—';
  const finished = (stats.succeeded ?? 0) + (stats.failed ?? 0);
  return `${percent.format(Number(stats.success_rate))} (${stats.succeeded ?? 0}/${finished})`;
}

export function formatCredits(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : decimal.format(Number(value));
}
