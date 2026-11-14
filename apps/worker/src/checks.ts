// Bu makinedeki araçları yoklar ve denetim sonuçlarını üretir. Hiçbir şey kurmaz, değiştirmez.
import { existsSync, realpathSync, statfsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHECK_LABELS,
  OPTIONAL_CHECKS,
  type CheckId,
  type CheckResult,
  type CheckStatus,
} from './lib/capabilities.ts';
import { installHint, type HintContext } from './lib/hints.ts';
import {
  audioTaggerPaths,
  expandPattern,
  hyperframesRuntime,
  mpfbManifestPatterns,
  normalizePlatform,
  pathLookupCandidates,
  redactHome,
  toolCandidates,
  venvCandidates,
  venvPython,
  whisperModelPath,
  whisperVadPath,
  type HostContext,
  type LocatableTool,
} from './lib/locations.ts';
import {
  LOW_DISK_GB,
  parseGpuLines,
  parseLspciGpu,
  parseMacGpu,
  type SystemInfo,
} from './lib/report.ts';
import {
  PYTHON_PROBE_SCRIPT,
  meetsMinimum,
  parsePythonProbe,
  parseVersion,
  satisfiesRange,
  versionFromName,
  type VersionTool,
} from './lib/versions.ts';
import {
  fileSize,
  isDirectory,
  isFile,
  listDir,
  readJson,
  readText,
  run,
} from './probe.ts';

/** Akışlarımızın gerektirdiği alt sınırlar (kaynak: ilgili rehber ve requirements.txt). */
export const MINIMUM = {
  // .claude/skills/anlatim-videosu/blender/README.md: kit Blender 5.x ile yazıldı (motor adı BLENDER_EEVEE)
  blender: '5.0',
  // .claude/skills/cinematic-film/scripts/check_setup.py
  python: '3.9',
  // .claude/skills/anlatim-videosu/SKILL.md: stil yolu bu sürümle kuruldu ve denendi
  hyperframes: '0.8.32',
  // .claude/skills/cinematic-film/requirements.txt
  'py.skia': '87.6',
  'py.numpy': '1.24',
  'py.pillow': '10',
  'py.scipy': '1.10',
} as const;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

export function hostContext(): HostContext {
  return {
    platform: normalizePlatform(process.platform),
    home: os.homedir(),
    env: process.env,
  };
}

function result(
  id: CheckId,
  status: CheckStatus,
  fields: Partial<
    Pick<CheckResult, 'version' | 'path' | 'required' | 'detail'>
  > = {},
): CheckResult {
  return {
    id,
    label: CHECK_LABELS[id],
    status,
    version: fields.version ?? null,
    path: fields.path ?? null,
    required: fields.required ?? null,
    optional: OPTIONAL_CHECKS.includes(id),
    detail: fields.detail ?? null,
    hint: null,
  };
}

function existingCandidates(tool: LocatableTool, ctx: HostContext): string[] {
  const seen = new Set<string>();
  return toolCandidates(tool, ctx, listDir).filter((candidate) => {
    if (!isFile(candidate)) return false;
    let real = candidate;
    try {
      real = realpathSync(candidate);
    } catch {
      // okunamayan bağlantı: adayın kendisi denenir
    }
    if (seen.has(real)) return false;
    seen.add(real);
    return true;
  });
}

interface Found {
  path: string;
  version: string;
}

/** Adayları sırayla dener; sürümünü söyleyebilen ilk aday kazanır. */
async function firstWorking(
  tool: LocatableTool & VersionTool,
  ctx: HostContext,
  args: readonly string[],
  timeoutMs: number,
  extra: readonly string[] = [],
): Promise<Found | null> {
  const candidates = [
    ...existingCandidates(tool, ctx),
    ...extra.filter((candidate) => isFile(candidate)),
  ];
  for (const candidate of candidates) {
    const ran = await run(candidate, args, { timeoutMs });
    const version = parseVersion(tool, ran.output);
    if (version) return { path: candidate, version };
  }
  return null;
}

/** Bulunan yol PATH'te değilse not düşer: mevcut script'ler aracı adıyla (PATH'ten) çağırıyor. */
function offPathNote(
  tool: LocatableTool,
  found: string,
  ctx: HostContext,
): string | null {
  const onPath = pathLookupCandidates([tool], ctx).some(
    (candidate) => candidate.toLowerCase() === found.toLowerCase(),
  );
  return onPath ? null : "PATH'te değil";
}

