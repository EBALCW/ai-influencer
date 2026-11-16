// Üretim planı → HyperFrames çalışma klasörünün dosyaları (saf: yalnız metin üretir).
// Senaryo metni hiçbir dosyaya KOD ya da İŞARETLEME olarak girmez:
//   * spec.json   Python tarafı `json.loads` ile okur (spec.py sabittir).
//   * spec.js     `window.SPEC = <JSON>`; JSON, betik bağlamı için ayrıca kaçışlanır.
//   * index.html  sabittir; içine yalnız sayı (süre) yazılır. Yazılar canvas'a çizilir.
import type { Card, ProductionPlan } from './script.ts';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** Kaynak kartının süresi (sn); kaynak yoksa kapanış kartı da yoktur. */
export const OUTRO_SECONDS = 3.4;

export interface TimingWord {
  w: string;
  s: number;
  e: number;
}
export interface TimingLine {
  start: number;
  end: number;
  words: TimingWord[];
}
export interface Timing {
  duration: number;
  lines: TimingLine[];
}

/**
 * Veriyi `<script>` içinde ya da `.js` dosyasında güvenle taşınan bir JS ifadesine çevirir:
 * JSON + `<`, `>`, `&`, U+2028/2029 kaçışları. Sonuç yalnız veri okur; `</script>` ya da HTML
 * yorumu oluşturamaz.
 */
