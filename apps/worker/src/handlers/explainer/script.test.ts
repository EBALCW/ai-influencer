import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermanentError } from '../../lib/errors.ts';
import { sampleEpisode } from '../../testing/explainer-tools.ts';
import {
  buildPlan,
  jobParamsSchema,
  scriptVersionSchema,
  structuredScriptSchema,
} from './script.ts';

function plan(overrides: Parameters<typeof sampleEpisode>[0] = {}) {
  const sample = sampleEpisode(overrides);
  return buildPlan(
    jobParamsSchema.parse(sample.params),
    scriptVersionSchema.parse(sample.version),
  );
}

test('düz metinden plan: vuruşlar, okunuşlar, kaynaklar, seri ve bölüm', () => {
  const result = plan();
  assert.equal(result.structured, 'none');
  assert.deepEqual(
    result.beats.map((beat) => beat.text),
    [
      'Planörün motoru yok. Yine de saatlerce havada kalır.',
      'Modern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.',
    ],
  );
  assert.ok(result.beats.every((beat) => beat.card === null));
  assert.equal(
    result.beats[1]!.marked.replace(/ \| /g, ' '),
    result.beats[1]!.text,
  );
  assert.deepEqual(result.spoken, {
    '1.000': 'bin',
    '40': 'kırk',
    '50': 'elli',
  });
  assert.equal(result.voice, 'tr-TR-AhmetNeural');
  assert.equal(result.rate, '+8%');
  assert.equal(result.captionMode, 'line');
  assert.equal(result.title, 'Planör nasıl uçar?');
  assert.equal(result.kindLabel, 'NASIL ÇALIŞIR?');
  assert.equal(result.seriesName, 'Gökyüzü Defteri');
  assert.equal(result.episodeLabel, 'Bölüm 3');
  // Kaynak adı yoksa yalnız sunucu adı; aynı kaynak bir kez
  assert.deepEqual(result.sources, ['NASA Glenn: Gliders', 'en.wikipedia.org']);
  assert.equal(result.styleFallbackFrom, null);
});

test('varsayılanlar: ses adı dilden, hız +8%, tekil videoda bölüm etiketi yok', () => {
  const result = plan({
    params: {
      series: null,
      voice: { provider: null, name: null, rate: null },
      caption_style: { mode: 'word', renk: 'mavi' },
      style_key: 'neon',
    },
  });
  assert.equal(result.voice, 'tr-TR-AhmetNeural');
  assert.equal(result.rate, '+8%');
  assert.equal(result.captionMode, 'word');
  assert.equal(result.seriesName, null);
  assert.equal(result.episodeLabel, null);
  // Bilinmeyen stil: şablon blueprint ile çizer, bunu çıktıda söyler
  assert.equal(result.styleFallbackFrom, 'neon');
});

const structured = {
  version: 1,
  beats: [
    {
      text: 'Planörün motoru yok. Yine de saatlerce havada kalır.',
      card: { type: 'phrase', text: 'MOTOR YOK' },
    },
    {
      text: 'Modern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.',
      heading: 'Süzülme oranı',
      card: {
        type: 'number',
        value: '40-50',
        unit: 'km',
        label: '1.000 metre alçalırken',
      },
    },
  ],
  spoken: { '40,': 'kırk' },
};

test('yapılandırılmış senaryo (sürüm 1): kartlar ve başlıklar plana girer', () => {
  const result = plan({ script: structured });
  assert.equal(result.structured, 'v1');
  assert.deepEqual(result.beats[0]!.card, {
    type: 'phrase',
    text: 'MOTOR YOK',
  });
  assert.equal(result.beats[1]!.heading, 'Süzülme oranı');
  assert.equal(result.beats[1]!.card?.type, 'number');
});

