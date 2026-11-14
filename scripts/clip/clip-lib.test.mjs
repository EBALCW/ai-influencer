import { test } from 'node:test';
import assert from 'node:assert/strict';
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

test('YouTube adresi: tek video kabul, diğer her şey ret', () => {
  const expected = {
    videoId: 'abcDEF_-123',
    url: 'https://www.youtube.com/watch?v=abcDEF_-123',
  };
  for (const url of [
    'https://www.youtube.com/watch?v=abcDEF_-123&t=42s&list=PL123',
    'https://youtu.be/abcDEF_-123?si=xyz',
    'https://www.youtube.com/shorts/abcDEF_-123',
    'https://www.youtube.com/live/abcDEF_-123',
    'https://m.youtube.com/watch?v=abcDEF_-123',
  ])
    assert.deepEqual(parseYoutubeUrl(url), expected);
  for (const url of [
    '',
    'abcDEF_-123',
    'http://www.youtube.com/watch?v=abcDEF_-123',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/@kanal',
    'https://www.youtube.com/watch?v=kisa',
    'https://youtube.com.evil.example/watch?v=abcDEF_-123',
    'https://vimeo.com/123456789',
    '--exec=id',
  ])
    assert.throws(() => parseYoutubeUrl(url), /YouTube|video|Adres/);
});

test('zaman okuma ve yazma', () => {
  assert.equal(parseTime('75'), 75);
  assert.equal(parseTime('1:15'), 75);
  assert.equal(parseTime('01:15.5'), 75.5);
  assert.equal(parseTime('1:02:03'), 3723);
  for (const bad of ['', 'abc', '1:75', '1:2:3:4', '-5', '1:', '--end'])
    assert.throws(() => parseTime(bad));
  assert.equal(formatTime(75), '01:15');
  assert.equal(formatTime(3723.9), '1:02:03');
});

test('klip aralığı: süre sınırları ve video sonu', () => {
  assert.deepEqual(validateRange(10, 40, 100), {
    start: 10,
    end: 40,
    length: 30,
  });
  assert.throws(() => validateRange(40, 10), /büyük/);
  assert.throws(() => validateRange(0, 3), /saniye arasında/);
  assert.throws(() => validateRange(0, 181), /saniye arasında/);
  assert.throws(() => validateRange(90, 120, 100), /aşıyor/);
  assert.doesNotThrow(() => validateRange(90, 120, null));
});

// YouTube cue içinde tek boşluktan oluşan satır kullanır (SP); editör kırpmasın diye açık yazıldı
const SP = ' ';
const AUTO_VTT = [
  'WEBVTT',
  'Kind: captions',
  'Language: tr',
  '',
  '00:00:01.000 --> 00:00:03.000 align:start position:0%',
  SP,
  'bugün<00:00:01.500><c> size</c><00:00:02.000><c> bir</c>',
  '',
  '00:00:03.000 --> 00:00:03.010 align:start position:0%',
  'bugün size bir',
  SP,
  '',
  '00:00:03.010 --> 00:00:05.000 align:start position:0%',
  'bugün size bir',
  'şey<00:00:03.500><c> anlatacağım</c>',
  '',
  '00:00:05.000 --> 00:00:05.010 align:start position:0%',
  'şey anlatacağım',
  SP,
  '',
  '00:00:25.000 --> 00:00:27.000',
  'Tom &amp; Jerry',
  '',
].join('\n');

test('altyazı: YouTube otomatik altyazısındaki tekrarlar atılır', () => {
  assert.deepEqual(parseSubtitles(AUTO_VTT), [
    { start: 1, end: 3, text: 'bugün size bir' },
    { start: 3.01, end: 5, text: 'şey anlatacağım' },
    { start: 25, end: 27, text: 'Tom & Jerry' },
  ]);
  assert.equal(
    toTranscript(parseSubtitles(AUTO_VTT)),
    '[00:01] bugün size bir şey anlatacağım\n[00:25] Tom & Jerry',
  );
});

test('altyazı: SRT de okunur, klip SRT’si sıfırdan başlar ve aralığa kırpılır', () => {
  const cues = parseSubtitles(
    '1\r\n00:00:08,000 --> 00:00:12,000\r\nilk\r\n\r\n2\r\n00:00:12,000 --> 00:00:20,000\r\nikinci\r\n\r\n3\r\n00:01:00,000 --> 00:01:02,000\r\ndışarıda\r\n',
  );
  assert.equal(cues.length, 3);
  assert.equal(
    clipSrt(cues, 10, 15),
    '1\n00:00:00,000 --> 00:00:02,000\nilk\n\n2\n00:00:02,000 --> 00:00:05,000\nikinci\n',
  );
  assert.equal(clipSrt(cues, 30, 40), '');
});

