import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermanentError } from '../../lib/errors.ts';
import {
  captionCues,
  parseTimingJs,
  toAss,
  toSrt,
  wrapTwoLines,
  type TimingData,
} from './captions.ts';

const word = (w: string, s: number) => ({ w, s, e: s + 0.25 });
const timing: TimingData = {
  duration: 5,
  lines: [
    {
      start: 0.1,
      end: 2,
      words: [
        word('Planörün', 0.1),
        word('motoru', 0.5),
        word('yok.', 0.9),
        word('Yine', 1.3),
        word('de', 1.6),
        word('uçar.', 1.8),
      ],
    },
    { start: 2.3, end: 3, words: [word('Peki', 2.3), word('nasıl?', 2.7)] },
  ],
  phrases: [
    { n: 1, line: 0, text: 'Planörün motoru yok.', s: 0.04, e: 1.24 },
    { n: 2, line: 0, text: 'Yine de uçar.', s: 1.24, e: 2.24 },
    { n: 3, line: 1, text: 'Peki nasıl?', s: 2.24, e: 4.15 },
  ],
};

test('timing.js veri olarak okunur; kod çalıştırılmaz', () => {
  const source = `window.TIMING = ${JSON.stringify(timing)};\n`;
  assert.deepEqual(parseTimingJs(source), timing);
  for (const bad of [
    'alert(1); window.TIMING = {};',
    'window.TIMING = {"duration":1,"lines":[],"phrases":[]};',
    'window.TIMING = {duration: 1};',
    `window.TIMING = ${JSON.stringify({ ...timing, phrases: [{ ...timing.phrases[0], line: 9 }] })};`,
    '',
  ])
    assert.throws(() => parseTimingJs(bad), PermanentError, bad.slice(0, 30));
});

test('parçalar kelime zamanlarıyla eşlenir', () => {
  const cues = captionCues(timing);
  assert.deepEqual(
    cues.map((cue) => cue.words.map((item) => item.w).join(' ')),
    ['Planörün motoru yok.', 'Yine de uçar.', 'Peki nasıl?'],
  );
  assert.throws(
    () =>
      captionCues({
        ...timing,
        phrases: [{ n: 1, line: 1, text: 'üç kelime var', s: 0, e: 1 }],
      }),
    PermanentError,
  );
});

test('en çok iki dengeli satır', () => {
  assert.deepEqual(wrapTwoLines('kısa metin'), ['kısa metin']);
  const rows = wrapTwoLines('Modern bir planör bin metre alçalırken');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows, ['Modern bir planör', 'bin metre alçalırken']);
  assert.equal(wrapTwoLines('a '.repeat(80).trim()).length, 2);
});

test('SRT: satır modunda parça başına kayıt, kelime modunda kelime başına', () => {
  const cues = captionCues(timing);
  const srt = toSrt(cues, 'line');
  assert.equal(
    srt.split('\n\n')[0],
    '1\n00:00:00,040 --> 00:00:01,240\nPlanörün motoru yok.',
  );
  const blocks = srt.trim().split('\n\n');
  assert.equal(blocks.length, 3);
  for (const block of blocks)
    assert.ok(block.split('\n').length <= 4, 'en çok iki metin satırı');

  const words = toSrt(cues, 'word').trim().split('\n\n');
  assert.equal(words.length, 8);
  assert.equal(words[1], '2\n00:00:00,460 --> 00:00:00,860\nmotoru');
  // Kayıtlar sıralı ve üst üste binmiyor
  const times = words.map((block) => block.split('\n')[1]!.split(' --> '));
  times.forEach((pair, index) => {
    assert.ok(pair[0]! < pair[1]!);
    if (index > 0) assert.ok(times[index - 1]![1]! <= pair[0]!);
  });
});

test('SRT ve ASS yapısı metinle bozulamaz', () => {
  const hostile: TimingData = {
    duration: 3,
    lines: [
      {
        start: 0,
        end: 2,
        words: [word('{\\an8}üst', 0), word('-->', 0.5), word('<b>x</b>', 1)],
      },
    ],
    phrases: [{ n: 1, line: 0, text: '{\\an8}üst --> <b>x</b>', s: 0, e: 2 }],
  };
  const cues = captionCues(hostile);
  const srt = toSrt(cues, 'line');
  assert.equal(srt.split('-->').length, 2, 'yalnız zaman satırındaki ok kalır');
  const ass = toAss(cues, 'line');
  const dialogue = ass
    .split('\n')
    .filter((line) => line.startsWith('Dialogue:'));
  assert.equal(dialogue.length, 1);
  assert.ok(
    !/[{}\\]/.test(dialogue[0]!.replace('\\N', '')),
    'biçim etiketi yok',
  );
  // Kelime modunda yalnız kendi ürettiğimiz \k etiketleri vardır
  const karaoke = toAss(cues, 'word')
    .split('\n')
    .find((line) => line.startsWith('Dialogue:'))!;
  assert.deepEqual(karaoke.match(/\{[^}]*\}/g), [
    '{\\k50}',
    '{\\k50}',
    '{\\k100}',
  ]);
  assert.match(ass, /PlayResX: 1080\nPlayResY: 1920/);
  assert.match(ass, /Style: Default,Arial,/);
});
