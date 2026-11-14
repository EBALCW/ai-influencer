// Yayıncı klipleri için saf mantık: URL doğrulama, zaman, VTT/SRT, yt-dlp ve ffmpeg argümanları.
// Dosya sistemi ve süreç çağrısı yok; hepsi clip.mjs içinde. Testler: clip-lib.test.mjs.

export const MIN_CLIP_SECONDS = 5;
export const MAX_CLIP_SECONDS = 180;
export const LAYOUTS = ['blur', 'crop'];

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Sadece tek bir YouTube videosu kabul edilir; playlist, kanal ve başka siteler reddedilir. */
export function parseYoutubeUrl(input) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    throw new Error('Geçerli bir YouTube video adresi ver.');
  }
  if (url.protocol !== 'https:' || !YOUTUBE_HOSTS.has(url.hostname))
    throw new Error(
      'Sadece https://www.youtube.com veya https://youtu.be video adresleri desteklenir.',
    );
  const parts = url.pathname.split('/').filter(Boolean);
  let videoId = null;
  if (url.hostname === 'youtu.be') videoId = parts[0];
  else if (parts[0] === 'watch') videoId = url.searchParams.get('v');
  else if (['shorts', 'live', 'embed'].includes(parts[0])) videoId = parts[1];
  if (!videoId || !VIDEO_ID.test(videoId))
    throw new Error(
      'Adres tek bir videoyu göstermeli (kanal veya oynatma listesi olmaz).',
    );
  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

