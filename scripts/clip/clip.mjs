#!/usr/bin/env node
// Yayıncı videolarından kısa dikey klip (Reels / Shorts / TikTok).
//   pnpm clip:auto <youtube-adresi> --permission "<izin referansı>" [--count N] [--length 40]
//       [--lang tr,en] [--layout blur|crop] [--no-subs] [--translate tr]
//       [--preview-only] [--exclude 1,3] [--keep-all]
//       Tek adım: indirir, en güçlü anları bulur, kalite kontrolünden geçirir ve <klasör>/clips/
//       altına keser. --count verilmezse klip sayısı yayın süresine göre seçilir (10 dk'ya bir, 3-15).
//       Kalite kontrolünde "ele" kararı alan adaylar (jenerik, donuk ekran, sessizlik) kesilmez;
//       --keep-all bunu kapatır. --preview-only kesmeden durur: clips/inceleme/ altındaki aday
//       dosyalarını ve clips/onizleme/ şeritlerini inceleyip kararları clips/kararlar.json'a yaz
//       (kaydırma, üst yazı, keep/drop), sonra aynı komutu --preview-only olmadan çalıştır.
//       --translate tr: altyazı başka dildeyse her klibin metnini clips/altyazi/ altına ayırır;
//       çevrilmiş NN.tr.srt dosyaları konunca aynı komut klipleri Türkçe altyazıyla keser.
//   pnpm clip:fetch <youtube-adresi> [--out <klasör>] [--lang tr,en] [--no-video] [--chat] [--max-height 360]
//       Videoyu, altyazıyı ve zaman damgalı transkripti ~/ai-influencer-clips/<id>/ altına indirir.
//       --max-height: yalnız inceleme yapılacaksa düşük çözünürlük (uzun yayın küçük kalır).
//   pnpm clip:moments <indirilen-klasör> [--top 10] [--length 40] [--min-length 15] [--max-length 60]
//       [--skip-start 60] [--skip-end <sn>] [--no-audio]
//       En çok tekrar izlenen yerler + sohbet patlamaları + ses zirvelerinden en güçlü anları sıralar,
//       aralığı söz başına/tepkinin sonuna oturtur, her adaya kalite raporu, önizleme şeridi ve
//       inceleme dosyası yazar. Kesim yapmaz; izin seçeneği istemez.
//   pnpm clip:cut <video> --start 12:30 --end 13:05 --out <klip.mp4> --permission "<izin referansı>"
//       [--layout blur|crop] [--x-offset -1..1] [--subs <altyazı.vtt|srt>] [--caption "<üst yazı>"]
//   pnpm clip:mark <indirilen-klasör> --published 1,4 [--rejected 2]
//       Yayınlanan/vazgeçilen adayları karar günlüğüne işler (ileride model eğitmek için veri).
//       Aralığı 1080×1920 H.264 olarak keser. --permission yerine: açık lisanslı kaynakta
//       --open-license "<lisans adı>", kendi çekiminde --own.
//
// Kural (docs/compliance.md → Kaynak içerik): başkasının videosu yalnızca hak sahibinin
// yazılı izniyle kullanılır. İzin referansı olmadan kesim yapılmaz.
// Gereksinim: yt-dlp, ffmpeg, ffprobe (PATH'te). Altyazı gömmek için libass'lı ffmpeg gerekir;
// farklı bir ffmpeg kullanmak için FFMPEG_PATH ayarla. Ayrıntı: docs/clip-guide.md.
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { isInside } from '../lib/panel-lib.mjs';
import {
  CLIP_MAX_SECONDS,
  CLIP_MIN_SECONDS,
  FINE_BINS_PER_SECOND,
  assessClip,
  boundaryKind,
  clipCountFor,
  coarsen,
  combine,
  contextTranscript,
  createChatCounter,
  createFrameMeter,
  createLoudnessMeter,
  defaultSkipEnd,
  findBreaks,
  parseDecisions,
  pickMoments,
  reactionEnd,
  refinePeak,
  replaySeries,
  silenceThreshold,
  snapClip,
  summarizeTags,
  transcriptFor,
} from './moments-lib.mjs';
import {
  captionAss,
  clipSrt,
  cutArgs,
  fetchArgs,
  formatTime,
  mergeWindows,
  parseCli,
  parseSubtitles,
  parseTime,
  parseYoutubeUrl,
  toTranscript,
  toVtt,
  validatePermission,
  validateRange,
  whisperCues,
} from './clip-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ok = (m) => console.log(`  \x1b[32m[OK]\x1b[0m ${m}`);

