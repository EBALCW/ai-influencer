// Araç çıktılarından sürüm okuma ve karşılaştırma. Saf fonksiyonlar; süreç çalıştırmaz.

export type VersionTool =
  | 'node'
  | 'pnpm'
  | 'ffmpeg'
  | 'ffprobe'
  | 'yt-dlp'
  | 'blender'
  | 'python'
  | 'whisper-cli'
  | 'chrome';

const NUMERIC = /\d+(?:\.\d+)+/;

/**
 * Bir aracın `--version` çıktısından sürümü çıkarır. Tanınmayan çıktıda (ör. Windows'un
 * Microsoft Store'a yönlendiren sahte `python.exe`'si) null döner: araç "yok" sayılır.
 */
export function parseVersion(tool: VersionTool, output: string): string | null {
  const text = output.replace(/\r/g, '');
  switch (tool) {
    case 'node':
      return /^v(\d+\.\d+\.\d+)/m.exec(text)?.[1] ?? null;
    case 'pnpm':
      return /^(\d+\.\d+\.\d+\S*)\s*$/m.exec(text)?.[1] ?? null;
    case 'ffmpeg':
    case 'ffprobe': {
      const token = new RegExp(`^${tool} version (\\S+)`, 'm').exec(text)?.[1];
      if (!token) return null;
      // Sürümlü yapılar: "9.0.2", "7.1-full_build-www.gyan.dev", "n7.1", "6.1.1-3ubuntu5"
      const release = /^n?(\d+(?:\.\d+)+)/.exec(token)?.[1];
      if (release) return release;
      // Git yapıları: "2025-01-02-git-0457aaf0d3-full_build-www.gyan.dev", "N-118193-g5f38c82536"
      return token.replace(/-(full|essentials)_build.*$/, '');
    }
    case 'yt-dlp':
      return /^(\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)\s*$/m.exec(text)?.[1] ?? null;
    case 'blender':
      // Windows'ta sürüm satırından önce uyarı satırları gelebilir
      return /^Blender (\d+\.\d+(?:\.\d+)?)/m.exec(text)?.[1] ?? null;
    case 'python':
      return /^Python (\d+\.\d+(?:\.\d+)?)/m.exec(text)?.[1] ?? null;
    case 'whisper-cli':
      return /version:?\s*v?(\d+\.\d+(?:\.\d+)?)/i.exec(text)?.[1] ?? null;
    case 'chrome':
      return (
        /(?:Chrome|Chromium|HeadlessChrome)\D*(\d+(?:\.\d+){1,3})/.exec(
          text,
        )?.[1] ?? null
      );
  }
}

/** Klasör adından sürüm: "mac_arm-152.0.7977.30", "Blender 5.3", "131.0.6778.86". */
export function versionFromName(name: string): string | null {
  return NUMERIC.exec(name)?.[0] ?? null;
}

function segments(version: string): number[] {
  return (version.match(/\d+/g) ?? []).map(Number);
}

/** a < b ise negatif, eşitse 0, a > b ise pozitif. Eksik parça 0 sayılır ("5.3" = "5.3.0"). */
export function compareVersions(a: string, b: string): number {
  const left = segments(a);
  const right = segments(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Sürüm okunamadıysa (null) alt sınır sağlanmış sayılmaz. */
export function meetsMinimum(version: string | null, minimum: string): boolean {
  return version !== null && compareVersions(version, minimum) >= 0;
}

/** `package.json` → `engines.node` (">=24 <25") aralığını denetler; yalnız >=, <, <= ve > okur. */
export function satisfiesRange(version: string, range: string): boolean {
  return range
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => {
      const match = /^(>=|<=|>|<)?v?(\d+(?:\.\d+)*)$/.exec(part);
      if (!match) return false;
      const diff = compareVersions(version, match[2] ?? '0');
      switch (match[1]) {
        case '>=':
          return diff >= 0;
        case '<=':
          return diff <= 0;
        case '>':
          return diff > 0;
        case '<':
          return diff < 0;
        default:
          return segments(match[2] ?? '').every(
            (value, index) => segments(version)[index] === value,
          );
      }
    });
}

export interface PythonProbe {
  python: string;
  packages: Record<string, { ok: boolean; version: string | null }>;
}

/** Sanal ortamın python'ında çalışan yoklama betiği: sürüm + paketler gerçekten içe aktarılıyor mu. */
export const PYTHON_PROBE_SCRIPT = [
  'import importlib, json, sys',
  'import importlib.metadata as md',
  'out = {"python": "%d.%d.%d" % sys.version_info[:3], "packages": {}}',
  'for dist, mod in (("edge-tts", "edge_tts"), ("skia-python", "skia"), ("numpy", "numpy"), ("pillow", "PIL"), ("scipy", "scipy")):',
  '    try:',
  '        importlib.import_module(mod)',
  '        try:',
  '            version = md.version(dist)',
  '        except Exception:',
  '            version = None',
  '        out["packages"][dist] = {"ok": True, "version": version}',
  '    except Exception:',
  '        out["packages"][dist] = {"ok": False, "version": None}',
  'print("PROBE=" + json.dumps(out))',
].join('\n');

/** Yoklama çıktısını okur; paketler içe aktarılırken uyarı satırı basılsa da çalışır. */
export function parsePythonProbe(output: string): PythonProbe | null {
  const line = output
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith('PROBE='));
  if (!line) return null;
  try {
    const data = JSON.parse(
      line.slice('PROBE='.length),
    ) as Partial<PythonProbe>;
    if (typeof data.python !== 'string' || typeof data.packages !== 'object')
      return null;
    return { python: data.python, packages: data.packages ?? {} };
  } catch {
    return null;
  }
}
