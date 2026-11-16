// Anlatım işleyicilerinin testleri için sahte araçlar: gerçek edge-tts, HyperFrames ve ffmpeg
// yerine aynı dosyaları yazan küçük bir program. Aşama akışını, çıktıları ve hata eşlemesini
// ağır araçlar olmadan (Linux CI) denemek içindir; görüntü ya da ses ÜRETMEZ.
//   node explainer-shim.mjs <araç> <argümanlar…>
// SHIM_FAIL=<ad> ile o adım hata verir; SHIM_BIG ile birleştirilen video sınırı aşar;
// SHIM_SLEEP_MS ile seslendirme adımı bekler (iptal testi).
import fs from 'node:fs';
import path from 'node:path';

const [tool, ...args] = process.argv.slice(2);
const fail = process.env.SHIM_FAIL ?? '';
const die = (name) => {
  if (fail !== name) return;
  // Gerçek araçlar gibi: hata çıktısında senaryo metni geçebilir
  console.error(`sahte hata (${name}): ${process.env.SHIM_ECHO ?? ''}`);
  process.exit(1);
};
const write = (file, body) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};
const after = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const spec = (reel) =>
  JSON.parse(fs.readFileSync(path.join(reel, 'spec.json'), 'utf8'));
const tokens = (line) =>
  line
    .replace(/\*/g, '')
    .split(/\s+/)
    .filter((token) => token && token !== '|');
/** Sahte video: ilk satırı süreyi taşıyan JSON, gerisi dolgu. */
const fakeVideo = (seconds, padBytes = 0) =>
  `${JSON.stringify({ duration: seconds })}\n${'0'.repeat(padBytes)}`;
const videoSeconds = (file) =>
  JSON.parse(fs.readFileSync(file, 'utf8').split('\n')[0]).duration;

