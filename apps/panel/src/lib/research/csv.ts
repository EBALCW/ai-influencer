import { parseCsv, type CsvColumn } from '@/lib/reports/csv';
import {
  costCsvValues,
  costEstimates,
  formatCsvValues,
  statusCsvValues,
  trendFormats,
  trendSchema,
  trendStatuses,
  type TrendInput,
} from './schemas';

/**
 * `research/trends.csv` (#10) içe/dışa aktarma. Sütunlar issue'daki sırayla;
 * `kaynak` #12'den (manual/claude), `influencer` boşsa global trend (slug ile).
 * Başlıklar büyük/küçük harf, Türkçe karakter, boşluk ve `(1-5)` gibi ekler
 * yok sayılarak eşlenir; Excel'in `;` ayracı ve BOM'u desteklenir.
 */
export const TREND_CSV_HEADERS = [
  'id',
  'tarih',
  'platform',
  'link',
  'hesap',
  'izlenme',
  'beğeni',
  'yorum',
  'süre_sn',
  'format',
  'kanca_ilk_3sn',
  'ses_müzik',
  'neden_viral',
  'uyarlama_fikri',
  'uyarlama_puanı',
  'maliyet_tahmini',
  'durum',
  'kaynak',
  'influencer',
  'not',
] as const;
export const MAX_TREND_CSV_ROWS = 1000;
export const MAX_TREND_CSV_BYTES = 2 * 1024 * 1024;

type Column = (typeof TREND_CSV_HEADERS)[number];

/** Türkçe karakterleri ASCII'ye indirip küçük harfe çevirir. */
export function fold(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr')
    .replace(
      /[çğıöşü]/g,
      (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c]!,
    )
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_');
}

const headerAliases: Record<string, Column> = {
  ...Object.fromEntries(TREND_CSV_HEADERS.map((h) => [fold(h), h])),
  url: 'link',
  date: 'tarih',
  kayit_tarihi: 'tarih',
  account: 'hesap',
  views: 'izlenme',
  likes: 'beğeni',
  comments: 'yorum',
  sure: 'süre_sn',
  kanca: 'kanca_ilk_3sn',
  ses: 'ses_müzik',
  muzik: 'ses_müzik',
  uyarlama_puan: 'uyarlama_puanı',
  puan: 'uyarlama_puanı',
  maliyet: 'maliyet_tahmini',
  notlar: 'not',
  notes: 'not',
};

function headerKey(raw: string): Column | undefined {
  const key = fold(raw.replace(/\(.*?\)/g, '')).replace(/^_+|_+$/g, '');
  return headerAliases[key];
}

function lookup<T extends string>(
  aliases: Record<string, T>,
  raw: string,
  label: string,
): T | undefined {
  const value = aliases[fold(raw)];
  if (!value) throw new Error(`${label} tanınmadı: "${raw.trim()}"`);
  return value;
}

const platformAliases: Record<string, TrendInput['platform']> = {
  instagram: 'instagram',
  ig: 'instagram',
  reels: 'instagram',
  tiktok: 'tiktok',
  tt: 'tiktok',
  youtube: 'youtube',
  yt: 'youtube',
  shorts: 'youtube',
  other: 'other',
  diger: 'other',
};
const formatAliases: Record<string, TrendInput['format']> = {
  ...Object.fromEntries(trendFormats.map((f) => [f, f])),
  ...Object.fromEntries(trendFormats.map((f) => [fold(formatCsvValues[f]), f])),
  lipsync: 'lip_sync',
  kisa: 'short_film',
};
const statusAliases: Record<string, TrendInput['status']> = {
  ...Object.fromEntries(trendStatuses.map((s) => [s, s])),
  ...Object.fromEntries(
    trendStatuses.map((s) => [fold(statusCsvValues[s]), s]),
  ),
  kullanildi: 'used',
};
const costAliases: Record<string, NonNullable<TrendInput['cost_estimate']>> = {
  ...Object.fromEntries(costEstimates.map((c) => [c, c])),
  ...Object.fromEntries(costEstimates.map((c) => [fold(costCsvValues[c]), c])),
};
const sourceAliases: Record<string, TrendInput['source']> = {
  manual: 'manual',
  manuel: 'manual',
  elle: 'manual',
  claude: 'claude',
};

