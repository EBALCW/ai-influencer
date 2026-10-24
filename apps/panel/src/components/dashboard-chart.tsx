import { lineSegments, metricNumber } from '@/lib/dashboard/metrics';
const colors = ['var(--accent)', 'var(--mint)', 'var(--text)'];
export function DashboardChart({
  title,
  description,
  days,
  series,
  bars = false,
}: {
  title: string;
  description: string;
  days: string[];
  series: Array<{ label: string; values: Array<number | null> }>;
  bars?: boolean;
}) {
  const max = Math.max(
    1,
    ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)),
  );
  const hasData = series.some((s) => s.values.some((v) => v !== null));
  return (
    <section
      className="rounded-2xl border border-line bg-surface p-5"
      aria-label={title}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="my-2 text-sm text-muted">{description}</p>
      {hasData ? (
        <>
          <p className="text-xs text-muted">
            Üst ölçek: {metricNumber(max, true)}
          </p>
          <svg
            viewBox="0 0 600 160"
            className="my-3 w-full"
            role="img"
            aria-label={`${title}; değerler aşağıdaki tabloda`}
          >
            <line x1="10" x2="590" y1="130" y2="130" stroke="var(--line)" />
            {series.map((s, j) => (
              <g
                key={s.label}
                fill={colors[j % colors.length]}
                stroke={colors[j % colors.length]}
              >
                {bars
                  ? s.values.map((v, i) =>
                      v === null ? null : (
                        <rect
                          key={i}
                          x={10 + (i * 580) / Math.max(1, days.length)}
                          y={130 - (v / max) * 120}
                          width={Math.max(
                            1,
                            580 / Math.max(1, days.length) - 2,
                          )}
                          height={(v / max) * 120}
                        >
                          <title>
                            {days[i]}: {metricNumber(v, true)}
                          </title>
                        </rect>
                      ),
                    )
                  : lineSegments(s.values, 600, 140, max).map((points, i) => (
                      <polyline
                        key={i}
                        points={points}
                        fill="none"
                        strokeWidth="2"
                      />
                    ))}
                {!bars &&
                  s.values.map((v, i) =>
                    v === null ? null : (
                      <circle
                        key={i}
                        cx={10 + (i / Math.max(1, days.length - 1)) * 580}
                        cy={130 - (v / max) * 120}
                        r="2"
                      >
                        <title>
                          {s.label} {days[i]}: {metricNumber(v, true)}
                        </title>
                      </circle>
                    ),
                  )}
              </g>
            ))}
          </svg>
          <p className="flex justify-between text-xs text-muted">
            <span>{days[0]} UTC</span>
            <span>{days.at(-1)} UTC</span>
          </p>
          <ul className="my-3 flex flex-wrap gap-4 text-sm">
            {series.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: colors[i % colors.length] }}
                />
                {s.label}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="my-6 text-sm text-muted">Bu aralıkta ölçüm yok.</p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-accent">
          {title} veri tablosu
        </summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {title} — UTC gün sonu değerleri
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-2">
                  Gün (UTC)
                </th>
                {series.map((s) => (
                  <th className="p-2" scope="col" key={s.label}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, i) => (
                <tr className="border-t border-line" key={day}>
                  <th className="p-2 font-normal" scope="row">
                    {day}
                  </th>
                  {series.map((s) => (
                    <td className="p-2" key={s.label}>
                      {s.values[i] == null
                        ? 'Ölçüm yok'
                        : metricNumber(s.values[i] ?? null, true)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
