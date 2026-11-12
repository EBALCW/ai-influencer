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

/**
 * CSV okuyucu (#10). RFC 4180 tırnak kuralları; satır sonu CRLF, LF veya CR.
 * - Baştaki UTF-8 BOM atlanır.
 * - Ayraç verilmezse başlık satırından seçilir: Türkçe Excel `;` ile kaydeder.
 * - `csvCell`'in formül korumasıyla eklediği `'` (ör. `'=1+1`) geri alınır.
 * Boş satırlar atlanır. Her kayıt dosyadaki başlangıç satır numarasını taşır.
 */
export type CsvRecord = { line: number; cells: string[] };

export function detectCsvSeparator(text: string): ',' | ';' | '\t' {
  const header = text.replace(/^﻿/, '').split(/\r\n|\n|\r/, 1)[0] ?? '';
  const count = (sep: string) => header.split(sep).length - 1;
  const candidates = [',', ';', '\t'] as const;
  return candidates.reduce((best, sep) =>
    count(sep) > count(best) ? sep : best,
  );
}

export function parseCsv(text: string, separator?: string): CsvRecord[] {
  const source = text.replace(/^﻿/, '');
  const sep = separator ?? detectCsvSeparator(source);
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  const pushCell = () => {
    cells.push(/^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell);
    cell = '';
  };
  const pushRecord = () => {
    pushCell();
    if (cells.some((value) => value.trim() !== ''))
      records.push({ line: start, cells });
    cells = [];
  };
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else {
        if (char === '\n' || (char === '\r' && source[i + 1] !== '\n'))
          line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === '') quoted = true;
    else if (char === sep) pushCell();
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      pushRecord();
      line += 1;
      start = line;
    } else cell += char;
  }
  if (cell !== '' || cells.length) pushRecord();
  return records;
}
