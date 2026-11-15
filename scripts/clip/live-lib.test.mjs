import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAT_LAG_SECONDS } from './moments-lib.mjs';
import { sourceRights } from './clip.mjs';
import {
  IRC_MAX_LINE,
  backoffSeconds,
  chatEvent,
  chatSeriesFor,
  createSpikeDetector,
  diskVerdict,
  eventTime,
  excerptPlan,
  ircHandshake,
  locate,
  parseChannel,
  parseIrcLine,
  planPrune,
  segmentArgs,
  segmentIndex,
  segmentName,
  segmentSpans,
  sessionName,
  streamlinkArgs,
} from './live-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// --- Kanal ve argümanlar ----------------------------------------------------

test('kanal: adres, yalın ad ve büyük harf kabul edilir', () => {
  for (const input of [
    'https://www.twitch.tv/Kanal_Adi',
    'twitch.tv/kanal_adi',
    'https://m.twitch.tv/kanal_adi/',
    'KANAL_ADI',
  ])
    assert.deepEqual(parseChannel(input), {
      channel: 'kanal_adi',
      url: 'https://www.twitch.tv/kanal_adi',
    });
});

test('kanal: doğrulanmamış girdi kayıt aracına geçmez', () => {
  for (const bad of [
    '',
    'ab',
    'a'.repeat(26),
    'kanal adi',
    'kanal;rm -rf',
    '--player=evil',
    '-o',
    'kanal$(id)',
    'https://www.twitch.tv/kanal/clip/abc',
    'https://www.twitch.tv/videos/123',
    'https://evil.example/kanal',
    'http://www.twitch.tv/kanal',
    'https://www.twitch.tv.evil.example/kanal',
    'https://kick.com/kanal',
    'türkçe_kanal',
  ])
    assert.throws(() => parseChannel(bad), undefined, bad);
});

test('kanal: YouTube canlı yayını için açık mesaj', () => {
  assert.throws(
    () => parseChannel('https://www.youtube.com/watch?v=abcdefghijk'),
    /YouTube canlı yayını v1 kapsamında değil/,
  );
});

test('streamlink argümanları: kabuk yok, kanal ve kalite doğrulanır', () => {
  const args = streamlinkArgs({ channel: 'kanal_adi', quality: '720p60,best' });
  assert.deepEqual(args.slice(-2), [
    'https://www.twitch.tv/kanal_adi',
    '720p60,best',
  ]);
  assert.ok(args.includes('--stdout'));
  assert.equal(args[args.indexOf('--retry-streams') + 1], '30');
  assert.equal(args[args.indexOf('--twitch-supported-codecs') + 1], 'h264');
  assert.throws(() => streamlinkArgs({ channel: 'a b' }));
  assert.throws(() =>
    streamlinkArgs({ channel: 'kanal', quality: 'best --player x' }),
  );
  assert.throws(() => streamlinkArgs({ channel: 'kanal', quality: '' }));
});

test('parça adları ve ffmpeg argümanları', () => {
  assert.equal(segmentName(7), 'parca-00007.ts');
  assert.equal(segmentIndex('parca-00007.ts'), 7);
  assert.equal(segmentIndex('parca-7.ts'), null);
  assert.equal(segmentIndex('../parca-00007.ts'), null);
  assert.equal(segmentIndex('parca-00007.ts|x'), null);
  const args = segmentArgs({ segmentSeconds: 600, startNumber: 4 });
  assert.equal(args[args.indexOf('-segment_start_number') + 1], '4');
  assert.equal(args[args.indexOf('-c') + 1], 'copy');
  assert.equal(args.at(-1), 'parca-%05d.ts');
  assert.throws(() => segmentArgs({ segmentSeconds: 5 }));
});

test('oturum adı ve yeniden deneme beklemesi', () => {
  assert.equal(
    sessionName('kanal', new Date(2026, 10, 5, 23, 59)),
    'kanal-2026-11-05',
  );
  assert.deepEqual([1, 2, 3, 6, 20].map(backoffSeconds), [2, 4, 8, 60, 60]);
});

// --- IRC --------------------------------------------------------------------

const NOW = 1_800_000_000_000;

