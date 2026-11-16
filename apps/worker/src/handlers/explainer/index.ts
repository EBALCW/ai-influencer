// `explainer.render` işleyicileri (#219 ses + altyazı, #220 HyperFrames stil yolu):
//   voice     onaylı senaryo → vuruşlar → edge-tts kayıtları + kelime zamanları → kilitli ses
//   captions  kelime zamanları → altyazı parçaları (SRT + ASS; kompozisyon aynı veriyi kullanır)
//   visuals   veriye dayalı Blueprint şablonu → HyperFrames çalışma klasörü, lint, önizleme kareleri
//   render    HyperFrames render → ses miksi + mux → denetim → yükleme sınırına sığdırma → çıktı
// Var olan, çalıştığı görülmüş betikler sarılır, yeniden yazılmaz (anlatim-videosu/SKILL.md §8).
//
// Güvenlik: senaryo ve kaynak notları veridir. Komutlara yalnız sabit argümanlar ve dosya yolları
// gider (kabuk yok); metin dosyaya JSON olarak yazılır, hiçbir zaman koda ya da HTML'e katılmaz.
//
// Aşamalar birbirinin dosyalarına dayanır ama iş başka bir denemede ortadan başlayabilir (iş
// kuyruğa dönünce çalışma klasörü silinir). Bu yüzden her adım kendinden öncekini "yoksa üret"
// diye çağırır; adımlar aynı girdide aynı dosyaları verir.
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
  AbortedError,
  PermanentError,
  TransientError,
} from '../../lib/errors.ts';
import {
  defineJobKind,
  type AnyJobKind,
  type StageContext,
  type StageOutput,
} from '../../lib/registry.ts';
import {
  captionCues,
  parseTimingJs,
  toAss,
  toSrt,
  type TimingData,
} from './captions.ts';
import {
  FPS,
  buildCues,
  compositionSpec,
  cuesJson,
  indexHtml,
  snapshotTimes,
  specJs,
  specJson,
  totalSeconds,
  type Timing,
} from './composition.ts';
import {
  finalProblems,
  fitVideoKbps,
  parseBlackSeconds,
  parseLoudness,
  parseProbe,
} from './media.ts';
import {
  buildPlan,
  jobParamsSchema,
  scriptVersionSchema,
  type JobParams,
  type ProductionPlan,
  type VoiceProviderKey,
} from './script.ts';
import { resolveExplainerTools, type ExplainerTools } from './tools.ts';

type Context = StageContext<JobParams>;

interface Run {
  context: Context;
  tools: ExplainerTools;
  plan: ProductionPlan;
  /** HyperFrames çalışma klasörü: `<iş klasörü>/reel` (repo dışında). */
  reel: string;
}