export function jsData(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** `spec.json`: `edge_takes.py`, `voice.py` ve `zaman_js.py` için satırlar ve ses ayarı. */
export function specJson(plan: ProductionPlan): string {
  return `${JSON.stringify(
    {
      lines: plan.beats.map((beat) => beat.marked),
      spoken: plan.spoken,
      voice: plan.voice,
      rate: plan.rate,
    },
    null,
    1,
  )}\n`;
}

export function totalSeconds(plan: ProductionPlan, timing: Timing): number {
  const outro = plan.sources.length > 0 ? OUTRO_SECONDS : 0;
  return Math.round((timing.duration + outro) * 1000) / 1000;
}

export interface CompositionSpec {
  lang: string;
  kindLabel: string;
  title: string;
  seriesName: string | null;
  episodeLabel: string | null;
  captionMode: 'line' | 'word';
  beats: { heading: string | null; card: Card | null }[];
  sources: string[];
  total: number;
  outro: number;
}

export function compositionSpec(
  plan: ProductionPlan,
  timing: Timing,
): CompositionSpec {
  return {
    lang: plan.language,
    kindLabel: plan.kindLabel,
    title: plan.title,
    seriesName: plan.seriesName,
    episodeLabel: plan.episodeLabel,
    captionMode: plan.captionMode,
    beats: plan.beats.map((beat) => ({
      heading: beat.heading,
      card: beat.card,
    })),
    sources: plan.sources,
    total: totalSeconds(plan, timing),
    outro: plan.sources.length > 0 ? OUTRO_SECONDS : 0,
  };
}

export function specJs(spec: CompositionSpec): string {
  return `window.SPEC = ${jsData(spec)};\n`;
}

export interface Cue {
  t: number;
  sound: string;
  gain: number;
  label: string;
}

/**
 * Ses işaretleri (edit-video paketinin kodla üretilen sesleri). Etiketler sabit metindir.
 * Her işaret, olayın ekranda ilk göründüğü ana konur.
 */
export function buildCues(plan: ProductionPlan, timing: Timing): Cue[] {
  const cues: Cue[] = [];
  const round = (t: number) => Math.round(Math.max(0, t) * 1000) / 1000;
  timing.lines.forEach((line, index) => {
    const start = index === 0 ? 0 : Math.max(0, line.start - 0.08);
    if (index > 0)
      cues.push({
        t: round(start),
        sound: 'camera-shutter-light',
        gain: -3,
        label: `şek. ${index + 1}`,
      });
    const card = plan.beats[index]?.card;
    if (card?.type === 'phrase')
      cues.push({
        t: round(start + 0.15),
        sound: 'ui-pop',
        gain: 0,
        label: 'ifade kartı',
      });
    else if (card?.type === 'number')
      cues.push({
        t: round(start + 0.7),
        sound: 'thock',
        gain: 2,
        label: 'sayı kartı',
      });
    else if (card?.type === 'steps') {
      const next = timing.lines[index + 1]?.start ?? timing.duration;
      const step = Math.min(
        1.1,
        Math.max(0.25, (next - 0.08 - start - 0.9) / card.items.length),
      );
      card.items.forEach((_, k) =>
        cues.push({
          t: round(start + 0.2 + k * step),
          sound: 'tick',
          gain: 0,
          label: `adım ${k + 1}`,
        }),
      );
    }
  });
  if (plan.sources.length > 0)
    cues.push({
      t: round(timing.duration - 0.3),
      sound: 'latch',
      gain: 0,
      label: 'kaynaklar',
    });
  return cues.sort((a, b) => a.t - b.t);
}

/** `cues.json` (sfx-sync.mjs girdisi). `total` kapanış kartını da kapsar. */
export function cuesJson(cues: readonly Cue[], total: number): string {
  return `${JSON.stringify({ fps: FPS, total, cues }, null, 1)}\n`;
}

/**
 * Kompozisyon sayfası. Sabit bir kalıptır: değişen tek şey süredir (sayı). Başlık dahil hiçbir
 * senaryo metni HTML'e yazılmaz.
 */
export function indexHtml(total: number): string {
  if (!Number.isFinite(total) || total <= 0 || total > 600)
    throw new Error('Kompozisyon süresi geçersiz.');
  const duration = total.toFixed(3);
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${WIDTH}, height=${HEIGHT}" />
    <title>Anlatım videosu</title>
    <style>
      @font-face {
        font-family: 'Architects Daughter';
        font-weight: 400;
        src: url('assets/fonts/ArchitectsDaughter-Regular.ttf') format('truetype');
      }
      @font-face {
        font-family: 'IBM Plex Mono';
        font-weight: 500;
        src: url('assets/fonts/IBMPlexMono-Medium.ttf') format('truetype');
      }
      html,
      body {
        margin: 0;
        background: #0d1116;
      }
      #root {
        position: relative;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        overflow: hidden;
        background: #18336b;
      }
      canvas {
        display: block;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
      }
      .preload {
        position: absolute;
        left: -9999px;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${duration}"
      data-width="${WIDTH}"
      data-height="${HEIGHT}"
      data-no-timeline
    >
      <canvas id="c" width="${WIDTH * 2}" height="${HEIGHT * 2}"></canvas>
      <span class="preload" style="font-family: 'Architects Daughter'">İıŞşĞğ</span
      ><span class="preload" style="font-family: 'IBM Plex Mono'; font-weight: 500">İıŞşĞğ</span>
    </div>
    <script>
      window.__hf = window.__hf || {};
      window.__hf.buildReady = window.__hf.buildReady || {};
      window.__hf.buildReady.scene = new Promise((r) => {
        window.__sceneReady = r;
      });
    </script>
    <script src="assets/timing.js"></script>
    <script src="assets/spec.js"></script>
    <script src="assets/bp.js"></script>
    <script src="assets/sablon.js"></script>
    <script>
      let ready = false,
        pending = 0;
      window.addEventListener('hf-seek', (e) => {
        pending = e.detail.time;
        if (ready) window.__film.draw(pending);
        else if (e.detail.waitUntil)
          e.detail.waitUntil(window.__film.ready.then(() => window.__film.draw(pending)));
      });
      window.__film.ready.then(() => {
        ready = true;
        window.__film.draw(pending);
        window.__sceneReady();
      });
    </script>
  </body>
</html>
`;
}

/** Önizleme kareleri için zamanlar: ilk kare, her vuruşun ortası (en çok `max`), kapanış. */
export function snapshotTimes(
  timing: Timing,
  total: number,
  max = 5,
): number[] {
  const mids = timing.lines.map((line) =>
    Math.min(total - 0.1, line.start + (line.end - line.start) * 0.7),
  );
  const picked: number[] = [0.4];
  const slots = Math.max(1, max - 2);
  for (let i = 0; i < Math.min(slots, mids.length); i++)
    picked.push(
      mids[
        Math.min(
          mids.length - 1,
          Math.floor(((i + 0.5) * mids.length) / Math.min(slots, mids.length)),
        )
      ]!,
    );
  picked.push(Math.max(0.5, total - 0.6));
  return [...new Set(picked.map((t) => Math.round(t * 100) / 100))]
    .filter((t) => t >= 0 && t < total)
    .sort((a, b) => a - b);
}
