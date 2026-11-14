import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessClip,
  boundaryKind,
  bucketize,
  chatSeries,
  clipCountFor,
  coarsen,
  combine,
  contextTranscript,
  createFrameMeter,
  createLoudnessMeter,
  defaultSkipEnd,
  findBreaks,
  parseDecisions,
  pickMoments,
  reactionEnd,
  refinePeak,
  replaySeries,
  robustScale,
  silenceThreshold,
  snapClip,
  summarizeTags,
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

test('yayın sonu atlanır: sondaki zirve seçilmez, varsayılan %5 ve en çok 2 dakika', () => {
  const duration = 600;
  const audio = new Float64Array(duration).fill(0.1);
  audio.fill(0.9, 300, 305);
  audio.fill(0.99, 585, 590); // jenerik
  const moments = pickMoments(combine({ audio }), {
    top: 5,
    length: 40,
    duration,
    skipEnd: 30,
  });
  assert.equal(moments.length, 1);
  assert.ok(moments[0].peak > 300 && moments[0].peak < 306);
  assert.equal(defaultSkipEnd(600), 30);
  assert.equal(defaultSkipEnd(4 * 3600), 120);
  assert.equal(defaultSkipEnd(null), 0);
});

// --- İçeriğe duyarlı sınırlar ve kalite kontrolü ---

/** Saniyede 4 dilimlik ses: varsayılan düzey `level`, verilen [from, to, value] aralıkları farklı. */
function fineAudio(seconds, level, spans = []) {
  const fine = new Float64Array(seconds * 4).fill(level);
  for (const [from, to, value] of spans) fine.fill(value, from * 4, to * 4);
  return fine;
}

test('ses ölçer: ince dilimler ve saniyelik dizi aynı ölçümden çıkar', () => {
  const meter = createLoudnessMeter(4, 2);
  const samples = Buffer.alloc(16);
  // 1. saniye: ilk yarı sessiz, ikinci yarı tam ses; 2. saniye: sessiz
  samples.writeInt16LE(16384, 4);
  samples.writeInt16LE(16384, 6);
  meter.push(samples.subarray(0, 5));
  meter.push(samples.subarray(5));
  assert.deepEqual(Array.from(meter.fine()), [0, 0.5, 0, 0]);
  const series = meter.series();
  assert.equal(series.length, 2);
  assert.ok(Math.abs(series[0] - Math.sqrt(0.125)) < 1e-9);
  assert.equal(series[1], 0);
  assert.deepEqual(Array.from(coarsen(meter.fine(), 2)), Array.from(series));
});

test('sessizlik eşiği: ortam gürültüsünün iki katı, olağan düzeyin %30-%50 aralığında', () => {
  assert.equal(silenceThreshold(null), 0);
  assert.equal(silenceThreshold(new Float64Array(8)), 0);
  // Konuşma 0,1; duraklamalar 0,01 (dilimlerin %20'si) → 2×0,01 %30'un altında → 0,03
  assert.ok(
    Math.abs(silenceThreshold(fineAudio(100, 0.1, [[0, 20, 0.01]])) - 0.03) <
      1e-9,
  );
  // Sürekli müzik: en sessiz dilim de yüksek → eşik ortancanın yarısını aşamaz
  assert.ok(
    Math.abs(silenceThreshold(fineAudio(100, 0.1, [[0, 20, 0.08]])) - 0.05) <
      1e-9,
  );
});

test('duraklar: cümle sonu, altyazı boşluğu ve sessizlik bulunur; kısa sessizlik sayılmaz', () => {
  const cues = [
    { start: 10, end: 12, text: 'ilk cümle burada biter.' },
    { start: 12, end: 14, text: 'ikinci satır devam' },
    // Otomatik altyazı: satır ekranda 20'ye kadar kalır ama söz 15'te biter
    { start: 14, end: 20, spokenEnd: 15, text: 'ediyor ve bitti' },
    { start: 20, end: 22, text: 'yeni söz' },
  ];
  const fine = fineAudio(40, 0.1, [
    [15, 19, 0.001],
    [25, 25.25, 0.001],
  ]);
  const breaks = findBreaks({ cues, fine, from: 5, to: 30 });
  assert.deepEqual(breaks, [
    { from: 12, to: 12, strength: 1.5, kind: 'cümle' },
    { from: 15, to: 20, strength: 1.5, kind: 'altyazı boşluğu' },
    { from: 15, to: 19, strength: 2, kind: 'sessizlik' },
  ]);
  // Pencere dışındaki duraklar dönmez
  assert.deepEqual(findBreaks({ cues, fine, from: 21, to: 30 }), []);
  assert.deepEqual(findBreaks({ from: 0, to: 30 }), []);
});

