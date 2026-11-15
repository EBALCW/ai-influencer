// `explainer.render` aşama akışı, sahte araçlarla (testing/explainer-shim.mjs): çıktılar, hata
// eşlemesi, yeniden deneme ve düşmanca girdi. Gerçek araçlarla üretim: pnpm worker:produce-local.
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { JOB_KINDS, jobKindCapability } from '@ai-influencer/shared/jobs';
import { createMemoryLogger } from '../../lib/log.ts';
import { createRegistry } from '../../lib/registry.ts';
import { runJob, type RunnerDeps } from '../../lib/runner.ts';
import {
  fakeExplainerTools,
  sampleEpisode,
} from '../../testing/explainer-tools.ts';
import { createFakeApi } from '../../testing/fake-api.ts';
import { createExplainerRenderJob } from './index.ts';

const KIND = 'explainer.render';
const root = mkdtempSync(path.join(os.tmpdir(), 'aiw-anlatim-'));
after(() => rmSync(root, { recursive: true, force: true }));

function setup(
  env: Record<string, string> = {},
  overrides: Parameters<typeof sampleEpisode>[0] = {},
  options: { maxUploadBytes?: number; maxAttempts?: number } = {},
) {
  const sample = sampleEpisode(overrides);
  // Sahte kuyruk iş kimliklerini her kurulumda baştan verir: her deneme kendi klasöründe çalışır
  const workDir = mkdtempSync(path.join(root, 'is-'));
  const fake = createFakeApi();
  const log = createMemoryLogger();
  const registry = createRegistry([
    createExplainerRenderJob(() => fakeExplainerTools(env)),
  ]);
  fake.scripts.set(
    `${sample.episodeId}:${sample.version.version}`,
    sample.version,
  );
  const job = fake.enqueue({
    kind: KIND,
    stages: JOB_KINDS[KIND].stages.map((stage) => ({ ...stage })),
    params: sample.params,
    required: [jobKindCapability(KIND)],
    episodeId: sample.episodeId,
    scriptVersion: sample.version.version as number,
    maxAttempts: options.maxAttempts ?? 1,
  });
  const run = async () => {
    const worker = await fake.api.registerWorker({
      name: 'test',
      platform: 'linux',
      version: '0',
      capabilities: registry.capabilities(),
    });
    const claimed = await fake.api.claimJob(worker.id, 30);
    assert.ok(claimed, 'iş alınmalı');
    const deps: RunnerDeps = {
      api: fake.api,
      registry,
      log,
      workerId: worker.id,
      leaseSeconds: 30,
      workDir,
      shutdown: new AbortController().signal,
      sleep: async () => undefined,
      progressThrottleMs: 0,
      renewIntervalMs: 50,
      ...(options.maxUploadBytes
        ? { maxUploadBytes: options.maxUploadBytes }
        : {}),
    };
    return runJob(deps, claimed);
  };
  return { fake, job, log, run, registry, workDir };
}

const statuses = (job: { stages: { status: string }[] }) =>
  job.stages.map((stage) => stage.status);

test('makine explainer.render türünü bildirir; aşamalar ortak tanımla aynı', () => {
  const { registry } = setup();
  assert.deepEqual(registry.capabilities(), ['kind:explainer.render']);
  for (const stage of ['voice', 'captions', 'visuals', 'render'])
    assert.ok(registry.find(KIND, stage), stage);
});

test('uçtan uca: dört aşama çalışır, çıktılar bağlanır, video onayında durur', async () => {
  const { job, run, workDir } = setup();
  assert.equal(await run(), 'advanced');
  assert.equal(job.status, 'awaiting_approval');
  assert.equal(job.current_stage, 'render');
  assert.deepEqual(statuses(job), [
    'succeeded',
    'succeeded',
    'succeeded',
    'succeeded',
  ]);
  assert.deepEqual(
    job.uploads.map((upload) => [
      upload.stage,
      upload.fileName,
      upload.role,
      upload.contentType,
    ]),
    [
      ['voice', 'narration.m4a', 'audio', 'audio/mp4'],
      ['voice', 'timing.json', 'other', 'application/json'],
      ['captions', 'captions.srt', 'captions', 'application/x-subrip'],
      ['captions', 'captions.ass', 'captions', 'text/plain'],
      ['visuals', 'onizleme-01.jpg', 'preview', 'image/jpeg'],
      ['visuals', 'onizleme-02.jpg', 'preview', 'image/jpeg'],
      ['visuals', 'onizleme-03.jpg', 'preview', 'image/jpeg'],
      ['visuals', 'onizleme-04.jpg', 'preview', 'image/jpeg'],
      ['render', 'final.mp4', 'final', 'video/mp4'],
      ['render', 'captions.srt', 'captions', 'application/x-subrip'],
    ],
  );
  const [voice, captions, visuals, render] = job.stages.map(
    (stage) => stage.output!,
  );
  assert.equal(voice!.voice, 'tr-TR-AhmetNeural');
  assert.equal(voice!.words, 19);
  assert.equal(voice!.structured, 'none');
  assert.equal(captions!.mode, 'line');
  assert.ok((captions!.cues as number) >= 3);
  assert.equal(visuals!.previews, 4);
  // Kaynak kartı süreye eklenir: anlatım + 3,4 sn
  assert.equal(render!.seconds, (voice!.seconds as number) + 3.4);
  assert.equal(render!.lufs, -14.1);
  assert.equal(render!.reencoded, false);
  assert.equal(render!.template, 'blueprint-v1');
  // Çalışma klasörü iş bu makineden ayrılınca silinir
  assert.equal(existsSync(path.join(workDir, job.id)), false);
});

