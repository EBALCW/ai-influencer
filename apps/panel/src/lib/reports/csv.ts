/**
 * CSV yazıcı (#62). RFC 4180: ayraç virgül, satır sonu CRLF, alan gerekiyorsa
 * çift tırnak içinde ve içindeki tırnak ikilenir.
 *
 * - Dosya UTF-8 BOM ile başlar; Windows Excel BOM olmadan Türkçe karakterleri bozar.
 * - Formül enjeksiyonu: `=`, `+`, `-`, `@` (ve sekme / satır başı) ile başlayan
 *   metin hücreleri Excel'de formül olarak çalışabilir. Başlarına `'` eklenir.
 *   Sayı tipindeki değerler (ör. -5) dokunulmadan yazılır.
 */
export const CSV_BOM = String.fromCharCode(0xfeff);
export const CSV_SEPARATOR = ',';
const LINE_END = '\r\n';
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

export type CsvValue =
  string | number | bigint | boolean | Date | null | undefined;

export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => CsvValue;
};

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  let text = value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(values: CsvValue[]): string {
  return values.map(csvCell).join(CSV_SEPARATOR);
}

/** BOM + başlık + satırlar. Her satır CRLF ile biter. */
export function toCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const lines = [csvLine(columns.map((column) => column.header))];
  for (const row of rows)
    lines.push(csvLine(columns.map((column) => column.value(row))));
  return CSV_BOM + lines.join(LINE_END) + LINE_END;
}

/** Dosya adı: ASCII, boşluksuz (Content-Disposition için güvenli). */
export function csvFileName(parts: string[]): string {
  const safe = parts
    .map((part) =>
      part
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/ı/g, 'i')
        .replace(/[^A-Za-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase(),
    )
    .filter(Boolean);
  return `${safe.join('_') || 'export'}.csv`;
}
