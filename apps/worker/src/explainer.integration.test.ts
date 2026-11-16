// Anlatım üretiminin (#219, #220) gerçek Supabase'e (CI'daki yerel kurulum) karşı uçtan uca testi:
// editor bölüm açar → senaryoyu ve kaynak notlarını kaydeder → onaylar → üretime gönderir →
// makine işi alır, senaryoyu `episode_script_versions`'tan okur, dört aşamayı yürütür, çıktıları
// `productions` bucket'ına yükleyip işe bağlar → iş video onayında durur → makine oturumu
// onaylayamaz → editor onaylar → iş tamamlanır, bölüm "video onaylı" olur.
// Ağır araçlar (edge-tts, HyperFrames, ffmpeg) CI'da yoktur: yerlerine aynı dosyaları yazan sahte
// araçlar kullanılır (testing/explainer-shim.mjs). Gerçek video: `pnpm worker:produce-local`.
// Yerel veriye kullanıcı ve çalışma alanı yazdığı için yalnız WORKER_INTEGRATION=1 ile çalışır.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createExplainerRenderJob } from './handlers/explainer/index.ts';
import { createHttp } from './lib/api.ts';
import { createMemoryLogger } from './lib/log.ts';
import { login } from './lib/login.ts';
import { createRegistry } from './lib/registry.ts';
import { createWorkerApi } from './lib/worker-api.ts';
import { createWorker, type ExitReason, type Worker } from './lib/worker.ts';
import { fakeExplainerTools } from './testing/explainer-tools.ts';
import { createMemoryStore } from './testing/memory-store.ts';

const enabled = process.env.WORKER_INTEGRATION === '1';
const url = process.env.LOCAL_SUPABASE_URL ?? '';
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? '';
const run = randomUUID().slice(0, 8);
const workDir = mkdtempSync(path.join(os.tmpdir(), 'aiw-anlatim-it-'));
/** Panelin HyperFrames yolu için istediği yetenekler (`requiredCapabilities`). */
const REQUIRED = [
  'kind:explainer.render',
  'voice.edge-tts',
  'render.hyperframes',
];

const SCRIPT_TEXT =
  'Planörün motoru yok. Yine de saatlerce havada kalır.\n\n' +
  'Modern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.';
