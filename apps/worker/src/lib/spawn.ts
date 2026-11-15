// İş aşamalarının çalıştırdığı alt süreçler için güvenli çalıştırıcı.
//   * Kabuk yok: dosya + argüman dizisi doğrudan işletim sistemine verilir.
//   * Dosya tam yol olmalı; Windows'ta .cmd/.bat çalıştırılmaz (cmd.exe argümanları yeniden
//     ayrıştırır, kaçışı güvenilir değildir).
//   * stdin kapalı; süre sınırı zorunlu; çıktı sınırlı.
//   * Ortam değişkenleri izin listesinden geçer: Supabase oturumu ve sağlayıcı anahtarları alt
//     sürece verilmez.
//   * İptal ve süre aşımında bütün süreç ağacı öldürülür (POSIX: süreç grubu, Windows: taskkill /T).
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { AbortedError, PermanentError } from './errors.ts';

export interface RunOptions {
  /** Çalışma klasörü (tam yol). */
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** İzin listesine ek olarak verilecek değişkenler (sır koyma). */
  env?: Record<string, string>;
  maxOutputBytes?: number;
  /** Nazik durdurmadan sonra zorla öldürmeye kadar beklenen süre. */
  killGraceMs?: number;
}

export interface RunOutcome {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  /** Çıktı sınırı aşıldı ve kırpıldı. */
  truncated: boolean;
}

/** Alt sürece geçirilen ortam değişkenleri (büyük/küçük harf duyarsız karşılaştırılır). */
export const ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'TMPDIR',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'USERNAME',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'COMMONPROGRAMFILES',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
  'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE',
  'XDG_RUNTIME_DIR',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'DISPLAY',
] as const;

export function childEnv(
  source: Record<string, string | undefined>,
  extra: Record<string, string> = {},
): Record<string, string> {
  const allowed = new Set<string>(ENV_ALLOWLIST);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && allowed.has(key.toUpperCase()))
      out[key] = value;
  }
  return { ...out, ...extra };
}

/** Komutu doğrular; uygunsuzsa `PermanentError` fırlatır (yeniden denemek sonucu değiştirmez). */
export function validateCommand(
  file: string,
  args: readonly string[],
  cwd: string,
  platform: NodeJS.Platform = process.platform,
): void {
  const p = platform === 'win32' ? path.win32 : path.posix;
  if (typeof file !== 'string' || file.length === 0 || file.includes('\0'))
    throw new PermanentError('Çalıştırılacak dosya geçersiz.');
  if (!p.isAbsolute(file))
    throw new PermanentError('Çalıştırılacak dosya tam yol olmalı.');
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(file))
    throw new PermanentError(
      'Windows toplu iş dosyaları (.cmd/.bat) çalıştırılmaz; asıl programı çağırın.',
    );
  if (typeof cwd !== 'string' || !p.isAbsolute(cwd) || cwd.includes('\0'))
    throw new PermanentError('Çalışma klasörü tam yol olmalı.');
  if (!Array.isArray(args) || args.length > 4096)
    throw new PermanentError('Argüman listesi geçersiz.');
  for (const arg of args) {
    if (typeof arg !== 'string' || arg.includes('\0'))
      throw new PermanentError('Argümanlar NUL içermeyen metin olmalı.');
    if (arg.length > 32_768) throw new PermanentError('Argüman çok uzun.');
  }
}

/**
 * Veriden gelen bir değeri seçenek sanılmayacak biçimde argümana çevirir: `-` ile başlayan
 * dosya adı `./-ad` olur. Seçenek/değer ayrımını `--` ile yapan araçlarda ayrıca `--` kullan.
 */
export function positionalArg(value: string): string {
  if (value.includes('\0')) throw new PermanentError('Argüman NUL içeremez.');
  return value.startsWith('-') ? `./${value}` : value;
}