test('iş ortadan sürdürülür: önceki aşamaların dosyaları yoksa yeniden üretilir', async () => {
  // 1. deneme render'da geçici hatayla kuyruğa döner (çalışma klasörü silinir)
  const env: Record<string, string> = { SHIM_FAIL: 'render' };
  const { job, run, workDir } = setup(env, {}, { maxAttempts: 3 });
  assert.equal(await run(), 'released');
  assert.equal(job.status, 'queued');
  assert.equal(job.current_stage, 'render');
  assert.equal(existsSync(path.join(workDir, job.id)), false);
  // 2. deneme doğrudan render aşamasından başlar ve tamamlar
  delete env.SHIM_FAIL;
  assert.equal(await run(), 'advanced');
  assert.equal(job.status, 'awaiting_approval');
  assert.equal(job.uploads.at(-2)!.fileName, 'final.mp4');
});

test('hata eşlemesi: ağ ve araç hatası geçici, girdi ve denetim hatası kalıcı', async () => {
  const cases: [
    Record<string, string>,
    'released' | 'failed',
    RegExp,
    number,
  ][] = [
    [
      { SHIM_FAIL: 'edge' },
      'released',
      /Seslendirme \(edge-tts\) başarısız/,
      0,
    ],
    [{ SHIM_FAIL: 'zaman' }, 'failed', /Altyazı zamanlama başarısız/, 1],
    [{ SHIM_FAIL: 'lint' }, 'failed', /lint\) başarısız/, 2],
    [{ SHIM_FAIL: 'snapshot' }, 'released', /Önizleme karesi başarısız/, 2],
    [{ SHIM_FAIL: 'mix' }, 'released', /Ses miksi başarısız/, 3],
    [{ SHIM_LUFS: '-27.0' }, 'failed', /ses yüksekliği hedefin dışında/, 3],
    [{ SHIM_BLACK: '1' }, 'failed', /siyah kare/, 3],
    [{ SHIM_MUTE: '1' }, 'failed', /ses akışı yok/, 3],
    [{ SHIM_DRIFT: '2' }, 'failed', /süre anlatımla uyuşmuyor/, 3],
  ];
  for (const [env, outcome, message, stageIndex] of cases) {
    const { job, run } = setup(env, {}, { maxAttempts: 2 });
    assert.equal(await run(), outcome, JSON.stringify(env));
    assert.match(job.error ?? '', message);
    assert.equal(
      job.current_stage,
      JOB_KINDS[KIND].stages[stageIndex]!.key,
      JSON.stringify(env),
    );
  }
});

test('kalıcı girdi hataları: onaysız sürüm, başka yol, bağlı bölüm yok', async () => {
  const unapproved = setup({}, { version: { approved_at: null } });
  assert.equal(await unapproved.run(), 'failed');
  assert.match(unapproved.job.error ?? '', /onaylı değil/);
  assert.equal(unapproved.job.uploads.length, 0);

  // Ses ve altyazı yoldan bağımsızdır; görsel aşama yalnız HyperFrames yolunda vardır
  const skia = setup({}, { params: { visual_route: 'skia' } });
  assert.equal(await skia.run(), 'failed');
  assert.equal(skia.job.current_stage, 'visuals');
  assert.match(skia.job.error ?? '', /yalnız "Stil paketi \(HyperFrames\)"/);

  const orphan = setup();
  orphan.job.episode_id = null;
  assert.equal(await orphan.run(), 'failed');
  assert.match(orphan.job.error ?? '', /bölüme bağlı değil/);

  const missing = setup();
  missing.fake.scripts.clear();
  assert.equal(await missing.run(), 'failed');
  assert.match(missing.job.error ?? '', /senaryo sürümü bulunamadı/);

  const malformed = setup();
  malformed.fake.scripts.set([...malformed.fake.scripts.keys()][0]!, {
    version: 2,
    script_text: 42,
  });
  assert.equal(await malformed.run(), 'failed');
  assert.match(malformed.job.error ?? '', /beklenen biçimde değil/);
});