test('IRC: etiketli PRIVMSG → zaman ve metin, kullanıcı adı yok', () => {
  const line =
    '@badge-info=;color=#FF0000;display-name=Biri;tmi-sent-ts=1799999999000;user-id=1 :biri!biri@biri.tmi.twitch.tv PRIVMSG #kanal :LOL : bu neydi';
  const parsed = parseIrcLine(line);
  assert.equal(parsed.command, 'PRIVMSG');
  assert.equal(parsed.tags['tmi-sent-ts'], '1799999999000');
  assert.deepEqual(chatEvent(parsed, 'kanal', NOW), {
    type: 'message',
    t: 1799999999000,
    text: 'LOL : bu neydi',
  });
});

test('IRC: etiketsiz ya da saati bozuk mesajda alış anı kullanılır', () => {
  const plain = parseIrcLine(':a!a@a.tmi.twitch.tv PRIVMSG #kanal :selam');
  assert.equal(chatEvent(plain, 'kanal', NOW).t, NOW);
  for (const ts of ['abc', '0', '99999999999999999', '-5', '1.5'])
    assert.equal(
      chatEvent(
        parseIrcLine(`@tmi-sent-ts=${ts} :a!a@a PRIVMSG #kanal :selam`),
        'kanal',
        NOW,
      ).t,
      NOW,
      ts,
    );
});

test('IRC: PING, RECONNECT, kanala giriş, baskın', () => {
  assert.deepEqual(
    chatEvent(parseIrcLine('PING :tmi.twitch.tv'), 'kanal', NOW),
    {
      type: 'ping',
      payload: 'tmi.twitch.tv',
    },
  );
  assert.deepEqual(
    chatEvent(parseIrcLine(':tmi.twitch.tv RECONNECT'), 'kanal', NOW),
    { type: 'reconnect' },
  );
  assert.equal(
    chatEvent(
      parseIrcLine('@emote-only=0;room-id=1 :tmi.twitch.tv ROOMSTATE #kanal'),
      'kanal',
      NOW,
    ).type,
    'joined',
  );
  assert.equal(
    chatEvent(
      parseIrcLine(
        ':justinfan1.tmi.twitch.tv 366 justinfan1 #kanal :End of /NAMES list',
      ),
      'kanal',
      NOW,
    ).type,
    'joined',
  );
  assert.deepEqual(
    chatEvent(
      parseIrcLine(
        `@msg-id=raid;tmi-sent-ts=${NOW - 500} :tmi.twitch.tv USERNOTICE #kanal`,
      ),
      'kanal',
      NOW,
    ),
    { type: 'raid', t: NOW - 500 },
  );
  // Abonelik bildirimi mesaj değildir
  assert.equal(
    chatEvent(
      parseIrcLine('@msg-id=resub :tmi.twitch.tv USERNOTICE #kanal :yaşasın'),
      'kanal',
      NOW,
    ),
    null,
  );
});

test('IRC: başka kanal, /me, boş ve çok uzun mesaj', () => {
  assert.equal(
    chatEvent(parseIrcLine(':a!a@a PRIVMSG #baska :selam'), 'kanal', NOW),
    null,
  );
  assert.equal(
    chatEvent(
      parseIrcLine(':a!a@a PRIVMSG #kanal :\u0001ACTION güldü\u0001'),
      'kanal',
      NOW,
    ).text,
    'güldü',
  );
  assert.equal(
    chatEvent(parseIrcLine(':a!a@a PRIVMSG #kanal :   '), 'kanal', NOW),
    null,
  );
  const long = chatEvent(
    parseIrcLine(`:a!a@a PRIVMSG #kanal :${'x'.repeat(5000)}`),
    'kanal',
    NOW,
  );
  assert.equal(long.text.length, 500);
});

