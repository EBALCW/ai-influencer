import {
  checkpointLabel,
  formatCount,
  formatRatio,
  segmentTables,
} from '@/lib/analytics/metrics';
import type { SegmentsResult } from '@/lib/analytics/schemas';

/** Kanca türü / format / yayın saati / süre / platform bazında performans. */
export function SegmentTables({ result }: { result: SegmentsResult }) {
  const tables = segmentTables(result.segments, result.overall.median);
  const metric = `${checkpointLabel(result.targetHours)} izlenme`;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tables.map((table) => (
        <div
          className="overflow-x-auto rounded-xl border border-line p-3"
          key={table.dimension}
        >
          <table
            aria-label={`${table.label} segmentleri`}
            className="w-full text-left text-sm"
          >
            <caption className="mb-2 text-left font-semibold text-text">
              {table.label}
            </caption>
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="p-2">
                  Segment
                </th>
                <th scope="col" className="p-2">
                  Post
                </th>
                <th scope="col" className="p-2">
                  Ölçülen
                </th>
                <th scope="col" className="p-2">
                  Medyan {metric}
                </th>
                <th scope="col" className="p-2">
                  Ortalama
                </th>
                <th scope="col" className="p-2">
                  Endeks
                </th>
              </tr>
            </thead>
            <tbody>
              {table.rows.length === 0 ? (
                <tr className="border-t border-line">
                  <td className="p-2 text-muted" colSpan={6}>
                    Bu boyutta veri yok.
                  </td>
                </tr>
              ) : (
                table.rows.map((row) => (
                  <tr className="border-t border-line" key={row.key}>
                    <th scope="row" className="p-2 font-normal">
                      {row.label}
                    </th>
                    <td className="p-2">{formatCount(row.posts)}</td>
                    <td className="p-2">{formatCount(row.measured)}</td>
                    <td className="p-2">{formatCount(row.median)}</td>
                    <td className="p-2">{formatCount(row.average)}</td>
                    <td className="p-2">{formatRatio(row.index)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
