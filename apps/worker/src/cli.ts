#!/usr/bin/env node
// Üretim makinesi programı (#211). Kullanım: pnpm worker:<start|login|logout|status|selftest>
// Kuyruktan iş alır, aşamaları bu bilgisayarda çalıştırır, sonucu yükler. Kimlik: ekip üyesinin
// makine olarak kaydedilmiş oturumu (docs/AUTH.md → "Üretim makinesi oturumu"); service role anahtarı kullanılmaz.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectChecks, hostContext } from './checks.ts';
import { selftestJob, selftestParams } from './handlers/selftest.ts';
import { createHttp } from './lib/api.ts';
import { deriveCapabilities } from './lib/capabilities.ts';
import {
  ConfigError,
  parseEnvFile,
  pickEnv,
  resolveConfig,
  type HostInfo,
  type WorkerConfig,
} from './lib/config.ts';
import {
  CredentialStoreError,
  createCredentialStore,
  type CredentialStore,
} from './lib/credential-store.ts';
import {
  AbortedError,
  ApiError,
  LoginError,
  NetworkError,
  SessionError,
} from './lib/errors.ts';
import { defaultRegistry } from './lib/handlers.ts';
import { createLogger, type Logger } from './lib/log.ts';
import { login, type Prompter } from './lib/login.ts';
import { createPrompter } from './lib/prompt.ts';
import { redactText } from './lib/redact.ts';
import { isSafeFileName, type StageContext } from './lib/registry.ts';
import { NOT_LOGGED_IN, createSession } from './lib/session.ts';
import { runProcess } from './lib/spawn.ts';
import {
  LockError,
  acquireLock,
  clearState,
  lockHolder,
  readState,
  writeState,
} from './lib/state.ts';
import { backoffMs } from './lib/timing.ts';
import { WORKER_VERSION } from './lib/version.ts';
import { createWorkerApi } from './lib/worker-api.ts';
import { createWorker, interruptibleSleep } from './lib/worker.ts';

export const EXIT = {
  ok: 0,
  error: 1,
  usage: 2,
  /** Makinede giriş yapılmamış. */
  notPaired: 3,
  /** Oturum geçersiz ya da makinenin yetkisi kaldırılmış. */
  revoked: 4,
  /** Program zaten çalışıyor. */
  alreadyRunning: 5,
  /** Güvenli kimlik kasası yok. */
  noCredentialStore: 6,
} as const;

export const HELP = `Kullanım: pnpm worker:<komut> [seçenekler]

  worker:start     Kuyruğu izler ve işleri bu bilgisayarda çalıştırır (Ctrl+C ile durur)
  worker:login     Ekip üyesi olarak giriş yapar; bu bilgisayarı makine olarak kaydeder
  worker:logout    Makinenin oturumunu kapatır ve kasadaki kaydı siler
  worker:status    Giriş, kasa ve oturum durumunu gösterir
  worker:selftest  İşleyicileri bu bilgisayarda çevrimdışı dener (kuyruğa iş açmaz)

Seçenekler:
  --json             Satır başına bir JSON nesnesi yazar
  --exit-when-idle   start: sırada iş kalmayınca çıkar
  --force            login: zaten giriş yapılmışsa yeniden giriş yapar
  --password         login: e-posta bağlantısı yerine parolayla giriş (parolası olan hesaplar)
  --help             Bu metni gösterir

Çıkış kodları: 0 tamam · 1 hata · 2 kullanım/ayar · 3 giriş yapılmamış · 4 yetki kaldırılmış
· 5 zaten çalışıyor · 6 güvenli kimlik kasası yok
Ayarlar repo kökündeki .env.local dosyasından okunur (docs/SETUP.md → Üretim makinesi).`;

const COMMANDS = ['start', 'login', 'logout', 'status', 'selftest'] as const;
type Command = (typeof COMMANDS)[number];

interface SignalSource {
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
}

export interface CliDeps {
  argv: readonly string[];
  env: Record<string, string | undefined>;
  host: HostInfo;
  repoRoot: string;
  out: (line: string) => void;
  signals: SignalSource;
  /** Test: işletim sistemi kasası yerine. */
  store?: CredentialStore;
  /** Test: yetenek denetimi yerine. */
  capabilities?: () => Promise<readonly string[]>;
  /** İkinci durdurma sinyalinde zorla çıkış. */
  forceExit?: (code: number) => void;
  /** Test: uçbirim girdisi yerine. */
  prompter?: Prompter;
}

