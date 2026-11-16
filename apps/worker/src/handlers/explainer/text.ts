// Senaryo metni → seslendirme satırları ("vuruş"). Saf fonksiyonlar; yapay zekâ yok.
// Metin veridir: burada yalnız temizlenir ve bölünür, hiçbir yerde koda ya da komuta katılmaz.

/** `voice.py` / `zaman_js.py` sözleşmesinde özel anlamı olan işaretler: metinde bırakılmaz. */
const MARKUP = /[*|]/g;
/** Denetim ve biçim karakterleri (satır sonu hariç), yön değiştiriciler, BOM. */
const INVISIBLE =
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;
/** Yazı tiplerinde karşılığı olmayan resim karakterleri (emoji) ve eşleşmemiş vekil kodlar. */
const PICTOGRAPH = /[\p{Extended_Pictographic}\p{Cs}\p{Co}\p{Cn}\ufe0f]/gu;

/**
 * Metni seslendirme ve çizim için güvenli, sade hale getirir: NFC, görünmez karakterler ve emoji
 * atılır, `*` ve `|` boşluk olur, boşluklar teke iner. Satır sonları korunur.
 */
export function cleanText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, ' ')
    .replace(PICTOGRAPH, ' ')
    .replace(MARKUP, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim();
}

/** Tek satırlık metin (başlık, etiket): satır sonları da boşluk olur, uzunluk sınırlanır. */
export function cleanLabel(input: string, max: number): string {
  const text = cleanText(input).replace(/\s+/g, ' ').trim();
  return truncate(text, max);
}

/** Kelime sınırında kısaltır; kısaldıysa sonuna "…" koyar. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, Math.max(1, max - 1)).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:–-]+$/u, '')}…`;
}

/** Noktayla bitse de cümle bitirmeyen kısaltmalar (küçük harf, noktasız). */
const ABBREVIATIONS = new Set([
  'dr',
  'prof',
  'doç',
  'yrd',
  'av',
  'sn',
  'vb',
  'vs',
  'vd',
  'bkz',
  'örn',
  'yak',
  'no',
  'tel',
  'st',
  'mr',
  'mrs',
  'ms',
  'ltd',
  'şti',
  'alb',
  'yzb',
  'gen',
  'org',
  'm.ö',
  'm.s',
  'i.ö',
  'i.s',
  'a.ş',
  't.c',
  'etc',
  'e.g',
  'i.e',
]);

