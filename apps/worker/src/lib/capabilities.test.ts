import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAPABILITY_REQUIREMENTS,
  CHECK_IDS,
  CHECK_LABELS,
  EXIT,
  OPTIONAL_CHECKS,
  ROUTES,
  WORKER_CAPABILITIES,
  deriveCapabilities,
  deriveRoutes,
  exitCode,
  type CheckId,
  type CheckStatus,
} from './capabilities.ts';

const checks = (overrides: Partial<Record<CheckId, CheckStatus>> = {}) =>
  CHECK_IDS.map((id) => ({ id, status: overrides[id] ?? ('ok' as const) }));

const only = (...ok: CheckId[]) =>
  CHECK_IDS.map((id) => ({
    id,
    status: ok.includes(id) ? ('ok' as const) : ('missing' as const),
  }));

test('yetenek anahtarları sabit: ad değişirse kuyruktaki işler eşleşmez', () => {
  assert.deepEqual(
    [...WORKER_CAPABILITIES],
    [
      'voice.edge-tts',
      'captions.burn',
      'render.skia',
      'render.hyperframes',
      'render.blender',
      'render.blender.mpfb',
      'clip.cut',
      'clip.transcribe',
      'clip.audio-tags',
      'fetch.youtube',
    ],
  );
});

test('her yeteneğin gereksinimi ve her denetimin etiketi tanımlı', () => {
  for (const key of WORKER_CAPABILITIES) {
    assert.ok(CAPABILITY_REQUIREMENTS[key].length > 0, key);
    for (const id of CAPABILITY_REQUIREMENTS[key])
      assert.ok(CHECK_IDS.includes(id), `${key} → ${id}`);
  }
  for (const id of CHECK_IDS) assert.ok(CHECK_LABELS[id], id);
  for (const route of ROUTES)
    for (const key of route.requires)
      assert.ok(WORKER_CAPABILITIES.includes(key), `${route.key} → ${key}`);
});

test('isteğe bağlı denetim hiçbir üretim yolunu engellemez', () => {
  const overrides = Object.fromEntries(
    OPTIONAL_CHECKS.map((id) => [id, 'missing' as const]),
  );
  const { available } = deriveCapabilities(checks(overrides));
  assert.ok(deriveRoutes(available).every((route) => route.ready));
  assert.ok(!available.includes('render.blender.mpfb'));
  assert.ok(!available.includes('clip.audio-tags'));
});

test('her şey kuruluysa bütün yetenekler var', () => {
  const report = deriveCapabilities(checks());
  assert.deepEqual(report.available, [...WORKER_CAPABILITIES]);
  assert.deepEqual(report.unavailable, []);
});

test('boş makine (CI): hiçbir yetenek yok, eksikler adıyla listelenir', () => {
  const report = deriveCapabilities(only('node', 'pnpm', 'python', 'chrome'));
  assert.deepEqual(report.available, []);
  assert.equal(report.unavailable.length, WORKER_CAPABILITIES.length);
  assert.deepEqual(
    report.unavailable.find((item) => item.key === 'fetch.youtube')?.missing,
    ['yt-dlp', 'ffmpeg'],
  );
  assert.deepEqual(
    report.unavailable.find((item) => item.key === 'render.hyperframes')
      ?.missing,
    ['hyperframes', 'ffmpeg', 'ffprobe', 'ffmpeg.libx264'],
  );
});

test('libass yoksa klip kesilir ama altyazı gömülemez', () => {
  const { available, unavailable } = deriveCapabilities(
    checks({ 'ffmpeg.subtitles': 'missing' }),
  );
  assert.ok(available.includes('clip.cut'));
  assert.ok(available.includes('render.blender'));
  assert.ok(!available.includes('captions.burn'));
  assert.deepEqual(
    unavailable.find((item) => item.key === 'captions.burn')?.missing,
    ['ffmpeg.subtitles'],
  );
  const routes = deriveRoutes(available);
  assert.equal(routes.find((r) => r.key === 'clip')?.ready, true);
  assert.equal(routes.find((r) => r.key === 'explainer.skia')?.ready, false);
  // Stil yolunda altyazı kompozisyonun içinde: libass gerekmez
  assert.equal(
    routes.find((r) => r.key === 'explainer.hyperframes')?.ready,
    true,
  );
});

test('eski sürüm eksik gibi sayılır', () => {
  const { available, unavailable } = deriveCapabilities(
    checks({ blender: 'outdated' }),
  );
  assert.ok(!available.includes('render.blender'));
  assert.ok(!available.includes('render.blender.mpfb'));
  assert.deepEqual(
    unavailable.find((item) => item.key === 'render.blender')?.missing,
    ['blender'],
  );
});

test('sanal ortam yoksa ses ve Skia yok; klip yolu etkilenmez', () => {
  const { available } = deriveCapabilities(
    checks({ venv: 'missing', 'py.edge-tts': 'missing', 'py.skia': 'missing' }),
  );
  assert.ok(!available.includes('voice.edge-tts'));
  assert.ok(!available.includes('render.skia'));
  assert.deepEqual(
    deriveRoutes(available)
      .filter((route) => route.ready)
      .map((route) => route.key),
    ['clip'],
  );
});

test('listede olmayan denetim eksik sayılır', () => {
  const { available } = deriveCapabilities([
    { id: 'yt-dlp', status: 'ok' },
    { id: 'ffmpeg', status: 'ok' },
  ]);
  assert.deepEqual(available, ['fetch.youtube']);
});

test('whisper modeli olmadan yerel konuşma tanıma yok', () => {
  const { available } = deriveCapabilities(
    checks({ 'whisper.model': 'missing' }),
  );
  assert.ok(!available.includes('clip.transcribe'));
  assert.ok(available.includes('clip.cut'));
});

test('exitCode', () => {
  const full = deriveCapabilities(checks()).available;
  assert.equal(exitCode(deriveRoutes(full), full, []), EXIT.ok);
  assert.equal(exitCode(deriveRoutes([]), [], []), EXIT.nothing);

  // Yetenek var ama hiçbir yol tam değil: üretilecek bir şey yok
  const partial = deriveCapabilities(
    only('ffmpeg', 'ffprobe', 'ffmpeg.libx264'),
  ).available;
  assert.deepEqual(partial, ['clip.cut']);
  assert.equal(exitCode(deriveRoutes(partial), partial, []), EXIT.nothing);

  // --require: istenen varsa 0, biri eksikse 3
  assert.equal(exitCode(deriveRoutes(partial), partial, ['clip.cut']), EXIT.ok);
  assert.equal(
    exitCode(deriveRoutes(full), full, ['clip.cut', 'render.skia']),
    EXIT.ok,
  );
  assert.equal(
    exitCode(deriveRoutes(partial), partial, ['clip.cut', 'fetch.youtube']),
    EXIT.requireMissing,
  );
});