export function parseCliArgs(argv: readonly string[]): {
  command: Command | null;
  json: boolean;
  exitWhenIdle: boolean;
  force: boolean;
  password: boolean;
  help: boolean;
  unknown: string[];
} {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const known = [
    '--json',
    '--exit-when-idle',
    '--force',
    '--password',
    '--help',
  ];
  const first = positional[0];
  return {
    command: (COMMANDS as readonly string[]).includes(first ?? '')
      ? (first as Command)
      : null,
    json: flags.has('--json'),
    exitWhenIdle: flags.has('--exit-when-idle'),
    force: flags.has('--force'),
    password: flags.has('--password'),
    help: flags.has('--help'),
    unknown: [
      ...[...flags].filter((flag) => !known.includes(flag)),
      ...positional.slice(1),
    ],
  };
}

function loadConfig(deps: CliDeps): WorkerConfig {
  const file = path.join(deps.repoRoot, '.env.local');
  const fileEnv = existsSync(file)
    ? parseEnvFile(readFileSync(file, 'utf8'))
    : {};
  return resolveConfig(fileEnv, pickEnv(deps.env), deps.host);
}

async function probeCapabilities(
  deps: CliDeps,
  log: Logger,
): Promise<readonly string[]> {
  if (deps.capabilities) return deps.capabilities();
  try {
    return deriveCapabilities(await collectChecks(hostContext())).available;
  } catch (error) {
    log.warn(
      'Yetenek denetimi çalıştırılamadı; makine yalnız temel işleri alacak.',
      {
        hata: error,
      },
    );
    return [];
  }
}

/** Durdurma sinyalleri: ilki nazikçe durdurur, ikincisi zorla çıkar. Temizleyiciyi döndürür. */
export function onStopSignals(
  source: SignalSource,
  stop: () => void,
  force: () => void,
): () => void {
  let count = 0;
  const handler = () => {
    count += 1;
    if (count === 1) stop();
    else force();
  };
  // SIGBREAK: Windows'ta Ctrl+Break; SIGHUP: konsol penceresi kapatıldı
  const names = ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'];
  for (const name of names) source.on(name, handler);
  return () => {
    for (const name of names) source.off(name, handler);
  };
}

async function start(
  deps: CliDeps,
  config: WorkerConfig,
  store: CredentialStore,
  log: Logger,
  exitWhenIdle: boolean,
): Promise<number> {
  const lock = acquireLock(config.stateDir);
  const stopping = new AbortController();
  let worker: ReturnType<typeof createWorker> | null = null;
  let watchdog: NodeJS.Timeout | undefined;
  const removeSignals = onStopSignals(
    deps.signals,
    () => {
      log.info(
        'Durduruluyor: süren iş kuyruğa bırakılacak. (Zorla çıkmak için yeniden Ctrl+C)',
      );
      stopping.abort();
      worker?.stop();
      watchdog = setTimeout(() => {
        log.error(
          'Durdurma 30 saniyede bitmedi; çıkılıyor. Süren iş kirası dolunca kuyruğa döner.',
        );
        (deps.forceExit ?? process.exit)(EXIT.error);
      }, 30_000);
      watchdog.unref();
    },
    () => {
      log.warn('Zorla çıkılıyor. Süren iş kirası dolunca kuyruğa döner.');
      (deps.forceExit ?? process.exit)(130);
    },
  );
  try {
    const http = createHttp({
      supabaseUrl: config.supabaseUrl,
      anonKey: config.anonKey,
    });
    const session = createSession({
      http,
      store,
      account: config.account,
      log,
    });
    // Açılışta ağ yoksa beklenir; oturum geçersizse durulur.
    for (let attempt = 1; ; attempt++) {
      try {
        await session.accessToken();
        break;
      } catch (error) {
        if (!(error instanceof NetworkError)) throw error;
        if (stopping.signal.aborted) return EXIT.ok;
        log.warn('Supabase’e ulaşılamadı; yeniden denenecek.', {
          deneme: attempt,
        });
        await interruptibleSleep(backoffMs(attempt), stopping.signal);
        if (stopping.signal.aborted) return EXIT.ok;
      }
    }
    worker = createWorker({
      api: createWorkerApi(http, session),
      registry: defaultRegistry(),
      log,
      name: config.name,
      platform: deps.host.platform,
      version: WORKER_VERSION,
      capabilities: () => probeCapabilities(deps, log),
      pollMs: config.pollMs,
      heartbeatMs: config.heartbeatMs,
      leaseSeconds: config.leaseSeconds,
      workDir: config.workDir,
      exitWhenIdle,
      onRegistered: (registered) => {
        const known = readState(config.stateDir, config.account);
        writeState(config.stateDir, {
          account: config.account,
          workerId: registered.id,
          name: registered.name,
          pairedAt: known?.pairedAt ?? new Date().toISOString(),
        });
      },
    });
    if (stopping.signal.aborted) return EXIT.ok;
    const reason = await worker.run();
    if (reason === 'revoked') {
      await session.forget().catch(() => undefined);
      clearState(config.stateDir);
      log.error(
        'Bu makinenin yetkisi kaldırılmış. Yeniden giriş için `pnpm worker:login` çalıştır.',
      );
      return EXIT.revoked;
    }
    log.info(
      reason === 'idle' ? 'Sırada iş yok; çıkılıyor.' : 'Program durdu.',
    );
    return EXIT.ok;
  } finally {
    clearTimeout(watchdog);
    removeSignals();
    lock.release();
  }
}

