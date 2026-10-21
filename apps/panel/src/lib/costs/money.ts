/**
 * Para yardımcıları. Toplama ve dönüşüm veritabanında (`numeric`) yapılır;
 * bu modül istemcide gösterim, önizleme ve karşılaştırma içindir.
 *
 * Neden number değil: `0.1 + 0.2 !== 0.3`. Değerler 4 ondalık basamakla
 * (numeric(14,4)) ölçeklenmiş bigint olarak işlenir. supabase-js numeric
 * değerleri bazen string, bazen number döndürür; ikisi de kabul edilir.
 */

export const MONEY_SCALE = 4;
const SCALE = 10n ** BigInt(MONEY_SCALE);

export type Decimal = string | number;

/** "12.3456" | 12.3456 -> 123456n (4 basamağa yarım-yukarı yuvarlanır). */
export function toMinor(value: Decimal): bigint {
  const text = typeof value === 'number' ? numberToPlain(value) : value.trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new RangeError(`Geçersiz tutar: ${String(value)}`);
  const [, sign, whole = '0', fraction = ''] = match;
  const padded = (fraction + '0'.repeat(MONEY_SCALE + 1)).slice(
    0,
    MONEY_SCALE + 1,
  );
  let minor = BigInt(whole) * SCALE + BigInt(padded.slice(0, MONEY_SCALE));
  if (Number(padded[MONEY_SCALE]) >= 5) minor += 1n;
  return sign ? -minor : minor;
}

function numberToPlain(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError('Tutar sonlu olmalı');
  // toFixed üstel gösterimi (1e-7) düz metne çevirir; fazladan basamak yuvarlamaya girer
  return value.toFixed(MONEY_SCALE + 2);
}

/** 123456n -> "12.3456" */
export function fromMinor(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(MONEY_SCALE, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function sumDecimals(values: Decimal[]): string {
  return fromMinor(values.reduce<bigint>((acc, v) => acc + toMinor(v), 0n));
}

/**
 * Tutarı kurla çarpar (rate: 1 kaynak = rate hedef). Kur yoksa (null/undefined)
 * `MissingRateError` fırlatır; farklı para birimleri asla dönüşümsüz toplanmaz.
 */
export class MissingRateError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`${from} → ${to} kuru tanımlı değil`);
    this.name = 'MissingRateError';
  }
}

export function convert(
  amount: Decimal,
  from: string,
  to: string,
  rate: Decimal | null | undefined,
): string {
  if (from === to) return fromMinor(toMinor(amount));
  if (rate === null || rate === undefined) throw new MissingRateError(from, to);
  // rate 8 basamağa kadar olabilir: iki ölçekli çarpımı 4 basamağa indir
  const rateScale = 10n ** 8n;
  const rateText =
    typeof rate === 'number' ? rate.toFixed(8) : normalize(rate, 8);
  const [w = '0', f = ''] = rateText.split('.');
  const rateMinor =
    BigInt(w) * rateScale + BigInt((f + '00000000').slice(0, 8));
  const product = toMinor(amount) * rateMinor;
  const rounded = (product + rateScale / 2n) / rateScale;
  return fromMinor(rounded);
}

function normalize(value: string, digits: number): string {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim()))
    throw new RangeError(`Geçersiz kur: ${value}`);
  const [w = '0', f = ''] = value.trim().split('.');
  return `${w}.${f.slice(0, digits)}`;
}

/** Mixed para birimli kayıtları hedef para birimine çevirip toplar. */
export function sumInCurrency(
  entries: Array<{ amount: Decimal; currency: string }>,
  target: string,
  rates: Record<string, Decimal | undefined>,
): string {
  return sumDecimals(
    entries.map((entry) =>
      convert(entry.amount, entry.currency, target, rates[entry.currency]),
    ),
  );
}

export function compareDecimals(a: Decimal, b: Decimal): -1 | 0 | 1 {
  const diff = toMinor(a) - toMinor(b);
  return diff === 0n ? 0 : diff < 0n ? -1 : 1;
}

export function formatMoney(
  value: Decimal | null | undefined,
  currency: string,
  locale = 'tr-TR',
): string {
  if (value === null || value === undefined) return '—';
  const [whole = '0', fraction = ''] = fromMinor(toMinor(value)).split('.');
  // Intl'e number vermek büyük tutarlarda hassasiyet kaybettirmez: 2 basamağa yuvarlanmış metin
  const cents = toMinor(`${whole}.${fraction}`);
  const rounded = Number(fromMinor(((cents + 50n) / 100n) * 100n));
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Üretilen tipler numeric kolonları `number` olarak tanımlar, ama PostgREST
 * "19.99" gibi string'i numeric olarak kabul eder. Tutarı float'a çevirip
 * hassasiyet kaybetmemek için string olarak gönderiyoruz.
 */
export function numericParam(value: string): number {
  if (!/^\d+(\.\d+)?$/.test(value))
    throw new RangeError(`Geçersiz sayı: ${value}`);
  return value as unknown as number;
}