function tool(name, versionArg = '--version') {
  const r = spawnSync(name, [versionArg], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

function requireTool(name, versionArg) {
  if (!tool(name, versionArg))
    throw new Error(
      `${name} bulunamadı. Kurulum:\n` +
        `  macOS:   brew install ${name === 'ffprobe' ? 'ffmpeg' : name}\n` +
        `  Windows: winget install ${name === 'yt-dlp' ? 'yt-dlp.yt-dlp' : 'Gyan.FFmpeg'}\n` +
        'Kurduktan sonra yeni bir terminal aç.',
    );
}

function outsideRepo(path, what) {
  if (isInside(path, root, sep))
    throw new Error(
      `${what} repo içinde olamaz (repo herkese açık; video dosyaları repoya girmez). Örnek: ~/ai-influencer-clips/`,
    );
}

function fetchSource(argv) {
  const { positional, options } = parseCli(argv, {
    values: ['out', 'lang', 'max-height'],
    flags: ['no-video', 'chat'],
  });
  if (positional.length !== 1)
    throw new Error(
      'Kullanım: pnpm clip:fetch <youtube-adresi> [--out <klasör>] [--lang tr,en] [--no-video] [--chat] [--max-height 360]',
    );
  const { videoId, url } = parseYoutubeUrl(positional[0]);
  const dir = resolve(
    options.out ?? join(homedir(), 'ai-influencer-clips', videoId),
  );
  outsideRepo(dir, 'İndirme klasörü');
  requireTool('yt-dlp');
  mkdirSync(dir, { recursive: true });

  const languages = (options.lang ?? 'tr,en').split(',').filter(Boolean);
  const r = spawnSync(
    'yt-dlp',
    fetchArgs(url, dir, {
      languages,
      video: !options['no-video'],
      chat: Boolean(options.chat),
      ...(options['max-height']
        ? { maxHeight: Number(options['max-height']) }
        : {}),
    }),
    { stdio: 'inherit' },
  );
  // yt-dlp tek bir altyazı hatasında da sıfırdan farklı kodla çıkar; başarıyı dosyalar belirler
  const infoFile = join(dir, `${videoId}.info.json`);
  const videoFile = join(dir, `${videoId}.mp4`);
  if (
    r.error ||
    !existsSync(infoFile) ||
    (!options['no-video'] && !existsSync(videoFile))
  )
    throw new Error(
      'İndirme başarısız. Adresi, internet bağlantısını ve videonun herkese açık olduğunu kontrol et; yt-dlp eskiyse güncelle.',
    );
  if (r.status !== 0)
    console.log(
      '  [UYARI] Bazı parçalar (altyazı ya da sohbet) indirilemedi; YouTube isteği sınırlamış olabilir. Birkaç dakika sonra aynı komutu yeniden çalıştırabilirsin.',
    );

  const info = JSON.parse(
    readFileSync(join(dir, `${videoId}.info.json`), 'utf8'),
  );
  const source = {
    videoId,
    url,
    title: info.title ?? null,
    channel: info.channel ?? info.uploader ?? null,
    channelUrl: info.channel_url ?? null,
    durationSeconds: info.duration ?? null,
    // Düşük çözünürlüklü inceleme kopyasından yayın kalitesinde klip kesilmesin diye saklanır
    height: info.height ?? null,
    language: info.language ?? null,
    uploadDate: info.upload_date ?? null,
    license: info.license ?? null,
  };
  writeFileSync(
    join(dir, 'source.json'),
    JSON.stringify(source, null, 2) + '\n',
  );
  // "Most replayed" ısı haritası (her videoda yoktur): clip:moments'ın en güçlü sinyali
  if (Array.isArray(info.heatmap) && info.heatmap.length > 0)
    writeFileSync(join(dir, 'heatmap.json'), JSON.stringify(info.heatmap));
  // info.json çok büyük ve gereksiz ayrıntı içerir; gerekenler source.json'da
  rmSync(infoFile, { force: true });

  const subtitles = subtitleFiles(dir, videoId, languages);
  console.log('');
  ok(`${source.title ?? videoId} — ${source.channel ?? 'kanal bilinmiyor'}`);
  if (source.durationSeconds) ok(`Süre ${formatTime(source.durationSeconds)}`);
  for (const name of subtitles) {
    const cues = parseSubtitles(readFileSync(join(dir, name), 'utf8'));
    const out = name.replace(/\.vtt$/, '.transcript.txt');
    writeFileSync(join(dir, out), toTranscript(cues) + '\n');
    ok(`Transkript: ${out} (${cues.length} satır)`);
  }
  ok(
    existsSync(join(dir, 'heatmap.json'))
      ? 'En çok tekrar izlenen yerler (ısı haritası) alındı'
      : 'Isı haritası yok (yeni ya da az izlenmiş video); anlar sohbet ve sesten bulunur',
  );
  if (options.chat)
    ok(
      existsSync(join(dir, `${videoId}.live_chat.json`))
        ? 'Sohbet tekrarı alındı'
        : 'Sohbet tekrarı yok (canlı yayın kaydı değil ya da sohbet kapalı)',
    );
  if (subtitles.length === 0)
    console.log(
      '  [UYARI] İstenen dillerde altyazı inmedi (videoda yok ya da YouTube isteği sınırladı). --lang ile başka dil dene ya da birkaç dakika sonra yeniden çalıştır; yerel transkript kuruluysa clip:moments aday pencerelerini kendisi yazıya döker.',
    );
  console.log(
    `\nKlasör: ${dir}\n` +
      `Sonraki adım: pnpm clip:moments "${dir}" ile en güçlü anları ve kalite raporunu çıkar, sonra pnpm clip:cut.\n` +
      'Hatırlatma: videonun sahibi biz değilsek kesmeden önce yazılı izin şart (docs/compliance.md).',
  );
}

/** Altyazı gömmek libass ister; standart Homebrew ffmpeg'inde yoktur. */
function pickFfmpeg(needSubtitles) {
  const candidates = [
    process.env.FFMPEG_PATH,
    'ffmpeg',
    '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg',
    '/usr/local/opt/ffmpeg-full/bin/ffmpeg',
  ].filter(Boolean);
  let found = false;
  for (const candidate of candidates) {
    const r = spawnSync(candidate, ['-hide_banner', '-filters'], {
      encoding: 'utf8',
    });
    if (r.error || r.status !== 0) continue;
    found = true;
    if (!needSubtitles || /^\s*\S+\s+subtitles\s/m.test(r.stdout))
      return candidate;
  }
  if (!found) requireTool('ffmpeg', '-version');
  throw new Error(
    "Bu ffmpeg altyazı gömemiyor (libass yok). macOS: brew install ffmpeg-full. Windows: Gyan.FFmpeg'in 'full' sürümü. " +
      'Farklı bir kurulum için FFMPEG_PATH ile ffmpeg yolunu ver ya da --subs olmadan kes.',
  );
}

function probeDuration(file) {
  const r = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nw=1:nk=1',
      file,
    ],
    { encoding: 'utf8' },
  );
  const seconds = Number.parseFloat(r.stdout);
  return r.status === 0 && Number.isFinite(seconds) ? seconds : null;
}

/** Kaynağın hak durumu: tam olarak bir seçenek verilmeli; yoksa kesim yapılmaz. */
function sourceRights(options) {
  const given = ['own', 'permission', 'open-license'].filter(
    (name) => options[name],
  );
  if (given.length !== 1)
    throw new Error(
      'Kaynağın durumu tek bir seçenekle belirtilmeli: başkasının videosu için --permission "<izin referansı>", ' +
        'açık lisanslı video için --open-license "<lisans adı, ör. CC BY>", kendi çekimin için --own. ' +
        'Yazılı izin ya da uygun lisans yoksa klip kesilmez (docs/compliance.md → Kaynak içerik).',
    );
  const sourceType = {
    own: 'own',
    permission: 'third_party',
    'open-license': 'open_license',
  }[given[0]];
  const permission = options.own
    ? null
    : validatePermission(options.permission ?? options['open-license']);
  return { sourceType, permission };
}