async function runLogin(
  deps: CliDeps,
  config: WorkerConfig,
  store: CredentialStore,
  log: Logger,
  options: { force: boolean; password: boolean },
): Promise<number> {
  const lock = acquireLock(config.stateDir);
  const abort = new AbortController();
  const removeSignals = onStopSignals(
    deps.signals,
    () => abort.abort(),
    () => (deps.forceExit ?? process.exit)(130),
  );
  try {
    if (!options.force && (await store.get(config.account)) !== null) {
      deps.out(
        'Bu makinede zaten giriş yapılmış. Durumu görmek için `pnpm worker:status`, yeniden giriş için `pnpm worker:login --force`.',
      );
      return EXIT.ok;
    }
    const http = createHttp({
      supabaseUrl: config.supabaseUrl,
      anonKey: config.anonKey,
    });
    const session = await login({
      http,
      store,
      account: config.account,
      log,
      prompter: deps.prompter ?? createPrompter(process.stdin, process.stdout),
      say: deps.out,
      method: options.password ? 'password' : 'email',
      signal: abort.signal,
    });
    // Oturum hemen makine olarak kaydedilir: o andan sonra salt okur ve onay veremez.
    // Kaydedilemezse sıradan bir üye oturumu kasada bırakılmaz.
    try {
      const registered = await createWorkerApi(http, session).registerWorker({
        name: config.name,
        platform: deps.host.platform,
        version: WORKER_VERSION,
        capabilities: [
          ...new Set([
            ...(await probeCapabilities(deps, log)),
            ...defaultRegistry().capabilities(),
          ]),
        ].sort(),
      });
      writeState(config.stateDir, {
        account: config.account,
        workerId: registered.id,
        name: registered.name,
        pairedAt: new Date().toISOString(),
      });
      deps.out(
        `Giriş tamam: "${registered.name}" makine olarak kaydedildi. Oturum ${store.label} içinde saklandı. Başlatmak için: pnpm worker:start`,
      );
      return EXIT.ok;
    } catch (error) {
      await session
        .logout()
        .catch(() => session.forget().catch(() => undefined));
      clearState(config.stateDir);
      const reason =
        error instanceof ApiError && error.code === '42501'
          ? 'Bu hesap makine kaydedemiyor (owner ya da editor olmalı).'
          : 'Makine kaydedilemedi.';
      deps.out(`${reason} Oturum kapatıldı; kasaya bir şey bırakılmadı.`);
      return EXIT.error;
    }
  } finally {
    removeSignals();
    lock.release();
  }
}

async function runLogout(
  config: WorkerConfig,
  store: CredentialStore,
  log: Logger,
  out: (line: string) => void,
): Promise<number> {
  const lock = acquireLock(config.stateDir);
  try {
    if ((await store.get(config.account)) === null) {
      clearState(config.stateDir);
      out('Bu makinede giriş yapılmamış; yapılacak bir şey yok.');
      return EXIT.ok;
    }
    const http = createHttp({
      supabaseUrl: config.supabaseUrl,
      anonKey: config.anonKey,
    });
    const session = createSession({
      http,
      store,
      account: config.account,
      log,
    });
    try {
      await session.logout();
    } catch (error) {
      if (!(error instanceof NetworkError)) throw error;
      // Sunucuya ulaşılamadı: yerel kayıt yine silinir, oturum panelden kaldırılmalıdır
      await session.forget();
      out(
        'Supabase’e ulaşılamadı: kasadaki kayıt silindi ama oturum sunucuda açık kalmış olabilir. Panelde Ayarlar → Üretim makineleri → Yetkiyi kaldır ile kapat.',
      );
    }
    clearState(config.stateDir);
    out(`Oturum kapatıldı ve ${store.label} içindeki kayıt silindi.`);
    return EXIT.ok;
  } finally {
    lock.release();
  }
}

