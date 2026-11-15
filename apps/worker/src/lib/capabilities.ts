// Denetim sonuçlarından yetenek türetme. Saf fonksiyonlar; testler sahte denetim sonucu verir.
import {
  WORKER_CAPABILITIES,
  type WorkerCapability,
} from '@ai-influencer/shared/capabilities';

export { WORKER_CAPABILITIES, type WorkerCapability };

/** Denetim kimlikleri. `--json` çıktısında `checks[].id` olarak geçer; adlar sabittir. */
export const CHECK_IDS = [
  'node',
  'pnpm',
  'ffmpeg',
  'ffprobe',
  'ffmpeg.libx264',
  'ffmpeg.subtitles',
  'yt-dlp',
  'blender',
  'blender.mpfb',
  'chrome',
  'hyperframes',
  'python',
  'venv',
  'py.edge-tts',
  'py.skia',
  'py.numpy',
  'py.pillow',
  'py.scipy',
  'whisper-cli',
  'whisper.model',
  'whisper.vad',
  'audio-tagger',
] as const;

export type CheckId = (typeof CHECK_IDS)[number];

/** ok: var · missing: eksik · outdated: var ama sürümü alt sınırın altında. */
export type CheckStatus = 'ok' | 'missing' | 'outdated';

export interface CheckResult {
  id: CheckId;
  label: string;
  status: CheckStatus;
  version: string | null;
  path: string | null;
  /** Alt sınır ya da beklenen aralık (ör. ">=5.0"); sınır yoksa null. */
  required: string | null;
  /** true ise hiçbir temel yetenek buna bağlı değildir. */
  optional: boolean;
  detail: string | null;
  /** Bu işletim sistemi için kurulum yönergesi; yalnız durum ok değilken dolu. */
  hint: string | null;
}

export const CHECK_LABELS: Record<CheckId, string> = {
  node: 'Node.js',
  pnpm: 'pnpm',
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  'ffmpeg.libx264': 'ffmpeg: libx264',
  'ffmpeg.subtitles': 'ffmpeg: altyazı (libass)',
  'yt-dlp': 'yt-dlp',
  blender: 'Blender',
  'blender.mpfb': 'Blender MPFB eklentisi',
  chrome: 'Chrome / Chromium',
  hyperframes: 'HyperFrames',
  python: 'Python',
  venv: 'Film sanal ortamı',
  'py.edge-tts': 'edge-tts',
  'py.skia': 'skia-python',
  'py.numpy': 'numpy',
  'py.pillow': 'pillow',
  'py.scipy': 'scipy',
  'whisper-cli': 'whisper.cpp (whisper-cli)',
  'whisper.model': 'whisper modeli',
  'whisper.vad': 'whisper VAD modeli',
  'audio-tagger': 'Ses etiketleyici',
};

export const OPTIONAL_CHECKS: readonly CheckId[] = [
  'blender.mpfb',
  'py.scipy',
  'whisper.vad',
  'audio-tagger',
];

/**
 * Her yeteneğin dayandığı denetimler; hepsi `ok` ise yetenek vardır.
 * `ffmpeg.subtitles` yalnız hem `subtitles` filtresi hem libx264 olan bir ffmpeg bulunduğunda ok olur.
 */
export const CAPABILITY_REQUIREMENTS: Record<
  WorkerCapability,
  readonly CheckId[]