const STRUCTURED = {
  version: 1,
  beats: [
    {
      text: 'Planörün motoru yok. Yine de saatlerce havada kalır.',
      card: { type: 'phrase', text: 'MOTOR YOK' },
    },
    {
      text: 'Modern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.',
      heading: 'Süzülme oranı',
      card: { type: 'number', value: '40-50', unit: 'km' },
    },
  ],
};
const FACT_NOTES = [
  {
    claim: 'Planörün motoru yok; itki üretmez.',
    sources: [
      {
        title: 'NASA Glenn: Gliders',
        url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/gliders/',
        primary: true,
      },
      {
        title: 'Wikipedia: Glider (sailplane)',
        url: 'https://en.wikipedia.org/wiki/Glider_(sailplane)',
      },
    ],
  },
  {
    claim: 'Modern planör 1 km alçalırken 40-50 km ileri gider.',
    sources: [
      {
        title: 'Wikipedia: Gliding',
        url: 'https://en.wikipedia.org/wiki/Gliding',
      },
      {
        title: 'Wikipedia: Glider (sailplane)',
        url: 'https://en.wikipedia.org/wiki/Glider_(sailplane)',
      },
    ],
  },
];

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
  } = {},
): Promise<Reply> {
  const key = options.key ?? anonKey;
  const response = await fetch(`${url}${route}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      apikey: key,
      Authorization: `Bearer ${options.token ?? key}`,
      'Content-Type': 'application/json',
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

async function rpc(token: string, name: string, body: Record<string, unknown>) {
  const reply = await rest(`/rest/v1/rpc/${name}`, { token, body });
  assert.equal(reply.status, 200, `${name} başarısız: ${reply.text}`);
  return reply.json;
}

async function waitFor<T>(
  what: string,
  probe: () => Promise<T | null | undefined | false>,
  timeoutMs = 60_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`zaman aşımı: ${what}`);
    await delay(200);
  }
}

let person: {
  id: string;
  email: string;
  password: string;
  workspaceId: string;
  token: string;
};
let running: { worker: Worker; done: Promise<ExitReason> } | null = null;
let machineToken = '';

before(async () => {
  if (!enabled) return;
  // Uzak bir projeye asla test verisi yazılmaz.
  assert.match(
    url,
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/,
    'LOCAL_SUPABASE_URL yerel olmalı',
  );
  const email = `worker-it-anlatim-${run}@example.test`;
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
    body: { p_user_id: created.json.id, p_name: `Anlatım makine testi ${run}` },
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
  person = {
    id: created.json.id,
    email,
    password,
    workspaceId: workspace.json,
    token: signedIn.json.access_token,
  };
});

after(async () => {
  rmSync(workDir, { recursive: true, force: true });
  if (!enabled) return;
  running?.worker.stop();
  await running?.done.catch(() => undefined);
  if (!person) return;
  await rest(`/rest/v1/workspaces?id=eq.${person.workspaceId}`, {
    key: serviceKey,
    method: 'DELETE',
  });
  await rest(`/auth/v1/admin/users/${person.id}`, {
    key: serviceKey,
    method: 'DELETE',
  });
});

test(
  'onaylı bölüm üretime gönderilir → makine dört aşamayı yürütür → video onayı → tamamlanır',
  { skip: !enabled, timeout: 180_000 },
  async () => {
    // 1) Editor: bölüm, ayarlar, senaryo, onay
    const episode = await rpc(person.token, 'create_episode', {
      p_title: 'Planör nasıl uçar?',
      p_kind: 'how_it_works',
    });
    await rpc(person.token, 'update_episode', {
      p_episode_id: episode.id,
      p_patch: {
        visual_route: 'hyperframes',
        style_key: 'blueprint',
        voice_provider: 'edge-tts',
        voice_name: 'tr-TR-AhmetNeural',
        voice_rate: '+8%',
        caption_style: { mode: 'word' },
      },
    });
    const saved = await rpc(person.token, 'save_episode_script', {
      p_episode_id: episode.id,
      p_script_text: SCRIPT_TEXT,
      p_fact_notes: FACT_NOTES,
      p_script: STRUCTURED,
    });
    assert.ok(saved.script_version >= 1);
    // Onaysız senaryoyla üretim işi açılamaz
    const early = await rest('/rest/v1/rpc/enqueue_episode_job', {
      token: person.token,
      body: {
        p_episode_id: episode.id,
        p_kind: 'explainer.render',
        p_required_capabilities: REQUIRED,
      },
    });
    assert.notEqual(early.status, 200, 'onaysız senaryo üretime gitmemeli');
    await rpc(person.token, 'approve_episode_script', {
      p_episode_id: episode.id,
      p_script_version: saved.script_version,
    });
    const job = await rpc(person.token, 'enqueue_episode_job', {
      p_episode_id: episode.id,
      p_kind: 'explainer.render',
      p_required_capabilities: REQUIRED,
    });
    assert.equal(job.episode_id, episode.id);
    assert.equal(job.episode_script_version, saved.script_version);
    assert.equal(job.params.visual_route, 'hyperframes');
    assert.equal(job.params.voice.name, 'tr-TR-AhmetNeural');

    // 2) Makine: giriş, kayıt, döngü (sahte araçlarla)
    const http = createHttp({ supabaseUrl: url, anonKey });
    const log = createMemoryLogger();
    const answers = [person.email, person.password];
    const next = async () => answers.shift() ?? '';
    const session = await login({
      http,
      store: createMemoryStore(),
      account: 'integration-anlatim',
      log,
      prompter: { ask: next, askHidden: next },
      say: () => undefined,
      method: 'password',
    });
    const worker = createWorker({
      api: createWorkerApi(http, session),
      registry: createRegistry([
        createExplainerRenderJob(() => fakeExplainerTools()),
      ]),
      log,
      name: `Anlatım makinesi ${run}`,
      platform: 'linux',
      version: '0.0.0-test',
      // Gerçek makinede bunları `worker:doctor` denetimi bildirir
      capabilities: async () => ['voice.edge-tts', 'render.hyperframes'],
      pollMs: 200,
      heartbeatMs: 500,
      leaseSeconds: 60,
      workDir,
      runner: { progressThrottleMs: 100, renewIntervalMs: 1000 },
    });
    running = { worker, done: worker.run() };
    machineToken = await session.accessToken();

    const read = async () => {
      const reply = await rest(
        `/rest/v1/jobs?id=eq.${job.id}&select=id,status,current_stage,error,job_stages(key,seq,status,output,error,approved_at)`,
        { token: person.token },
      );
      assert.equal(reply.status, 200, reply.text);
      const row = reply.json[0];
      row.job_stages.sort(
        (a: { seq: number }, b: { seq: number }) => a.seq - b.seq,
      );
      return row;
    };
    const waiting = await waitFor('iş video onayında durmalı', async () => {
      const row = await read();
      if (row.status === 'failed' || row.status === 'cancelled')
        throw new Error(
          `iş ${row.status}: ${row.error}\n${log.lines.slice(-20).join('\n')}`,
        );
      return row.status === 'awaiting_approval' ? row : null;
    });
    assert.equal(waiting.current_stage, 'render');
    assert.deepEqual(
      waiting.job_stages.map((stage: { key: string }) => stage.key),
      ['voice', 'captions', 'visuals', 'render'],
    );
    const [voice, captions, visuals, render] = waiting.job_stages.map(
      (stage: { output: Record<string, unknown> }) => stage.output,
    );
    assert.equal(voice.voice, 'tr-TR-AhmetNeural');
    assert.equal(
      voice.structured,
      'v1',
      'yapılandırılmış senaryo onaylı metinle eşleşmeli',
    );
    assert.equal(voice.words, 19);
    assert.equal(captions.mode, 'word');
    assert.ok(visuals.previews >= 3);
    assert.equal(render.width, 1080);
    assert.equal(render.height, 1920);
    // Kaynak notları var: kapanış kartı süreye eklenir
    assert.ok(Math.abs(render.seconds - (voice.seconds + 3.4)) < 0.01);

    // 3) Çıktılar bucket'ta ve işe bağlı
    const assets = await rest(
      `/rest/v1/job_assets?job_id=eq.${job.id}&select=role,stage_key,assets(bucket,storage_path,mime_type,file_size_bytes,kind)`,
      { token: person.token },
    );
    assert.equal(assets.status, 200, assets.text);
    const byName = new Map<
      string,
      { role: string; stage_key: string; assets: Record<string, unknown> }
    >();
    for (const row of assets.json)
      byName.set(String(row.assets.storage_path).split('/').pop()!, row);
    for (const [name, role, mime] of [
      ['narration.m4a', 'audio', 'audio/mp4'],
      ['timing.json', 'other', 'application/json'],
      ['captions.srt', 'captions', 'application/x-subrip'],
      ['captions.ass', 'captions', 'text/plain'],
      ['onizleme-01.jpg', 'preview', 'image/jpeg'],
      ['final.mp4', 'final', 'video/mp4'],
    ] as const) {
      const row = byName.get(name);
      assert.ok(row, `${name} işe bağlı olmalı`);
      assert.equal(row.role, role, name);
      assert.equal(row.assets.bucket, 'productions');
      assert.equal(row.assets.mime_type, mime, name);
      assert.equal(
        row.assets.storage_path,
        `${person.workspaceId}/${job.id}/${name}`,
      );
      assert.ok(Number(row.assets.file_size_bytes) > 0, name);
    }
    assert.equal(byName.get('final.mp4')!.assets.kind, 'final_video');
    assert.equal(byName.get('final.mp4')!.stage_key, 'render');
    // Altyazı dosyası gerçekten yüklenmiş ve kelime kelime (word modu)
    const srt = await fetch(
      `${url}/storage/v1/object/authenticated/productions/${person.workspaceId}/${job.id}/captions.srt`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${person.token}` } },
    );
    assert.equal(srt.status, 200);
    const srtText = await srt.text();
    assert.match(srtText, /^1\n00:00:00,\d{3} --> 00:00:00,\d{3}\nPlanörün\n/);
    // Senaryo metni makinenin günlüğüne ya da aşama çıktılarına yazılmaz
    assert.ok(!JSON.stringify(waiting.job_stages).includes('saatlerce'));

    // 4) Makine oturumu video onayı veremez; editor verir
    const denied = await rest('/rest/v1/rpc/approve_job_stage', {
      token: machineToken,
      body: { p_job_id: job.id, p_stage_key: 'render' },
    });
    assert.notEqual(denied.status, 200, 'makine oturumu onaylayamamalı');
    const status = async () =>
      (
        await rest(`/rest/v1/episodes?id=eq.${episode.id}&select=status`, {
          token: person.token,
        })
      ).json[0].status;
    assert.equal(await status(), 'ready_for_review');
    await rpc(person.token, 'approve_job_stage', {
      p_job_id: job.id,
      p_stage_key: 'render',
    });
    const done = await waitFor('iş tamamlanmalı', async () => {
      const row = await read();
      return row.status === 'succeeded' ? row : null;
    });
    assert.ok(done.job_stages[3].approved_at);
    assert.equal(await status(), 'approved');

    worker.stop();
    assert.equal(await running.done, 'stopped');
    running = null;
  },
);
