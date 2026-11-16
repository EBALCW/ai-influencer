import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { selftestJob, selftestParams } from '../handlers/selftest.ts';
import { defaultRegistry } from './handlers.ts';
import {
  JOB_KINDS,
  createRegistry,
  defineJobKind,
  isSafeFileName,
  jobKindCapability,
  validateStageOutput,
} from './registry.ts';

test('kayıt: tür + aşama → işleyici; bilinmeyenler null', () => {
  const registry = defaultRegistry();
  assert.deepEqual(registry.kinds(), ['clip.selftest', 'explainer.render']);
  assert.deepEqual(registry.capabilities(), [
    'kind:clip.selftest',
    'kind:explainer.render',
  ]);
  for (const stage of ['voice', 'captions', 'visuals', 'render'])
    assert.equal(
      typeof registry.find('explainer.render', stage)?.handler,
      'function',
    );
  for (const stage of ['prepare', 'review', 'finish'])
    assert.equal(
      typeof registry.find('clip.selftest', stage)?.handler,
      'function',
    );
  assert.equal(registry.find('clip.selftest', 'yok'), null);
  assert.equal(registry.find('explainer.render', 'script'), null);
  assert.equal(registry.find('bilinmeyen.tur', 'prepare'), null);
  // Prototip zinciri işleyici sanılmaz
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty'])
    assert.equal(registry.find('clip.selftest', name), null, name);
  assert.equal(registry.find('constructor', 'prepare'), null);
});

test('kayıt hataları: bilinmeyen tür, çift kayıt, aşama uyuşmazlığı', () => {
  const params = z.object({}).strict();
  assert.throws(
    () => createRegistry([{ ...selftestJob, kind: 'yok.tur' as never }]),
    /Bilinmeyen iş türü/,
  );
  assert.throws(() => createRegistry([selftestJob, selftestJob]), /iki kez/);
  assert.throws(
    () =>
      createRegistry([
        defineJobKind({
          kind: 'clip.selftest',
          params,
          stages: { prepare: async () => ({}) },
        }),
      ]),
    /uyuşmuyor/,
  );
  assert.throws(
    () =>
      createRegistry([
        defineJobKind({
          kind: 'clip.selftest',
          params,
          stages: {
            prepare: async () => ({}),
            review: async () => ({}),
            bitir: async () => ({}),
          },
        }),
      ]),
    /uyuşmuyor/,
  );
});

test('selftest aşamaları ortak tanımla aynı ve yalnız biri onay ister', () => {
  const stages = JOB_KINDS['clip.selftest'].stages;
  assert.deepEqual(
    stages.map((stage) => stage.key),
    Object.keys(selftestJob.stages),
  );
  assert.equal(
    stages.filter((stage) => 'requires_approval' in stage).length,
    1,
  );
  assert.equal(jobKindCapability('clip.selftest'), 'kind:clip.selftest');
});

test('parametreler şemadan geçer; kötü niyetli girdi işleyiciye ulaşmaz', () => {
  const entry = defaultRegistry().find('clip.selftest', 'prepare')!;
  assert.deepEqual(entry.parse({}), {
    ok: true,
    value: { steps: 3, stepMs: 200, note: '', failMode: 'transient' },
  });
  assert.equal(entry.parse({ steps: 5, note: '$(rm -rf ~); `id`' }).ok, true);
  const bad: unknown[] = [
    null,
    'metin',
    [],
    { steps: 0 },
    { steps: 1e9 },
    { steps: '3' },
    { stepMs: -1 },
    { note: 'x'.repeat(201) },
    { failAt: 'baska' },
    { bilinmeyen: 1 },
    { steps: 3, command: 'rm -rf /' },
    { constructor: { prototype: {} } },
    JSON.parse('{"__proto__": {"steps": 1}, "extra": true}'),
  ];
  for (const params of bad) {
    const parsed = entry.parse(params);
    assert.equal(parsed.ok, false, JSON.stringify(params));
  }
  // Hata özeti girilen değeri taşımaz
  const leaked = entry.parse({ note: 'GIZLI-DEGER'.repeat(30) });
  assert.equal(JSON.stringify(leaked).includes('GIZLI-DEGER'), false);
  assert.equal(selftestParams.safeParse({ steps: 2.5 }).success, false);
});

test('dosya adı ve aşama çıktısı denetimi', () => {
  for (const good of ['selftest.txt', 'a', 'final_1080x1920.mp4', 'A-b.c'])
    assert.equal(isSafeFileName(good), true, good);
  for (const bad of [
    '',
    '.gizli',
    '../x',
    'a/b',
    'a\\b',
    'a..b',
    'a b',
    '-rf',
    'x'.repeat(101),
    'a\0b',
    'ş.txt',
  ])
    assert.equal(isSafeFileName(bad), false, bad);

  assert.deepEqual(validateStageOutput(undefined), {});
  assert.deepEqual(validateStageOutput({ ok: true, n: 1 }), { ok: true, n: 1 });
  assert.equal(validateStageOutput([1]), null);
  assert.equal(validateStageOutput('metin'), null);
  assert.equal(validateStageOutput({ büyük: 'x'.repeat(9000) }), null);
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(validateStageOutput(circular), null);
  // Fonksiyon ve undefined alanlar JSON'a girmez
  assert.deepEqual(validateStageOutput({ a: 1, f: () => 1, u: undefined }), {
    a: 1,
  });
});