/** "12500", "12.500", "1,2M", "15K", "3,4 bin", "1.2 milyon" → tam sayı. */
export function parseCount(raw: string): number | null {
  const value = raw.trim().toLocaleLowerCase('tr').replace(/\s+/g, '');
  if (!value) return null;
  const match = /^(\d+(?:[.,]\d+)?)(k|bin|m|mn|milyon)?$/.exec(value);
  if (match?.[2]) {
    const multiplier = /^(k|bin)$/.test(match[2]) ? 1_000 : 1_000_000;
    return Math.round(Number(match[1]!.replace(',', '.')) * multiplier);
  }
  if (/^\d{1,3}(?:[.,\s]\d{3})+$/.test(value) || /^\d+$/.test(value))
    return Number(value.replace(/[.,\s]/g, ''));
  throw new Error(`Sayı okunamadı: "${raw.trim()}"`);
}

/** "45", "0:45", "1:05" → saniye. */
export function parseDuration(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+$/.test(value)) return Number(value);
  throw new Error(`Süre saniye olmalı: "${value}"`);
}

/** "2026-10-24", "24.10.2026", "24/10/2026" → ISO tarih. Boş → bugün (DB). */
export function parseDate(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const tr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(value);
  if (tr)
    return `${tr[3]}-${tr[2]!.padStart(2, '0')}-${tr[1]!.padStart(2, '0')}`;
  throw new Error(`Tarih okunamadı: "${value}" (YYYY-AA-GG veya GG.AA.YYYY)`);
}

function parseScore(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/^[1-5]$/.test(value))
    throw new Error(`Uyarlama puanı 1-5 arası tam sayı olmalı: "${value}"`);
  return Number(value);
}

const issueLabels: Record<string, string> = {
  url: 'link',
  captured_on: 'tarih',
  account_handle: 'hesap',
  views: 'izlenme',
  likes: 'beğeni',
  comments: 'yorum',
  duration_s: 'süre_sn',
  hook: 'kanca_ilk_3sn',
  sound: 'ses_müzik',
  why_viral: 'neden_viral',
  adaptation_idea: 'uyarlama_fikri',
  adaptation_score: 'uyarlama_puanı',
  notes: 'not',
};

export type TrendCsvRow = { line: number; input: TrendInput };
export type TrendCsvError = { line: number; message: string };
export type TrendImportResult = {
  created: number;
  skipped: number;
  errors: TrendCsvError[];
  ignoredColumns: string[];
};
export type TrendCsvResult =
  | {
      ok: true;
      rows: TrendCsvRow[];
      errors: TrendCsvError[];
      ignoredColumns: string[];
    }
  | { ok: false; error: string };

/**
 * CSV metnini doğrular. Dosya düzeyindeki hata (başlık yok, `link` sütunu yok,
 * çok satır) `ok: false` döner; satır hataları `errors` içinde satır numarasıyla
 * raporlanır ve geçerli satırlar yine döner. `influencers`: slug → id.
 */