async function runStatus(
  config: WorkerConfig,
  store: CredentialStore,
  log: Logger,
  out: (line: string) => void,
  json: boolean,
): Promise<number> {
  const available = await store.available();
  const state = readState(config.stateDir, config.account);
  const runningPid = lockHolder(config.stateDir);
  const report: Record<string, unknown> = {
    sunucu: config.account,
    makine: state?.name ?? config.name,
    kasa: store.label,
    kasaKullanilabilir: available.ok,
    ...(available.ok ? {} : { kasaSorunu: available.reason }),
    girisYapilmis: false,
    calisiyor: runningPid !== null,
    surum: WORKER_VERSION,
  };
  let code: number = EXIT.notPaired;
  if (available.ok) {
    const paired = (await store.get(config.account)) !== null;
    report.girisYapilmis = paired;
    if (paired) code = EXIT.ok;
    // Çalışan program varken oturuma dokunulmaz (aynı token iki kez yenilenmesin)
    if (paired && runningPid === null) {
      const lock = acquireLock(config.stateDir);
      try {
        const http = createHttp({
          supabaseUrl: config.supabaseUrl,
          anonKey: config.anonKey,
        });
        const session = createSession({
          http,
          store,
          account: config.account,
          log,
        });
        const token = await session.accessToken();
        report.oturum = 'geçerli';
        if (state) {
          const rows = await http.select<{
            name: string;
            last_seen_at: string;
            revoked_at: string | null;
            capabilities: string[];
          }>(
            'production_workers',
            `select=name,last_seen_at,revoked_at,capabilities&id=eq.${state.workerId}`,
            token,
          );
          const row = rows[0];
          if (row) {
            report.sonGorulme = row.last_seen_at;
            report.yetenekSayisi = row.capabilities.length;
            report.yetkiKaldirildi = row.revoked_at !== null;
          }
        }
      } catch (error) {
        if (error instanceof SessionError) {
          report.oturum = 'geçersiz';
          report.girisYapilmis = false;
          code = EXIT.revoked;
        } else if (error instanceof NetworkError)
          report.oturum = 'denetlenemedi (ağ)';
        else throw error;
      } finally {
        lock.release();
      }
    }
  } else code = EXIT.noCredentialStore;

  if (json) out(JSON.stringify(report));
  else {
    const yes = (value: unknown) => (value ? 'evet' : 'hayır');
    out(`Sunucu          ${report.sunucu}`);
    out(`Makine          ${report.makine}  (sürüm ${WORKER_VERSION})`);
    out(
      `Kimlik kasası   ${report.kasa}${available.ok ? '' : `: KULLANILAMIYOR (${String(report.kasaSorunu)})`}`,
    );
    out(`Giriş yapılmış  ${yes(report.girisYapilmis)}`);
    out(
      `Program         ${runningPid === null ? 'çalışmıyor' : `çalışıyor (süreç ${runningPid})`}`,
    );
    if (report.oturum) out(`Oturum          ${String(report.oturum)}`);
    if (report.sonGorulme) out(`Son görülme     ${String(report.sonGorulme)}`);
    if (report.yetkiKaldirildi)
      out('Yetki           KALDIRILMIŞ (yeniden giriş: pnpm worker:login)');
    if (!report.girisYapilmis && available.ok)
      out('Giriş için: pnpm worker:login');
  }
  return code;
}