test('yapılandırılmış senaryo onaylı metinle uyuşmuyorsa yok sayılır', () => {
  const drifted = structuredClone(structured);
  drifted.beats[0]!.text = 'Planörün iki motoru var.';
  const result = plan({ script: drifted });
  assert.equal(result.structured, 'ignored');
  assert.ok(result.beats.every((beat) => beat.card === null));
  assert.ok(!result.beats.some((beat) => beat.text.includes('iki motoru')));
  // Tanınmayan biçim de yok sayılır
  assert.equal(plan({ script: { sahne: [] } }).structured, 'ignored');
});

test('film motorunun script.json biçimi: text + typed okunur', () => {
  const result = plan({
    script: {
      title: 'x',
      takes: [
        {
          take: 'T01',
          lines: [
            {
              id: 1,
              text: 'Planörün motoru yok. Yine de saatlerce havada kalır.',
              hero: 'çizim: süzülen planör',
              typed: 'MOTOR YOK',
            },
          ],
        },
        {
          take: 'T02',
          lines: [
            {
              id: 2,
              text: 'Modern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.',
            },
          ],
        },
      ],
    },
  });
  assert.equal(result.structured, 'engine');
  assert.deepEqual(result.beats[0]!.card, {
    type: 'phrase',
    text: 'MOTOR YOK',
  });
  assert.equal(result.beats[1]!.card, null);
});

test('şema: bilinmeyen kart türü ve fazla alan reddedilir', () => {
  for (const bad of [
    { version: 1, beats: [] },
    { version: 2, beats: [{ text: 'a' }] },
    {
      version: 1,
      beats: [{ text: 'a', card: { type: 'diagram', svg: '<svg/>' } }],
    },
    {
      version: 1,
      beats: [{ text: 'a', card: { type: 'phrase', text: 'x', html: '<b>' } }],
    },
    {
      version: 1,
      beats: [{ text: 'a', card: { type: 'steps', items: ['tek'] } }],
    },
    {
      version: 1,
      beats: [{ text: 'a', card: { type: 'number', value: 'x'.repeat(17) } }],
    },
    { version: 1, beats: [{ text: 'a', script: 'alert(1)' }] },
  ])
    assert.equal(structuredScriptSchema.safeParse(bad).success, false);
});

test('girdi doğrulama: kalıcı hatalar ve senaryo metni taşımayan mesajlar', () => {
  const secret = 'ÇOK-GİZLİ-SENARYO-CÜMLESİ';
  const cases: [Parameters<typeof sampleEpisode>[0], RegExp][] = [
    [{ version: { approved_at: null } }, /onaylı değil/],
    [{ version: { version: 5 } }, /sürümü/],
    [{ scriptText: ' \n ' }, /boş/],
    [{ scriptText: `${secret} `.repeat(500) }, /çok uzun/],
    [
      { params: { voice: { provider: 'elevenlabs', name: null, rate: null } } },
      /edge-tts/,
    ],
    [
      {
        params: { voice: { provider: null, name: '$(rm -rf ~)', rate: null } },
      },
      /Ses adı/,
    ],
    [
      { params: { voice: { provider: null, name: null, rate: '+8%; ls' } } },
      /hız/i,
    ],
    [
      {
        scriptText: 'Merhaba dünya.',
        version: { language: 'de' },
        params: { voice: { provider: null, name: null, rate: null } },
      },
      /varsayılan ses yok/,
    ],
  ];
  for (const [overrides, pattern] of cases)
    assert.throws(
      () => plan(overrides),
      (error: unknown) => {
        assert.ok(error instanceof PermanentError);
        assert.match(error.message, pattern);
        assert.ok(!error.message.includes(secret));
        return true;
      },
    );
  // Parametre şeması: bilinmeyen yol, hatalı kimlik
  const sample = sampleEpisode();
  assert.equal(
    jobParamsSchema.safeParse({ ...sample.params, visual_route: '../../etc' })
      .success,
    false,
  );
  assert.equal(
    jobParamsSchema.safeParse({
      ...sample.params,
      episode: { ...sample.params.episode, id: '../x' },
    }).success,
    false,
  );
});
