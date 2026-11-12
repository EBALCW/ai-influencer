#!/usr/bin/env node
// Yayıncı videolarından kısa dikey klip (Reels / Shorts / TikTok).
//   pnpm clip:fetch <youtube-adresi> [--out <klasör>] [--lang tr,en] [--no-video] [--chat]
//       Videoyu, altyazıyı ve zaman damgalı transkripti ~/ai-influencer-clips/<id>/ altına indirir.
//   pnpm clip:moments <indirilen-klasör> [--top 10] [--length 40] [--skip-start 60] [--no-audio]
//       En çok tekrar izlenen yerler + sohbet patlamaları + ses zirvelerinden en güçlü anları sıralar.
//   pnpm clip:cut <video> --start 12:30 --end 13:05 --out <klip.mp4> --permission "<izin referansı>"
//       [--layout blur|crop] [--x-offset -1..1] [--subs <altyazı.vtt|srt>]
//       Aralığı 1080×1920 H.264 olarak keser. --permission yerine: açık lisanslı kaynakta
//       --open-license "<lisans adı>", kendi çekiminde --own.
//
// Kural (docs/compliance.md → Kaynak içerik): başkasının videosu yalnızca hak sahibinin
// yazılı izniyle kullanılır. İzin referansı olmadan kesim yapılmaz.
// Gereksinim: yt-dlp, ffmpeg, ffprobe (PATH'te). Altyazı gömmek için libass'lı ffmpeg gerekir;
// farklı bir ffmpeg kullanmak için FFMPEG_PATH ayarla. Ayrıntı: docs/clip-guide.md.
import { spawn, spawnSync } from 'node:child_process';
import {
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
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { isInside } from '../lib/panel-lib.mjs';
import {
  combine,
  createChatCounter,
  createLoudnessMeter,
  pickMoments,
  replaySeries,
  transcriptFor,
} from './moments-lib.mjs';
import {
  clipSrt,
  cutArgs,
  fetchArgs,
  formatTime,
  parseCli,
  parseSubtitles,
  parseTime,
  parseYoutubeUrl,
  toTranscript,
  validatePermission,
  validateRange,
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
    values: ['out', 'lang'],
    flags: ['no-video', 'chat'],
  });
  if (positional.length !== 1)
    throw new Error(
      'Kullanım: pnpm clip:fetch <youtube-adresi> [--out <klasör>] [--lang tr,en] [--no-video] [--chat]',
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

  const subtitles = readdirSync(dir)
    .filter((name) => name.startsWith(`${videoId}.`) && name.endsWith('.vtt'))
    .sort(
      (a, b) =>
        languages.findIndex((l) => a.includes(`.${l}`)) -
        languages.findIndex((l) => b.includes(`.${l}`)),
    );
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
      '  [UYARI] Bu videoda istenen dillerde altyazı yok; klip anlarını videoyu izleyerek seç ya da --lang ile başka dil dene.',
    );
  console.log(
    `\nKlasör: ${dir}\n` +
      `Sonraki adım: pnpm clip:moments "${dir}" ile en güçlü anları bul, sonra pnpm clip:cut.\n` +
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
    ],
    flags: ['own'],
  });
  if (positional.length !== 1 || !options.start || !options.end || !options.out)
    throw new Error(
      'Kullanım: pnpm clip:cut <video> --start 12:30 --end 13:05 --out <klip.mp4> --permission "<izin referansı>" [--layout blur|crop] [--x-offset -1..1] [--subs <altyazı.vtt>]',
    );
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

  const input = resolve(positional[0]);
  if (!existsSync(input) || !statSync(input).isFile())
    throw new Error('Video dosyası bulunamadı.');
  const output = resolve(options.out);
  if (extname(output).toLowerCase() !== '.mp4')
    throw new Error('Çıktı uzantısı .mp4 olmalı.');
  outsideRepo(output, 'Çıktı');
  if (existsSync(output))
    throw new Error('Çıktı zaten var; yeni bir ad seç (üzerine yazılmaz).');

  const ffmpeg = pickFfmpeg(Boolean(options.subs));
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
        start: formatTime(start),
        end: formatTime(end),
        seconds: Math.round(length * 10) / 10,
        layout: options.layout ?? 'blur',
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

/** Videonun sesini 4 kHz mono ham veriye çevirip saniyelik ses düzeyini ölçer. */
function measureLoudness(video) {
  const rate = 4000;
  const meter = createLoudnessMeter(rate);
  return new Promise((fulfill) => {
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
    child.on('close', (code) => fulfill(code === 0 ? meter.series() : null));
  });
}

async function moments(argv) {
  const { positional, options } = parseCli(argv, {
    values: ['top', 'length', 'skip-start'],
    flags: ['no-audio'],
  });
  if (positional.length !== 1)
    throw new Error(
      'Kullanım: pnpm clip:moments <indirilen-klasör> [--top 10] [--length 40] [--skip-start 60] [--no-audio]',
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
  const length = number('length', 40, 10, 180);
  const skipStart = number('skip-start', 60, 0, 3600);

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

  let audio = null;
  if (!options['no-audio'] && hasVideo) {
    requireTool('ffmpeg', '-version');
    console.log(
      '  Ses düzeyi ölçülüyor (uzun yayında birkaç dakika sürebilir)…',
    );
    audio = await measureLoudness(video);
  }

  const combined = combine({ replay, chat, audio });
  const names = { replay: 'tekrar izlenme', chat: 'sohbet', audio: 'ses' };
  ok(`Sinyaller: ${combined.used.map((name) => names[name]).join(', ')}`);
  if (!replay && !chat)
    console.log(
      '  [UYARI] Yalnız ses var: zirveler müzik ya da oyun sesi de olabilir. Sohbet için pnpm clip:fetch … --chat ile yeniden indir.',
    );

  const subtitle = readdirSync(dir).find(
    (name) => name.startsWith(`${source.videoId}.`) && name.endsWith('.vtt'),
  );
  const cues = subtitle
    ? parseSubtitles(readFileSync(join(dir, subtitle), 'utf8'))
    : [];
  const list = pickMoments(combined, { top, length, duration, skipStart }).map(
    (moment, i) => ({
      rank: i + 1,
      start: formatTime(moment.start),
      end: formatTime(moment.end),
      peak: formatTime(moment.peak),
      score: moment.score,
      why: names[moment.why],
      signals: moment.signals,
      transcript: transcriptFor(cues, moment.start, moment.end),
    }),
  );
  writeFileSync(
    join(dir, 'moments.json'),
    JSON.stringify({ source, signals: combined.used, moments: list }, null, 2) +
      '\n',
  );
  console.log('\n  #  Aralık              Puan  Neden            Transkript');
  for (const m of list)
    console.log(
      `  ${String(m.rank).padStart(2)} ${`${m.start}-${m.end}`.padEnd(19)} ${String(m.score).padEnd(5)} ${m.why.padEnd(16)} ${m.transcript.slice(0, 70)}`,
    );
  console.log(
    `\n${list.length} an moments.json dosyasına yazıldı. Puan sıralama içindir; son kararı transkripti okuyup klibi izleyerek ver.`,
  );
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'fetch') fetchSource(rest);
  else if (mode === 'cut') cut(rest);
  else if (mode === 'moments') await moments(rest);
  else
    throw new Error(
      'Kullanım: pnpm clip:fetch <youtube-adresi>  |  pnpm clip:moments <klasör>  |  pnpm clip:cut <video> --start … --end … --out … --permission …',
    );
} catch (error) {
  console.error(`\x1b[31m[HATA]\x1b[0m ${error.message}`);
  process.exitCode = 1;
}
