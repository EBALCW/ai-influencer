import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketize,
  chatSeries,
  clipCountFor,
  combine,
  createLoudnessMeter,
  pickMoments,
  replaySeries,
  robustScale,
  transcriptFor,
} from './moments-lib.mjs';

const chatLine = (ms, text) =>
  JSON.stringify({
    replayChatItemAction: {
      videoOffsetTimeMsec: String(ms),
      actions: [
        {
          addChatItemAction: {
            item: {
              liveChatTextMessageRenderer: { message: { runs: [{ text }] } },
            },
          },
        },
      ],
    },
  });

test('ısı haritası saniyelik diziye yayılır; yoksa null', () => {
  assert.equal(replaySeries(undefined, 100), null);
  assert.equal(replaySeries([], 100), null);
  const series = replaySeries(
    [
      { start_time: 0, end_time: 5, value: 0.1 },
      { start_time: 5, end_time: 10, value: 1 },
    ],
    10,
  );
  assert.deepEqual(
    Array.from(series),
    [0.1, 0.1, 0.1, 0.1, 0.1, 1, 1, 1, 1, 1],
  );
});

test('sohbet: gecikme geri alınır, tepki mesajı 3 sayılır, bozuk satır atlanır', () => {
  const series = chatSeries(
    [
      chatLine(20_000, 'merhaba'),
      chatLine(20_500, 'LMAOOO'),
      chatLine(21_000, '💀💀'),
      '{bozuk json',
      '',
      chatLine(-5, 'yayın öncesi'),
      chatLine(999_000, 'süre dışı'),
      JSON.stringify({
        replayChatItemAction: { videoOffsetTimeMsec: '30000' },
      }),
    ],
    60,
  );
  // 20 sn - 8 sn gecikme = 12. saniye: 1 (sıradan) + 3 (tepki); 13. saniye: 3
  assert.equal(series[12], 4);
  assert.equal(series[13], 3);
  assert.equal(
    series.reduce((a, b) => a + b, 0),
    7,
  );
  assert.equal(chatSeries(['{}', 'x'], 60), null);
});

test('ses ölçer: parça sınırı örneği bölse de saniyelik RMS doğru', () => {
  const rate = 4;
  const samples = [0, 0, 0, 0, 16384, -16384, 16384, -16384];
  const raw = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => raw.writeInt16LE(s, i * 2));
  const meter = createLoudnessMeter(rate);
  meter.push(raw.subarray(0, 5)); // tek sayıda bayt: örnek ortadan bölünür
  meter.push(raw.subarray(5));
  const series = meter.series();
  assert.equal(series.length, 2);
  assert.equal(series[0], 0);
  assert.ok(Math.abs(series[1] - 0.5) < 1e-9);
  assert.equal(createLoudnessMeter(rate).series(), null);
});

test('kova ve ölçekleme: düz sinyal sıfır, zirve öne çıkar ve 6 ile sınırlanır', () => {
  assert.deepEqual(
    Array.from(bucketize(Float64Array.of(1, 3, 5, 7, 9), 2)),
    [2, 6, 9],
  );
  assert.deepEqual(
    Array.from(robustScale(Float64Array.of(2, 2, 2, 2))),
    [0, 0, 0, 0],
  );
  const scaled = robustScale(Float64Array.of(1, 1.1, 0.9, 1, 1.05, 50));
  assert.equal(scaled[5], 6);
  assert.ok(scaled[0] < 1);
  // Çoğu kova aynı (MAD = 0) olsa bile tek sıçrama kaybolmaz
  assert.ok(robustScale(Float64Array.of(0, 0, 0, 0, 0, 0, 9))[6] > 2);
});

test('birleştirme: eksik sinyalin ağırlığı kalanlara dağılır; hiç sinyal yoksa hata', () => {
  assert.throws(() => combine({}), /sinyal/);
  const audio = new Float64Array(100).fill(0.1);
  audio.fill(0.9, 40, 45);
  const only = combine({ audio });
  assert.deepEqual(only.used, ['audio']);
  // Tek sinyal varken ağırlığı 1 olur: puan ölçeklenmiş değere eşit
  assert.equal(only.score[8], only.scaled.audio[8]);
  const replay = new Float64Array(100).fill(0.2);
  replay.fill(1, 40, 45);
  const both = combine({ audio, replay, chat: null });
  assert.deepEqual(both.used, ['replay', 'audio']);
  assert.equal(both.score.indexOf(Math.max(...both.score)), 8);
});

test('an seçimi: en güçlüler, birbirine yakın olanlar tek, aralık zirvenin önüne ağırlıklı', () => {
  const duration = 600;
  const audio = new Float64Array(duration).fill(0.1);
  audio.fill(0.9, 100, 105); // güçlü
  audio.fill(0.8, 115, 120); // aynı anın devamı: ayrı klip olmamalı
  audio.fill(0.6, 400, 405); // ikinci an
  audio.fill(0.95, 590, 595); // video sonu: aralık taşmamalı
  audio.fill(0.99, 5, 10); // yayın girişi: atlanacak
  const moments = pickMoments(combine({ audio }), {
    top: 5,
    length: 40,
    duration,
    skipStart: 30,
  });
  assert.equal(moments.length, 3);
  assert.ok(moments.every((m) => m.end - m.start === 40));
  assert.ok(moments.every((m) => m.start >= 0 && m.end <= duration));
  assert.ok(moments.every((m) => m.why === 'audio'));
  const first = moments.find((m) => m.peak > 100 && m.peak < 106);
  assert.ok(first, 'en güçlü an seçilmeli');
  // Zirve klibin ikinci yarısında: önce kurulum, sonra tepki
  assert.ok(first.peak - first.start > first.end - first.peak);
  assert.ok(!moments.some((m) => m.peak > 110 && m.peak < 125));
  assert.ok(moments.some((m) => m.end === duration));
  assert.deepEqual(
    moments.map((m) => m.score),
    moments.map((m) => m.score).sort((a, b) => b - a),
  );
});

test('transkript: aralıktaki satırlar, uzunsa kırpılır', () => {
  const cues = [
    { start: 0, end: 4, text: 'önce' },
    { start: 10, end: 14, text: 'içeride bir' },
    { start: 14, end: 18, text: 'cümle' },
    { start: 40, end: 44, text: 'sonra' },
  ];
  assert.equal(transcriptFor(cues, 9, 20), 'içeride bir cümle');
  assert.equal(transcriptFor(cues, 9, 20, 8), 'içeride…');
  assert.equal(transcriptFor(cues, 100, 120), '');
});

test('klip sayısı yayın süresine göre: 10 dakikaya bir, 3 ile 15 arasında', () => {
  assert.equal(clipCountFor(null), 3);
  assert.equal(clipCountFor(5 * 60), 3);
  assert.equal(clipCountFor(49 * 60), 5);
  assert.equal(clipCountFor(2 * 3600), 12);
  assert.equal(clipCountFor(8 * 3600), 15);
});