> = {
  // edge_takes.py kayıt alır; voice.py kayıtları numpy + ffmpeg ile birleştirir
  'voice.edge-tts': ['venv', 'py.edge-tts', 'py.numpy', 'ffmpeg'],
  'captions.burn': ['ffmpeg', 'ffmpeg.subtitles'],
  'render.skia': [
    'venv',
    'py.skia',
    'py.numpy',
    'py.pillow',
    'ffmpeg',
    'ffprobe',
    'ffmpeg.libx264',
  ],
  // libx264: bitmiş video yükleme sınırına sığdırılırken yeniden kodlanır
  'render.hyperframes': [
    'node',
    'hyperframes',
    'chrome',
    'ffmpeg',
    'ffprobe',
    'ffmpeg.libx264',
  ],
  'render.blender': ['blender', 'ffmpeg', 'ffmpeg.libx264'],
  'render.blender.mpfb': [
    'blender',
    'blender.mpfb',
    'ffmpeg',
    'ffmpeg.libx264',
  ],
  'clip.cut': ['ffmpeg', 'ffprobe', 'ffmpeg.libx264'],
  'clip.transcribe': ['whisper-cli', 'whisper.model', 'ffmpeg'],
  'clip.audio-tags': ['audio-tagger', 'ffmpeg'],
  'fetch.youtube': ['yt-dlp', 'ffmpeg'],
};

export interface MissingCapability {
  key: WorkerCapability;
  /** Eksik ya da eski olan denetimlerin kimlikleri. */
  missing: CheckId[];
}

export interface CapabilityReport {
  available: WorkerCapability[];
  unavailable: MissingCapability[];
}

/** Listede olmayan denetim eksik sayılır: bilinmeyen şey için yetenek bildirilmez. */
export function deriveCapabilities(
  checks: readonly Pick<CheckResult, 'id' | 'status'>[],
): CapabilityReport {
  const ok = new Set(
    checks.filter((check) => check.status === 'ok').map((check) => check.id),
  );
  const available: WorkerCapability[] = [];
  const unavailable: MissingCapability[] = [];
  for (const key of WORKER_CAPABILITIES) {
    const missing = CAPABILITY_REQUIREMENTS[key].filter((id) => !ok.has(id));
    if (missing.length === 0) available.push(key);
    else unavailable.push({ key, missing });
  }
  return { available, unavailable };
}

/** Uçtan uca bir üretim yolu: bitmiş video çıkarmak için gereken yetenekler. */
export const ROUTES = [
  {
    key: 'explainer.skia',
    label: 'Anlatım videosu, Skia yolu',
    requires: ['voice.edge-tts', 'render.skia', 'captions.burn'],
  },
  {
    key: 'explainer.hyperframes',
    label: 'Anlatım videosu, stil yolu (HyperFrames)',
    requires: ['voice.edge-tts', 'render.hyperframes'],
  },
  {
    key: 'explainer.blender',
    label: 'Anlatım videosu, Blender 3B kesit',
    requires: ['voice.edge-tts', 'render.blender', 'captions.burn'],
  },
  {
    key: 'clip',
    label: 'Yayıncı klibi',
    requires: ['fetch.youtube', 'clip.cut'],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  requires: readonly WorkerCapability[];
}[];

export type RouteKey = (typeof ROUTES)[number]['key'];

export interface RouteStatus {
  key: RouteKey;
  label: string;
  ready: boolean;
  missing: WorkerCapability[];
}

export function deriveRoutes(
  available: readonly WorkerCapability[],
): RouteStatus[] {
  return ROUTES.map((route) => {
    const missing = route.requires.filter((key) => !available.includes(key));
    return {
      key: route.key,
      label: route.label,
      ready: missing.length === 0,
      missing,
    };
  });
}

export const EXIT = {
  /** En az bir üretim yolu tam. */
  ok: 0,
  /** Kullanım hatası ya da beklenmeyen hata. */
  error: 1,
  /** Hiçbir üretim yolu tam değil. */
  nothing: 2,
  /** `--require` ile istenen yetenek eksik. */
  requireMissing: 3,
} as const;

export function exitCode(
  routes: readonly RouteStatus[],
  available: readonly WorkerCapability[],
  required: readonly WorkerCapability[],
): number {
  if (required.some((key) => !available.includes(key)))
    return EXIT.requireMissing;
  if (required.length > 0) return EXIT.ok;
  return routes.some((route) => route.ready) ? EXIT.ok : EXIT.nothing;
}