async function checkNode(): Promise<CheckResult> {
  const pkg = readJson(path.join(repoRoot, 'package.json'));
  const engines = pkg?.engines as { node?: string } | undefined;
  const range = engines?.node ?? '>=24';
  const version = process.versions.node;
  return result('node', satisfiesRange(version, range) ? 'ok' : 'outdated', {
    version,
    path: process.execPath,
    required: range,
  });
}

async function checkPnpm(ctx: HostContext): Promise<CheckResult> {
  const pkg = readJson(path.join(repoRoot, 'package.json'));
  const wanted =
    typeof pkg?.packageManager === 'string'
      ? (pkg.packageManager.split('@')[1] ?? null)
      : null;
  const required = wanted ? `>=${wanted}` : null;
  // `pnpm worker:doctor` ile çalışırken pnpm kendini ortam değişkeniyle bildirir
  const agent = /pnpm\/(\d+\.\d+\.\d+)/.exec(
    process.env.npm_config_user_agent ?? '',
  )?.[1];
  const found = agent
    ? { version: agent, path: process.env.npm_execpath ?? null }
    : await firstWorking('pnpm', ctx, ['--version'], 20_000);
  if (!found) return result('pnpm', 'missing', { required });
  return result(
    'pnpm',
    !wanted || meetsMinimum(found.version, wanted) ? 'ok' : 'outdated',
    { version: found.version, path: found.path, required },
  );
}

async function checkFfmpeg(ctx: HostContext): Promise<CheckResult[]> {
  const builds: (Found & { subtitles: boolean; libx264: boolean })[] = [];
  for (const candidate of existingCandidates('ffmpeg', ctx)) {
    const ran = await run(candidate, ['-hide_banner', '-version']);
    const version = parseVersion('ffmpeg', ran.output);
    if (!version) continue;
    const [filters, encoders] = await Promise.all([
      run(candidate, ['-hide_banner', '-filters']),
      run(candidate, ['-hide_banner', '-encoders']),
    ]);
    builds.push({
      path: candidate,
      version,
      // scripts/clip/clip.mjs → pickFfmpeg ile aynı ölçüt
      subtitles: /^\s*\S+\s+subtitles\s/m.test(filters.output),
      libx264: /^\s*\S+\s+libx264\s/m.test(encoders.output),
    });
  }

  const primary = builds[0];
  const captions =
    builds.find((build) => build.subtitles && build.libx264) ??
    builds.find((build) => build.subtitles);

  const ffprobe = await firstWorking(
    'ffprobe',
    ctx,
    ['-hide_banner', '-version'],
    10_000,
    builds.map((build) =>
      path.join(
        path.dirname(build.path),
        ctx.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe',
      ),
    ),
  );

  return [
    primary
      ? result('ffmpeg', 'ok', {
          version: primary.version,
          path: primary.path,
          detail: offPathNote('ffmpeg', primary.path, ctx),
        })
      : result('ffmpeg', 'missing'),
    ffprobe
      ? result('ffprobe', 'ok', {
          version: ffprobe.version,
          path: ffprobe.path,
          detail: offPathNote('ffprobe', ffprobe.path, ctx),
        })
      : result('ffprobe', 'missing'),
    primary?.libx264
      ? result('ffmpeg.libx264', 'ok', { path: primary.path })
      : result('ffmpeg.libx264', 'missing', {
          detail: primary
            ? 'bu ffmpeg yapısında libx264 kodlayıcısı yok'
            : null,
        }),
    captions?.libx264
      ? result('ffmpeg.subtitles', 'ok', {
          version: captions.version,
          path: captions.path,
          detail:
            captions.path === primary?.path
              ? null
              : "PATH'teki ffmpeg altyazı gömemiyor; bu yapı kullanılır",
        })
      : result('ffmpeg.subtitles', 'missing', {
          detail: captions
            ? 'subtitles filtresi var ama aynı yapıda libx264 yok'
            : primary
              ? 'bulunan ffmpeg yapılarında subtitles filtresi (libass) yok'
              : null,
        }),
  ];
}

async function checkYtDlp(ctx: HostContext): Promise<CheckResult> {
  // Windows'ta tek dosyalık yt-dlp.exe ilk çalıştırmada kendini açar: süre sınırı geniş
  const found = await firstWorking('yt-dlp', ctx, ['--version'], 30_000);
  return found
    ? result('yt-dlp', 'ok', {
        ...found,
        detail: offPathNote('yt-dlp', found.path, ctx),
      })
    : result('yt-dlp', 'missing');
}