const CLOSERS = /["'”’»)\]]+$/u;

function endsSentence(token: string, next: string | undefined): boolean {
  const bare = token.replace(CLOSERS, '');
  if (/[!?]+$/.test(bare) || /[!?]…?$/.test(bare)) return true;
  if (!/(\.|…)$/.test(bare)) return false;
  if (next === undefined) return true;
  const core = bare.replace(/[.…]+$/, '');
  const lower = core.toLocaleLowerCase('tr');
  // Kısaltma, tek harf ("A.") ya da sıra sayısı ("3. bölüm"): cümle sürüyor
  if (ABBREVIATIONS.has(lower.replace(/^["'“‘«(\[]+/u, ''))) return false;
  if (Array.from(core).length === 1 && /\p{L}/u.test(core)) return false;
  const first = next.replace(/^["'“‘«(\[]+/u, '').charAt(0);
  // Sonraki kelime küçük harfle başlıyorsa nokta cümle sonu değildir
  if (first !== '' && /\p{Ll}/u.test(first)) return false;
  return true;
}

/** Bir paragrafı cümlelere böler. "3.000", "22,5", "Dr." ve "3. bölüm" cümleyi bölmez. */
export function splitSentences(paragraph: string): string[] {
  const tokens = paragraph.split(/\s+/).filter(Boolean);
  const sentences: string[] = [];
  let current: string[] = [];
  tokens.forEach((token, index) => {
    current.push(token);
    if (endsSentence(token, tokens[index + 1])) {
      sentences.push(current.join(' '));
      current = [];
    }
  });
  if (current.length > 0) sentences.push(current.join(' '));
  return sentences;
}

/**
 * Düz metinden vuruşlar: boş satır paragrafı (ve vuruşu) böler; paragraf içinde kısa cümleler
 * `maxChars`'a kadar aynı vuruşta toplanır (edge-tts noktada kendisi duraklar), uzun cümle tek
 * başına kalır. Cümle ortasından bölünmez: seslendirmenin tonlaması bozulmasın.
 */
export function makeBeats(text: string, maxChars = 110): string[] {
  const beats: string[] = [];
  for (const paragraph of cleanText(text).split(/\n\s*\n/)) {
    const flat = paragraph.replace(/\s+/g, ' ').trim();
    if (!flat) continue;
    let current = '';
    for (const sentence of splitSentences(flat)) {
      if (current && current.length + 1 + sentence.length > maxChars) {
        beats.push(current);
        current = sentence;
      } else current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) beats.push(current);
  }
  return beats;
}

export function countWords(lines: readonly string[]): number {
  return lines.reduce(
    (sum, line) => sum + line.split(/\s+/).filter(Boolean).length,
    0,
  );
}

const ONES = [
  '',
  'bir',
  'iki',
  'üç',
  'dört',
  'beş',
  'altı',
  'yedi',
  'sekiz',
  'dokuz',
];
const TENS = [
  '',
  'on',
  'yirmi',
  'otuz',
  'kırk',
  'elli',
  'altmış',
  'yetmiş',
  'seksen',
  'doksan',
];
const SCALES = ['', 'bin', 'milyon', 'milyar', 'trilyon'];

function underThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  if (hundreds > 0)
    parts.push(hundreds === 1 ? 'yüz' : `${ONES[hundreds]} yüz`);
  const tens = Math.floor((n % 100) / 10);
  if (tens > 0) parts.push(TENS[tens]!);
  if (n % 10 > 0) parts.push(ONES[n % 10]!);
  return parts.join(' ');
}

/** Tam sayının Türkçe okunuşu (0 … 999 trilyon). Kapsam dışıysa `null`. */
export function turkishNumber(value: number): string | null {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 1e15) return null;
  if (value === 0) return 'sıfır';
  const parts: string[] = [];
  let rest = value;
  for (let scale = 0; rest > 0; scale++) {
    const group = rest % 1000;
    rest = Math.floor(rest / 1000);
    if (group === 0) continue;
    // "bir bin" denmez
    const words = scale === 1 && group === 1 ? '' : underThousand(group);
    parts.unshift([words, SCALES[scale]].filter(Boolean).join(' '));
  }
  return parts.join(' ');
}

/** `voice.py` ile aynı kural: kelimenin çekirdeği baştaki ve sondaki noktalama atılarak bulunur. */
export function tokenCore(token: string): string {
  return token.replace(/^[.,!?:;"]+/, '').replace(/[.,!?:;"]+$/, '');
}

/**
 * Yalnız sayıdan oluşan kelimenin Türkçe okunuşu: "3.000" → "üç bin", "40" → "kırk",
 * "%40" → "yüzde kırk", "1,5" → "bir virgül beş". Tanınmayan biçimde `null` (ses servisi okur).
 */
export function spokenNumber(core: string): string | null {
  const match = /^(%?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,4}))?$/.exec(core);
  if (!match) return null;
  const [, percent, whole, fraction] = match;
  const digits = whole!.replace(/\./g, '');
  // Baştaki sıfır (007, 0532) sayı değil koddur: dokunma
  if (digits.length > 15 || (digits.length > 1 && digits.startsWith('0')))
    return null;
  const words = turkishNumber(Number(digits));
  if (words === null) return null;
  const parts = [percent ? 'yüzde' : '', words];
  if (fraction !== undefined) {
    const tail =
      fraction.startsWith('0') && fraction.length > 1
        ? Array.from(fraction)
            .map((digit) => turkishNumber(Number(digit)))
            .join(' ')
        : turkishNumber(Number(fraction));
    parts.push('virgül', tail ?? '');
  }
  return parts.filter(Boolean).join(' ');
}

/**
 * Satırlardaki sayıların okunuş sözlüğü (`spec.py` → `SPOKEN`). Yalnız Türkçe için üretilir;
 * senaryonun kendi verdiği okunuşlar (`overrides`) önceliklidir.
 */
export function buildSpoken(
  lines: readonly string[],
  language: string,
  overrides: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const spoken: Record<string, string> = {};
  if (language.toLowerCase().startsWith('tr'))
    for (const line of lines)
      for (const token of line.split(/\s+/)) {
        const core = tokenCore(token);
        if (!core || Object.hasOwn(spoken, core)) continue;
        const words = spokenNumber(core);
        if (words) spoken[core] = words;
      }
  for (const [key, value] of Object.entries(overrides)) {
    const core = tokenCore(cleanLabel(key, 40));
    const said = cleanLabel(value, 120);
    if (core && said && !/\s/.test(core)) spoken[core] = said;
  }
  return spoken;
}

/**
 * Altyazı parçası sınırlarını ` | ` ile işaretler (`zaman_js.py` bu işarette ve cümle sonu
 * noktalamada böler; ses bu işareti görmez). Parça `maxChars`'ı geçmez (tek kelime daha uzunsa
 * tek başına kalır); virgülden sonra, parça yeterince doluysa erken bölünür.
 */
export function withCaptionBreaks(line: string, maxChars = 38): string {
  const out: string[] = [];
  let length = 0;
  for (const token of line.split(/\s+/).filter(Boolean)) {
    const size = Array.from(token).length;
    if (length > 0 && length + 1 + size > maxChars) {
      out.push('|');
      length = 0;
    }
    out.push(token);
    length += (length > 0 ? 1 : 0) + size;
    if (/[.?!;:]$/.test(token)) length = 0;
    else if (/,$/.test(token) && length >= maxChars * 0.5) {
      out.push('|');
      length = 0;
    }
  }
  while (out[out.length - 1] === '|') out.pop();
  return out.join(' ').replace(/(?:\| )+\|/g, '|');
}