function cut(argv) {
  const { positional, options } = parseCli(argv, {
    values: [
      'start',
      'end',
      'out',
      'permission',
      'open-license',
      'layout',
      'x-offset',
      'subs',
      'caption',
    ],
    flags: ['own'],
  });
  if (positional.length !== 1 || !options.start || !options.end || !options.out)
    throw new Error(
      'Kullanım: pnpm clip:cut <video> --start 12:30 --end 13:05 --out <klip.mp4> --permission "<izin referansı>" [--layout blur|crop] [--x-offset -1..1] [--subs <altyazı.vtt>] [--caption "<üst yazı>"]',
    );
  const { sourceType, permission } = sourceRights(options);

  const input = resolve(positional[0]);
  if (!existsSync(input) || !statSync(input).isFile())
    throw new Error('Video dosyası bulunamadı.');
  const output = resolve(options.out);
  if (extname(output).toLowerCase() !== '.mp4')
    throw new Error('Çıktı uzantısı .mp4 olmalı.');
  outsideRepo(output, 'Çıktı');
  if (existsSync(output))
    throw new Error('Çıktı zaten var; yeni bir ad seç (üzerine yazılmaz).');

  const ffmpeg = pickFfmpeg(Boolean(options.subs || options.caption));
  const duration = tool('ffprobe', '-version') ? probeDuration(input) : null;
  const { start, end, length } = validateRange(
    parseTime(options.start),
    parseTime(options.end),
    duration,
  );

  mkdirSync(dirname(output), { recursive: true });
  // Geçici klasörde çalış: yarım kalan iş final dosya bırakmaz, altyazı yolu kaçırma derdi olmaz
  const work = mkdtempSync(join(dirname(output), '.clip-'));
  try {
    let subtitles = null;
    if (options.subs) {
      const file = resolve(options.subs);
      if (!existsSync(file)) throw new Error('Altyazı dosyası bulunamadı.');
      const srt = clipSrt(
        parseSubtitles(readFileSync(file, 'utf8')),
        start,
        end,
      );
      if (!srt)
        throw new Error('Bu aralıkta altyazı satırı yok; --subs olmadan kes.');
      subtitles = 'subs.srt';
      writeFileSync(join(work, subtitles), srt);
    }
    let caption = null;
    if (options.caption) {
      caption = 'ust.ass';
      writeFileSync(join(work, caption), captionAss(options.caption, length));
    }
    const r = spawnSync(
      ffmpeg,
      cutArgs({
        input,
        output: 'final.mp4',
        start,
        end,
        layout: options.layout ?? 'blur',
        xOffset: options['x-offset'] ? Number(options['x-offset']) : 0,
        subtitles,
        caption,
      }),
      { cwd: work, stdio: ['ignore', 'inherit', 'inherit'] },
    );
    if (r.error || r.status !== 0)
      throw new Error(
        'Kesim başarısız. Girdinin okunabilir bir video olduğunu ve ffmpeg kurulumunda libx264/AAC bulunduğunu kontrol et.',
      );
    copyFileSync(join(work, 'final.mp4'), output);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  // Panele (/clips) ve içerik kartına girilecek kaynak bilgisi klibin yanında durur
  const sourceFile = join(dirname(input), 'source.json');
  const source = existsSync(sourceFile)
    ? JSON.parse(readFileSync(sourceFile, 'utf8'))
    : null;
  writeFileSync(
    output.replace(/\.mp4$/i, '.json'),
    JSON.stringify(
      {
        clip: basename(output),
        start: formatTime(start, { tenths: true }),
        end: formatTime(end, { tenths: true }),
        seconds: Math.round(length * 10) / 10,
        layout: options.layout ?? 'blur',
        caption: options.caption ?? null,
        sourceType,
        permission,
        source,
      },
      null,
      2,
    ) + '\n',
  );
  ok(`${basename(output)} (${Math.round(length)} sn, 1080×1920)`);
  console.log(
    "Yayından önce: klibi telefonda izle, kaynağı caption'da belirt, panelde /clips kaydını ve içerik kartındaki kaynak alanlarını doldur.",
  );
}

/**
 * Videonun sesini 4 kHz mono ham veriye çevirip çeyrek saniyelik ses düzeyini ölçer.
 * Sonuç ses.json'da saklanır: iki geçişli akışta (önce incele, sonra kes) saatlerce süren
 * yayın ikinci kez çözülmez.
 */
async function measureLoudness(video, dir) {
  const cacheFile = join(dir, 'ses.json');
  const stat = statSync(video);
  if (existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
      if (
        cache.size === stat.size &&
        cache.mtimeMs === stat.mtimeMs &&
        cache.perSecond === FINE_BINS_PER_SECOND
      )
        return Float64Array.from(cache.fine);
    } catch {
      // Bozuk önbellek yok sayılır, yeniden ölçülür
    }
  }
  console.log('  Ses düzeyi ölçülüyor (uzun yayında birkaç dakika sürebilir)…');
  const rate = 4000;
  const meter = createLoudnessMeter(rate, FINE_BINS_PER_SECOND);
  const fine = await new Promise((fulfill) => {
    const child = spawn(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-i',
        video,
        '-vn',
        '-ac',
        '1',
        '-ar',
        String(rate),
        '-f',
        's16le',
        '-',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    child.stdout.on('data', (chunk) => meter.push(chunk));
    child.on('error', () => fulfill(null));
    child.on('close', (code) => fulfill(code === 0 ? meter.fine() : null));
  });
  if (fine)
    writeFileSync(
      cacheFile,
      JSON.stringify({
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        perSecond: FINE_BINS_PER_SECOND,
        fine: Array.from(fine, (v) => Math.round(v * 1e5) / 1e5),
      }),
    );
  return fine;
}

/** Aralığı 64×36 gri karelere (saniyede 4) indirip hareket/düz zemin/siyah/kayma ölçümlerini çıkarır. */
function measureVisual(ffmpeg, video, start, end) {
  const [width, height] = [64, 36];
  const r = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-ss',
      String(start),
      '-t',
      String(end - start),
      '-i',
      video,
      '-an',
      '-vf',
      `fps=4,scale=${width}:${height},format=gray`,
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  if (r.error || r.status !== 0) return null;
  const meter = createFrameMeter(width, height);
  meter.push(r.stdout);
  return meter.result();
}

function writePreview(ffmpeg, video, start, end, sheet) {
  const span = end - start;
  spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-ss',
      String(start),
      '-t',
      String(span),
      '-i',
      video,
      '-vf',
      `fps=6/${span},scale=320:-2,tile=6x1`,
      '-frames:v',
      '1',
      sheet,
    ],
    { stdio: 'ignore' },
  );
}

/**
 * İsteğe bağlı ses etiketleyici (sherpa-onnx + CED-tiny, AudioSet sınıfları): müzik, gülme,
 * bağırma. Repo bağımlılığı değildir; repo dışındaki kurulumdan yüklenir (docs/clip-guide.md →
 * Ses etiketleyici). Kurulu değilse null döner ve ilgili ölçümler atlanır.
 */