async function checkBlender(ctx: HostContext): Promise<CheckResult[]> {
  const required = `>=${MINIMUM.blender}`;
  const found = await firstWorking('blender', ctx, ['--version'], 40_000);
  const blender = found
    ? result(
        'blender',
        meetsMinimum(found.version, MINIMUM.blender) ? 'ok' : 'outdated',
        { ...found, required },
      )
    : result('blender', 'missing', { required });

  const manifest = mpfbManifestPatterns(ctx)
    .flatMap((pattern) => expandPattern(pattern, ctx.platform, listDir))
    .find((file) => isFile(file));
  const mpfb = manifest
    ? result('blender.mpfb', 'ok', {
        version:
          /^version\s*=\s*"([^"]+)"/m.exec(readText(manifest) ?? '')?.[1] ??
          null,
        path: path.dirname(manifest),
      })
    : result('blender.mpfb', 'missing');
  return [blender, mpfb];
}

async function chromeVersion(
  file: string,
  ctx: HostContext,
): Promise<string | null> {
  // HyperFrames'in indirdiği başsız Chrome: sürüm klasör adında ("mac_arm-152.0.7977.30")
  if (/chrome-headless-shell/i.test(file))
    return versionFromName(path.basename(path.dirname(path.dirname(file))));
  // Windows'ta chrome.exe --version sürüm yazmaz, pencere açar: sürüm yandaki klasör adından okunur
  if (ctx.platform === 'win32')
    return (
      listDir(path.dirname(file))
        .filter((name) => /^\d+(\.\d+){3}$/.test(name))
        .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))[0] ?? null
    );
  const ran = await run(file, ['--version'], { timeoutMs: 15_000 });
  return parseVersion('chrome', ran.output);
}

async function checkChrome(ctx: HostContext): Promise<CheckResult> {
  for (const candidate of existingCandidates('chrome', ctx)) {
    const version = await chromeVersion(candidate, ctx);
    // Windows'ta dosyanın varlığı yeter; diğerlerinde sürüm söyleyemeyen aday geçilir
    if (version || ctx.platform === 'win32')
      return result('chrome', 'ok', { version, path: candidate });
  }
  return result('chrome', 'missing');
}

async function checkHyperframes(ctx: HostContext): Promise<CheckResult> {
  const required = `>=${MINIMUM.hyperframes}`;
  const runtime = hyperframesRuntime(ctx);
  const modules = path.join(runtime, 'node_modules');
  const pkg = readJson(path.join(modules, 'hyperframes', 'package.json'));
  const binary = ['hyperframes', 'hyperframes.cmd']
    .map((name) => path.join(modules, '.bin', name))
    .find((file) => existsSync(file));
  const version = typeof pkg?.version === 'string' ? pkg.version : null;
  if (!version || !binary)
    return result('hyperframes', 'missing', {
      required,
      detail: isDirectory(runtime)
        ? 'çalışma zamanı klasörü var ama paket eksik'
        : null,
    });
  return result(
    'hyperframes',
    meetsMinimum(version, MINIMUM.hyperframes) ? 'ok' : 'outdated',
    {
      version,
      path: runtime,
      required,
      detail: existsSync(path.join(modules, 'gsap', 'package.json'))
        ? null
        : 'GSAP kurulu değil (bazı stiller ister)',
    },
  );
}

const PY_PACKAGES = [
  ['py.edge-tts', 'edge-tts', null],
  ['py.skia', 'skia-python', MINIMUM['py.skia']],
  ['py.numpy', 'numpy', MINIMUM['py.numpy']],
  ['py.pillow', 'pillow', MINIMUM['py.pillow']],
  ['py.scipy', 'scipy', MINIMUM['py.scipy']],
] as const;