test('IRC: bozuk satırlar akışı durdurmaz', () => {
  for (const bad of [
    '',
    null,
    undefined,
    42,
    '@yalnız-etiket',
    ':yalnız-önek',
    ':önek ',
    ':a!a@a privmsg #kanal :küçük harf komut',
    '   ',
    ': :',
    '@a=b :c',
    'x'.repeat(IRC_MAX_LINE + 1),
  ])
    assert.equal(parseIrcLine(bad), null, String(bad).slice(0, 30));
  assert.equal(chatEvent(null, 'kanal', NOW), null);
  // Uzun ama sınırın altındaki etiket bloğu ayrıştırılır
  const tags = `@x=${'y'.repeat(8000)};tmi-sent-ts=${NOW}`;
  assert.equal(
    chatEvent(
      parseIrcLine(`${tags} :a!a@a PRIVMSG #kanal :tamam`),
      'kanal',
      NOW,
    ).text,
    'tamam',
  );
  // Satır sonu ve önek sahteciliği: metindeki "PRIVMSG" yeni komut olmaz
  const sneaky = parseIrcLine(':a!a@a PRIVMSG #kanal :PING :x\r\n');
  assert.equal(chatEvent(sneaky, 'kanal', NOW).text, 'PING :x');
});

test('IRC: bağlantı satırları hesapsız ve salt okunur', () => {
  const lines = ircHandshake('kanal', 0.5);
  assert.deepEqual(lines, [
    'CAP REQ :twitch.tv/tags twitch.tv/commands',
    'NICK justinfan50000',
    'JOIN #kanal',
  ]);
  assert.ok(!lines.some((line) => /^PASS/.test(line)));
  assert.throws(() => ircHandshake('kanal\r\nJOIN #baska'));
});

// --- Patlama dedektörü --------------------------------------------------------

function seeded(seed = 1) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

/**
 * Dedektörü saniye saniye besler. `rate(s)` o saniyedeki mesaj sayısı (kesirli olabilir),
 * `text(s)` mesaj metni; canlı döngüdeki gibi her saniye advance çağrılır.
 */
function simulate({
  seconds,
  rate,
  text = () => 'selam',
  seed = 3,
  prepare,
  options,
}) {
  const random = seeded(seed);
  const detector = createSpikeDetector(options);
  const t0 = 1_800_000_000_000;
  prepare?.(detector, t0);
  const spikes = [];
  for (let s = 0; s < seconds; s++) {
    const wanted = rate(s);
    const n = Math.floor(wanted) + (random() < wanted % 1 ? 1 : 0);
    for (let k = 0; k < n; k++)
      detector.push(t0 + s * 1000 + Math.floor(random() * 1000), text(s));
    spikes.push(...detector.advance(t0 + (s + 1) * 1000));
  }
  spikes.push(...detector.advance(t0 + (seconds + 60) * 1000));
  return {
    spikes: spikes.map((spike) => ({
      ...spike,
      peak: (spike.peakAt - t0) / 1000,
      onset: (spike.onsetAt - t0) / 1000,
    })),
    detector,
  };
}

const burst =
  (from, length = 10) =>
  (s) =>
    s >= from && s < from + length;

test('dedektör: sessiz yayında patlama yok', () => {
  const { spikes } = simulate({ seconds: 1800, rate: () => 0.1 });
  assert.equal(spikes.length, 0);
});

test('dedektör: yoğun ama düzenli sohbette patlama yok', () => {
  const random = seeded(9);
  const { spikes } = simulate({
    seconds: 1800,
    rate: () => 8,
    text: () => (random() < 0.2 ? 'LOL' : 'düz mesaj'),
  });
  assert.equal(spikes.length, 0);
});

test('dedektör: tek patlama bir kez, doğru yerde bildirilir', () => {
  const inBurst = burst(600);
  const { spikes, detector } = simulate({
    seconds: 900,
    rate: (s) => (inBurst(s) ? 10 : 2),
    text: (s) => (inBurst(s) ? 'LMAO' : 'selam'),
  });
  assert.equal(spikes.length, 1);
  assert.ok(Math.abs(spikes[0].peak - 605) <= 5, `tepe ${spikes[0].peak}`);
  assert.ok(
    Math.abs(spikes[0].onset - 600) <= 3,
    `başlangıç ${spikes[0].onset}`,
  );
  assert.ok(spikes[0].ratio >= 5);
  assert.equal(detector.stats().spikes, 1);
  // Kayıttaki an: sohbet gecikmesi kadar geride; --chat-offset ile kaydırılır
  assert.equal(
    eventTime(spikes[0]),
    spikes[0].onsetAt - CHAT_LAG_SECONDS * 1000,
  );
  assert.equal(eventTime(spikes[0], 5) - eventTime(spikes[0]), 5000);
});

