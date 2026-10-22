import { axisTicks, polylinePoints, sqrtPosition } from '@/lib/analytics/chart';
import {
  checkpointLabel,
  CHECKPOINT_HOURS,
  formatCount,
} from '@/lib/analytics/metrics';

// Renk tek ayırt edici değil: her seri ayrıca farklı çizgi deseni kullanır.
const styles = [
  { color: 'var(--accent)', dash: undefined },
  { color: 'var(--mint)', dash: '6 4' },
  { color: 'var(--text)', dash: '2 3' },
  { color: 'var(--muted)', dash: '9 3 2 3' },
];

export type ChartSeries = {
  label: string;
  points: Array<{ hours: number; views: number }>;
};

const BOX = [44, 12, 540, 150] as const;

/** İzlenme eğrisi (yayından bu yana saat → kümülatif izlenme). */
export function ViewsChart({
  title,
  description,
  series,
}: {
  title: string;
  description: string;
  series: ChartSeries[];
}) {
  const all = series.flatMap((s) => s.points);
  const titleId = `${title.replaceAll(/\W+/g, '-')}-title`;
  if (!all.length)
    return (
      <section className="section-card" aria-labelledby={titleId}>
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">
          Henüz ölçüm yok. Metrik toplayıcı snapshot yazdığında eğri burada
          görünecek.
        </p>
      </section>
    );
  const maxHours = Math.max(1, ...all.map((p) => p.hours));
  const maxViews = Math.max(1, ...all.map((p) => p.views));
  const [left, top, width, height] = BOX;
  const hoursRows = [...new Set(all.map((p) => p.hours))].sort((a, b) => a - b);

  return (
    <section className="section-card" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-base font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <svg
        viewBox="0 0 600 190"
        className="my-3 w-full"
        role="img"
        aria-label={`${title}; değerler aşağıdaki tabloda`}
      >
        <line
          x1={left}
          x2={left + width}
          y1={top + height}
          y2={top + height}
          stroke="var(--line)"
        />
        <text
          x={left - 6}
          y={top + 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted)"
        >
          {formatCount(maxViews)}
        </text>
        <text
          x={left - 6}
          y={top + height}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted)"
        >
          0
        </text>
        {axisTicks(maxHours, CHECKPOINT_HOURS).map((tick) => {
          const x = left + sqrtPosition(tick, maxHours) * width;
          return (
            <g key={tick}>
              <line
                x1={x}
                x2={x}
                y1={top}
                y2={top + height}
                stroke="var(--line-soft)"
              />
              <text
                x={x}
                y={top + height + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {checkpointLabel(tick)}
              </text>
            </g>
          );
        })}
        {series.map((s, i) => {
          const style = styles[i % styles.length]!;
          return (
            <g key={s.label} stroke={style.color} fill={style.color}>
              <polyline
                points={polylinePoints(s.points, maxHours, maxViews, BOX)}
                fill="none"
                strokeWidth="2"
                strokeDasharray={style.dash}
              />
              {s.points.map((p) => (
                <circle
                  key={`${p.hours}-${p.views}`}
                  cx={left + sqrtPosition(p.hours, maxHours) * width}
                  cy={top + height - (p.views / maxViews) * height}
                  r="3"
                >
                  <title>
                    {s.label} · {p.hours} sa: {formatCount(p.views)}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <ul className="m-0 flex list-none flex-wrap gap-4 p-0 text-sm">
        {series.map((s, i) => {
          const style = styles[i % styles.length]!;
          return (
            <li key={s.label} className="flex items-center gap-2">
              <svg width="24" height="8" aria-hidden="true">
                <line
                  x1="0"
                  x2="24"
                  y1="4"
                  y2="4"
                  stroke={style.color}
                  strokeWidth="2"
                  strokeDasharray={style.dash}
                />
              </svg>
              {s.label}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Zaman ekseni karekök ölçekli: ilk saatler daha geniş gösterilir.
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-accent">
          {title} veri tablosu
        </summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="p-2">
                  Yayından sonra (sa)
                </th>
                {series.map((s) => (
                  <th scope="col" className="p-2" key={s.label}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hoursRows.map((hours) => (
                <tr className="border-t border-line" key={hours}>
                  <th scope="row" className="p-2 font-normal">
                    {hours}
                  </th>
                  {series.map((s) => {
                    const point = s.points.find((p) => p.hours === hours);
                    return (
                      <td className="p-2" key={s.label}>
                        {point ? formatCount(point.views) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