async function checkPython(ctx: HostContext): Promise<CheckResult[]> {
  const required = `>=${MINIMUM.python}`;
  const candidates = venvCandidates(ctx);
  const venvDir =
    candidates.find((dir) => isFile(venvPython(dir, ctx.platform))) ?? null;
  const probe = venvDir
    ? parsePythonProbe(
        (
          await run(
            venvPython(venvDir, ctx.platform),
            ['-I', '-c', PYTHON_PROBE_SCRIPT],
            // skia ve scipy ilk içe aktarmada yavaş olabilir
            { timeoutMs: 60_000, env: { PYTHONIOENCODING: 'utf-8' } },
          )
        ).output,
      )
    : null;

  const venvOk = probe !== null && meetsMinimum(probe.python, MINIMUM.python);
  const venv = !venvDir
    ? result('venv', 'missing', { required })
    : !probe
      ? result('venv', 'missing', {
          path: venvDir,
          required,
          detail: 'klasör var ama python çalışmıyor; ortamı yeniden kur',
        })
      : result('venv', venvOk ? 'ok' : 'outdated', {
          version: probe.python,
          path: venvDir,
          required,
        });

  const packages = PY_PACKAGES.map(([id, dist, minimum]) => {
    const info = probe?.packages[dist];
    const packageRequired = minimum ? `>=${minimum}` : null;
    if (!info?.ok)
      return result(id, 'missing', {
        required: packageRequired,
        detail: probe ? null : 'sanal ortam yok',
      });
    return result(
      id,
      !minimum || !info.version || meetsMinimum(info.version, minimum)
        ? 'ok'
        : 'outdated',
      { version: info.version, required: packageRequired },
    );
  });

  // Sistem Python'ı yalnız sanal ortamı kurmak için gerekir
  const extra =
    ctx.platform === 'win32' ? pathLookupCandidates(['py'], ctx) : [];
  const system = await firstWorking(
    'python',
    ctx,
    ['--version'],
    15_000,
    extra,
  );
  const python = system
    ? result(
        'python',
        meetsMinimum(system.version, MINIMUM.python) ? 'ok' : 'outdated',
        { ...system, required },
      )
    : result('python', 'missing', { required });
  python.optional = venvOk;
  python.detail = 'yalnız sanal ortamı kurmak için';

  return [python, venv, ...packages];
}

async function checkWhisper(ctx: HostContext): Promise<CheckResult[]> {
  let cli = result('whisper-cli', 'missing');
  for (const candidate of existingCandidates('whisper-cli', ctx)) {
    const versionRun = await run(candidate, ['--version']);
    const version = parseVersion('whisper-cli', versionRun.output);
    // Eski sürümlerde --version yok; --help çalışıyorsa araç vardır (clip.mjs de böyle bakar)
    if (!version && !(await run(candidate, ['--help'])).ok) continue;
    cli = result('whisper-cli', 'ok', {
      version,
      path: candidate,
      detail: offPathNote('whisper-cli', candidate, ctx),
    });
    break;
  }

  const megabytes = (bytes: number) => `${Math.round(bytes / 1_048_576)} MB`;
  const modelFile = whisperModelPath(ctx);
  const modelSize = fileSize(modelFile);
  // Yarım inen model dosyası birkaç KB kalır: 1 MB altı model sayılmaz
  const model =
    modelSize !== null && modelSize > 1_048_576
      ? result('whisper.model', 'ok', {
          path: modelFile,
          detail: megabytes(modelSize),
        })
      : result('whisper.model', 'missing', {
          detail:
            modelSize !== null ? 'dosya var ama eksik inmiş görünüyor' : null,
        });

  const vadFile = whisperVadPath(ctx);
  const vadSize = fileSize(vadFile);
  const vad =
    vadSize !== null && vadSize > 100_000
      ? result('whisper.vad', 'ok', { path: vadFile })
      : result('whisper.vad', 'missing');
  return [cli, model, vad];
}

async function checkAudioTagger(ctx: HostContext): Promise<CheckResult> {
  const { packageDir, model } = audioTaggerPaths(ctx);
  const pkg = readJson(
    path.join(packageDir, 'node_modules', 'sherpa-onnx-node', 'package.json'),
  );
  const hasPackage =
    existsSync(path.join(packageDir, 'package.json')) && pkg !== null;
  const hasModel = isFile(model);
  if (hasPackage && hasModel)
    return result('audio-tagger', 'ok', {
      version: typeof pkg?.version === 'string' ? pkg.version : null,
      path: packageDir,
    });
  return result('audio-tagger', 'missing', {
    detail:
      hasPackage || hasModel
        ? `${hasPackage ? 'model dosyası' : 'sherpa-onnx-node paketi'} eksik`
        : null,
  });
}