test('dedektör: ayrık iki patlama iki aday; bitişik olanlar birleşir; yakın olanlar tek aday', () => {
  const run = (second) => {
    const a = burst(600);
    const b = burst(second);
    return simulate({
      seconds: 1200,
      rate: (s) => (a(s) || b(s) ? 12 : 2),
      text: (s) => (a(s) || b(s) ? 'KEKW' : 'selam'),
    }).spikes;
  };
  const apart = run(780);
  assert.equal(apart.length, 2);
  assert.ok(apart[1].peak - apart[0].peak >= 170);
  // 20 sn arayla: tek olay
  assert.equal(run(620).length, 1);
  // 40 sn arayla: ayrı olay ama en az aralığın (60 sn) altında → tek aday
  assert.equal(run(640).length, 1);
});

test('dedektör: ısınma süresi dolmadan aday çıkmaz', () => {
  const inBurst = burst(60);
  const { spikes } = simulate({
    seconds: 300,
    rate: (s) => (inBurst(s) ? 12 : 2),
  });
  assert.equal(spikes.length, 0);
});

test('dedektör: baskın (raid) bildirimi olan mesaj seli aday olmaz, olağan düzeyi de bozmaz', () => {
  const raid = burst(600, 90);
  const real = burst(840);
  const { spikes } = simulate({
    seconds: 1100,
    rate: (s) => (raid(s) ? 15 : real(s) ? 12 : 2),
    text: (s) => (real(s) ? 'LOL' : raid(s) ? 'baskın emojisi' : 'selam'),
    prepare: (detector, t0) => detector.suppress(t0 + 600_000, t0 + 690_000),
  });
  assert.equal(spikes.length, 1);
  assert.ok(Math.abs(spikes[0].peak - 845) <= 5);
});

test('dedektör: bildirimsiz uzun mesaj seli olağan düzeyi şişirmez (ortanca), sonraki gerçek patlama bulunur', () => {
  const flood = burst(600, 80);
  const real = burst(800);
  const { spikes } = simulate({
    seconds: 1100,
    rate: (s) => (flood(s) ? 15 : real(s) ? 12 : 2),
    text: (s) => (real(s) ? 'LOL' : 'selam'),
  });
  // Selin kendisi bir aday üretir (insan/kalite kontrolü eler); gerçek patlama kaybolmaz
  assert.ok(spikes.some((spike) => Math.abs(spike.peak - 805) <= 5));
  assert.ok(spikes.length <= 2);
});

test('dedektör: kopukluk sonrası biriken mesajlar patlama sayılmaz', () => {
  const backlog = burst(660, 10);
  const { spikes } = simulate({
    seconds: 1000,
    // 600-660 arası bağlantı yok; dönüşte birikenler bir anda akıyor
    rate: (s) => (s >= 600 && s < 660 ? 0 : backlog(s) ? 14 : 2),
    prepare: (detector, t0) => detector.gap(t0 + 600_000, t0 + 660_000),
  });
  assert.equal(spikes.length, 0);
});

test('dedektör: kopukluk olağan düzeyi sıfırlamaz, sonraki gerçek patlama bulunur', () => {
  const real = burst(760);
  const { spikes } = simulate({
    seconds: 1000,
    rate: (s) => (s >= 600 && s < 660 ? 0 : real(s) ? 12 : 2),
    text: (s) => (real(s) ? 'LOL' : 'selam'),
    prepare: (detector, t0) => detector.gap(t0 + 600_000, t0 + 660_000),
  });
  assert.equal(spikes.length, 1);
  assert.ok(Math.abs(spikes[0].peak - 765) <= 5);
});

test('dedektör: sohbet uzun süre susup olağan hızla dönerse patlama sayılmaz', () => {
  const { spikes } = simulate({
    seconds: 1800,
    rate: (s) => (s >= 400 && s < 1000 ? 0 : 2),
  });
  assert.equal(spikes.length, 0);
});

test('dedektör: sabit hızlı emoji yağmuru patlama değildir; tepki sözcükleri ağırlığı artırır', () => {
  const spam = simulate({
    seconds: 1200,
    rate: () => 6,
    text: () => 'PogChamp PogChamp PogChamp',
  });
  assert.equal(spam.spikes.length, 0);
  // Aynı mesaj hızında yalnız içerik tepkiye dönerse (3 kat ağırlık) aday çıkar
  const inBurst = burst(700, 15);
  const reaction = simulate({
    seconds: 1200,
    rate: () => 3,
    text: (s) => (inBurst(s) ? 'LMAOOO 💀' : 'düz mesaj'),
  });
  assert.equal(reaction.spikes.length, 1);
});

