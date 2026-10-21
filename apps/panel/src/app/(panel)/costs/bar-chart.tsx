'use client';

/**
 * Tek seri, tek renk bar grafik (büyüklük). Her bar üzerine gelince/odaklanınca
 * değerini gösterir; aynı veri tablo olarak da açılabilir (renge bağımlı değil).
 * Değeri bilinmeyen (eksik kur) bar çizilmez, etiketle belirtilir.
 */
export function BarChart({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number | null; display: string }>;
}) {
  const max = Math.max(0, ...rows.map((row) => row.value ?? 0));
  return (
    <figure className="m-0">
      <figcaption className="mb-3 text-sm font-semibold text-text">
        {title}
      </figcaption>
      <ul
        aria-label={title}
        className="m-0 flex h-40 list-none items-end gap-1 border-b border-line p-0"
      >
        {rows.map((row) => {
          const height =
            row.value === null || max === 0
              ? 0
              : Math.max(2, (row.value / max) * 100);
          return (
            <li
              key={row.label}
              className="group relative flex h-full min-w-2 flex-1 items-end"
              tabIndex={0}
              aria-label={`${row.label}: ${row.display}`}
            >
              <span
                className="block w-full rounded-t bg-accent"
                style={{ height: `${height}%` }}
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-text group-hover:block group-focus:block"
              >
                {row.label}: {row.display}
              </span>
            </li>
          );
        })}
      </ul>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">Tablo olarak göster</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-medium">Etiket</th>
              <th className="py-1 font-medium">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-1">{row.label}</td>
                <td className="py-1">{row.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