const MINUTE = 60_000;
/** Bu sürümde üretilebilen görsel yol. */
export const SUPPORTED_ROUTE = 'hyperframes';
/** Hata sonrası saklanan tanılama klasörlerinin sayısı ve boyut sınırları. */
const KEEP_FAILURES = 5;
const KEEP_FILE_BYTES = 2 * 1024 * 1024;
const KEEP_TOTAL_BYTES = 20 * 1024 * 1024;

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function tail(text: string, max = 600): string {
  const clean = text.replace(/\u001b\[[0-9;]*m/g, '').trim();
  return clean.length > max ? `…${clean.slice(-max)}` : clean;
}

/**
 * Alt süreç çalıştırır ve sonucu hataya çevirir. Hata metni sabittir (aracın çıktısı senaryo
 * metni içerebilir; yalnız bu makinenin günlüğüne yazılır, veritabanına gitmez).
 */
async function runTool(
  run: Run,
  label: string,
  command: readonly string[],
  args: readonly string[],
  options: { timeoutMs: number; onFail: 'transient' | 'permanent' },
) {
  const [file, ...prefix] = command;
  if (!file) throw new PermanentError(`${label}: komut tanımlı değil.`);
  const outcome = await run.context.run(file, [...prefix, ...args], {
    timeoutMs: options.timeoutMs,
    env: run.tools.env,
    maxOutputBytes: 400_000,
  });
  if (outcome.aborted) throw new AbortedError('İş durduruldu.');
  if (outcome.timedOut)
    throw new TransientError(`${label} süre sınırını aştı.`);
  if (outcome.code !== 0) {
    run.context.log.warn(`${label} başarısız.`, {
      kod: outcome.code,
      cikti: tail(outcome.stderr || outcome.stdout),
    });
    const message = `${label} başarısız oldu (çıkış kodu ${outcome.code ?? 'yok'}).`;
    throw options.onFail === 'permanent'
      ? new PermanentError(message)
      : new TransientError(message);
  }
  return outcome;
}

async function start(
  context: Context,
  getTools: () => ExplainerTools,
): Promise<Run> {
  const version = scriptVersionSchema.safeParse(await context.loadScript());
  if (!version.success)
    throw new PermanentError(
      `Senaryo sürümü beklenen biçimde değil: ${version.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.') || '(kök)'}: ${issue.code}`)
        .join('; ')}`,
    );
  const plan = buildPlan(context.params, version.data);
  const reel = path.join(context.workDir, 'reel');
  await mkdir(reel, { recursive: true });
  return { context, tools: getTools(), plan, reel };
}

function requireRoute(context: Context): void {
  if (context.params.visual_route !== SUPPORTED_ROUTE)
    throw new PermanentError(
      'Bu makine sürümü yalnız "Stil paketi (HyperFrames)" yolunu üretir; bölümün görsel yolunu değiştirin.',
    );
}

async function readTiming(run: Run): Promise<Timing> {
  let data: Partial<Timing>;
  try {
    data = JSON.parse(
      await readFile(path.join(run.reel, 'voice', 'timing.json'), 'utf8'),
    ) as Partial<Timing>;
  } catch {
    throw new TransientError('Ses zamanlaması okunamadı.');
  }
  if (
    typeof data.duration !== 'number' ||
    !(data.duration > 0) ||
    !Array.isArray(data.lines) ||
    data.lines.length !== run.plan.beats.length
  )
    throw new PermanentError('Ses zamanlaması senaryoyla uyuşmuyor.');
  return data as Timing;
}

/**
 * Ses sağlayıcı arayüzü. Sağlayıcı, `spec.json`'daki her satır için `voice/takes/NN.<mp3|wav|m4a>`
 * kaydını ve yanında kelime zamanlarını (`NN.words.json`: `[{ text, start, end }]`, kaydın kendi
 * zamanında) üretir. Kayıtların tek seste birleştirilmesi (`voice.py --engine files`), altyazı ve
 * görsel bu sözleşmeye dayanır; yeni sağlayıcı yalnız `record` yazar.
 */
interface VoiceProvider {
  record(run: Run): Promise<void>;
}

const VOICE_PROVIDERS: Record<VoiceProviderKey, VoiceProvider> = {
  // Microsoft'un ücretsiz servisi: ağ gerekir, hata geçici sayılır. Ses adı ve hız spec.json'dadır.
  'edge-tts': {
    async record(run) {
      await runTool(
        run,
        'Seslendirme (edge-tts)',
        run.tools.python,
        [run.tools.scripts.edgeTakes, run.reel],
        { timeoutMs: 8 * MINUTE, onFail: 'transient' },
      );
    },
  },
};

// ── Adımlar (her biri öncekini "yoksa üret" diye çağırır) ────────────────────

async function stepVoice(run: Run): Promise<Timing> {
  const { reel, tools, context } = run;
  const marker = path.join(reel, 'voice', '.tamam');
  if (await exists(marker)) return readTiming(run);
  await writeFile(path.join(reel, 'spec.json'), specJson(run.plan), 'utf8');
  await cp(tools.assets.specPy, path.join(reel, 'spec.py'));
  context.progress(5, 'Seslendirme: satırlar kaydediliyor');
  await VOICE_PROVIDERS[run.plan.voiceProvider].record(run);
  context.progress(60, 'Seslendirme: ses kilitleniyor');
  await runTool(
    run,
    'Ses birleştirme',
    tools.python,
    [tools.scripts.voice, reel, '--engine', 'files'],
    {
      timeoutMs: 5 * MINUTE,
      onFail: 'transient',
    },
  );
  const timing = await readTiming(run);
  await mkdir(path.join(reel, 'out'), { recursive: true });
  await runTool(
    run,
    'Ses kodlama',
    tools.ffmpeg,
    [
      '-v',
      'error',
      '-y',
      '-i',
      path.join(reel, 'voice', 'vo.wav'),
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      path.join(reel, 'out', 'narration.m4a'),
    ],
    { timeoutMs: 2 * MINUTE, onFail: 'transient' },
  );
  await writeFile(marker, '', 'utf8');
  return timing;
}

async function stepCaptions(run: Run): Promise<TimingData> {
  const { reel, tools, context } = run;
  const marker = path.join(reel, 'out', '.altyazi-tamam');
  const timingJs = path.join(reel, 'assets', 'timing.js');
  if (!(await exists(marker))) {
    await stepVoice(run);
    context.progress(30, 'Altyazı: parçalar zamanlanıyor');
    // Kelime sayısı uyuşmazlığı girdiye bağlıdır: yeniden denemek sonucu değiştirmez
    await runTool(
      run,
      'Altyazı zamanlama',
      tools.python,
      [tools.scripts.timing, reel],
      {
        timeoutMs: 2 * MINUTE,
        onFail: 'permanent',
      },
    );
    const data = parseTimingJs(await readFile(timingJs, 'utf8'));
    const cues = captionCues(data);
    await writeFile(
      path.join(reel, 'out', 'captions.srt'),
      toSrt(cues, run.plan.captionMode),
      'utf8',
    );
    await writeFile(
      path.join(reel, 'out', 'captions.ass'),
      toAss(cues, run.plan.captionMode),
      'utf8',
    );
    await writeFile(marker, '', 'utf8');
  }
  return parseTimingJs(await readFile(timingJs, 'utf8'));
}

async function stepComposition(
  run: Run,
): Promise<{ timing: TimingData; total: number }> {
  const { reel, tools, context } = run;
  const timing = await stepCaptions(run);
  const total = totalSeconds(run.plan, timing);
  const marker = path.join(reel, '.kompozisyon-tamam');
  if (await exists(marker)) return { timing, total };
  context.progress(20, 'Görseller: şablon kuruluyor');
  const assets = path.join(reel, 'assets');
  await mkdir(assets, { recursive: true });
  await cp(tools.assets.engine, path.join(assets, 'bp.js'));
  await cp(tools.assets.template, path.join(assets, 'sablon.js'));
  await cp(tools.assets.fonts, path.join(assets, 'fonts'), { recursive: true });
  await writeFile(
    path.join(assets, 'spec.js'),
    specJs(compositionSpec(run.plan, timing)),
    'utf8',
  );
  await writeFile(path.join(reel, 'index.html'), indexHtml(total), 'utf8');
  await writeFile(
    path.join(reel, 'cues.json'),
    cuesJson(buildCues(run.plan, timing), total),
    'utf8',
  );
  context.progress(35, 'Görseller: kompozisyon denetleniyor (lint)');
  await runTool(
    run,
    'Kompozisyon denetimi (lint)',
    tools.hyperframes,
    ['lint', reel],
    {
      timeoutMs: 3 * MINUTE,
      onFail: 'permanent',
    },
  );
  await writeFile(marker, '', 'utf8');
  return { timing, total };
}

async function stepSnapshots(
  run: Run,
  timing: TimingData,
  total: number,
): Promise<{ file: string; at: number }[]> {
  const { reel, tools, context } = run;
  const times = snapshotTimes(timing, total);
  const dir = path.join(reel, 'snapshots');
  await rm(dir, { recursive: true, force: true });
  context.progress(50, 'Görseller: önizleme kareleri alınıyor');
  await runTool(
    run,
    'Önizleme karesi',
    tools.hyperframes,
    [
      'snapshot',
      reel,
      '--describe',
      'false',
      '--no-end',
      '--at',
      times.join(','),
      '--output',
      dir,
    ],
    { timeoutMs: 6 * MINUTE, onFail: 'transient' },
  );
  const frames = (await readdir(dir))
    .filter((name) => /^frame-.*\.png$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (frames.length === 0)
    throw new TransientError('Önizleme karesi üretilemedi.');
  const out: { file: string; at: number }[] = [];
  for (const [index, name] of frames.entries()) {
    // İncelemeye yetecek boyut: 540×960 JPEG (yükleme sınırının çok altında)
    const file = path.join(
      dir,
      `onizleme-${String(index + 1).padStart(2, '0')}.jpg`,
    );
    await runTool(
      run,
      'Önizleme küçültme',
      tools.ffmpeg,
      [
        '-v',
        'error',
        '-y',
        '-i',
        path.join(dir, name),
        '-vf',
        'scale=540:-2',
        '-q:v',
        '4',
        file,
      ],
      { timeoutMs: MINUTE, onFail: 'transient' },
    );
    out.push({ file, at: times[index] ?? 0 });
    context.progress(
      60 + (35 * (index + 1)) / frames.length,
      'Görseller: kareler hazırlanıyor',
    );
  }
  return out;
}

interface Final {
  file: string;
  bytes: number;
  seconds: number;
  lufs: number | null;
  reencoded: boolean;
}

async function stepRender(run: Run): Promise<Final> {
  const { reel, tools, context } = run;
  const { total } = await stepComposition(run);
  const silent = path.join(reel, 'previews', 'video.mp4');
  const mix = path.join(reel, 'out', 'mix.wav');
  const muxed = path.join(reel, 'out', 'muxed.mp4');
  const final = path.join(reel, 'out', 'final.mp4');
  await mkdir(path.dirname(silent), { recursive: true });

  context.progress(10, 'Render: kareler çiziliyor (HyperFrames)');
  await runTool(
    run,
    'Render (HyperFrames)',
    tools.hyperframes,
    [
      'render',
      reel,
      '--fps',
      String(FPS),
      '--quality',
      'high',
      '--workers',
      '4',
      '--output',
      silent,
    ],
    { timeoutMs: 45 * MINUTE, onFail: 'transient' },
  );
  if (!(await exists(silent)))
    throw new TransientError('Render çıktı dosyası oluşmadı.');

  context.progress(70, 'Render: ses miksi ve birleştirme');
  await runTool(
    run,
    'Ses miksi',
    tools.node,
    [
      tools.scripts.sfxSync,
      'mix',
      path.join(reel, 'cues.json'),
      '--voice',
      path.join(reel, 'voice', 'vo.wav'),
      '--out',
      mix,
      '--seconds',
      String(total),
      '--video',
      silent,
      '--mux',
      muxed,
    ],
    { timeoutMs: 10 * MINUTE, onFail: 'transient' },
  );

  // Yükleme sınırına sığdır (büyük dosya yüklemesi #215'te)
  context.progress(82, 'Render: çıktı hazırlanıyor');
  const limit = context.maxUploadBytes - 64 * 1024;
  let reencoded = false;
  if ((await stat(muxed)).size <= limit) await cp(muxed, final);
  else {
    reencoded = true;
    const first = fitVideoKbps(limit, total);
    if (first === null)
      throw new PermanentError(
        'Video bu sürümün yükleme sınırına okunur kalitede sığmıyor; senaryoyu kısaltın.',
      );
    for (const kbps of [first, Math.floor(first * 0.82)]) {
      await runTool(
        run,
        'Yeniden kodlama',
        tools.ffmpeg,
        [
          '-v',
          'error',
          '-y',
          '-i',
          muxed,
          '-c:v',
          'libx264',
          '-preset',
          'slow',
          '-b:v',
          `${kbps}k`,
          '-maxrate',
          `${Math.floor(kbps * 1.6)}k`,
          '-bufsize',
          `${kbps * 2}k`,
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          final,
        ],
        { timeoutMs: 20 * MINUTE, onFail: 'transient' },
      );
      if ((await stat(final)).size <= limit) break;
    }
    if ((await stat(final)).size > limit)
      throw new PermanentError(
        'Video yükleme sınırına sığdırılamadı; senaryoyu kısaltın.',
      );
  }

  context.progress(92, 'Render: bitmiş video denetleniyor');
  const probe = await runTool(
    run,
    'Video denetimi (ffprobe)',
    tools.ffprobe,
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      final,
    ],
    { timeoutMs: 2 * MINUTE, onFail: 'transient' },
  );
  const loud = await runTool(
    run,
    'Ses yüksekliği ölçümü',
    tools.ffmpeg,
    [
      '-hide_banner',
      '-nostats',
      '-i',
      final,
      '-map',
      '0:a:0',
      '-af',
      'ebur128',
      '-f',
      'null',
      '-',
    ],
    { timeoutMs: 5 * MINUTE, onFail: 'transient' },
  );
  const black = await runTool(
    run,
    'Siyah kare denetimi',
    tools.ffmpeg,
    [
      '-hide_banner',
      '-nostats',
      '-i',
      final,
      '-map',
      '0:v:0',
      '-vf',
      'blackdetect=d=0.4:pix_th=0.08',
      '-an',
      '-f',
      'null',
      '-',
    ],
    { timeoutMs: 10 * MINUTE, onFail: 'transient' },
  );
  const lufs = parseLoudness(loud.stderr);
  const problems = finalProblems({
    probe: parseProbe(probe.stdout),
    expectedSeconds: total,
    lufs,
    blackSeconds: parseBlackSeconds(black.stderr),
  });
  if (problems.length > 0)
    throw new PermanentError(
      `Bitmiş video denetimden geçmedi: ${problems.join('; ')}.`,
    );
  return {
    file: final,
    bytes: (await stat(final)).size,
    seconds: total,
    lufs,
    reencoded,
  };
}

// ── Hata sonrası tanılama ────────────────────────────────────────────────────

/**
 * Hata olunca çalışma klasörünün küçük dosyalarını (plan, zamanlama, kompozisyon, altyazı)
 * `<çalışma kökü>/_hatali/<iş>/` altına kopyalar; video ve ses kopyalanmaz. Son birkaç iş saklanır.
 * Asıl iş klasörünü yürütücü siler.
 */
async function keepFailure(context: Context): Promise<void> {
  try {
    const root = path.join(path.dirname(context.workDir), '_hatali');
    const target = path.join(root, context.jobId);
    await rm(target, { recursive: true, force: true });
    let total = 0;
    const walk = async (dir: string, relative: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const from = path.join(dir, entry.name);
        const rel = path.join(relative, entry.name);
        if (entry.isDirectory()) {
          if (
            ![
              'fonts',
              'takes',
              'snapshots',
              'previews',
              'node_modules',
            ].includes(entry.name)
          )
            await walk(from, rel);
        } else if (
          entry.isFile() &&
          /\.(json|js|html|srt|ass|py|txt)$/i.test(entry.name)
        ) {
          const size = (await stat(from)).size;
          if (size > KEEP_FILE_BYTES || total + size > KEEP_TOTAL_BYTES)
            continue;
          total += size;
          await mkdir(path.dirname(path.join(target, rel)), {
            recursive: true,
          });
          await cp(from, path.join(target, rel));
        }
      }
    };
    await walk(context.workDir, '');
    const kept = await Promise.all(
      (await readdir(root)).map(async (name) => ({
        name,
        time: (await stat(path.join(root, name))).mtimeMs,
      })),
    );
    for (const old of kept.sort((a, b) => b.time - a.time).slice(KEEP_FAILURES))
      await rm(path.join(root, old.name), { recursive: true, force: true });
    context.log.info('Hata tanılama dosyaları saklandı.', { klasor: target });
  } catch {
    // tanılama en iyi çabadır: asıl hatayı gölgelemez
  }
}

function guarded(
  handler: (context: Context) => Promise<StageOutput>,
): (context: Context) => Promise<StageOutput> {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      if (!(error instanceof AbortedError) && !context.signal.aborted)
        await keepFailure(context);
      throw error;
    }
  };
}

async function attachFile(
  context: Context,
  file: string,
  fileName: string,
  contentType: string,
  role: Parameters<Context['attach']>[0]['role'],
): Promise<number> {
  const body = await readFile(file);
  if (body.byteLength > context.maxUploadBytes)
    throw new PermanentError(`${fileName} yükleme sınırını aşıyor.`);
  await context.attach({ fileName, body, contentType, role });
  return body.byteLength;
}

/** Aşama çıktısındaki ortak özet: hangi şablon, hangi senaryo biçimi. */
function summary(plan: ProductionPlan): StageOutput {
  return {
    template: 'blueprint-v1',
    structured: plan.structured,
    beats: plan.beats.length,
    ...(plan.styleFallbackFrom
      ? { style_note: 'İstenen stil bu sürümde yok; blueprint kullanıldı.' }
      : {}),
  };
}

/**
 * `explainer.render` tanımı. `getTools` araçların yerini çözer (varsayılan: bu makine);
 * testler sahte araç verir.
 */
export function createExplainerRenderJob(
  getTools: () => ExplainerTools = () => resolveExplainerTools(),
): AnyJobKind {
  return defineJobKind<JobParams>({
    kind: 'explainer.render',
    params: jobParamsSchema,
    stages: {
      voice: guarded(async (context) => {
        const run = await start(context, getTools);
        const timing = await stepVoice(run);
        context.progress(85, 'Seslendirme: çıktılar yükleniyor');
        await attachFile(
          context,
          path.join(run.reel, 'out', 'narration.m4a'),
          'narration.m4a',
          'audio/mp4',
          'audio',
        );
        await attachFile(
          context,
          path.join(run.reel, 'voice', 'timing.json'),
          'timing.json',
          'application/json',
          'other',
        );
        return {
          ...summary(run.plan),
          seconds: timing.duration,
          words: timing.lines.reduce((sum, line) => sum + line.words.length, 0),
          voice: run.plan.voice,
          rate: run.plan.rate,
        };
      }),
      captions: guarded(async (context) => {
        const run = await start(context, getTools);
        const timing = await stepCaptions(run);
        context.progress(80, 'Altyazı: çıktılar yükleniyor');
        await attachFile(
          context,
          path.join(run.reel, 'out', 'captions.srt'),
          'captions.srt',
          'application/x-subrip',
          'captions',
        );
        await attachFile(
          context,
          path.join(run.reel, 'out', 'captions.ass'),
          'captions.ass',
          'text/plain',
          'captions',
        );
        return {
          ...summary(run.plan),
          mode: run.plan.captionMode,
          cues: timing.phrases.length,
          max_lines: 2,
        };
      }),
      visuals: guarded(async (context) => {
        requireRoute(context);
        const run = await start(context, getTools);
        const { timing, total } = await stepComposition(run);
        const frames = await stepSnapshots(run, timing, total);
        for (const frame of frames)
          await attachFile(
            context,
            frame.file,
            path.basename(frame.file),
            'image/jpeg',
            'preview',
          );
        return {
          ...summary(run.plan),
          seconds: total,
          previews: frames.length,
          preview_times: frames.map((frame) => frame.at),
        };
      }),
      render: guarded(async (context) => {
        requireRoute(context);
        const run = await start(context, getTools);
        const final = await stepRender(run);
        context.progress(96, 'Render: video yükleniyor');
        await attachFile(
          context,
          final.file,
          'final.mp4',
          'video/mp4',
          'final',
        );
        await attachFile(
          context,
          path.join(run.reel, 'out', 'captions.srt'),
          'captions.srt',
          'application/x-subrip',
          'captions',
        );
        // Başarı: çalışma klasörü boşaltılır (iş klasörünü yürütücü de siler)
        await rm(run.reel, { recursive: true, force: true }).catch(
          () => undefined,
        );
        return {
          ...summary(run.plan),
          seconds: final.seconds,
          bytes: final.bytes,
          width: 1080,
          height: 1920,
          lufs: final.lufs,
          reencoded: final.reencoded,
        };
      }),
    },
  });
}