function loadTagger() {
  const packageDir =
    process.env.AUDIO_TAGGER_DIR ??
    join(homedir(), '.local', 'share', 'ai-influencer-audio');
  const modelDir =
    process.env.AUDIO_TAG_MODEL_DIR ??
    join(
      homedir(),
      '.local',
      'share',
      'sherpa-models',
      'sherpa-onnx-ced-tiny-audio-tagging-2024-04-19',
    );
  const model = join(modelDir, 'model.int8.onnx');
  const labels = join(modelDir, 'class_labels_indices.csv');
  if (!existsSync(join(packageDir, 'package.json')) || !existsSync(model))
    return null;
  try {
    const sherpa = createRequire(join(packageDir, 'package.json'))(
      'sherpa-onnx-node',
    );
    const tagger = new sherpa.AudioTagging({
      model: { ced: model, numThreads: 2, provider: 'cpu', debug: false },
      labels,
      topK: 527,
    });
    return (video, start, end) => {
      const rate = 16000;
      const r = spawnSync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-ss',
          String(start),
          '-t',
          String(end - start),
          '-i',
          video,
          '-vn',
          '-ac',
          '1',
          '-ar',
          String(rate),
          '-f',
          'f32le',
          '-',
        ],
        { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
      );
      if (r.error || r.status !== 0) return null;
      const usable = r.stdout.length - (r.stdout.length % 4);
      const samples = new Float32Array(
        r.stdout.buffer.slice(
          r.stdout.byteOffset,
          r.stdout.byteOffset + usable,
        ),
      );
      const windows = [];
      // 4 sn'lik pencereler, 2 sn adım
      for (let i = 0; i + rate * 4 <= samples.length; i += rate * 2) {
        const stream = tagger.createStream();
        stream.acceptWaveform({
          sampleRate: rate,
          samples: samples.slice(i, i + rate * 4),
        });
        windows.push(
          Object.fromEntries(
            tagger.compute(stream, 527).map((e) => [e.name, e.prob]),
          ),
        );
      }
      return summarizeTags(windows);
    };
  } catch {
    return null;
  }
}

const pad2 = (n) => String(n).padStart(2, '0');
const stemOf = (moment) =>
  `${pad2(moment.rank)}-${moment.start.replaceAll(':', '.')}`;
const percent = (value) =>
  value == null ? '–' : `%${Math.round(value * 100)}`;

