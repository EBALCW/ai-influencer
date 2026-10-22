import { z } from 'zod';

export const platforms = ['instagram', 'youtube', 'tiktok'] as const;
export const platformNames = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};
const day = z.iso.date();
const querySchema = z.object({
  inf: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  platform: z.enum(['all', ...platforms]).default('all'),
  range: z.enum(['7', '30', '90', 'custom']).default('7'),
  from: day.optional(),
  to: day.optional(),
});
const DAY = 86_400_000;
export function dashboardFilter(
  query: Record<string, unknown>,
  now = new Date(),
) {
  const q = querySchema.parse(query);
  const to =
    q.range === 'custom' ? day.parse(q.to) : now.toISOString().slice(0, 10);
  const from =
    q.range === 'custom'
      ? day.parse(q.from)
      : new Date(Date.parse(to) - (Number(q.range) - 1) * DAY)
          .toISOString()
          .slice(0, 10);
  if (from > to || Date.parse(to) - Date.parse(from) > 365 * DAY)
    throw new Error('Tarih aralığı 1–366 gün olmalı.');
  return { ...q, from, to };
}
export type DashboardFilter = ReturnType<typeof dashboardFilter>;

/** Weighted engagement on latest snapshots of posts published in the selected period. */
export function engagementRate(
  interactions: number | null,
  views: number | null,
) {
  return interactions === null || views === null || views <= 0
    ? null
    : (interactions / views) * 100;
}
export function changePercent(change: number | null, latest: number | null) {
  if (change === null || latest === null || latest - change <= 0) return null;
  return (change / (latest - change)) * 100;
}
const numberFormat = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
});
const decimalFormat = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 2,
});
export const metricNumber = (value: number | null, decimals = false) =>
  value === null
    ? '—'
    : (decimals ? decimalFormat : numberFormat).format(value);
export const metricPercent = (value: number | null) =>
  value === null
    ? '—'
    : `%${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
export const signedNumber = (value: number | null) =>
  value === null
    ? 'Değişim ölçülemedi'
    : `${value > 0 ? '+' : ''}${metricNumber(value)}`;

/** Missing readings break a line; they must never become zero observations. */
export function lineSegments(
  values: Array<number | null>,
  width = 600,
  height = 140,
  scaleMax?: number,
) {
  const known = values.filter((v): v is number => v !== null);
  const max = scaleMax ?? Math.max(1, ...known);
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current.join(' '));
      current = [];
    } else
      current.push(
        `${10 + (i / Math.max(1, values.length - 1)) * (width - 20)},${height - 10 - (v / max) * (height - 20)}`,
      );
  });
  if (current.length) segments.push(current.join(' '));
  return segments;
}