/** "75", "1:15", "01:15.5", "1:02:03" → saniye. */
export function parseTime(value) {
  const text = String(value ?? '').trim();
  if (!/^(\d+:){0,2}\d+(\.\d+)?$/.test(text))
    throw new Error(`Zaman "${text}" okunamadı. Örnek: 75, 1:15 veya 1:02:03.`);
  const parts = text.split(':').map(Number);
  if (parts.slice(1).some((part) => part >= 60))
    throw new Error(
      `Zaman "${text}" geçersiz: dakika ve saniye 60'tan küçük olmalı.`,
    );
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function validateRange(start, end, duration) {
  if (!(start >= 0) || !(end > start))
    throw new Error('Bitiş, başlangıçtan büyük olmalı.');
  const length = end - start;
  if (length < MIN_CLIP_SECONDS || length > MAX_CLIP_SECONDS)
    throw new Error(
      `Klip ${MIN_CLIP_SECONDS}-${MAX_CLIP_SECONDS} saniye arasında olmalı (istenen: ${Math.round(length)} sn).`,
    );
  if (duration != null && end > duration + 0.5)
    throw new Error(
      `Bitiş (${formatTime(end)}) videonun süresini (${formatTime(duration)}) aşıyor.`,
    );
  return { start, end, length };
}

const VTT_TIME =
  /^((?:\d+:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d+:)?\d{2}:\d{2}[.,]\d{3})/;

function cleanCueText(line) {
  return line
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * WebVTT veya SRT metnini satırlara ayırır. YouTube otomatik altyazısı aynı satırı
 * kayan pencereyle tekrar eder; tekrarlar atılır, her satır ilk göründüğü anla kalır.
 */
export function parseSubtitles(text) {
  const cues = [];
  let current = null;
  for (const raw of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
    const match = VTT_TIME.exec(raw.trim());
    if (match) {
      current = {
        start: parseTime(match[1].replace(',', '.')),
        end: parseTime(match[2].replace(',', '.')),
        lines: [],
      };
      cues.push(current);
    } // YouTube cue içinde tek boşluklu satır kullanır; cue'yu yalnız tamamen boş satır bitirir
    else if (raw === '') current = null;
    else if (current) {
      const line = cleanCueText(raw);
      if (line) current.lines.push(line);
    }
  }
  const out = [];
  let previous = [];
  for (const cue of cues) {
    const fresh = cue.lines.filter((line) => !previous.includes(line));
    previous = cue.lines;
    // 10 ms'lik "geçiş" satırları yalnızca bir önceki metni tekrarlar
    if (fresh.length === 0 || cue.end - cue.start < 0.05) continue;
    out.push({ start: cue.start, end: cue.end, text: fresh.join(' ') });
  }
  return out;
}

/** Klip seçerken okunacak metin: yaklaşık `window` saniyelik bloklar, başında zaman. */
export function toTranscript(cues, window = 20) {
  const blocks = [];
  let block = null;
  for (const cue of cues) {
    if (!block || cue.start - block.start >= window) {
      block = { start: cue.start, parts: [] };
      blocks.push(block);
    }
    block.parts.push(cue.text);
  }
  return blocks
    .map((b) => `[${formatTime(b.start)}] ${b.parts.join(' ')}`)
    .join('\n');
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n, width = 2) => String(n).padStart(width, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))},${pad(ms % 1000, 3)}`;
}

/**
 * [start, end] aralığına düşen satırları, klip 0'dan başlayacak şekilde SRT'ye çevirir.
 * `absolute` verilirse zamanlar kaynak videoya göre kalır: çeviri için ayrılan dosya
 * sonradan yine clip:cut --subs ile kullanılabilsin diye.
 */
export function clipSrt(cues, start, end, { absolute = false } = {}) {
  const shift = absolute ? 0 : start;
  const inside = cues
    .filter((cue) => cue.end > start && cue.start < end)
    .map((cue) => ({
      start: Math.max(cue.start, start) - shift,
      end: Math.min(cue.end, end) - shift,
      text: cue.text,
    }));
  // Otomatik altyazıda satırlar üst üste biner; bir sonraki başlayınca öncekini bitir
  for (let i = 0; i < inside.length - 1; i++)
    inside[i].end = Math.min(inside[i].end, inside[i + 1].start);
  return inside
    .filter((cue) => cue.end - cue.start > 0.05)
    .map(
      (cue, i) =>
        `${i + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`,
    )
    .join('\n');
}

/** yt-dlp argümanları. Çıktı adı video kimliği: başlıktaki özel karakter sorun çıkarmaz. */
export function fetchArgs(
  url,
  dir,
  { languages = ['tr', 'en'], video = true, chat = false } = {},
) {
  for (const language of languages)
    if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(language))
      throw new Error(`Dil kodu "${language}" geçersiz. Örnek: tr, en, pt-BR.`);
  return [
    '--no-playlist',
    '--no-progress',
    '--restrict-filenames',
    // Altyazı ya da sohbet indirilemezse (ör. HTTP 429) video ve bilgiler yine de alınsın;
    // neyin eksik kaldığını clip.mjs dosyalara bakarak raporlar
    '--ignore-errors',
    '--sleep-subtitles',
    '1',
    '--paths',
    dir,
    '--output',
    '%(id)s.%(ext)s',
    '--write-info-json',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs',
    // live_chat: canlı yayının sohbet tekrarı (<id>.live_chat.json), clip:moments kullanır
    [...languages, ...(chat ? ['live_chat'] : [])].join(','),
    '--sub-format',
    'vtt',
    ...(video
      ? [
          '--format',
          'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b[height<=1080]',
          '--merge-output-format',
          'mp4',
        ]
      : ['--skip-download']),
    '--',
    url,
  ];
}

const SUBTITLE_STYLE =
  'FontName=Arial,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60,MarginL=20,MarginR=20';

/**
 * ffmpeg argümanları: [start, end] aralığını 1080×1920, 30 fps, H.264 + AAC olarak üretir.
 *   blur → videonun tamamı ortada, arkada aynı görüntünün bulanık dolgusu (hiçbir şey kırpılmaz)
 *   crop → ortadan (xOffset ile kaydırılabilir) 9:16 kırpma, ekranı doldurur
 * `subtitles` verilirse ffmpeg'in çalışma klasöründeki dosya adıdır (yol değil): filtre
 * içinde Windows yolu kaçırmak yerine clip.mjs geçici klasörde çalıştırır.
 */
export function cutArgs({
  input,
  output,
  start,
  end,
  layout = 'blur',
  xOffset = 0,
  subtitles = null,
}) {
  if (!LAYOUTS.includes(layout))
    throw new Error(`Yerleşim ${LAYOUTS.join(' veya ')} olmalı.`);
  if (!(xOffset >= -1 && xOffset <= 1))
    throw new Error('--x-offset -1 (sol) ile 1 (sağ) arasında olmalı.');
  if (subtitles && !/^[A-Za-z0-9_.-]+$/.test(subtitles))
    throw new Error(
      'Altyazı dosya adı yalnız harf, rakam, nokta ve tire içerebilir.',
    );
  const length = end - start;
  const caption = subtitles
    ? `,subtitles=filename=${subtitles}:force_style='${SUBTITLE_STYLE}'`
    : '';
  const tail = `fps=30,format=yuv420p${caption}`;
  const square = 'scale=trunc(iw*sar/2)*2:ih,setsar=1';
  const video =
    layout === 'crop'
      ? `[0:v:0]${square},crop=w='min(iw,ih*9/16)':h=ih:x='(iw-ow)/2*(1+${xOffset})':y=0,scale=1080:1920,setsar=1,${tail}[v]`
      : `[0:v:0]${square},split=2[bg][fg];` +
        `[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.08[blurred];` +
        `[fg]scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2[front];` +
        `[blurred][front]overlay=(W-w)/2:(H-h)/2,setsar=1,${tail}[v]`;
  const fade = 0.03;
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-n',
    '-protocol_whitelist',
    'file,pipe',
    '-ss',
    String(start),
    '-t',
    String(length),
    '-i',
    input,
    '-filter_complex',
    video,
    '-map',
    '[v]',
    '-map',
    '0:a:0?',
    // Kesim noktasında "çıt" sesi olmasın
    '-af',
    `afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, length - fade).toFixed(3)}:d=${fade}`,
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-maxrate',
    '16M',
    '-bufsize',
    '32M',
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-movflags',
    '+faststart',
    output,
  ];
}

/** Kısa referans: belge, e-posta veya kişisel bilgi buraya yazılmaz (docs/compliance.md). */
export function validatePermission(reference) {
  const text = String(reference ?? '').trim();
  if (text.length < 3 || text.length > 120)
    throw new Error(
      'İzin referansı 3-120 karakter olmalı. Örnek: "yazılı izin – kısıtlı depoda: IZIN-2026-014".',
    );
  if (/@|https?:\/\//i.test(text))
    throw new Error(
      'İzin referansına e-posta veya bağlantı yazma; kısıtlı depodaki kaydın kısa adını yaz.',
    );
  return text;
}

/** Komut satırı: konumsal argümanlar + `--ad değer` + bayraklar. Bilinmeyen seçenek hatadır. */
export function parseCli(argv, { values = [], flags = [] }) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) positional.push(arg);
    else if (flags.includes(arg.slice(2))) options[arg.slice(2)] = true;
    else if (values.includes(arg.slice(2))) {
      const value = argv[++i];
      // Negatif sayı (--x-offset -0.3) değerdir; başka bir seçenek değil
      if (value === undefined || /^--[a-z]/.test(value))
        throw new Error(`${arg} için değer eksik.`);
      if (arg.slice(2) in options) throw new Error(`${arg} iki kez verildi.`);
      options[arg.slice(2)] = value;
    } else throw new Error(`Bilinmeyen seçenek: ${arg}`);
  }
  return { positional, options };
}