test('yükleme sınırı: büyük video yeniden kodlanır; sığmazsa kalıcı hata', async () => {
  const fits = setup({ SHIM_BIG: '1' }, {}, { maxUploadBytes: 700_000 });
  assert.equal(await fits.run(), 'advanced');
  assert.equal(fits.job.stages[3]!.output!.reencoded, true);
  assert.ok(
    fits.job.uploads.find((upload) => upload.fileName === 'final.mp4')!.size <
      700_000,
  );

  const never = setup({ SHIM_BIG: '2' }, {}, { maxUploadBytes: 700_000 });
  assert.equal(await never.run(), 'failed');
  assert.match(never.job.error ?? '', /yükleme sınırına sığdırılamadı/);
});

test('iptal: süren alt süreç öldürülür, iş iptal olarak kapanır', async () => {
  const { fake, job, run, workDir } = setup({ SHIM_SLEEP_MS: '30000' });
  const started = Date.now();
  const outcome = run();
  // Seslendirme alt süreci başladıktan sonra iptal iste
  while (job.stages[0]!.progress === undefined && Date.now() - started < 5000)
    await new Promise((resolve) => setTimeout(resolve, 20));
  fake.requestCancel(job);
  assert.equal(await outcome, 'cancelled');
  assert.equal(job.status, 'cancelled');
  assert.ok(
    Date.now() - started < 15_000,
    'alt süreç beklenmeden durdurulmalı',
  );
  assert.equal(job.uploads.length, 0);
  // İptal hata değildir: tanılama kopyası tutulmaz
  assert.equal(existsSync(path.join(workDir, '_hatali', job.id)), false);
});

const HOSTILE =
  'İlk cümle `touch PWNED` ve $(touch PWNED) içerir. ' +
  '</script><script>require("fs").writeFileSync("PWNED","x")</script> ikinci cümle. ' +
  '"; import os; os.system("touch PWNED") #\' üçüncü cümle. ' +
  '../../PWNED ve --output=/tmp/PWNED dördüncü cümle. ' +
  `${'çokuzunkelime'.repeat(60)} beşinci cümle.`;

test('düşmanca senaryo: hiçbir şey çalışmaz, metin yalnız veri dosyalarında durur', async () => {
  // Hata vererek durdur ki tanılama kopyası kalsın ve dosyalara bakılabilsin
  const { job, run, log, fake, workDir } = setup(
    { SHIM_FAIL: 'render', SHIM_ECHO: 'GİZLİ-SENARYO-PARÇASI' },
    {
      scriptText: HOSTILE,
      params: {
        episode: {
          ...sampleEpisode().params.episode,
          title: '$(touch PWNED) `id` </title><script>1</script>',
        },
      },
    },
  );
  assert.equal(await run(), 'failed');
  assert.equal(job.current_stage, 'render');
  // Aracın hata çıktısı (senaryo metni taşıyabilir) veritabanına gitmez, yalnız yerel günlükte
  assert.equal(
    job.error,
    'Render (HyperFrames) başarısız oldu (çıkış kodu 1).',
  );
  assert.ok(log.lines.some((line) => line.includes('GİZLİ-SENARYO-PARÇASI')));
  for (const stage of job.stages)
    assert.ok(!JSON.stringify(stage.output ?? {}).includes('PWNED'));
  assert.ok(!fake.calls.join(' ').includes('PWNED'));

  const kept = path.join(workDir, '_hatali', job.id, 'reel');
  const html = readFileSync(path.join(kept, 'index.html'), 'utf8');
  assert.ok(!html.includes('PWNED') && !html.includes('touch'));
  const specJs = readFileSync(path.join(kept, 'assets', 'spec.js'), 'utf8');
  assert.ok(specJs.startsWith('window.SPEC = {'));
  assert.ok(!/[<>]/.test(specJs));
  // spec.py sabittir (repodaki dosyanın aynısı); metin spec.json'da JSON olarak durur
  assert.equal(
    readFileSync(path.join(kept, 'spec.py'), 'utf8'),
    readFileSync(new URL('./template/spec.py', import.meta.url), 'utf8'),
  );
  const spec = JSON.parse(readFileSync(path.join(kept, 'spec.json'), 'utf8'));
  assert.ok(
    spec.lines.join(' ').replace(/ \| /g, ' ').includes('$(touch PWNED)'),
  );
  // Hiçbir yerde PWNED adında dosya oluşmadı
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [entry.name],
    );
  assert.ok(!walk(workDir).includes('PWNED'));
  assert.equal(existsSync(path.join(process.cwd(), 'PWNED')), false);
  assert.equal(existsSync('/tmp/PWNED'), false);
  // Tanılama kopyasında video ve ses yoktur
  assert.ok(
    !walk(kept).some((name) => /\.(mp4|wav|mp3|m4a|png|jpg)$/.test(name)),
  );
});
