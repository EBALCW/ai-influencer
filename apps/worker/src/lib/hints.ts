// Eksik araç için işletim sistemine göre kurulum yönergesi. Yalnız metin üretir; hiçbir şey kurmaz.
import type { CheckId } from './capabilities.ts';
import type { Platform } from './locations.ts';

export interface HintContext {
  /** Sanal ortamın (beklenen) klasörü. */
  venvDir: string;
  /** Sanal ortamın python yolu. */
  venvPython: string;
  /** HyperFrames'in kurulduğu film klasörü. */
  filmWorkspace: string;
  whisperModel: string;
  whisperVad: string;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin';
const WHISPER_VAD_URL =
  'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin';
const PIP_PACKAGES =
  '-m pip install -r .claude/skills/cinematic-film/requirements.txt edge-tts';

type PerPlatform = Record<Platform, string>;

const FFMPEG: PerPlatform = {
  darwin:
    'brew install ffmpeg-full  (standart "brew install ffmpeg" altyazı gömemez; başka yol için FFMPEG_PATH)',
  win32:
    'winget install Gyan.FFmpeg  ("full" yapı; libass ve libx264 içerir), sonra yeni terminal aç',
  linux: 'sudo apt install ffmpeg',
};

const SIMPLE: Partial<Record<CheckId, PerPlatform>> = {
  node: {
    darwin: 'bash scripts/setup-mac.sh  (fnm ile Node 24 kurar)',
    win32:
      'powershell -ExecutionPolicy Bypass -File scripts\\setup-windows.ps1  (fnm ile Node 24 kurar)',
    linux:
      'fnm install --corepack-enabled && fnm use  (AGENTS.md → Linux / WSL)',
  },
  pnpm: {
    darwin: 'corepack enable && corepack install',
    win32: 'corepack enable; corepack install',
    linux: 'corepack enable && corepack install',
  },
  ffmpeg: FFMPEG,
  ffprobe: {
    darwin: 'brew install ffmpeg-full  (ffprobe ffmpeg ile birlikte gelir)',
    win32: 'winget install Gyan.FFmpeg  (ffprobe ffmpeg ile birlikte gelir)',
    linux: 'sudo apt install ffmpeg  (ffprobe ffmpeg ile birlikte gelir)',
  },
  'ffmpeg.libx264': FFMPEG,
  'ffmpeg.subtitles': FFMPEG,
  'yt-dlp': {
    darwin: 'brew install yt-dlp',
    win32: 'winget install yt-dlp.yt-dlp',
    linux: 'pipx install yt-dlp  (apt paketi çoğu zaman eski kalır)',
  },
  blender: {
    darwin: 'brew install --cask blender  (başka yere kuruluysa BLENDER_PATH)',
    win32:
      'winget install BlenderFoundation.Blender  (başka yere kuruluysa BLENDER_PATH)',
    linux: 'sudo snap install blender --classic',
  },
  chrome: {
    darwin: 'brew install --cask google-chrome',
    win32: 'winget install Google.Chrome',
    linux:
      'sudo apt install chromium  (başka yol için HYPERFRAMES_BROWSER_PATH)',
  },
  python: {
    darwin: 'brew install python',
    win32: 'winget install Python.Python.3.12',
    linux: 'sudo apt install python3 python3-venv',
  },
  'whisper-cli': {
    darwin: 'brew install whisper-cpp',
    win32:
      "github.com/ggml-org/whisper.cpp/releases adresinden whisper-bin-x64.zip'i indir, aç ve klasörü PATH'e ekle",
    linux:
      "github.com/ggml-org/whisper.cpp kaynak koddan derle (cmake -B build && cmake --build build -j), build/bin klasörünü PATH'e ekle",
  },
};

const MPFB =
  'Blender → Edit → Preferences → Get Extensions → "MPFB" ara ve kur (isteğe bağlı; yalnız insan figürü gereken sahneler)';

/** PowerShell 5'te `curl`, Invoke-WebRequest takma adıdır; gerçek curl `curl.exe`. */
const curl = (platform: Platform) =>
  platform === 'win32' ? 'curl.exe' : 'curl';

/** `null`: bu denetim için kurulacak bir şey yok. */
export function installHint(
  id: CheckId,
  platform: Platform,
  ctx: HintContext,
): string | null {
  const simple = SIMPLE[id]?.[platform];
  if (simple) return simple;
  switch (id) {
    case 'blender.mpfb':
      return MPFB;
    case 'hyperframes':
      return `node .claude/skills/edit-video/scripts/init-workspace.mjs --workspace "${ctx.filmWorkspace}" --install  (~410 MB, repo dışına kurulur)`;
    case 'venv':
      return `${platform === 'win32' ? 'py' : 'python3'} -m venv "${ctx.venvDir}"  (başka klasör için FILM_VENV_DIR)`;
    case 'py.edge-tts':
    case 'py.skia':
    case 'py.numpy':
    case 'py.pillow':
    case 'py.scipy':
      // PowerShell tırnaklı bir yolu ancak `&` ile çalıştırır
      return `${platform === 'win32' ? '& ' : ''}"${ctx.venvPython}" ${PIP_PACKAGES}`;
    case 'whisper.model':
      return `${curl(platform)} -L --create-dirs -o "${ctx.whisperModel}" ${WHISPER_MODEL_URL}  (574 MB; başka model için WHISPER_MODEL)`;
    case 'whisper.vad':
      return `${curl(platform)} -L --create-dirs -o "${ctx.whisperVad}" ${WHISPER_VAD_URL}  (isteğe bağlı, 0,9 MB)`;
    case 'audio-tagger':
      return 'docs/clip-guide.md → "Ses etiketleyici" adımları (isteğe bağlı; sherpa-onnx-node + CED-tiny modeli, repo dışına)';
    default:
      return null;
  }
}