export function taskkillPath(env: Record<string, string | undefined>): string {
  const root = env.SystemRoot || env.SYSTEMROOT || env.windir || 'C:\\Windows';
  return path.win32.join(root, 'System32', 'taskkill.exe');
}

/** Süreç ağacını öldüren komut (Windows) ya da sinyal hedefi (POSIX: negatif pid = süreç grubu). */
export function killPlan(
  pid: number,
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
  force: boolean,
):
  | { kind: 'signal'; target: number; signal: NodeJS.Signals }
  | { kind: 'command'; file: string; args: string[] } {
  if (platform === 'win32')
    return {
      kind: 'command',
      file: taskkillPath(env),
      // /F olmadan konsolsuz süreçler kapanmaz; iki aşamada da zorla
      args: ['/PID', String(pid), '/T', '/F'],
    };
  return {
    kind: 'signal',
    target: -pid,
    signal: force ? 'SIGKILL' : 'SIGTERM',
  };
}

export function killTree(child: ChildProcess, force: boolean): void {
  const pid = child.pid;
  if (!pid || child.exitCode !== null) return;
  const plan = killPlan(pid, process.platform, process.env, force);
  try {
    if (plan.kind === 'signal') process.kill(plan.target, plan.signal);
    else
      spawn(plan.file, plan.args, {
        stdio: 'ignore',
        windowsHide: true,
        shell: false,
      }).on('error', () => child.kill('SIGKILL'));
  } catch {
    // Grup yoksa (süreç çoktan bitti) ya da yetki yoksa tek süreci dene
    try {
      child.kill(force ? 'SIGKILL' : 'SIGTERM');
    } catch {
      // süreç zaten bitmiş
    }
  }
}

export function runProcess(
  file: string,
  args: readonly string[],
  options: RunOptions,
): Promise<RunOutcome> {
  validateCommand(file, args, options.cwd);
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
    throw new PermanentError('Alt süreç için süre sınırı zorunlu.');
  if (options.signal?.aborted)
    return Promise.reject(new AbortedError('İş durduruldu.'));
  const maxOutput = options.maxOutputBytes ?? 1_000_000;
  const grace = options.killGraceMs ?? 3000;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;
    let aborted = false;
    let settled = false;
    let forceTimer: NodeJS.Timeout | undefined;

    let child: ChildProcess;
    try {
      child = spawn(file, [...args], {
        cwd: options.cwd,
        env: childEnv(process.env, options.env),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        // POSIX: kendi süreç grubu, böylece torunlarıyla birlikte öldürülebilir
        detached: process.platform !== 'win32',
      });
    } catch (error) {
      reject(
        new PermanentError(
          `Alt süreç başlatılamadı: ${error instanceof Error ? error.message : 'bilinmeyen hata'}`,
        ),
      );
      return;
    }

    const stop = () => {
      killTree(child, false);
      forceTimer = setTimeout(() => killTree(child, true), grace);
      forceTimer.unref();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, options.timeoutMs);
    const onAbort = () => {
      aborted = true;
      stop();
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      options.signal?.removeEventListener('abort', onAbort);
      // Ana süreç bitse de grupta kalan torunlar olabilir
      if (timedOut || aborted) killTree(child, true);
      resolve({ code, stdout, stderr, timedOut, aborted, truncated });
    };
    const collect = (target: 'out' | 'err') => (chunk: Buffer) => {
      const size = stdout.length + stderr.length;
      if (size >= maxOutput) {
        truncated = true;
        return;
      }
      const text = chunk.toString('utf8').slice(0, maxOutput - size);
      if (target === 'out') stdout += text;
      else stderr += text;
    };
    child.stdout?.on('data', collect('out'));
    child.stderr?.on('data', collect('err'));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      options.signal?.removeEventListener('abort', onAbort);
      reject(new PermanentError(`Alt süreç başlatılamadı: ${error.message}`));
    });
    child.on('close', (code) => finish(code));
  });
}
