#!/usr/bin/env node
// Yayıncı videolarından kısa dikey klip (Reels / Shorts / TikTok).
//   pnpm clip:fetch <youtube-adresi> [--out <klasör>] [--lang tr,en] [--no-video]
//       Videoyu, altyazıyı ve zaman damgalı transkripti ~/ai-influencer-clips/<id>/ altına indirir.
//   pnpm clip:cut <video> --start 12:30 --end 13:05 --out <klip.mp4> --permission "<izin referansı>"
//       [--layout blur|crop] [--x-offset -1..1] [--subs <altyazı.vtt|srt>]
//       Aralığı 1080×1920 H.264 olarak keser. --permission yerine: açık lisanslı kaynakta
//       --open-license "<lisans adı>", kendi çekiminde --own.
//
// Kural (docs/compliance.md → Kaynak içerik): başkasının videosu yalnızca hak sahibinin
// yazılı izniyle kullanılır. İzin referansı olmadan kesim yapılmaz.
// Gereksinim: yt-dlp, ffmpeg, ffprobe (PATH'te). Altyazı gömmek için libass'lı ffmpeg gerekir;
// farklı bir ffmpeg kullanmak için FFMPEG_PATH ayarla. Ayrıntı: docs/clip-guide.md.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
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
import { fileURLToPath } from 'node:url';
import { isInside } from '../lib/panel-lib.mjs';
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
    flags: ['no-video'],
  });
  if (positional.length !== 1)
    throw new Error(
      'Kullanım: pnpm clip:fetch <youtube-adresi> [--out <klasör>] [--lang tr,en] [--no-video]',
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
    fetchArgs(url, dir, { languages, video: !options['no-video'] }),
    { stdio: 'inherit' },
  );
  if (r.status !== 0)
    throw new Error(
      'İndirme başarısız. Adresi, internet bağlantısını ve videonun herkese açık olduğunu kontrol et; yt-dlp eskiyse güncelle.',
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
  // info.json çok büyük ve gereksiz ayrıntı içerir; gerekenler source.json'da
  rmSync(join(dir, `${videoId}.info.json`), { force: true });

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
  if (subtitles.length === 0)
    console.log(
      '  [UYARI] Bu videoda istenen dillerde altyazı yok; klip anlarını videoyu izleyerek seç ya da --lang ile başka dil dene.',
    );
  console.log(
    `\nKlasör: ${dir}\n` +
      'Sonraki adım: transkriptten klip anlarını seç, sonra pnpm clip:cut.\n' +
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

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'fetch') fetchSource(rest);
  else if (mode === 'cut') cut(rest);
  else
    throw new Error(
      'Kullanım: pnpm clip:fetch <youtube-adresi>  |  pnpm clip:cut <video> --start … --end … --out … --permission …',
    );
} catch (error) {
  console.error(`\x1b[31m[HATA]\x1b[0m ${error.message}`);
  process.exitCode = 1;
}