test('tepkinin sonu: ses ve sohbet olağan düzeye dönünce; bilgi yoksa null', () => {
  const audio = new Float64Array(200).fill(0.1);
  audio.fill(0.5, 98, 106);
  assert.equal(reactionEnd({ peak: 100, audio, until: 160 }), 106);
  // Sohbet daha uzun sürüyor: ikisi de sönmeden bitmez
  const chat = new Float64Array(200).fill(2);
  chat.fill(30, 98, 115);
  assert.equal(reactionEnd({ peak: 100, audio, chat, until: 160 }), 115);
  // Sınıra kadar sönmüyorsa null
  assert.equal(reactionEnd({ peak: 100, audio, chat, until: 110 }), null);
  // Düz sinyal bilgi taşımaz
  assert.equal(
    reactionEnd({
      peak: 100,
      audio: new Float64Array(200).fill(0.1),
      until: 160,
    }),
    null,
  );
  assert.equal(reactionEnd({ peak: 100, until: 160 }), null);
});

test('zirve inceltme: kovadaki en yüksek sesli saniye; ses yoksa aynı kalır', () => {
  const audio = new Float64Array(60).fill(0.1);
  audio[31] = 0.9;
  assert.equal(refinePeak(32.5, audio), 31.5);
  assert.equal(refinePeak(32.5, null), 32.5);
});

test('sınırlar: başlangıç söz başına, bitiş tepki sönünce ilk durağa oturur', () => {
  const breaks = [
    { from: 70, to: 71, strength: 1, kind: 'sessizlik' },
    { from: 78.5, to: 80, strength: 1.5, kind: 'sessizlik' },
    { from: 96, to: 96.2, strength: 1, kind: 'cümle' }, // zirveye 3 sn'den yakın: başlangıç olamaz
    { from: 108, to: 109, strength: 1, kind: 'sessizlik' },
    { from: 118, to: 119, strength: 1, kind: 'sessizlik' },
  ];
  const clip = snapClip({
    peak: 98,
    target: 30,
    breaks,
    decay: 106,
    duration: 600,
  });
  // Hedef başlangıç 98 − 30×0,65 = 78,5 → 80'deki durak; duraklamanın içinden başlar
  assert.deepEqual(clip, {
    start: 79.9,
    end: 108.4,
    startKind: 'sessizlik',
    endKind: 'sessizlik',
  });
});

test('sınırlar: en az/en çok süre korunur; durak yoksa sabit pencere ve işaret null', () => {
  // Tepki hemen sönse de klip 15 sn'den kısa olmaz ve vuruştan sonra yer kalır
  const short = snapClip({
    peak: 100,
    target: 20,
    breaks: [],
    decay: 102,
    duration: 600,
  });
  assert.equal(short.start, 87);
  // Tepki 102'de sönse de zirveden sonra hedef sürenin %25'i (5 sn) kalır
  assert.equal(short.end, 105);
  assert.equal(short.startKind, null);
  assert.equal(short.endKind, null);
  const tiny = snapClip({
    peak: 100,
    target: 20,
    breaks: [{ from: 95.5, to: 96.5, strength: 2, kind: 'sessizlik' }],
    decay: 101,
    duration: 600,
  });
  assert.ok(tiny.end - tiny.start >= 15, JSON.stringify(tiny));
  // Tepki sönmüyorsa (decay yok) hedef süre; hiçbir koşulda 60 sn aşılmaz
  const long = snapClip({
    peak: 100,
    target: 40,
    breaks: [{ from: 139, to: 140, strength: 2, kind: 'sessizlik' }],
    duration: 600,
  });
  assert.equal(long.start, 74);
  assert.ok(long.end <= long.start + 60);
  const capped = snapClip({
    peak: 100,
    target: 90,
    min: 15,
    max: 60,
    breaks: [],
    duration: 600,
  });
  assert.equal(capped.end - capped.start, 60);
  // Video başı ve sonu doğal sınırdır
  const edge = snapClip({ peak: 10, target: 40, breaks: [], duration: 30 });
  assert.deepEqual(edge, {
    start: 0,
    end: 30,
    startKind: 'video başı',
    endKind: 'video sonu',
  });
});