test('dedektör: gecikmiş mesaj ve uzun askı (uyku) sonrası dayanıklı', () => {
  const detector = createSpikeDetector();
  const t0 = 1_800_000_000_000;
  for (let s = 0; s < 400; s++) {
    detector.push(t0 + s * 1000, 'selam');
    detector.advance(t0 + (s + 1) * 1000);
  }
  // Çoktan kapanmış kovaya düşen mesaj yok sayılır
  detector.push(t0 + 1000, 'LOL');
  detector.push(Number.NaN, 'LOL');
  // 3 saat askıdan sonra tek çağrı: kilitlenmez, sahte aday üretmez
  assert.deepEqual(detector.advance(t0 + 3 * 3600_000), []);
  assert.equal(detector.stats().messages, 400);
});

test('sohbet dizisi: kayıt eksenine gecikme kadar geri kaydırılır', () => {
  const from = 1_800_000_000_000;
  const series = chatSeriesFor(
    [
      { t: from + (CHAT_LAG_SECONDS + 5) * 1000 + 10, w: 3 },
      { t: from + (CHAT_LAG_SECONDS + 5) * 1000 + 900, w: 1 },
      { t: from, w: 1 }, // gecikme uygulanınca aralığın öncesine düşer
      { t: from + 500_000, w: 1 },
    ],
    from,
    20,
  );
  assert.equal(series.length, 20);
  assert.equal(series[5], 4);
  assert.equal(
    series.reduce((a, b) => a + b, 0),
    4,
  );
  // --chat-offset +2: aynı mesajlar 2 sn ileride
  assert.equal(chatSeriesFor([{ t: from + 13_000, w: 1 }], from, 20, 2)[7], 1);
});

// --- Saat eşlemesi ------------------------------------------------------------

const W = 1_800_000_000_000;
const SEGMENTS = [
  // İlk parça: açılışta 6 sn toplu indirildiği için 600 sn içerik 594 sn'de yazıldı
  {
    file: 'parca-00000.ts',
    index: 0,
    run: 1,
    openedAt: W,
    closedAt: W + 594_000,
    duration: 600,
  },
  {
    file: 'parca-00001.ts',
    index: 1,
    run: 1,
    openedAt: W + 594_000,
    closedAt: W + 1_194_000,
    duration: 600,
  },
  // Yazılmakta olan parça: süresi W+1_300_000 anında ölçüldü
  {
    file: 'parca-00002.ts',
    index: 2,
    run: 1,
    openedAt: W + 1_194_000,
    closedAt: null,
    probedAt: W + 1_300_000,
    duration: 106,
  },
];

test('saat eşlemesi: parçanın sonu bilinen andır', () => {
  const spans = segmentSpans(SEGMENTS);
  assert.equal(spans[0].startWall, W - 6000);
  assert.deepEqual(locate(spans, W + 100_000), {
    file: 'parca-00000.ts',
    offset: 106,
  });
  assert.deepEqual(locate(spans, W + 594_000), {
    file: 'parca-00001.ts',
    offset: 0,
  });
  assert.deepEqual(locate(spans, W + 1_250_000), {
    file: 'parca-00002.ts',
    offset: 56,
  });
  assert.equal(locate(spans, W + 1_300_000), null);
  assert.equal(locate(spans, W - 10_000), null);
});

test('saat eşlemesi: süresi bilinmeyen ve silinmiş parçalar atlanır', () => {
  const spans = segmentSpans([
    { ...SEGMENTS[0], pruned: true },
    { ...SEGMENTS[1], duration: null },
    SEGMENTS[2],
    {
      file: 'parca-00003.ts',
      index: 3,
      run: 1,
      closedAt: null,
      duration: null,
    },
  ]);
  assert.deepEqual(
    spans.map((s) => s.file),
    ['parca-00002.ts'],
  );
});

