// Araçların işletim sistemine göre aranacağı yerler. Saf fonksiyonlar: dosya sistemine
// yalnız dışarıdan verilen `listDir` ile bakar, böylece Windows yolları macOS'ta da test edilir.
import path from 'node:path';

export type Platform = 'darwin' | 'win32' | 'linux';

export interface HostContext {
  platform: Platform;
  home: string;
  env: Record<string, string | undefined>;
}

export type ListDir = (dir: string) => string[];

export type LocatableTool =
  | 'pnpm'
  | 'ffmpeg'
  | 'ffprobe'
  | 'yt-dlp'
  | 'blender'
  | 'chrome'
  | 'python'
  | 'whisper-cli';

export function normalizePlatform(platform: string): Platform {
  return platform === 'darwin' || platform === 'win32' ? platform : 'linux';
}

export function pathApi(platform: Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

/** Windows'ta ortam değişkeni adları büyük/küçük harfe duyarsızdır (`Path`, `PATH`). */
export function envGet(ctx: HostContext, name: string): string | undefined {
  const direct = ctx.env[name];
  if (direct !== undefined && direct !== '') return direct;
  if (ctx.platform !== 'win32') return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(ctx.env))
    if (key.toLowerCase() === wanted && value) return value;
  return undefined;
}

/** PATH'teki her klasör için aday dosya yolları; Windows'ta PATHEXT uzantıları eklenir. */
export function pathLookupCandidates(
  names: readonly string[],
  ctx: HostContext,
): string[] {
  const p = pathApi(ctx.platform);
  const dirs = (envGet(ctx, 'PATH') ?? '')
    .split(p.delimiter)
    .map((dir) => dir.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
  const extensions =
    ctx.platform === 'win32'
      ? (envGet(ctx, 'PATHEXT') ?? '.COM;.EXE;.BAT;.CMD')
          .split(';')
          .map((ext) => ext.trim().toLowerCase())
          .filter(Boolean)
      : [''];
  const out: string[] = [];
  for (const dir of dirs)
    for (const name of names) {
      if (ctx.platform === 'win32' && p.extname(name) !== '')
        out.push(p.join(dir, name));
      else for (const ext of extensions) out.push(p.join(dir, name + ext));
    }
  return unique(out);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Yol kalıbını açar; yalnız `*` desteklenir ve bir yol parçasının içinde kalır
 * (`C:\Program Files\Blender Foundation\Blender *\blender.exe`). Eşleşenler yeni sürüm
 * önce gelecek şekilde sıralanır. Yıldızsız kalıp olduğu gibi döner (varlığı sonra denetlenir).
 */
export function expandPattern(
  pattern: string,
  platform: Platform,
  listDir: ListDir,
): string[] {
  if (!pattern.includes('*')) return [pattern];
  const p = pathApi(platform);
  const root = p.parse(pattern).root;
  const parts = pattern.slice(root.length).split(p.sep).filter(Boolean);
  let bases = [root];
  for (const part of parts) {
    if (!part.includes('*')) {
      bases = bases.map((base) => p.join(base, part));
      continue;
    }
    const matcher = new RegExp(
      `^${part
        .split('*')
        .map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}$`,
      platform === 'linux' ? '' : 'i',
    );
    bases = bases.flatMap((base) =>
      listDir(base)
        .filter((name) => matcher.test(name))
        .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
        .map((name) => p.join(base, name)),
    );
    if (bases.length === 0) return [];
  }
  return bases;
}

interface WindowsDirs {
  programFiles: string;
  programFilesX86: string;
  localAppData: string;
  appData: string;
  programData: string;
}

export function windowsDirs(ctx: HostContext): WindowsDirs {
  const p = path.win32;
  return {
    programFiles: envGet(ctx, 'ProgramFiles') ?? 'C:\\Program Files',
    programFilesX86:
      envGet(ctx, 'ProgramFiles(x86)') ?? 'C:\\Program Files (x86)',
    localAppData:
      envGet(ctx, 'LOCALAPPDATA') ?? p.join(ctx.home, 'AppData', 'Local'),
    appData: envGet(ctx, 'APPDATA') ?? p.join(ctx.home, 'AppData', 'Roaming'),
    programData: envGet(ctx, 'ProgramData') ?? 'C:\\ProgramData',
  };
}

const PATH_NAMES: Record<LocatableTool, Record<Platform, string[]>> = {
  pnpm: { darwin: ['pnpm'], win32: ['pnpm'], linux: ['pnpm'] },
  ffmpeg: { darwin: ['ffmpeg'], win32: ['ffmpeg'], linux: ['ffmpeg'] },
  ffprobe: { darwin: ['ffprobe'], win32: ['ffprobe'], linux: ['ffprobe'] },
  'yt-dlp': { darwin: ['yt-dlp'], win32: ['yt-dlp'], linux: ['yt-dlp'] },
  blender: { darwin: ['blender'], win32: ['blender'], linux: ['blender'] },
  chrome: {
    darwin: ['chromium'],
    win32: ['chrome', 'chromium'],
    linux: [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
    ],
  },
  python: {
    darwin: ['python3', 'python'],
    win32: ['python', 'python3'],
    linux: ['python3', 'python'],
  },
  'whisper-cli': {
    darwin: ['whisper-cli'],
    win32: ['whisper-cli'],
    linux: ['whisper-cli'],
  },
};

/** Kullanıcının yolu açıkça verdiği ortam değişkeni (varsa ilk aday odur). */
export const OVERRIDE_ENV: Partial<Record<LocatableTool, string>> = {
  ffmpeg: 'FFMPEG_PATH',
  blender: 'BLENDER_PATH',
  chrome: 'HYPERFRAMES_BROWSER_PATH',
};

/** PATH dışında bilinen kurulum yerleri (kalıp olabilir). */
export function knownLocationPatterns(
  tool: LocatableTool,
  ctx: HostContext,
): string[] {
  const p = pathApi(ctx.platform);
  const home = ctx.home;
  // HyperFrames'in kendi indirdiği başsız Chrome (her işletim sisteminde aynı düzen)
  const hyperframesChrome = p.join(
    home,
    '.cache',
    'hyperframes',
    'chrome',
    'chrome-headless-shell',
    '*',
    '*',
    ctx.platform === 'win32'
      ? 'chrome-headless-shell.exe'
      : 'chrome-headless-shell',
  );

  if (ctx.platform === 'win32') {
    const dirs = windowsDirs(ctx);
    const exe = `${tool}.exe`;
    const wingetLink = p.join(
      dirs.localAppData,
      'Microsoft',
      'WinGet',
      'Links',
    );
    const wingetPackages = p.join(
      dirs.localAppData,
      'Microsoft',
      'WinGet',
      'Packages',
    );
    const scoopShims = p.join(home, 'scoop', 'shims');
    const chocolatey = p.join(dirs.programData, 'chocolatey', 'bin');
    switch (tool) {
      case 'ffmpeg':
      case 'ffprobe':
        return [
          p.join(wingetLink, exe),
          p.join(wingetPackages, 'Gyan.FFmpeg*', 'ffmpeg-*', 'bin', exe),
          p.join(scoopShims, exe),
          p.join(chocolatey, exe),
          p.join(dirs.programFiles, 'ffmpeg', 'bin', exe),
          p.join('C:\\', 'ffmpeg', 'bin', exe),
        ];
      case 'yt-dlp':
        return [
          p.join(wingetLink, exe),
          p.join(wingetPackages, 'yt-dlp.yt-dlp*', exe),
          p.join(scoopShims, exe),
          p.join(chocolatey, exe),
        ];
      case 'blender':
        return [
          p.join(dirs.programFiles, 'Blender Foundation', 'Blender *', exe),
          p.join(home, 'scoop', 'apps', 'blender', 'current', exe),
          p.join(
            dirs.programFilesX86,
            'Steam',
            'steamapps',
            'common',
            'Blender',
            exe,
          ),
        ];
      case 'chrome':
        return [
          hyperframesChrome,
          ...[dirs.programFiles, dirs.programFilesX86, dirs.localAppData].map(
            (base) =>
              p.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          ),
          p.join(dirs.localAppData, 'Chromium', 'Application', 'chrome.exe'),
        ];
      case 'python':
        return [
          p.join(dirs.localAppData, 'Programs', 'Python', 'Python3*', exe),
          p.join(dirs.programFiles, 'Python3*', exe),
          p.join(scoopShims, exe),
        ];
      case 'whisper-cli':
        return [p.join(wingetLink, exe), p.join(scoopShims, exe)];
      case 'pnpm':
        return [
          p.join(dirs.localAppData, 'pnpm', 'pnpm.exe'),
          p.join(dirs.localAppData, 'pnpm', 'pnpm.cmd'),
          p.join(dirs.appData, 'npm', 'pnpm.cmd'),
        ];
    }
  }

  if (ctx.platform === 'darwin') {
    // Homebrew: Apple Silicon /opt/homebrew, Intel /usr/local; MacPorts /opt/local
    const prefixes = ['/opt/homebrew', '/usr/local', '/opt/local'];
    const bins = (name: string) =>
      prefixes.map((prefix) => p.join(prefix, 'bin', name));
    switch (tool) {
      case 'ffmpeg':
      case 'ffprobe':
        return [
          // libass'lı yapı: standart Homebrew ffmpeg'i altyazı gömemez
          '/opt/homebrew/opt/ffmpeg-full/bin/' + tool,
          '/usr/local/opt/ffmpeg-full/bin/' + tool,
          ...bins(tool),
        ];
      case 'blender':
        return [
          '/Applications/Blender.app/Contents/MacOS/Blender',
          p.join(home, 'Applications/Blender.app/Contents/MacOS/Blender'),
          '/Applications/Blender*.app/Contents/MacOS/Blender',
          ...bins('blender'),
        ];
      case 'chrome':
        return [
          hyperframesChrome,
          ...['/Applications', p.join(home, 'Applications')].flatMap((apps) => [
            p.join(apps, 'Google Chrome.app/Contents/MacOS/Google Chrome'),
            p.join(apps, 'Chromium.app/Contents/MacOS/Chromium'),
          ]),
        ];
      case 'python':
        return bins('python3');
      default:
        return bins(tool);
    }
  }

  const bins = (name: string) => [
    p.join('/usr/bin', name),
    p.join('/usr/local/bin', name),
    p.join('/snap/bin', name),
    p.join(home, '.local', 'bin', name),
  ];
  switch (tool) {
    case 'blender':
      return [...bins('blender'), '/opt/blender*/blender'];
    case 'chrome':
      return [
        hyperframesChrome,
        ...PATH_NAMES.chrome.linux.flatMap((name) => bins(name)),
      ];
    case 'python':
      return bins('python3');
    default:
      return bins(tool);
  }
}

/**
 * Bir aracın denenecek yolları, öncelik sırasıyla: kullanıcının verdiği yol, PATH, bilinen
 * kurulum yerleri. Dönen yolların var olduğu garanti değildir; çağıran denetler.
 */
export function toolCandidates(
  tool: LocatableTool,
  ctx: HostContext,
  listDir: ListDir,
): string[] {
  const override = OVERRIDE_ENV[tool];
  const fromEnv = override ? envGet(ctx, override) : undefined;
  return unique([
    ...(fromEnv ? [fromEnv] : []),
    ...pathLookupCandidates(PATH_NAMES[tool][ctx.platform], ctx),
    ...knownLocationPatterns(tool, ctx).flatMap((pattern) =>
      expandPattern(pattern, ctx.platform, listDir),
    ),
  ]);
}

/** Film sanal ortamı: `FILM_VENV_DIR`, yoksa rehberlerdeki varsayılan yerler. */
export function venvCandidates(ctx: HostContext): string[] {
  const p = pathApi(ctx.platform);
  const fromEnv = envGet(ctx, 'FILM_VENV_DIR');
  if (fromEnv) return [fromEnv];
  const shared = p.join(ctx.home, '.local', 'share', 'ai-influencer-film-venv');
  return ctx.platform === 'win32'
    ? [p.join(ctx.home, 'ai-influencer-film-venv'), shared]
    : [shared];
}

export function venvPython(venvDir: string, platform: Platform): string {
  const p = pathApi(platform);
  return platform === 'win32'
    ? p.join(venvDir, 'Scripts', 'python.exe')
    : p.join(venvDir, 'bin', 'python');
}

/** HyperFrames çalışma zamanı: `<film klasörü>/.favstash-studio/runtime`. */
export function hyperframesRuntime(ctx: HostContext): string {
  const p = pathApi(ctx.platform);
  const workspace =
    envGet(ctx, 'FILM_WORKSPACE_DIR') ??
    p.join(ctx.home, 'ai-influencer-films');
  return p.join(workspace, '.favstash-studio', 'runtime');
}

export function whisperModelPath(ctx: HostContext): string {
  const p = pathApi(ctx.platform);
  return (
    envGet(ctx, 'WHISPER_MODEL') ??
    p.join(
      ctx.home,
      '.local',
      'share',
      'whisper-models',
      'ggml-large-v3-turbo-q5_0.bin',
    )
  );
}

export function whisperVadPath(ctx: HostContext): string {
  const p = pathApi(ctx.platform);
  return (
    envGet(ctx, 'WHISPER_VAD_MODEL') ??
    p.join(p.dirname(whisperModelPath(ctx)), 'ggml-silero-v6.2.0.bin')
  );
}

export function audioTaggerPaths(ctx: HostContext): {
  packageDir: string;
  model: string;
} {
  const p = pathApi(ctx.platform);
  const packageDir =
    envGet(ctx, 'AUDIO_TAGGER_DIR') ??
    p.join(ctx.home, '.local', 'share', 'ai-influencer-audio');
  const modelDir =
    envGet(ctx, 'AUDIO_TAG_MODEL_DIR') ??
    p.join(
      ctx.home,
      '.local',
      'share',
      'sherpa-models',
      'sherpa-onnx-ced-tiny-audio-tagging-2024-04-19',
    );
  return { packageDir, model: p.join(modelDir, 'model.int8.onnx') };
}

/** Blender'ın kullanıcı ayar klasörü; MPFB eklentisi bunun altına kurulur. */
export function blenderConfigDir(ctx: HostContext): string {
  const p = pathApi(ctx.platform);
  if (ctx.platform === 'darwin')
    return p.join(ctx.home, 'Library', 'Application Support', 'Blender');
  if (ctx.platform === 'win32')
    return p.join(windowsDirs(ctx).appData, 'Blender Foundation', 'Blender');
  return p.join(
    envGet(ctx, 'XDG_CONFIG_HOME') ?? p.join(ctx.home, '.config'),
    'blender',
  );
}

/** MPFB'nin `blender_manifest.toml` dosyası için kalıplar (eklenti deposu adı değişebilir). */
export function mpfbManifestPatterns(ctx: HostContext): string[] {
  const p = pathApi(ctx.platform);
  const config = blenderConfigDir(ctx);
  return [
    p.join(config, '*', 'extensions', '*', 'mpfb', 'blender_manifest.toml'),
    p.join(config, '*', 'scripts', 'addons', 'mpfb', '__init__.py'),
  ];
}

/**
 * Çıktıda ev klasörünü `~` ile değiştirir: repo herkese açık, raporlar issue'ya yapıştırılıyor;
 * kullanıcı adı sızmasın. Windows'ta büyük/küçük harf ve eğik çizgi yönü fark etmez.
 */
export function redactHome(
  text: string,
  home: string,
  platform: Platform,
  replacement = '~',
): string {
  if (!home || home === '/' || /^[A-Za-z]:[\\/]?$/.test(home)) return text;
  const trimmed = home.replace(/[\\/]+$/, '');
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\\|\//g, '[\\\\/]');
  return text.replace(
    new RegExp(
      `${escaped}(?=$|[\\\\/"'\\s:;,)])`,
      platform === 'win32' ? 'gi' : 'g',
    ),
    // `$` özel anlam taşımasın diye fonksiyonla verilir ("$HOME")
    () => replacement,
  );
}