function nearestExistingDir(dir: string): string {
  let current = dir;
  while (!isDirectory(current)) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

async function gpuNames(ctx: HostContext): Promise<string[]> {
  if (ctx.platform === 'darwin')
    return parseMacGpu(
      (await run('/usr/sbin/system_profiler', ['SPDisplaysDataType', '-json']))
        .output,
    );
  if (ctx.platform === 'win32')
    return parseGpuLines(
      (
        await run(
          path.join(
            process.env.SystemRoot ?? 'C:\\Windows',
            'System32',
            'WindowsPowerShell',
            'v1.0',
            'powershell.exe',
          ),
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            'Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }',
          ],
          { timeoutMs: 20_000 },
        )
      ).output,
    );
  const nvidia = await run('nvidia-smi', [
    '--query-gpu=name',
    '--format=csv,noheader',
  ]);
  if (nvidia.ok) return parseGpuLines(nvidia.output);
  const lspci = await run('lspci', []);
  return lspci.ok ? parseLspciGpu(lspci.output) : [];
}

export async function collectSystem(ctx: HostContext): Promise<SystemInfo> {
  let diskFreeGb: number | null = null;
  try {
    // Film ve klip dosyalarının yazıldığı birim (klasör henüz yoksa en yakın üst klasör)
    const stat = statfsSync(
      nearestExistingDir(path.dirname(path.dirname(hyperframesRuntime(ctx)))),
    );
    diskFreeGb = Math.round((stat.bavail * stat.bsize) / 1e9);
  } catch {
    // bazı dosya sistemlerinde statfs yok: bilinmiyor olarak kalır
  }
  const cpus = os.cpus();
  return {
    platform: ctx.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpu: cpus[0]?.model.trim() ?? null,
    cores: cpus.length,
    memoryGb: Math.round(os.totalmem() / 1_073_741_824),
    gpu: await gpuNames(ctx),
    diskFreeGb,
    diskLow: diskFreeGb !== null && diskFreeGb < LOW_DISK_GB,
  };
}

export function hintContext(ctx: HostContext): HintContext {
  const venvDir =
    venvCandidates(ctx).find((dir) => isDirectory(dir)) ??
    venvCandidates(ctx)[0] ??
    '';
  // Yönergeler kopyalanıp çalıştırılır: tırnak içinde de açılan `$HOME` yazılır
  // (bash, zsh ve PowerShell'de aynı), `~` tırnak içinde açılmaz.
  const portable = (file: string) =>
    redactHome(file, ctx.home, ctx.platform, '$HOME');
  return {
    venvDir: portable(venvDir),
    venvPython: portable(venvPython(venvDir, ctx.platform)),
    filmWorkspace: portable(
      path.dirname(path.dirname(hyperframesRuntime(ctx))),
    ),
    whisperModel: portable(whisperModelPath(ctx)),
    whisperVad: portable(whisperVadPath(ctx)),
  };
}

/** Tüm denetimleri çalıştırır; sıra `CHECK_IDS` ile aynıdır. Bir denetim patlarsa "eksik" sayılır. */
export async function collectChecks(ctx: HostContext): Promise<CheckResult[]> {
  const safe = async (
    ids: readonly CheckId[],
    work: () => Promise<CheckResult | CheckResult[]>,
  ): Promise<CheckResult[]> => {
    try {
      return [await work()].flat();
    } catch {
      return ids.map((id) =>
        result(id, 'missing', { detail: 'denetim çalıştırılamadı' }),
      );
    }
  };
  const groups = await Promise.all([
    safe(['node'], () => checkNode()),
    safe(['pnpm'], () => checkPnpm(ctx)),
    safe(['ffmpeg', 'ffprobe', 'ffmpeg.libx264', 'ffmpeg.subtitles'], () =>
      checkFfmpeg(ctx),
    ),
    safe(['yt-dlp'], () => checkYtDlp(ctx)),
    safe(['blender', 'blender.mpfb'], () => checkBlender(ctx)),
    safe(['chrome'], () => checkChrome(ctx)),
    safe(['hyperframes'], () => checkHyperframes(ctx)),
    safe(
      [
        'python',
        'venv',
        'py.edge-tts',
        'py.skia',
        'py.numpy',
        'py.pillow',
        'py.scipy',
      ],
      () => checkPython(ctx),
    ),
    safe(['whisper-cli', 'whisper.model', 'whisper.vad'], () =>
      checkWhisper(ctx),
    ),
    safe(['audio-tagger'], () => checkAudioTagger(ctx)),
  ]);
  const hints = hintContext(ctx);
  return groups.flat().map((check) => ({
    ...check,
    hint:
      check.status === 'ok' ? null : installHint(check.id, ctx.platform, hints),
  }));
}
