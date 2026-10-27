import { spawn } from 'node:child_process';
import { lstat, realpath, mkdtemp, link, rm } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseArgs(args) {
  const mute = args.includes('--mute');
  const paths = args.filter((arg) => arg !== '--mute');
  if (
    paths.length !== 2 ||
    paths.some((arg) => arg.startsWith('--')) ||
    args.filter((arg) => arg === '--mute').length > 1
  )
    throw new Error('Kullanım: pnpm video:export <girdi> <çıktı.mp4> [--mute]');
  const [input, output] = paths.map((value) => resolve(value));
  if (extname(output).toLowerCase() !== '.mp4')
    throw new Error('Çıktı uzantısı .mp4 olmalı.');
  if (input === output) throw new Error('Girdi ve çıktı farklı olmalı.');
  return { input, output, mute };
}

export function exportArgs(input, output, mute) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-n',
    '-protocol_whitelist',
    'file,pipe',
    '-i',
    input,
    '-map',
    '0:v:0',
    ...(mute ? ['-an'] : ['-map', '0:a:0?', '-c:a', 'aac', '-b:a', '192k']),
    '-vf',
    'scale=trunc(iw*sar/2)*2:ih,setsar=1,scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p',
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

function run(args) {
  return new Promise((fulfill, reject) => {
    const child = spawn('ffmpeg', args, { shell: false, stdio: 'ignore' });
    child.on('error', () =>
      reject(new Error('FFmpeg başlatılamadı; ffmpeg PATH üzerinde olmalı.')),
    );
    child.on('close', (code) =>
      code === 0
        ? fulfill()
        : reject(
            new Error(
              'Export başarısız. Girdinin okunabilir video olduğunu ve FFmpeg kurulumunda libx264/AAC bulunduğunu kontrol et.',
            ),
          ),
    );
  });
}

export async function exportVideo({ input, output, mute }) {
  const source = await realpath(input);
  if (!(await lstat(source)).isFile())
    throw new Error('Girdi bir dosya olmalı.');
  try {
    await lstat(output);
    throw new Error('Çıktı zaten var; yeni bir versiyon adı seç.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Aynı diskte geçici çıktı: başarısız iş final dosya bırakmaz.
  const temporary = await mkdtemp(join(dirname(output), '.video-export-'));
  try {
    const rendered = join(temporary, 'final.mp4');
    await run(exportArgs(source, rendered, mute));
    // link() mevcut hedefi ezmez; aynı anda açılan bir dosya da korunur.
    await link(rendered, output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await exportVideo(parseArgs(process.argv.slice(2)));
    console.log(
      'Export tamamlandı. Yayından önce kurgu ve telefon QC kontrolünü yap.',
    );
  } catch (error) {
    const message = error.code
      ? 'Dosya işlemi başarısız; girdi, çıktı klasörü, izinler ve boş alanı kontrol et.'
      : error.message;
    console.error(message);
    process.exitCode = 1;
  }
}
