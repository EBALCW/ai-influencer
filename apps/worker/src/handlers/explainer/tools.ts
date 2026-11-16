// Anlatım işleyicilerinin kullandığı araçlar ve betikler: nerede durdukları tek yerde çözülür.
// Komutlar önek dizisidir (ör. [node, hyperframes.mjs]); testler sahte araç verebilir.
import { existsSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TransientError } from '../../lib/errors.ts';
import {
  envGet,
  hyperframesRuntime,
  normalizePlatform,
  toolCandidates,
  venvCandidates,
  venvPython,
  type HostContext,
} from '../../lib/locations.ts';

export interface ExplainerTools {
  python: string[];
  node: string[];
  ffmpeg: string[];
  ffprobe: string[];
  hyperframes: string[];
  scripts: {
    /** anlatim-videosu/scripts/edge_takes.py */
    edgeTakes: string;
    /** edit-video/scripts/voice.py */
    voice: string;
    /** anlatim-videosu/scripts/zaman_js.py */
    timing: string;
    /** edit-video/scripts/sfx-sync.mjs */
    sfxSync: string;
  };
  assets: {
    /** Blueprint çizim motoru (planor-stil/assets/bp.js). */
    engine: string;
    /** Yazı tipi klasörü (Türkçe harfleri tam iki yazı tipi + lisansları). */
    fonts: string;
    /** Veriye dayalı şablon (template/sablon.js). */
    template: string;
    /** Sabit spec.py (içeriği spec.json'dan okur). */
    specPy: string;
  };
  /** Alt süreçlere izin listesine ek olarak verilen ortam (sır içermez). */
  env: Record<string, string>;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Repo kökü: apps/worker/src/handlers/explainer → beş üst klasör. */
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function listDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function missing(what: string): never {
  // Yetenek bildirilmiş ama araç yok: iş kuyruğa dönsün, başka makine alabilsin
  throw new TransientError(
    `${what} bu makinede bulunamadı. Denetim: pnpm worker:doctor`,
  );
}

export function resolveExplainerTools(
  host: HostContext = {
    platform: normalizePlatform(process.platform),
    home: os.homedir(),
    env: process.env,
  },
  repoRoot = REPO_ROOT,
): ExplainerTools {
  const venv = venvCandidates(host).find((dir) =>
    isFile(venvPython(dir, host.platform)),
  );
  if (!venv) missing('Film sanal ortamı');
  const locate = (tool: 'ffmpeg' | 'ffprobe') =>
    toolCandidates(tool, host, listDir).find(isFile) ?? missing(tool);
  const ffmpeg = locate('ffmpeg');
  const ffprobe = locate('ffprobe');
  const cli = path.join(
    hyperframesRuntime(host),
    'node_modules',
    'hyperframes',
    'bin',
    'hyperframes.mjs',
  );
  if (!isFile(cli)) missing('HyperFrames');

  const skills = path.join(repoRoot, '.claude', 'skills');
  const example = path.join(skills, 'anlatim-videosu', 'ornek', 'planor-stil');
  const scripts = {
    edgeTakes: path.join(skills, 'anlatim-videosu', 'scripts', 'edge_takes.py'),
    voice: path.join(skills, 'edit-video', 'scripts', 'voice.py'),
    timing: path.join(skills, 'anlatim-videosu', 'scripts', 'zaman_js.py'),
    sfxSync: path.join(skills, 'edit-video', 'scripts', 'sfx-sync.mjs'),
  };
  const assets = {
    engine: path.join(example, 'assets', 'bp.js'),
    fonts: path.join(example, 'assets', 'fonts'),
    template: path.join(HERE, 'template', 'sablon.js'),
    specPy: path.join(HERE, 'template', 'spec.py'),
  };
  for (const file of [
    ...Object.values(scripts),
    assets.engine,
    assets.template,
    assets.specPy,
  ])
    if (!isFile(file)) missing('Anlatım betikleri (repo eksik)');
  if (!existsSync(assets.fonts)) missing('Şablon yazı tipleri');

  // Betikler ffmpeg / ffprobe / node'u adıyla çağırır: bulunan yapılar PATH'in başına konur
  const pathKey =
    Object.keys(host.env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
  const delimiter = host.platform === 'win32' ? ';' : ':';
  const env: Record<string, string> = {
    [pathKey]: [
      ...new Set([
        path.dirname(ffmpeg),
        path.dirname(ffprobe),
        path.dirname(process.execPath),
      ]),
      host.env[pathKey] ?? '',
    ]
      .filter(Boolean)
      .join(delimiter),
    HYPERFRAMES_NO_TELEMETRY: '1',
    HYPERFRAMES_NO_UPDATE_CHECK: '1',
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONDONTWRITEBYTECODE: '1',
  };
  const browser = envGet(host, 'HYPERFRAMES_BROWSER_PATH');
  if (browser) env.HYPERFRAMES_BROWSER_PATH = browser;
  return {
    python: [venvPython(venv, host.platform)],
    node: [process.execPath],
    ffmpeg: [ffmpeg],
    ffprobe: [ffprobe],
    hyperframes: [process.execPath, cli],
    scripts,
    assets,
    env,
  };
}
