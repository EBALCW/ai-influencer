import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  finalProblems,
  fitVideoKbps,
  parseBlackSeconds,
  parseLoudness,
  parseProbe,
} from './media.ts';

const probeJson = JSON.stringify({
  format: { duration: '43.133' },
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920 },
    { codec_type: 'audio', codec_name: 'aac' },
  ],
});

test('ffprobe, ebur128 ve blackdetect çıktıları okunur', () => {
  assert.deepEqual(parseProbe(probeJson), {
    duration: 43.133,
    video: { width: 1080, height: 1920, codec: 'h264' },
    audio: true,
  });
  assert.equal(parseProbe('json değil'), null);
  assert.deepEqual(parseProbe('{}'), {
    duration: null,
    video: null,
    audio: false,
  });
  assert.equal(
    parseLoudness('I: -20.0 LUFS (anlık)\nSummary:\n  I:         -14.2 LUFS\n'),
    -14.2,
  );
  assert.equal(parseLoudness('çıktı yok'), null);
  assert.equal(
    parseBlackSeconds(
      'black_start:0 black_end:0.5 black_duration:0.5\nblack_start:9 black_end:10 black_duration:1',
    ),
    1.5,
  );
  assert.equal(parseBlackSeconds(''), 0);
});

test('yükleme sınırına sığan bit hızı', () => {
  const limit = 5 * 1024 * 1024;
  const kbps = fitVideoKbps(limit, 43)!;
  assert.ok(kbps > 700 && kbps < 900, String(kbps));
  assert.ok(((kbps + 128) * 1000 * 43) / 8 < limit);
  // Çok uzun video okunur kalitede sığmaz
  assert.equal(fitVideoKbps(limit, 170), null);
  assert.equal(fitVideoKbps(limit, 0), null);
});

test('bitmiş video denetimi: süre, akışlar, ses yüksekliği, siyah kare', () => {
  const ok = {
    probe: parseProbe(probeJson),
    expectedSeconds: 43.13,
    lufs: -14,
    blackSeconds: 0,
  };
  assert.deepEqual(finalProblems(ok), []);
  assert.match(finalProblems({ ...ok, expectedSeconds: 40 })[0]!, /süre/);
  assert.match(finalProblems({ ...ok, lufs: -23 })[0]!, /ses yüksekliği/);
  assert.match(finalProblems({ ...ok, lufs: null })[0]!, /ölçülemedi/);
  assert.match(finalProblems({ ...ok, blackSeconds: 1.2 })[0]!, /siyah/);
  assert.deepEqual(finalProblems({ ...ok, probe: null }), [
    'video dosyası okunamadı',
  ]);
  const silent = parseProbe(
    JSON.stringify({
      format: { duration: '43.1' },
      streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
    }),
  );
  assert.deepEqual(
    finalProblems({ ...ok, probe: silent }).map((text) => text.split(' ')[0]),
    ['çözünürlük', 'ses'],
  );
});