test('sınır türü: elle kaydırılan sınır bir durağa denk geliyorsa adı döner', () => {
  const breaks = [{ from: 50, to: 52, strength: 2, kind: 'sessizlik' }];
  assert.equal(boundaryKind(51, 'start', breaks), 'sessizlik');
  assert.equal(boundaryKind(52.3, 'start', breaks), 'sessizlik');
  assert.equal(boundaryKind(55, 'start', breaks), null);
  assert.equal(boundaryKind(0.1, 'start', breaks), 'video başı');
  assert.equal(boundaryKind(99.8, 'end', breaks, 100), 'video sonu');
});

/** Gri kareler: her kare tek ton ya da verilen üretici ile. */
function frames(width, height, count, pixel) {
  const out = Buffer.alloc(width * height * count);
  for (let f = 0; f < count; f++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        out[f * width * height + y * width + x] = pixel(f, x, y);
  return out;
}

test('görüntü ölçer: donuk kart, siyah ekran, akan jenerik ve hareketli sahne ayrışır', () => {
  const measure = (pixel, count = 20) => {
    const meter = createFrameMeter(16, 12);
    const data = frames(16, 12, count, pixel);
    // Parça sınırı karenin ortasına denk gelebilir
    meter.push(data.subarray(0, 100));
    meter.push(data.subarray(100));
    return meter.result();
  };
  assert.equal(createFrameMeter(16, 12).result(), null);

  const card = measure((f, x, y) => (y === 5 && x > 3 && x < 12 ? 230 : 40));
  assert.equal(card.frames, 20);
  assert.equal(card.staticRatio, 1);
  assert.ok(card.flatRatio > 0.9);
  assert.equal(card.blackRatio, 0);
  assert.equal(card.scrollRatio, 0);

  const black = measure(() => 3);
  assert.equal(black.blackRatio, 1);

  // Koyu zeminde yukarı akan yazı satırları: her karede 1 satır kayar
  const credits = measure((f, x, y) =>
    (y + f) % 4 === 0 && x % 3 !== 0 ? 220 : 10,
  );
  assert.ok(credits.scrollRatio > 0.9, JSON.stringify(credits));
  assert.equal(credits.staticRatio, 0);

  // Her karede değişen, kaymayla açıklanamayan görüntü
  const busy = measure(
    (f, x, y) =>
      Math.floor(
        Math.abs(Math.sin(x * 12.9898 + y * 78.233 + f * 37.719) * 43758.5453),
      ) % 256,
  );
  assert.equal(busy.scrollRatio, 0);
  assert.equal(busy.staticRatio, 0);
  assert.ok(busy.flatRatio < 0.5);
});

const speech = (from, to, step = 2) => {
  const cues = [];
  for (let t = from; t < to; t += step)
    cues.push({
      start: t,
      end: t + step,
      text: 'bu satırda tam altı sözcük var',
    });
  return cues;
};
const liveVisual = {
  frames: 120,
  motion: 12,
  staticRatio: 0.05,
  flatRatio: 0.3,
  blackRatio: 0,
  scrollRatio: 0,
};

test('kalite: sözle başlayan, tepkisi olan, sınırları temiz klip güçlü çıkar', () => {
  const fine = fineAudio(200, 0.1, [[118, 122, 0.5]]);
  const report = assessClip({
    start: 100,
    end: 130,
    peak: 120,
    cues: speech(60, 180),
    fine,
    visual: liveVisual,
    startKind: 'sessizlik',
    endKind: 'cümle',
  });
  assert.equal(report.verdict, 'güçlü');
  assert.ok(report.score >= 90, String(report.score));
  assert.equal(report.metrics.speechCoverage, 1);
  assert.equal(report.metrics.hookWords, 9);
  assert.equal(report.metrics.startsMidSentence, false);
  assert.equal(report.metrics.peakPosition, 0.67);
  assert.equal(report.metrics.loudnessJumpDb, 14);
  assert.ok(report.reasons.some((r) => r.includes('ses sıçraması')));
  assert.equal(report.parts.sinirlar, 1);
});

test('kalite: cümle ortası, geç başlayan söz ve tepkisizlik puanı düşürür ve gerekçeye yazılır', () => {
  const fine = fineAudio(200, 0.1, [[100, 108, 0.001]]);
  const cues = [
    { start: 90, end: 99, text: 'önceki uzun cümle sürüyor' },
    { start: 108, end: 131.5, text: 'geç başlayan tek bir söz' },
  ];
  const report = assessClip({
    start: 100,
    end: 130,
    peak: 104,
    cues,
    fine,
    visual: liveVisual,
  });
  assert.equal(report.metrics.hookWords, 0);
  assert.equal(report.metrics.firstSpeechAt, 8);
  assert.equal(report.metrics.endsMidSentence, true);
  assert.equal(report.metrics.startsMidSentence, false);
  assert.ok(report.score < 70, String(report.score));
  assert.notEqual(report.verdict, 'güçlü');
  for (const text of [
    "ilk 3 sn'de söz yok",
    'cümle ortasında bitiyor',
    'zirve çok başta',
    'belirgin tepki yok',
  ])
    assert.ok(
      report.reasons.some((r) => r.includes(text)),
      text,
    );
});

test('kalite: akan jenerik, donuk kart, siyah ekran ve sessizlik elenir; konuşmalı slayt elenmez', () => {
  const fine = fineAudio(200, 0.1);
  const base = { start: 100, end: 130, peak: 120, fine };
  const credits = assessClip({
    ...base,
    visual: { ...liveVisual, scrollRatio: 0.7 },
  });
  assert.equal(credits.verdict, 'ele');
  assert.match(credits.reasons[0], /akan jenerik/);

  const card = assessClip({
    ...base,
    cues: speech(0, 50),
    visual: { ...liveVisual, staticRatio: 0.95, flatRatio: 0.9 },
  });
  assert.equal(card.verdict, 'ele');
  assert.ok(card.reasons.some((r) => r.includes('donuk ekran')));

  const black = assessClip({
    ...base,
    cues: speech(60, 180),
    visual: { ...liveVisual, blackRatio: 0.6 },
  });
  assert.equal(black.verdict, 'ele');

  const silent = assessClip({
    ...base,
    fine: fineAudio(200, 0.1, [[100, 125, 0.001]]),
    cues: speech(60, 180),
    visual: liveVisual,
  });
  assert.equal(silent.verdict, 'ele');
  assert.ok(silent.reasons.includes('klibin çoğu sessiz'));

  // Sunum: slayt durağan ama konuşma kesintisiz → elenmez, yalnız işaretlenir
  const talk = assessClip({
    ...base,
    cues: speech(60, 180),
    visual: { ...liveVisual, staticRatio: 0.9, flatRatio: 0.85 },
    startKind: 'cümle',
    endKind: 'cümle',
  });
  assert.notEqual(talk.verdict, 'ele');
  assert.ok(talk.reasons.includes('görüntü durağan'));
});

test('kalite: ölçülemeyen parça puana girmez; sohbet patlaması tepki sayılır', () => {
  const bare = assessClip({ start: 100, end: 130, peak: 120 });
  assert.equal(bare.parts.konusma, null);
  assert.equal(bare.parts.goruntu, null);
  assert.equal(bare.parts.tepki, null);
  assert.equal(bare.metrics.speechCoverage, undefined);
  assert.ok(bare.reasons.some((r) => r.includes('altyazı yok')));
  assert.equal(bare.score, 100); // yalnız zirve konumu ölçüldü

  const chat = new Float64Array(200).fill(1);
  chat.fill(10, 100, 130);
  const crowd = assessClip({
    start: 100,
    end: 130,
    peak: 120,
    fine: fineAudio(200, 0.1),
    chat,
    chatMean: 2,
    chatPeak: 5,
  });
  assert.equal(crowd.metrics.chatDensity, 5);
  assert.equal(crowd.parts.tepki, 1);
  assert.ok(crowd.reasons.includes('sohbet zirvede patlıyor'));
});

test('inceleme transkripti: klip içi ve 10 sn bağlam ayrı işaretlenir', () => {
  const lines = contextTranscript(speech(80, 150), 100, 130, 10);
  assert.equal(lines[0].at, 90);
  assert.equal(lines.at(-1).at, 138);
  assert.deepEqual(
    lines.filter((l) => l.inside).map((l) => l.at),
    [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128],
  );
});

test('kararlar: kaydırma, üst yazı ve keep/drop okunur; hatalı giriş ve kaymış aday reddedilir', () => {
  const moments = [
    { rank: 1, peak: '12:50' },
    { rank: 2, peak: '40:05' },
  ];
  const parsed = parseDecisions(
    {
      note: 'açıklama',
      candidates: {
        1: {
          peak: '12:50',
          decision: 'keep',
          shiftStart: -4,
          shiftEnd: 3,
          caption: ' Şampiyonluk golü ',
          title: 'Başlık',
        },
        2: { decision: null },
      },
    },
    moments,
  );
  assert.deepEqual(parsed.get(1), {
    decision: 'keep',
    shiftStart: -4,
    shiftEnd: 3,
    caption: 'Şampiyonluk golü',
    title: 'Başlık',
    note: '',
  });
  assert.equal(parsed.get(2).decision, null);
  assert.equal(parsed.get(2).shiftStart, 0);
  assert.equal(parseDecisions({}, moments).size, 0);
  assert.equal(parseDecisions(null, moments).size, 0);
  const bad = (candidates, pattern) =>
    assert.throws(() => parseDecisions({ candidates }, moments), pattern);
  bad({ 3: {} }, /3 numaralı aday yok/);
  bad({ 1: { peak: '09:00' } }, /zirvesi değişmiş/);
  bad({ 1: { shiftStart: '4' } }, /shiftStart/);
  bad({ 1: { shiftEnd: 90 } }, /shiftEnd/);
  bad({ 1: { decision: 'maybe' } }, /decision/);
  bad({ 1: { caption: 'x'.repeat(61) } }, /caption en çok 60/);
  bad([], /nesne/);
});

test('an seçimi: spacing verilirse adaylar o kadar aralıklı seçilir', () => {
  const series = new Float64Array(600);
  series.fill(1, 100, 105);
  series.fill(0.9, 150, 155);
  series.fill(0.8, 300, 305);
  const combined = combine({ audio: series });
  const near = pickMoments(combined, { top: 5, length: 40, duration: 600 });
  assert.equal(near.length, 3);
  const spaced = pickMoments(combined, {
    top: 5,
    length: 40,
    duration: 600,
    spacing: 60,
  });
  assert.deepEqual(
    spaced.map((m) => m.peak),
    [102.5, 302.5],
  );
});

test('ses etiketleri: müzik baskın klip elenir, fon müziği ve gülme yalnız işaretlenir', () => {
  assert.equal(summarizeTags([]), null);
  const song = summarizeTags([
    { Music: 0.9, Speech: 0.1, Singing: 0.3 },
    { Music: 0.8, Speech: 0.05 },
  ]);
  assert.deepEqual(song, {
    music: 0.85,
    speech: 0.08,
    laughter: 0,
    shout: 0,
    crowd: 0,
  });
  const funny = summarizeTags([
    { Music: 0.5, Speech: 0.9 },
    {
      Music: 0.3,
      Speech: 0.8,
      Giggle: 0.1,
      'Belly laugh': 0.4,
      Screaming: 0.2,
      Applause: 0.5,
    },
  ]);
  assert.deepEqual(funny, {
    music: 0.4,
    speech: 0.85,
    laughter: 0.4,
    shout: 0.2,
    crowd: 0.5,
  });

  const base = {
    start: 100,
    end: 130,
    peak: 120,
    fine: fineAudio(200, 0.1),
    cues: speech(60, 180),
    visual: liveVisual,
  };
  const rejected = assessClip({ ...base, tags: song });
  assert.equal(rejected.verdict, 'ele');
  assert.match(rejected.reasons[0], /müzik baskın/);
  const kept = assessClip({ ...base, tags: funny });
  assert.notEqual(kept.verdict, 'ele');
  for (const text of [
    'arkada müzik var',
    'gülme sesi var',
    'bağırma/çığlık var',
    'kalabalık tepkisi var',
  ])
    assert.ok(
      kept.reasons.some((r) => r.includes(text)),
      text,
    );
  assert.deepEqual(kept.metrics.tags, funny);
});