/** Agent'ın anlam değerlendirmesi için tek dosyalık aday paketi (clips/inceleme/NN.md). */
function packetText(moment, cues, previewFile) {
  const q = moment.quality;
  const m = q.metrics;
  const from = parseTime(moment.start);
  const to = parseTime(moment.end);
  const lines = contextTranscript(cues, from, to, 10);
  const row = (label, value) => `- ${label}: ${value}`;
  return [
    `# Aday ${pad2(moment.rank)}: ${moment.start} - ${moment.end} (${m.seconds} sn)`,
    '',
    row('Zirve', `${moment.peak} (klibin ${percent(m.peakPosition)} noktası)`),
    row(
      'Sinyal',
      `${moment.score} (${moment.why}; ${Object.entries(moment.signals)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')})`,
    ),
    row('Kalite', `${q.score}/100 → ${q.verdict}`),
    row(
      'Gerekçe',
      q.reasons.length ? q.reasons.join('; ') : 'belirgin sorun yok',
    ),
    row(
      'Sınırlar',
      `başlangıç ${m.startBoundary ?? 'durak bulunamadı'}, bitiş ${m.endBoundary ?? 'durak bulunamadı'}`,
    ),
    row(
      'Konuşma',
      m.speechCoverage == null
        ? 'ölçülemedi (altyazı yok)'
        : `${percent(m.speechCoverage)}, ilk 3 sn'de ~${m.hookWords} sözcük`,
    ),
    row(
      'Ses',
      m.silenceRatio == null
        ? 'ölçülmedi'
        : `sessizlik ${percent(m.silenceRatio)}, zirvede sıçrama ${m.loudnessJumpDb ?? '–'} dB`,
    ),
    ...(m.chatDensity != null
      ? [
          row(
            'Sohbet',
            `yayın ortalamasının ${m.chatDensity} katı, zirve ${m.chatPeak}`,
          ),
        ]
      : []),
    ...(m.tags
      ? [
          row(
            'Ses etiketleri',
            `müzik ${percent(m.tags.music)}, konuşma ${percent(m.tags.speech)}, gülme ${percent(m.tags.laughter)}, bağırma ${percent(m.tags.shout)}, kalabalık ${percent(m.tags.crowd)}`,
          ),
        ]
      : []),
    ...(m.frames
      ? [
          row(
            'Görüntü',
            `hareket ${m.motion}, durağan ${percent(m.staticRatio)}, düz zemin ${percent(m.flatRatio)}, siyah ${percent(m.blackRatio)}, dikey kayma ${percent(m.scrollRatio)}`,
          ),
        ]
      : []),
    row(
      'Alt puanlar',
      Object.entries(q.parts)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k} ${v}`)
        .join(', '),
    ),
    ...(previewFile ? [row('Önizleme şeridi', previewFile)] : []),
    ...(moment.adjusted
      ? [
          row(
            'Elle ayar',
            `başlangıç ${moment.adjusted.shiftStart} sn, bitiş ${moment.adjusted.shiftEnd} sn`,
          ),
        ]
      : []),
    ...(moment.caption ? [row('Üst yazı', moment.caption)] : []),
    '',
    '## Transkript',
    '',
    lines.length
      ? '`>` klibin içi, `·` klibin 10 sn öncesi/sonrası (bağlam, klipte yok).'
      : 'Altyazı yok. Şeride ve gerekirse videodan çıkaracağın karelere bak.',
    '',
    ...lines.map(
      (line) =>
        `${line.inside ? '>' : '·'} [${formatTime(line.at, { tenths: true })}] ${line.text}`,
    ),
    '',
    '## Değerlendirme',
    '',
    'Rubrik: `.claude/skills/yayinci-klip/SKILL.md` → "Anlam değerlendirmesi". Kararı `clips/kararlar.json` içine yaz.',
    '',
  ].join('\n');
}

async function moments(argv) {
  const { positional, options } = parseCli(argv, {
    values: [
      'top',
      'length',
      'min-length',
      'max-length',
      'skip-start',
      'skip-end',
    ],
    flags: ['no-audio'],
  });
  if (positional.length !== 1)
    throw new Error(
      'Kullanım: pnpm clip:moments <indirilen-klasör> [--top 10] [--length 40] [--min-length 15] [--max-length 60] [--skip-start 60] [--skip-end <sn>] [--no-audio]',
    );
  const dir = resolve(positional[0]);
  const sourceFile = join(dir, 'source.json');
  if (!existsSync(sourceFile))
    throw new Error(
      'Bu klasörde source.json yok. Önce pnpm clip:fetch ile videoyu indir.',
    );
  const source = JSON.parse(readFileSync(sourceFile, 'utf8'));
  const number = (name, fallback, min, max) => {
    const value =
      options[name] === undefined ? fallback : Number(options[name]);
    if (!(value >= min && value <= max))
      throw new Error(`--${name} ${min}-${max} arasında bir sayı olmalı.`);
    return value;
  };
  const top = number('top', 10, 1, 50);
  const minLength = number('min-length', CLIP_MIN_SECONDS, 5, 180);
  const maxLength = number('max-length', CLIP_MAX_SECONDS, minLength, 180);
  const length = Math.min(
    maxLength,
    Math.max(minLength, number('length', 40, 10, 180)),
  );
  const skipStart = number('skip-start', 60, 0, 3600);
  const skipEndOption = options['skip-end'];

  const video = join(dir, `${source.videoId}.mp4`);
  const hasVideo = existsSync(video);
  const duration =
    source.durationSeconds ?? (hasVideo ? probeDuration(video) : null);
  if (!duration)
    throw new Error('Video süresi bilinmiyor; videoyu indirip yeniden dene.');

  const heatmapFile = join(dir, 'heatmap.json');
  const replay = existsSync(heatmapFile)
    ? replaySeries(JSON.parse(readFileSync(heatmapFile, 'utf8')), duration)
    : null;

  let chat = null;
  const chatFile = join(dir, `${source.videoId}.live_chat.json`);
  if (existsSync(chatFile)) {
    const counter = createChatCounter(duration);
    for await (const line of createInterface({
      input: createReadStream(chatFile, 'utf8'),
      crlfDelay: Infinity,
    }))
      counter.push(line);
    chat = counter.series();
    ok(`Sohbet: ${counter.messages()} mesaj`);
  }

  let fine = null;
  if (!options['no-audio'] && hasVideo) {
    requireTool('ffmpeg', '-version');
    fine = await measureLoudness(video, dir);
  }
  const audio = fine ? coarsen(fine) : null;

  const combined = combine({ replay, chat, audio });
  const names = { replay: 'tekrar izlenme', chat: 'sohbet', audio: 'ses' };
  ok(`Sinyaller: ${combined.used.map((name) => names[name]).join(', ')}`);
  if (!replay && !chat)
    console.log(
      '  [UYARI] Yalnız ses var: zirveler müzik ya da oyun sesi de olabilir. Sohbet için pnpm clip:fetch … --chat ile yeniden indir.',
    );

  const skipEnd =
    skipEndOption === undefined
      ? defaultSkipEnd(duration)
      : number('skip-end', 0, 0, 3600);
  const picked = pickMoments(combined, {
    top,
    length,
    duration,
    skipStart,
    skipEnd,
    // Sınırlar zirvenin iki yanına max'a kadar uzayabilir; adaylar üst üste binmesin
    spacing: Math.max(length, maxLength),
  });

  // Yerel döküm yalnız aday pencerelerini kapsar; gerçek altyazı varsa o kullanılır
  const subtitle = subtitleFiles(dir, source.videoId).find(
    (name) => !name.endsWith('.whisper.vtt'),
  );
  let cues = subtitle
    ? parseSubtitles(readFileSync(join(dir, subtitle), 'utf8'))
    : [];
  if (cues.length === 0 && hasVideo && picked.length > 0)
    cues = transcribeLocally({
      dir,
      video,
      source,
      // Başlangıç zirveden en çok max'ın %80'i geride, bitiş en çok max ileride olabilir
      windows: picked.map((m) => [
        Math.max(0, m.peak - maxLength * 0.8 - 12),
        Math.min(duration, m.peak + maxLength * 0.75 + 12),
      ]),
    });

  const threshold = silenceThreshold(fine);
  const chatMean = chat ? chat.reduce((a, b) => a + b, 0) / chat.length : null;
  const breaksAround = (peak) =>
    findBreaks({
      cues,
      fine,
      threshold,
      from: peak - maxLength - 15,
      to: peak + maxLength + 15,
    });
  let list = picked.map((moment, i) => {
    const peak = refinePeak(moment.peak, audio);
    const breaks = breaksAround(peak);
    const range = snapClip({
      peak,
      target: length,
      min: minLength,
      max: maxLength,
      duration,
      breaks,
      decay: reactionEnd({
        peak,
        audio,
        chat,
        until: Math.min(duration, peak + maxLength),
      }),
    });
    return { rank: i + 1, moment, peak, breaks, ...range };
  });

  // Agent'ın/kullanıcının kararları: kaydırma, üst yazı, keep/drop
  const clipsDir = join(dir, 'clips');
  const decisionsFile = join(clipsDir, 'kararlar.json');
  const decisions = existsSync(decisionsFile)
    ? parseDecisions(
        JSON.parse(readFileSync(decisionsFile, 'utf8')),
        list.map((c) => ({ rank: c.rank, peak: formatTime(c.peak) })),
      )
    : new Map();

  const ffmpeg = hasVideo ? pickFfmpeg(false) : null;
  const previewDir = join(clipsDir, 'onizleme');
  const packetDir = join(clipsDir, 'inceleme');
  if (hasVideo) mkdirSync(previewDir, { recursive: true });
  mkdirSync(packetDir, { recursive: true });
  const tagger = hasVideo ? loadTagger() : null;
  if (hasVideo)
    console.log(
      `  Adaylar inceleniyor (görüntü ölçümü, önizleme${tagger ? ', ses etiketleri' : ''})…`,
    );
  list = list.map((c) => {
    const decision = decisions.get(c.rank);
    let { start, end, startKind, endKind } = c;
    let adjusted = null;
    if (decision && (decision.shiftStart !== 0 || decision.shiftEnd !== 0)) {
      start = Math.max(0, start + decision.shiftStart);
      end = Math.min(duration, end + decision.shiftEnd);
      validateRange(start, end, duration);
      startKind = boundaryKind(start, 'start', c.breaks, duration);
      endKind = boundaryKind(end, 'end', c.breaks, duration);
      adjusted = {
        shiftStart: decision.shiftStart,
        shiftEnd: decision.shiftEnd,
      };
    }
    const visual = hasVideo ? measureVisual(ffmpeg, video, start, end) : null;
    const quality = assessClip({
      start,
      end,
      peak: c.peak,
      cues,
      fine,
      threshold,
      chat,
      chatMean,
      chatPeak: c.moment.signals.chat ?? null,
      visual,
      tags: tagger ? tagger(video, start, end) : null,
      startKind,
      endKind,
    });
    const out = {
      rank: c.rank,
      start: formatTime(start, { tenths: true }),
      end: formatTime(end, { tenths: true }),
      peak: formatTime(c.peak),
      seconds: quality.metrics.seconds,
      score: c.moment.score,
      why: names[c.moment.why],
      signals: c.moment.signals,
      quality,
      transcript: transcriptFor(cues, start, end),
      ...(adjusted ? { adjusted } : {}),
      ...(decision?.decision ? { decision: decision.decision } : {}),
      ...(decision?.caption ? { caption: decision.caption } : {}),
      ...(decision?.title ? { title: decision.title } : {}),
      ...(decision?.note ? { note: decision.note } : {}),
    };
    let preview = null;
    if (hasVideo) {
      preview = join(previewDir, `${stemOf(out)}.jpg`);
      // Aralık kaydırıldıysa aynı adayın eski şeridi kalmasın
      for (const name of readdirSync(previewDir))
        if (name.startsWith(`${pad2(c.rank)}-`) && name !== basename(preview))
          rmSync(join(previewDir, name), { force: true });
      if (!existsSync(preview))
        writePreview(ffmpeg, video, start, end, preview);
      out.preview = join('clips', 'onizleme', basename(preview));
    }
    out.packet = join('clips', 'inceleme', `${pad2(c.rank)}.md`);
    writeFileSync(join(dir, out.packet), packetText(out, cues, preview));
    return out;
  });

  writeFileSync(
    join(dir, 'moments.json'),
    JSON.stringify(
      {
        source,
        signals: combined.used,
        subtitles: subtitle ?? (cues.length ? 'yerel transkript' : null),
        moments: list,
      },
      null,
      2,
    ) + '\n',
  );
  if (!existsSync(decisionsFile) && list.length > 0)
    writeFileSync(
      decisionsFile,
      JSON.stringify(
        {
          note: 'Her aday için: decision "keep" | "drop" | null (null = kalite kararına bırak), shiftStart/shiftEnd saniye (eksi = geri, artı = ileri), caption klibin üstüne gömülecek tek satır bağlam (en çok 60 karakter), title yayın başlığı önerisi. peak alanına dokunma.',
          candidates: Object.fromEntries(
            list.map((m) => [
              m.rank,
              {
                peak: m.peak,
                decision: null,
                shiftStart: 0,
                shiftEnd: 0,
                caption: '',
                title: '',
                note: '',
              },
            ]),
          ),
        },
        null,
        2,
      ) + '\n',
    );

  console.log(
    '\n  #  Aralık                 Sn    Sinyal  Kalite  Karar   Gerekçe',
  );
  for (const m of list)
    console.log(
      `  ${String(m.rank).padStart(2)} ${`${m.start}-${m.end}`.padEnd(22)} ${String(m.seconds).padEnd(5)} ${String(m.score).padEnd(7)} ${String(m.quality.score).padEnd(7)} ${m.quality.verdict.padEnd(7)} ${(m.quality.reasons.join('; ') || m.transcript).slice(0, 110)}`,
    );
  console.log(
    `\n${list.length} aday moments.json dosyasına yazıldı. İnceleme dosyaları: ${packetDir}\n` +
      'Kalite puanı ölçülebilenleri gösterir (söz, sınır, tepki, görüntü); klibin komik ya da anlaşılır olduğunu ölçmez. ' +
      `Her adayın inceleme dosyasını ve şeridini değerlendirip kararları ${decisionsFile} içine yaz.`,
  );
}

const whisperModel = () =>
  process.env.WHISPER_MODEL ??
  join(
    homedir(),
    '.local',
    'share',
    'whisper-models',
    'ggml-large-v3-turbo-q5_0.bin',
  );

/**
 * YouTube altyazısı olmayan (ya da istek sınırına takılan) videoda yalnız aday pencerelerini
 * whisper.cpp ile yazıya döker; yayının tamamını dökmek saatler sürerdi. Sonuç whisper.json'da
 * saklanır (aynı pencere ikinci kez dökülmez) ve kesimde kullanılmak üzere VTT olarak yazılır.
 * whisper-cli ya da model yoksa boş döner: akış altyazısız sürer.
 */
function transcribeLocally({ dir, video, source, windows }) {
  const model = whisperModel();
  if (!existsSync(model) || !tool('whisper-cli', '--help')) {
    console.log(
      '  [UYARI] Altyazı yok ve yerel transkript kurulu değil (whisper-cli + model; docs/clip-guide.md → Yerel transkript). Konuşma ölçümleri atlanıyor.',
    );
    return [];
  }
  const cacheFile = join(dir, 'whisper.json');
  let cache = { model: basename(model), windows: [] };
  if (existsSync(cacheFile)) {
    try {
      const saved = JSON.parse(readFileSync(cacheFile, 'utf8'));
      if (saved.model === cache.model && Array.isArray(saved.windows))
        cache = saved;
    } catch {
      // Bozuk önbellek yok sayılır
    }
  }
  const todo = mergeWindows(windows).filter(
    ([from, to]) => !cache.windows.some((w) => w.from <= from && w.to >= to),
  );
  if (todo.length > 0) {
    const total = todo.reduce((sum, [from, to]) => sum + to - from, 0);
    console.log(
      `  Altyazı yok: aday pencereleri yerelde yazıya dökülüyor (${todo.length} pencere, ${Math.round(total / 60)} dk ses; M4'te yaklaşık ${Math.max(1, Math.round(total / 60 / 5))} dk)…`,
    );
    const language = /^[a-z]{2,3}$/.test(source.language ?? '')
      ? source.language
      : 'auto';
    const work = mkdtempSync(join(dir, '.whisper-'));
    try {
      for (const [from, to] of todo) {
        const wav = join(work, 'a.wav');
        const extracted = spawnSync(
          'ffmpeg',
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-nostdin',
            '-y',
            '-ss',
            String(from),
            '-t',
            String(to - from),
            '-i',
            video,
            '-vn',
            '-ac',
            '1',
            '-ar',
            '16000',
            wav,
          ],
          { stdio: 'ignore' },
        );
        if (extracted.error || extracted.status !== 0) continue;
        const r = spawnSync(
          'whisper-cli',
          // -ml/-sow: uzun bölümler sözcük sınırından ~60 karakterlik satırlara bölünür (altyazı ve sınır için)
          [
            '-m',
            model,
            '-l',
            language,
            '-f',
            wav,
            '-ml',
            '60',
            '-sow',
            '-oj',
            '-of',
            join(work, 'out'),
            '-np',
          ],
          { stdio: 'ignore' },
        );
        const outFile = join(work, 'out.json');
        if (r.error || r.status !== 0 || !existsSync(outFile)) continue;
        cache.windows.push({
          from,
          to,
          cues: whisperCues(JSON.parse(readFileSync(outFile, 'utf8')), from),
        });
        rmSync(outFile, { force: true });
        writeFileSync(cacheFile, JSON.stringify(cache));
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  // Pencereler üst üste binebilir: aynı an için ilk döküm kalır
  const cues = [];
  for (const w of [...cache.windows].sort((a, b) => a.from - b.from))
    for (const cue of w.cues)
      if (cues.length === 0 || cue.start >= cues.at(-1).end - 0.05)
        cues.push(cue);
  if (cues.length > 0) {
    const language = /^[a-z]{2,3}$/.test(source.language ?? '')
      ? source.language
      : 'und';
    writeFileSync(
      join(dir, `${source.videoId}.${language}.whisper.vtt`),
      toVtt(cues),
    );
    ok(`Yerel transkript: ${cues.length} satır (yalnız aday pencereleri)`);
  }
  return cues;
}

function subtitleFiles(dir, videoId, languages = ['tr', 'en']) {
  return readdirSync(dir)
    .filter((name) => name.startsWith(`${videoId}.`) && name.endsWith('.vtt'))
    .sort(
      (a, b) =>
        Number(a.endsWith('.whisper.vtt')) -
          Number(b.endsWith('.whisper.vtt')) ||
        languages.findIndex((l) => a.includes(`.${l}`)) -
          languages.findIndex((l) => b.includes(`.${l}`)),
    );
}

/** Aday başına bir satır: özellikler + karar. İleride bir model eğitmek için veri birikir. */
function logDecisions(dir, source, entries) {
  const file = join(dirname(dir), 'karar-gunlugu.jsonl');
  const at = new Date().toISOString();
  appendFileSync(
    file,
    entries
      .map(({ moment, decision }) =>
        JSON.stringify({
          at,
          videoId: source.videoId,
          durationSeconds: source.durationSeconds,
          rank: moment.rank,
          peak: moment.peak,
          start: moment.start,
          end: moment.end,
          signalScore: moment.score,
          signals: moment.signals,
          qualityScore: moment.quality?.score ?? null,
          verdict: moment.quality?.verdict ?? null,
          parts: moment.quality?.parts ?? null,
          metrics: moment.quality?.metrics ?? null,
          adjusted: moment.adjusted ?? null,
          captioned: Boolean(moment.caption),
          decision,
        }),
      )
      .join('\n') + '\n',
  );
  return file;
}

function rankList(value, name) {
  const ranks = (value ?? '').split(',').filter(Boolean).map(Number);
  if (ranks.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error(`--${name} aday numaraları ister. Örnek: --${name} 1,3`);
  return ranks;
}

/** Yayın sonrası: hangi adaylar yayınlandı, hangilerinden vazgeçildi. */
function mark(argv) {
  const { positional, options } = parseCli(argv, {
    values: ['published', 'rejected'],
    flags: [],
  });
  const published = rankList(options.published, 'published');
  const rejected = rankList(options.rejected, 'rejected');
  if (positional.length !== 1 || published.length + rejected.length === 0)
    throw new Error(
      'Kullanım: pnpm clip:mark <indirilen-klasör> --published 1,4 [--rejected 2]',
    );
  const dir = resolve(positional[0]);
  const file = join(dir, 'moments.json');
  if (!existsSync(file))
    throw new Error('Bu klasörde moments.json yok. Önce pnpm clip:moments.');
  const { source, moments: list } = JSON.parse(readFileSync(file, 'utf8'));
  const entries = [];
  for (const [ranks, decision] of [
    [published, 'published'],
    [rejected, 'rejected'],
  ])
    for (const rank of ranks) {
      const moment = list.find((m) => m.rank === rank);
      if (!moment) throw new Error(`${rank} numaralı aday yok.`);
      entries.push({ moment, decision });
    }
  ok(`${entries.length} karar işlendi: ${logDecisions(dir, source, entries)}`);
}

/** Tek adım: indir → anları bul → hepsini kes. Yarıda kalırsa aynı komut kaldığı yerden sürer. */
async function auto(argv) {
  const { positional, options } = parseCli(argv, {
    values: [
      'out',
      'lang',
      'count',
      'length',
      'permission',
      'open-license',
      'layout',
      'translate',
      'exclude',
    ],
    flags: ['own', 'no-subs', 'preview-only', 'keep-all'],
  });
  if (positional.length !== 1)
    throw new Error(
      'Kullanım: pnpm clip:auto <youtube-adresi> --permission "<izin referansı>" [--count N] [--length 40] [--lang tr,en] [--layout blur|crop] [--no-subs] [--translate tr] [--preview-only] [--exclude 1,3] [--keep-all]',
    );
  const excluded = new Set(rankList(options.exclude, 'exclude'));
  const target = options.translate;
  if (target !== undefined && !/^[a-z]{2,3}$/.test(target))
    throw new Error('--translate bir dil kodu ister. Örnek: --translate tr');
  // İzin kontrolü en başta: saatlerce indirdikten sonra reddetmek yerine hemen dur
  sourceRights(options);
  const rights = options.own
    ? ['--own']
    : options.permission
      ? ['--permission', options.permission]
      : ['--open-license', options['open-license']];
  const { videoId, url } = parseYoutubeUrl(positional[0]);
  const dir = resolve(
    options.out ?? join(homedir(), 'ai-influencer-clips', videoId),
  );
  const video = join(dir, `${videoId}.mp4`);
  const sourceFile = join(dir, 'source.json');

  console.log('\n1/3 İndirme');
  if (existsSync(video) && existsSync(sourceFile))
    ok('Video zaten indirilmiş; yeniden indirilmiyor');
  else {
    fetchSource([
      url,
      '--out',
      dir,
      '--chat',
      ...(options.lang ? ['--lang', options.lang] : []),
    ]);
    if (process.exitCode) return;
  }
  const source = JSON.parse(readFileSync(sourceFile, 'utf8'));
  const count = options.count ?? String(clipCountFor(source.durationSeconds));

  console.log('\n2/3 En güçlü anlar ve kalite kontrolü');
  // Kalite kontrolü ve inceleme aday eler: istenen sayının iki katı aday çıkarılır
  const wanted = Number(count);
  if (!(wanted >= 1 && wanted <= 25))
    throw new Error('--count 1-25 arasında bir sayı olmalı.');
  await moments([
    dir,
    '--top',
    String(wanted * 2),
    ...(options.length ? ['--length', options.length] : []),
  ]);
  const list = JSON.parse(
    readFileSync(join(dir, 'moments.json'), 'utf8'),
  ).moments;
  if (list.length === 0)
    throw new Error(
      'Öne çıkan an bulunamadı (sinyal düz). Aralığı elle seçip pnpm clip:cut ile kes.',
    );

  // Kesilecekler: elle "drop"/--exclude dışarıda; "ele" kararı yalnız --keep-all ya da elle "keep" ile geçer
  const fate = (moment) => {
    if (excluded.has(moment.rank) || moment.decision === 'drop')
      return 'excluded';
    if (
      moment.quality.verdict === 'ele' &&
      !options['keep-all'] &&
      moment.decision !== 'keep'
    )
      return 'auto_rejected';
    return 'candidate';
  };
  const rejected = list.filter((m) => fate(m) === 'auto_rejected');
  if (rejected.length > 0) {
    console.log(
      `\nKalite kontrolü ${rejected.length} adayı eledi (kesilmeyecek; yine de kesmek için --keep-all ya da kararlar.json'da "keep"):`,
    );
    for (const m of rejected)
      console.log(
        `  ${pad2(m.rank)} ${m.start}-${m.end}: ${m.quality.reasons[0]}`,
      );
  }
  if (options['preview-only']) {
    console.log(
      `\n${list.length} aday var, elenmeyenlerin ilk ${wanted} tanesi kesilecek. Her adayın clips/inceleme/<sıra>.md dosyasını ve şeridini değerlendir, ` +
        'kararları clips/kararlar.json içine yaz, sonra komutu --preview-only olmadan yeniden çalıştır.',
    );
    return;
  }
  if (source.height && source.height < 720)
    console.log(
      `  [UYARI] Kaynak ${source.height}p indirilmiş (inceleme kopyası). Yayınlanacak klip için klasörü silip --max-height olmadan yeniden indir.`,
    );

  console.log(`\n3/3 Kesim (${wanted} klip)`);
  const languages = (options.lang ?? 'tr,en').split(',').filter(Boolean);
  const subtitle = options['no-subs']
    ? null
    : subtitleFiles(dir, videoId, languages)[0];
  if (!options['no-subs'] && !subtitle)
    console.log('  [UYARI] Altyazı dosyası yok; klipler altyazısız kesiliyor.');
  // Çeviri: kaynak altyazı hedef dilde değilse metin ayrılır, çevrilmiş dosya beklenir
  const translating =
    Boolean(target && subtitle) && !subtitle.includes(`.${target}.`);
  const cues = translating
    ? parseSubtitles(readFileSync(join(dir, subtitle), 'utf8'))
    : [];
  const subsDir = join(dir, 'clips', 'altyazi');
  if (translating) mkdirSync(subsDir, { recursive: true });
  const clips = [];
  const log = [];
  let waiting = 0;
  for (const moment of list) {
    const state = fate(moment);
    if (state !== 'candidate') {
      log.push({ moment, decision: state });
      continue;
    }
    if (clips.length + waiting >= wanted) {
      log.push({ moment, decision: 'not_needed' });
      continue;
    }
    const stem = stemOf(moment);
    const name = `${stem}.mp4`;
    const output = join(dir, 'clips', name);
    const base = [
      video,
      '--start',
      moment.start,
      '--end',
      moment.end,
      '--out',
      output,
      ...rights,
      ...(options.layout ? ['--layout', options.layout] : []),
      ...(moment.caption ? ['--caption', moment.caption] : []),
    ];
    let subs = subtitle ? join(dir, subtitle) : null;
    if (translating && !existsSync(output)) {
      const original = join(subsDir, `${stem}.srt`);
      const translated = join(subsDir, `${stem}.${target}.srt`);
      const text = clipSrt(
        cues,
        parseTime(moment.start),
        parseTime(moment.end),
        { absolute: true },
      );
      if (!text) subs = null;
      else if (existsSync(translated)) subs = translated;
      else {
        if (!existsSync(original)) writeFileSync(original, text);
        waiting++;
        continue;
      }
    }
    let subtitled = false;
    if (existsSync(output)) ok(`${name} zaten var; atlandı`);
    else if (subs) {
      try {
        cut([...base, '--subs', subs]);
        subtitled = true;
      } catch (error) {
        // Konuşmasız aralıkta altyazı satırı olmaz; klip altyazısız kesilir
        if (!/altyazı satırı yok/.test(error.message)) throw error;
        cut(base);
      }
    } else cut(base);
    clips.push({ file: name, ...moment, subtitled });
    log.push({ moment, decision: 'cut' });
  }
  if (waiting > 0) {
    console.log(
      `\n${waiting} klip çeviri bekliyor: ${subsDir}\n` +
        `Her <ad>.srt dosyasını çevirip yanına <ad>.${target}.srt olarak kaydet: satır numaraları ve zamanlar aynı kalır, yalnız metin değişir. ` +
        'Sonra aynı komutu yeniden çalıştır.',
    );
  }
  writeFileSync(
    join(dir, 'clips', 'clips.json'),
    JSON.stringify(
      {
        source,
        clips,
        rejected: list
          .filter((m) => fate(m) !== 'candidate')
          .map((m) => ({
            rank: m.rank,
            start: m.start,
            end: m.end,
            why:
              fate(m) === 'auto_rejected'
                ? `kalite kontrolü: ${m.quality.reasons[0]}`
                : m.note || 'elle elendi',
          })),
      },
      null,
      2,
    ) + '\n',
  );
  if (waiting === 0) logDecisions(dir, source, log);
  if (clips.length > 0)
    console.log(
      `\n${clips.length} klip hazır: ${join(dir, 'clips')}\n` +
        'Sıra sinyal puanına göre (01 en güçlü). Hepsini izle, yayınlanacakları seç; yayınladıklarını pnpm clip:mark ile işle.',
    );
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'fetch') fetchSource(rest);
  else if (mode === 'cut') cut(rest);
  else if (mode === 'moments') await moments(rest);
  else if (mode === 'auto') await auto(rest);
  else if (mode === 'mark') mark(rest);
  else
    throw new Error(
      'Kullanım: pnpm clip:auto <youtube-adresi> --permission …  |  pnpm clip:fetch <youtube-adresi>  |  pnpm clip:moments <klasör>  |  pnpm clip:cut <video> --start … --end … --out … --permission …  |  pnpm clip:mark <klasör> --published …',
    );
} catch (error) {
  console.error(`\x1b[31m[HATA]\x1b[0m ${error.message}`);
  process.exitCode = 1;
}
