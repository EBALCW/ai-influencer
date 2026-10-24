/**
 * Zaman ekseni karekök ölçekli: ilk saatler (1–5 sa) 7 günlük eğride
 * ezilmesin diye. `max` 0 ise tüm noktalar başa düşer.
 */
export function sqrtPosition(hours: number, maxHours: number) {
  if (maxHours <= 0 || hours <= 0) return 0;
  return Math.min(1, Math.sqrt(hours) / Math.sqrt(maxHours));
}

/** Eksende gösterilecek kontrol noktaları: verinin kapsadığı aralıktakiler. */
export function axisTicks(maxHours: number, ticks: readonly number[]) {
  return ticks.filter((tick) => tick <= Math.max(maxHours, ticks[0] ?? 0));
}

export type ChartPoint = { hours: number; views: number };

/** SVG polyline noktaları; sınırlar `[left, top, width, height]`. */
export function polylinePoints(
  points: readonly ChartPoint[],
  maxHours: number,
  maxViews: number,
  [left, top, width, height]: readonly [number, number, number, number],
) {
  return [...points]
    .sort((a, b) => a.hours - b.hours)
    .map((p) => {
      const x = left + sqrtPosition(p.hours, maxHours) * width;
      const y =
        top + height - (maxViews > 0 ? (p.views / maxViews) * height : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