test('yt-dlp argümanları: tek video, adres seçenek olarak yorumlanamaz', () => {
  const args = fetchArgs('https://www.youtube.com/watch?v=abcDEF_-123', 'out');
  assert.ok(args.includes('--no-playlist'));
  assert.deepEqual(args.slice(-2), [
    '--',
    'https://www.youtube.com/watch?v=abcDEF_-123',
  ]);
  assert.equal(args[args.indexOf('--sub-langs') + 1], 'tr,en');
  assert.ok(
    fetchArgs('u', 'out', { video: false }).includes('--skip-download'),
  );
  assert.throws(() => fetchArgs('u', 'out', { languages: ['tr;rm'] }));
});

test('ffmpeg argümanları: dikey çıktı, üzerine yazmaz, altyazı zincirin sonunda', () => {
  const blur = cutArgs({
    input: 'in.mp4',
    output: 'out.mp4',
    start: 10,
    end: 40,
  });
  assert.ok(blur.includes('-n'));
  assert.ok(!blur.includes('-y'));
  assert.deepEqual(blur.slice(blur.indexOf('-ss'), blur.indexOf('-i') + 2), [
    '-ss',
    '10',
    '-t',
    '30',
    '-i',
    'in.mp4',
  ]);
  const graph = blur[blur.indexOf('-filter_complex') + 1];
  assert.match(graph, /boxblur/);
  assert.match(graph, /overlay/);
  assert.match(graph, /1080:1920/);
  assert.equal(blur.at(-1), 'out.mp4');

  const crop = cutArgs({
    input: 'in.mp4',
    output: 'out.mp4',
    start: 0,
    end: 20,
    layout: 'crop',
    xOffset: -0.5,
    subtitles: 'subs.srt',
  });
  const cropGraph = crop[crop.indexOf('-filter_complex') + 1];
  assert.match(cropGraph, /crop=/);
  assert.match(cropGraph, /scale=1080:1920/);
  assert.match(
    cropGraph,
    /format=yuv420p,subtitles=filename=subs\.srt[^,]*\[v\]$|subtitles=filename=subs\.srt.*\[v\]$/,
  );
  assert.ok(
    cropGraph.indexOf('subtitles=') > cropGraph.indexOf('scale=1080:1920'),
  );

  assert.throws(() =>
    cutArgs({ input: 'a', output: 'b', start: 0, end: 9, layout: 'wide' }),
  );
  assert.throws(() =>
    cutArgs({ input: 'a', output: 'b', start: 0, end: 9, xOffset: 2 }),
  );
  assert.throws(() =>
    cutArgs({
      input: 'a',
      output: 'b',
      start: 0,
      end: 9,
      subtitles: "x':y.srt",
    }),
  );
});

test('izin referansı: kısa ad zorunlu, kişisel bilgi ve bağlantı yazılmaz', () => {
  assert.equal(
    validatePermission('  yazılı izin – kısıtlı depoda: IZIN-014 '),
    'yazılı izin – kısıtlı depoda: IZIN-014',
  );
  for (const bad of [
    '',
    '  ',
    'ok',
    'ali@example.com',
    'https://drive.example/izin',
    'x'.repeat(121),
  ])
    assert.throws(() => validatePermission(bad));
});

test('komut satırı ayrıştırma', () => {
  const spec = { values: ['start', 'x-offset'], flags: ['own'] };
  assert.deepEqual(
    parseCli(
      ['video.mp4', '--start', '1:00', '--own', '--x-offset', '-0.3'],
      spec,
    ),
    {
      positional: ['video.mp4'],
      options: { start: '1:00', own: true, 'x-offset': '-0.3' },
    },
  );
  assert.throws(() => parseCli(['--start'], spec), /eksik/);
  assert.throws(() => parseCli(['--start', '--own'], spec), /eksik/);
  assert.throws(
    () => parseCli(['--start', '1', '--start', '2'], spec),
    /iki kez/,
  );
  assert.throws(() => parseCli(['--overwrite'], spec), /Bilinmeyen/);
});

test('clipSrt absolute: zamanlar kaynağa göre kalır, yeniden kesilince aynı klibi verir', () => {
  const cues = [
    { start: 95, end: 99, text: 'önce' },
    { start: 100, end: 104, text: 'bir' },
    { start: 104, end: 108, text: 'iki' },
  ];
  const absolute = clipSrt(cues, 100, 110, { absolute: true });
  assert.match(absolute, /00:01:40,000 --> 00:01:44,000\nbir/);
  assert.equal(
    clipSrt(parseSubtitles(absolute), 100, 110),
    clipSrt(cues, 100, 110),
  );
});