if (tool === 'python') {
  const [script, reel] = args;
  if (script.endsWith('edge_takes.py')) {
    die('edge');
    // İptal testi: uzun süren bir kayıt gibi bekler
    if (process.env.SHIM_SLEEP_MS)
      await new Promise((resolve) =>
        setTimeout(resolve, Number(process.env.SHIM_SLEEP_MS)),
      );
    spec(reel).lines.forEach((line, i) => {
      const base = path.join(
        reel,
        'voice',
        'takes',
        String(i).padStart(2, '0'),
      );
      write(`${base}.mp3`, 'sahte-mp3');
      write(
        `${base}.words.json`,
        JSON.stringify(
          tokens(line).map((text, k) => ({
            text,
            start: k * 0.3,
            end: k * 0.3 + 0.25,
          })),
        ),
      );
    });
  } else if (script.endsWith('voice.py')) {
    die('voice');
    let t = 0.1;
    const lines = spec(reel).lines.map((line) => {
      const words = tokens(line).map((w) => {
        const word = {
          w,
          s: Math.round(t * 1000) / 1000,
          e: Math.round((t + 0.25) * 1000) / 1000,
        };
        t += 0.3;
        return word;
      });
      t += 0.14;
      return {
        text: words.map((word) => word.w).join(' '),
        speaker: 'host',
        start: words[0].s,
        end: words[words.length - 1].e,
        words,
      };
    });
    write(path.join(reel, 'voice', 'vo.wav'), 'sahte-wav');
    write(
      path.join(reel, 'voice', 'timing.json'),
      JSON.stringify({
        duration: Math.round((t + 0.8) * 1000) / 1000,
        engine: 'files',
        tempo: 1,
        lines,
      }),
    );
  } else if (script.endsWith('zaman_js.py')) {
    die('zaman');
    // zaman_js.py ile aynı kural: " | " ve cümle sonu noktalama parçayı böler
    const timing = JSON.parse(
      fs.readFileSync(path.join(reel, 'voice', 'timing.json'), 'utf8'),
    );
    const groups = [];
    spec(reel).lines.forEach((raw, i) => {
      const words = timing.lines[i].words;
      let k = 0;
      let cur = [];
      for (const token of raw.replace(/\*/g, '').split(/\s+/).filter(Boolean)) {
        if (token === '|') {
          if (cur.length) groups.push([i, cur]);
          cur = [];
          continue;
        }
        cur.push(words[k++]);
        if ('.?!;:'.includes(token.at(-1))) {
          groups.push([i, cur]);
          cur = [];
        }
      }
      if (cur.length) groups.push([i, cur]);
    });
    const phrases = groups.map(([line, ws], n) => {
      const next = groups[n + 1] ? groups[n + 1][1][0].s : timing.duration;
      return {
        n: n + 1,
        line,
        text: ws.map((word) => word.w).join(' '),
        s: Math.round(Math.max(0, ws[0].s - 0.06) * 1000) / 1000,
        e: Math.round(Math.min(next - 0.06, ws.at(-1).e + 1.2) * 1000) / 1000,
      };
    });
    write(
      path.join(reel, 'assets', 'timing.js'),
      `window.TIMING = ${JSON.stringify({
        duration: timing.duration,
        lines: timing.lines.map(({ start, end, words }) => ({
          start,
          end,
          words,
        })),
        phrases,
      })};\n`,
    );
    write(path.join(reel, 'out', 'captions.srt'), 'sahte\n');
  } else process.exit(64);
} else if (tool === 'hyperframes') {
  const [command, reel] = args;
  if (command === 'lint') die('lint');
  else if (command === 'snapshot') {
    die('snapshot');
    after('--at')
      .split(',')
      .forEach((_, i) =>
        write(
          path.join(
            after('--output'),
            `frame-${String(i).padStart(2, '0')}.png`,
          ),
          'sahte-png',
        ),
      );
  } else if (command === 'render') {
    die('render');
    const html = fs.readFileSync(path.join(reel, 'index.html'), 'utf8');
    write(
      after('--output'),
      fakeVideo(Number(/data-duration="([0-9.]+)"/.exec(html)[1])),
    );
  } else process.exit(64);
} else if (tool === 'node') {
  // sfx-sync.mjs mix <cues.json> --voice … --out … --seconds … --video … --mux …
  die('mix');
  JSON.parse(fs.readFileSync(args[2], 'utf8'));
  write(after('--out'), 'sahte-mix');
  write(
    after('--mux'),
    fakeVideo(Number(after('--seconds')), process.env.SHIM_BIG ? 800_000 : 0),
  );
} else if (tool === 'ffmpeg') {
  const output = args.at(-1);
  const input = after('-i');
  if (output === '-') {
    if (args.includes('ebur128'))
      console.error(
        `  Integrated loudness:\n    I:  ${process.env.SHIM_LUFS ?? '-14.1'} LUFS`,
      );
    if (
      process.env.SHIM_BLACK === '1' &&
      args.some((arg) => arg.startsWith('blackdetect'))
    )
      console.error(
        '[blackdetect @ 0x0] black_start:0 black_end:1.5 black_duration:1.5',
      );
  } else if (output.endsWith('.mp4')) {
    die('encode');
    // Yeniden kodlama: dolgu atılır (dosya küçülür); SHIM_BIG=2 ise küçülmez
    write(
      output,
      fakeVideo(
        videoSeconds(input),
        process.env.SHIM_BIG === '2' ? 800_000 : 0,
      ),
    );
  } else write(output, `sahte-${path.extname(output).slice(1)}`);
} else if (tool === 'ffprobe') {
  const seconds =
    videoSeconds(args.at(-1)) + Number(process.env.SHIM_DRIFT ?? 0);
  console.log(
    JSON.stringify({
      format: { duration: String(seconds) },
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920 },
        ...(process.env.SHIM_MUTE === '1'
          ? []
          : [{ codec_type: 'audio', codec_name: 'aac' }]),
      ],
    }),
  );
} else process.exit(64);