test('kesit planı: tek parça içinde', () => {
  const spans = segmentSpans(SEGMENTS);
  const event = W + 300_000;
  const plan = excerptPlan(spans, event - 75_000, event + 35_000, event);
  assert.deepEqual(plan.files, ['parca-00000.ts']);
  assert.equal(plan.seek, 231);
  assert.equal(plan.seconds, 110);
  assert.equal(plan.startWall, event - 75_000);
});

test('kesit planı: parça sınırını aşan aday iki parçadan alınır', () => {
  const spans = segmentSpans(SEGMENTS);
  const event = W + 600_000; // ikinci parçanın 6. saniyesi
  const plan = excerptPlan(spans, event - 75_000, event + 35_000, event);
  assert.deepEqual(plan.files, ['parca-00000.ts', 'parca-00001.ts']);
  // İlk parçanın başından itibaren: (W+525_000) − (W−6_000) = 531 sn
  assert.equal(plan.seek, 531);
  assert.equal(plan.seconds, 110);
  const tail = W + 1_210_000;
  const second = excerptPlan(spans, tail - 75_000, tail + 35_000, tail);
  assert.deepEqual(second.files, ['parca-00001.ts', 'parca-00002.ts']);
  assert.equal(second.endWall, tail + 35_000);
});

test('kesit planı: kayıt henüz o kadar ilerlemediyse eldeki kadar; kayıtta olmayan an için plan yok', () => {
  const spans = segmentSpans(SEGMENTS);
  const event = W + 1_290_000;
  const plan = excerptPlan(spans, event - 75_000, event + 35_000, event);
  assert.equal(plan.endWall, W + 1_300_000);
  assert.equal(plan.seconds, 85);
  assert.equal(
    excerptPlan(spans, W + 2_000_000, W + 2_100_000, W + 2_050_000),
    null,
  );
  // Kaydın en başı: öncesi yok
  const early = excerptPlan(spans, W - 60_000, W + 50_000, W + 15_000);
  assert.equal(early.seek, 0);
  assert.equal(early.startWall, W - 6000);
});

test('kesit planı: kayıt yeniden başladıysa sınırın ötesine geçilmez', () => {
  const spans = segmentSpans([
    SEGMENTS[0],
    // Kopukluktan sonra yeni çalıştırma: 30 sn boşluk, zaman damgaları sıfırdan
    {
      file: 'parca-00001.ts',
      index: 1,
      run: 2,
      closedAt: W + 1_224_000,
      duration: 600,
    },
  ]);
  const event = W + 630_000;
  const plan = excerptPlan(spans, event - 75_000, event + 35_000, event);
  assert.deepEqual(plan.files, ['parca-00001.ts']);
  assert.equal(plan.seek, 0);
  assert.equal(plan.startWall, W + 624_000);
  // Boşluğa denk gelen an kayıtta yok
  assert.equal(excerptPlan(spans, W + 530_000, W + 640_000, W + 605_000), null);
});

// --- Disk ---------------------------------------------------------------------

test('disk bütçesi: en eski kapalı parçalar silinir, son ikisi ve yazılan korunur', () => {
  const GB = 1024 ** 3;
  const segments = [0, 1, 2, 3, 4].map((i) => ({
    file: segmentName(i),
    size: GB,
    closed: i < 4,
  }));
  assert.deepEqual(planPrune(segments, 10 * GB), []);
  assert.deepEqual(planPrune(segments, 3.5 * GB), [
    'parca-00000.ts',
    'parca-00001.ts',
  ]);
  // Bütçe ne kadar küçük olursa olsun son iki kapalı parça ve açık parça durur
  assert.deepEqual(planPrune(segments, 0), [
    'parca-00000.ts',
    'parca-00001.ts',
  ]);
  // Zaten silinmiş parça sayılmaz
  assert.deepEqual(
    planPrune(
      segments.map((s, i) => (i === 0 ? { ...s, pruned: true } : s)),
      3.5 * GB,
    ),
    ['parca-00001.ts'],
  );
  assert.deepEqual(planPrune([], GB), []);
});

test('boş alan: eşik altında kayıt durur', () => {
  const GB = 1024 ** 3;
  assert.equal(diskVerdict(100 * GB), 'ok');
  assert.equal(diskVerdict(5 * GB), 'low');
  assert.equal(diskVerdict(2 * GB), 'stop');
  assert.equal(diskVerdict(Number.NaN), 'unknown');
});