export function parseTrendCsv(
  text: string,
  influencers: Map<string, string>,
): TrendCsvResult {
  const records = parseCsv(text);
  const [header, ...body] = records;
  if (!header) return { ok: false, error: 'Dosya boş.' };
  const columns = header.cells.map(headerKey);
  if (!columns.includes('link'))
    return {
      ok: false,
      error: `"link" sütunu bulunamadı. Beklenen başlıklar: ${TREND_CSV_HEADERS.join(', ')}`,
    };
  if (body.length > MAX_TREND_CSV_ROWS)
    return {
      ok: false,
      error: `Bir dosyada en fazla ${MAX_TREND_CSV_ROWS} satır olabilir.`,
    };
  const ignoredColumns = header.cells.filter(
    (cell, i) => !columns[i] && cell.trim(),
  );

  const rows: TrendCsvRow[] = [];
  const errors: TrendCsvError[] = [];
  for (const record of body) {
    const cell = (name: Column) => {
      const index = columns.indexOf(name);
      return index === -1 ? '' : (record.cells[index] ?? '');
    };
    const messages: string[] = [];
    const attempt = <T>(fn: () => T): T | undefined => {
      try {
        return fn();
      } catch (error) {
        messages.push(error instanceof Error ? error.message : String(error));
        return undefined;
      }
    };
    const slug = cell('influencer').trim();
    let influencerId: string | null = null;
    if (slug) {
      influencerId = influencers.get(slug) ?? null;
      if (!influencerId) messages.push(`Influencer bulunamadı: "${slug}"`);
    }
    const raw = {
      url: cell('link').trim(),
      platform: cell('platform').trim()
        ? attempt(() => lookup(platformAliases, cell('platform'), 'Platform'))
        : undefined,
      influencer_id: influencerId,
      captured_on: attempt(() => parseDate(cell('tarih'))),
      account_handle: cell('hesap'),
      views: attempt(() => parseCount(cell('izlenme'))) ?? null,
      likes: attempt(() => parseCount(cell('beğeni'))) ?? null,
      comments: attempt(() => parseCount(cell('yorum'))) ?? null,
      duration_s: attempt(() => parseDuration(cell('süre_sn'))) ?? null,
      format: cell('format').trim()
        ? attempt(() => lookup(formatAliases, cell('format'), 'Format'))
        : undefined,
      hook: cell('kanca_ilk_3sn'),
      sound: cell('ses_müzik'),
      why_viral: cell('neden_viral'),
      adaptation_idea: cell('uyarlama_fikri'),
      adaptation_score:
        attempt(() => parseScore(cell('uyarlama_puanı'))) ?? null,
      cost_estimate: cell('maliyet_tahmini').trim()
        ? (attempt(() =>
            lookup(costAliases, cell('maliyet_tahmini'), 'Maliyet tahmini'),
          ) ?? null)
        : null,
      status: cell('durum').trim()
        ? attempt(() => lookup(statusAliases, cell('durum'), 'Durum'))
        : undefined,
      source: cell('kaynak').trim()
        ? attempt(() => lookup(sourceAliases, cell('kaynak'), 'Kaynak'))
        : undefined,
      notes: cell('not'),
    };
    if (!raw.url) messages.push('Link boş.');
    if (messages.length) {
      errors.push({ line: record.line, message: messages.join(' · ') });
      continue;
    }
    const parsed = trendSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => {
          const field = String(issue.path[0] ?? '');
          return `${issueLabels[field] ?? field}: ${issue.message}`;
        })
        .join(' · ');
      errors.push({ line: record.line, message });
      continue;
    }
    rows.push({ line: record.line, input: parsed.data });
  }
  return { ok: true, rows, errors, ignoredColumns };
}

export type TrendCsvSource = {
  id: string;
  captured_on: string;
  platform: string;
  url: string;
  account_handle: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  duration_s: number | null;
  format: string;
  hook: string;
  sound: string;
  why_viral: string;
  adaptation_idea: string;
  adaptation_score: number | null;
  cost_estimate: string | null;
  status: string;
  source: string;
  notes: string;
  influencer_slug: string | null;
};

const csvValue = <K extends string>(map: Record<K, string>, key: string) =>
  map[key as K] ?? key;

export const trendCsvColumns: CsvColumn<TrendCsvSource>[] = [
  { header: 'id', value: (r) => r.id },
  { header: 'tarih', value: (r) => r.captured_on },
  { header: 'platform', value: (r) => r.platform },
  { header: 'link', value: (r) => r.url },
  { header: 'hesap', value: (r) => r.account_handle },
  { header: 'izlenme', value: (r) => r.views },
  { header: 'beğeni', value: (r) => r.likes },
  { header: 'yorum', value: (r) => r.comments },
  { header: 'süre_sn', value: (r) => r.duration_s },
  { header: 'format', value: (r) => csvValue(formatCsvValues, r.format) },
  { header: 'kanca_ilk_3sn', value: (r) => r.hook },
  { header: 'ses_müzik', value: (r) => r.sound },
  { header: 'neden_viral', value: (r) => r.why_viral },
  { header: 'uyarlama_fikri', value: (r) => r.adaptation_idea },
  { header: 'uyarlama_puanı', value: (r) => r.adaptation_score },
  {
    header: 'maliyet_tahmini',
    value: (r) =>
      r.cost_estimate ? csvValue(costCsvValues, r.cost_estimate) : '',
  },
  { header: 'durum', value: (r) => csvValue(statusCsvValues, r.status) },
  { header: 'kaynak', value: (r) => r.source },
  { header: 'influencer', value: (r) => r.influencer_slug ?? '' },
  { header: 'not', value: (r) => r.notes },
];
