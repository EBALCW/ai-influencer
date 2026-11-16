// Altyazı: `zaman_js.py`'nin ürettiği parçalar (assets/timing.js) → SRT ve ASS.
// Saf fonksiyonlar. Parça sınırları ve zamanlar sesin kelime zamanlarından gelir.
import { PermanentError } from '../../lib/errors.ts';
import type { Timing, TimingWord } from './composition.ts';

export interface Phrase {
  n: number;
  line: number;
  text: string;
  s: number;
  e: number;
}
export interface TimingData extends Timing {
  phrases: Phrase[];
}
export interface CaptionCue extends Phrase {
  words: TimingWord[];
}

const PREFIX = 'window.TIMING = ';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** `assets/timing.js` dosyasını VERİ olarak okur (çalıştırmaz): sabit önek + JSON + `;`. */
export function parseTimingJs(source: string): TimingData {
  const text = source.trim();
  if (!text.startsWith(PREFIX) || !text.endsWith(';'))
    throw new PermanentError('Zamanlama dosyası beklenen biçimde değil.');
  let data: unknown;
  try {
    data = JSON.parse(text.slice(PREFIX.length, -1));
  } catch {
    throw new PermanentError('Zamanlama dosyası okunamadı.');
  }
  const timing = data as Partial<TimingData> | null;
  if (
    !timing ||
    !isNumber(timing.duration) ||
    timing.duration <= 0 ||
    !Array.isArray(timing.lines) ||
    !Array.isArray(timing.phrases) ||
    timing.lines.length === 0 ||
    !timing.lines.every(
      (line) =>
        line &&
        isNumber(line.start) &&
        isNumber(line.end) &&
        Array.isArray(line.words) &&
        line.words.every(
          (word) =>
            word &&
            typeof word.w === 'string' &&
            isNumber(word.s) &&
            isNumber(word.e),
        ),
    ) ||
    !timing.phrases.every(
      (phrase) =>
        phrase &&
        typeof phrase.text === 'string' &&
        isNumber(phrase.s) &&
        isNumber(phrase.e) &&
        Number.isInteger(phrase.line) &&
        phrase.line >= 0 &&
        phrase.line < timing.lines!.length,
    )
  )
    throw new PermanentError('Zamanlama dosyası beklenen biçimde değil.');
  return timing as TimingData;
}

/** Her parçayı kendi kelime zamanlarıyla eşler (parçalar satır içinde sırayla ilerler). */
export function captionCues(timing: TimingData): CaptionCue[] {
  const at = timing.lines.map(() => 0);
  return timing.phrases.map((phrase) => {
    const count = phrase.text.split(' ').filter(Boolean).length;
    const from = at[phrase.line]!;
    const words = timing.lines[phrase.line]!.words.slice(from, from + count);
    if (words.length !== count)
      throw new PermanentError(
        'Altyazı parçaları kelime zamanlarıyla uyuşmuyor.',
      );
    at[phrase.line] = from + count;
    return { ...phrase, words };
  });
}

/** Metni en çok iki dengeli satıra böler (`maxChars` satır başına hedef). */
export function wrapTwoLines(text: string, maxChars = 24): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const length = Array.from(words.join(' ')).length;
  if (length <= maxChars || words.length < 2) return [words.join(' ')];
  let best = 1;
  let bestGap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const first = Array.from(words.slice(0, i).join(' ')).length;
    const gap = Math.abs(first - (length - first - 1));
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function stamp(seconds: number, separator: ',' | '.'): string {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${separator}${pad(ms % 1000, 3)}`;
}

/** SRT metninde yapı bozan şeyler: boş satır (parça ayırıcı) ve `-->`. */
function srtText(text: string): string {
  return text.replace(/-->/g, '→').replace(/\s+/g, ' ').trim();
}

/**
 * SRT. `line`: parça başına bir kayıt, en çok iki satır. `word`: her kelime kendi kaydında
 * (kelime kelime altyazı).
 */
export function toSrt(
  cues: readonly CaptionCue[],
  mode: 'line' | 'word',
): string {
  const rows: { s: number; e: number; text: string }[] = [];
  if (mode === 'word')
    for (const cue of cues)
      cue.words.forEach((word, index) => {
        const next = cue.words[index + 1];
        rows.push({
          s: Math.max(0, word.s - 0.04),
          e: next ? next.s - 0.04 : cue.e,
          text: srtText(word.w),
        });
      });
  else
    for (const cue of cues)
      rows.push({
        s: cue.s,
        e: cue.e,
        text: wrapTwoLines(srtText(cue.text)).join('\n'),
      });
  return rows
    .filter((row) => row.text && row.e > row.s)
    .map(
      (row, index) =>
        `${index + 1}\n${stamp(row.s, ',')} --> ${stamp(row.e, ',')}\n${row.text}\n`,
    )
    .join('\n');
}

/** ASS metni: süslü parantez (biçim etiketi) ve ters eğik çizgi metinden çıkarılır. */
function assText(text: string): string {
  return text
    .replace(/[{}\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assStamp(seconds: number): string {
  const cs = Math.round(Math.max(0, seconds) * 100);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
}

/**
 * ASS (1080×1920, güvenli alanda, Türkçe harfleri tam bir yazı tipiyle). Videoya gömmek isteyen
 * yollar (skia, blender) ve elle düzenleme içindir; HyperFrames yolunda altyazı kompozisyonun
 * içindedir. `word` modunda kelimeler `\k` ile sırayla vurgulanır.
 */
export function toAss(
  cues: readonly CaptionCue[],
  mode: 'line' | 'word',
): string {
  const head = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Arial: macOS ve Windows'ta var, İ ı Ş ş Ğ ğ tam. Alt kenar y=1236 (güvenli alan).
    'Style: Default,Arial,58,&H00FFFFFF,&H0099CCFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,2,180,180,684,162',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const events = cues
    .filter((cue) => cue.e > cue.s && cue.text.trim())
    .map((cue) => {
      let body: string;
      if (mode === 'word')
        body = cue.words
          .map((word, index) => {
            const next = cue.words[index + 1];
            const cs = Math.max(
              1,
              Math.round(((next ? next.s : cue.e) - word.s) * 100),
            );
            return `{\\k${cs}}${assText(word.w)}`;
          })
          .join(' ');
      else body = wrapTwoLines(assText(cue.text)).join('\\N');
      return `Dialogue: 0,${assStamp(cue.s)},${assStamp(cue.e)},Default,,0,0,0,,${body}`;
    });
  return `${[...head, ...events].join('\n')}\n`;
}