// --- Hak kuralı ve komut satırı -----------------------------------------------

test('hak kuralı: seçenek isteğe bağlı, birden çok seçenek hata', () => {
  // 16 Kasım 2026 kararı: izin şart değil; seçenek yoksa "izin alınmadı" olarak kaydedilir
  assert.deepEqual(sourceRights({}), {
    sourceType: 'third_party',
    permission: null,
  });
  assert.throws(
    () => sourceRights({ own: true, permission: 'IZIN-2026-014' }),
    /en çok bir seçenekle/,
  );
  assert.deepEqual(sourceRights({ own: true }), {
    sourceType: 'own',
    permission: null,
  });
  assert.deepEqual(sourceRights({ permission: 'IZIN-2026-014' }), {
    sourceType: 'third_party',
    permission: 'IZIN-2026-014',
  });
  assert.equal(
    sourceRights({ 'open-license': 'CC BY 4.0' }).sourceType,
    'open_license',
  );
  assert.throws(() => sourceRights({ permission: 'biri@example.com' }));
});

const cli = (args, env = process.env) =>
  spawnSync(process.execPath, [join(here, 'live.mjs'), ...args], {
    encoding: 'utf8',
    env,
  });

test('clip:live birden çok hak seçeneğini ve çelişen seçenekleri reddeder', () => {
  const two = cli(['live', 'kanal_adi', '--own', '--permission', 'IZIN-1']);
  assert.equal(two.status, 1);
  assert.match(two.stderr, /en çok bir seçenekle/);
  const both = cli(['live', 'kanal_adi', '--analysis-only', '--own']);
  assert.equal(both.status, 1);
  assert.match(
    both.stderr,
    /--analysis-only hak seçeneğiyle birlikte verilmez/,
  );
});

test('clip:live geçersiz kanalı kayıt aracına vermeden reddeder', () => {
  const r = cli(['live', 'kanal;adi', '--own']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Kanal adı/);
});

test('clip:live streamlink yoksa kurulum ipucuyla çıkar', () => {
  const out = mkdtempSync(join(tmpdir(), 'canli-test-'));
  try {
    // PATH boş: streamlink bulunamaz (CI'da zaten kurulu değil)
    const r = cli(
      ['live', 'kanal_adi', '--own', '--out', join(out, 'oturum')],
      {
        ...process.env,
        PATH: '',
        Path: '',
      },
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /streamlink bulunamadı/);
    assert.match(r.stderr, /brew install streamlink/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('clip:live-cut yalnız inceleme oturumundan kesmez; hak durumu olmadan kesime geçer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'canli-test-'));
  try {
    const session = {
      version: 1,
      channel: 'kanal_adi',
      analysisOnly: true,
      rights: null,
    };
    writeFileSync(join(dir, 'session.json'), JSON.stringify(session));
    const refused = cli(['live-cut', dir, '--only', '1', '--own']);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /yalnız inceleme/);
    writeFileSync(
      join(dir, 'session.json'),
      JSON.stringify({ ...session, analysisOnly: false }),
    );
    // Hak seçeneği artık şart değil: komut hak kuralına takılmaz, sıradaki denetime (aday yok) geçer
    const noRights = cli(['live-cut', dir, '--only', '1']);
    assert.doesNotMatch(noRights.stderr, /seçenekle belirt/);
    const two = cli([
      'live-cut',
      dir,
      '--only',
      '1',
      '--own',
      '--permission',
      'IZIN-1',
    ]);
    assert.equal(two.status, 1);
    assert.match(two.stderr, /en çok bir seçenekle/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('clip:cut izin alınmamış kaynakta atıf ister', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atif-test-'));
  try {
    const video = join(dir, 'girdi.mp4');
    writeFileSync(video, 'video değil');
    const r = spawnSync(
      process.execPath,
      [
        join(here, 'clip.mjs'),
        'cut',
        video,
        '--start',
        '0',
        '--end',
        '10',
        '--out',
        join(dir, 'klip.mp4'),
      ],
      { encoding: 'utf8' },
    );
    // Kaynak dosyası (source.json) ve --credit yok: atıfsız kesilmez
    assert.equal(r.status, 1);
    assert.match(r.stderr, /atıf zorunlu/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