/** İşleyicileri kuyruk ve oturum olmadan bu bilgisayarda çalıştırır. */
async function runSelftest(deps: CliDeps, log: Logger): Promise<number> {
  const dir = path.join(
    deps.host.tmpdir,
    'ai-influencer-worker',
    `selftest-${process.pid}`,
  );
  const abort = new AbortController();
  const removeSignals = onStopSignals(
    deps.signals,
    () => abort.abort(),
    () => (deps.forceExit ?? process.exit)(130),
  );
  await mkdir(dir, { recursive: true });
  try {
    const params = selftestParams.parse({
      steps: 3,
      stepMs: 150,
      note: 'çevrimdışı deneme',
    });
    for (const [stage, handler] of Object.entries(selftestJob.stages)) {
      const stageLog = log.child({ asama: stage });
      const context: StageContext<unknown> = {
        jobId: '00000000-0000-4000-8000-000000000000',
        kind: 'clip.selftest',
        stage,
        params,
        workDir: dir,
        signal: abort.signal,
        log: stageLog,
        progress: (percent, detail) =>
          stageLog.info('İlerleme', {
            yuzde: Math.round(percent),
            not: detail,
          }),
        run: (file, args, options) =>
          runProcess(file, args, {
            ...options,
            cwd: options.cwd ?? dir,
            signal: abort.signal,
          }),
        attach: async (output) => {
          if (!isSafeFileName(output.fileName))
            throw new Error('Dosya adı geçersiz.');
          await writeFile(path.join(dir, output.fileName), output.body);
          stageLog.info('Çıktı üretildi (çevrimdışı: yüklenmedi).', {
            dosya: output.fileName,
            bayt: output.body.byteLength,
          });
        },
      };
      const output = await handler(context);
      stageLog.info('Aşama bitti.', { cikti: output ?? {} });
    }
    deps.out(
      [
        '',
        'Çevrimdışı deneme tamam: işleyiciler bu bilgisayarda çalışıyor.',
        'Kuyruk üzerinden uçtan uca denemek için (makine oturumu iş açamaz):',
        '  1) pnpm worker:start',
        '  2) Panelde Ayarlar → Üretim makineleri → "Deneme işi gönder"',
        '  3) İş "onay bekliyor" olunca aynı sayfadan onayla; iş tamamlanır.',
      ].join('\n'),
    );
    return EXIT.ok;
  } finally {
    removeSignals();
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function main(deps: CliDeps): Promise<number> {
  const args = parseCliArgs(deps.argv);
  if (args.help) {
    deps.out(HELP);
    return EXIT.ok;
  }
  if (!args.command || args.unknown.length > 0) {
    deps.out(
      `${args.unknown.length > 0 ? `Bilinmeyen seçenek: ${args.unknown.join(' ')}` : 'Komut belirtilmedi.'}\n\n${HELP}`,
    );
    return EXIT.usage;
  }
  const log = createLogger({
    json: args.json,
    home: deps.host.home,
    write: deps.out,
  });
  try {
    if (args.command === 'selftest') return await runSelftest(deps, log);
    const config = loadConfig(deps);
    const store =
      deps.store ??
      createCredentialStore({ platform: deps.host.platform, env: deps.env });
    if (args.command === 'status')
      return await runStatus(config, store, log, deps.out, args.json);
    const available = await store.available();
    if (!available.ok) {
      deps.out(
        `Güvenli kimlik kasası kullanılamıyor: ${available.reason}\nProgram oturum bilgisini düz dosyada saklamaz; bu yüzden çalışmıyor.`,
      );
      return EXIT.noCredentialStore;
    }
    if (args.command === 'login')
      return await runLogin(deps, config, store, log, {
        force: args.force,
        password: args.password,
      });
    if (args.command === 'logout')
      return await runLogout(config, store, log, deps.out);
    return await start(deps, config, store, log, args.exitWhenIdle);
  } catch (error) {
    if (error instanceof ConfigError) {
      deps.out(`Ayar hatası: ${error.message}`);
      return EXIT.usage;
    }
    if (error instanceof LockError) {
      deps.out(`${error.message} Önce onu durdur.`);
      return EXIT.alreadyRunning;
    }
    if (error instanceof CredentialStoreError) {
      deps.out(error.message);
      return EXIT.noCredentialStore;
    }
    if (error instanceof SessionError) {
      deps.out(error.message);
      return error.message === NOT_LOGGED_IN ? EXIT.notPaired : EXIT.revoked;
    }
    if (error instanceof LoginError || error instanceof AbortedError) {
      deps.out(error.message);
      return EXIT.error;
    }
    // Beklenmeyen hata: yığın izi yerine sırsız tek satır
    deps.out(
      `Beklenmeyen hata: ${redactText(error instanceof Error ? error.message : String(error), { home: deps.host.home })}`,
    );
    return EXIT.error;
  }
}

function realHost(): HostInfo {
  const platform = process.platform;
  if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux')
    throw new ConfigError(`Bu işletim sistemi desteklenmiyor: ${platform}`);
  return {
    platform,
    home: os.homedir(),
    hostname: os.hostname(),
    tmpdir: os.tmpdir(),
    env: process.env,
  };
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) {
  let code: number;
  try {
    code = await main({
      argv: process.argv.slice(2),
      env: process.env,
      host: realHost(),
      repoRoot: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        '..',
      ),
      out: (line) => console.log(line),
      signals: process,
    });
  } catch (error) {
    console.error(
      error instanceof ConfigError ? error.message : 'Program başlatılamadı.',
    );
    code = EXIT.error;
  }
  process.exitCode = code;
  // Süresi dolup bırakılan süreçler ve açık zamanlayıcılar çıkışı bekletmesin
  process.stdout.write('', () => process.exit(code));
}
