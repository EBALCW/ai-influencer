// Program ayarları: repo kökündeki `.env.local` ve ortam değişkenleri (ortam önceliklidir).
// Yalnız izin verilen anahtarlar okunur: aynı dosyada duran service role anahtarı ve diğer
// sırlar programın belleğine hiç girmez.
import path from 'node:path';

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** `.env.local`'den okunmasına izin verilen anahtarlar. */
export const ALLOWED_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'WORKER_NAME',
  'WORKER_POLL_SECONDS',
  'WORKER_STATE_DIR',
  'WORKER_WORK_DIR',
] as const;
type EnvKey = (typeof ALLOWED_ENV_KEYS)[number];
export type EnvValues = Partial<Record<EnvKey, string>>;

/** `.env` biçimi: `ANAHTAR=değer`, `#` yorum, isteğe bağlı tek ya da çift tırnak. */
export function parseEnvFile(text: string): EnvValues {
  const out: EnvValues = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      line,
    );
    if (!match) continue;
    const key = match[1] as EnvKey;
    if (!(ALLOWED_ENV_KEYS as readonly string[]).includes(key)) continue;
    let value = (match[2] ?? '').trim();
    const quote = value[0];
    if (
      (quote === '"' || quote === "'") &&
      value.endsWith(quote) &&
      value.length >= 2
    )
      value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    // Sonraki boş satır önceki dolu değeri ezmesin
    if (value !== '' || out[key] === undefined) out[key] = value;
  }
  return out;
}

export function pickEnv(env: Record<string, string | undefined>): EnvValues {
  const out: EnvValues = {};
  for (const key of ALLOWED_ENV_KEYS) {
    const value = env[key];
    if (typeof value === 'string' && value.trim() !== '')
      out[key] = value.trim();
  }
  return out;
}

export interface WorkerConfig {
  /** Sonunda `/` olmayan Supabase adresi. */
  supabaseUrl: string;
  /** Herkese açık (anon / publishable) anahtar. */
  anonKey: string;
  /** Kimlik kasasındaki hesap adı: Supabase sunucusunun adı. */
  account: string;
  name: string;
  pollMs: number;
  heartbeatMs: number;
  leaseSeconds: number;
  stateDir: string;
  workDir: string;
}

export interface HostInfo {
  platform: 'darwin' | 'win32' | 'linux';
  home: string;
  hostname: string;
  tmpdir: string;
  env: Record<string, string | undefined>;
}

function jwtRole(key: string): string | null {
  const payload = key.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    const role =
      claims && typeof claims === 'object'
        ? (claims as Record<string, unknown>).role
        : null;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

/** Makine adı: denetim karakterleri atılır, 80 karaktere kısaltılır. */
export function machineName(input: string): string {
  const clean = input
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
  return clean || 'uretim-makinesi';
}

export function defaultStateDir(host: HostInfo): string {
  const p = host.platform === 'win32' ? path.win32 : path.posix;
  if (host.platform === 'darwin')
    return p.join(
      host.home,
      'Library',
      'Application Support',
      'ai-influencer-worker',
    );
  if (host.platform === 'win32')
    return p.join(
      host.env.LOCALAPPDATA || p.join(host.home, 'AppData', 'Local'),
      'ai-influencer-worker',
    );
  return p.join(
    host.env.XDG_STATE_HOME || p.join(host.home, '.local', 'state'),
    'ai-influencer-worker',
  );
}

export function resolveConfig(
  fileEnv: EnvValues,
  processEnv: EnvValues,
  host: HostInfo,
): WorkerConfig {
  const env: EnvValues = { ...fileEnv, ...processEnv };
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!rawUrl || !anonKey)
    throw new ConfigError(
      'NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. Repo kökündeki .env.local dosyasını doldur (pnpm env:pull).',
    );
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ConfigError('NEXT_PUBLIC_SUPABASE_URL geçerli bir adres değil.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new ConfigError(
      'NEXT_PUBLIC_SUPABASE_URL https olmalı (http yalnız localhost için kabul edilir).',
    );
  if (url.username || url.password || url.search || url.hash)
    throw new ConfigError(
      'NEXT_PUBLIC_SUPABASE_URL yalnız sunucu adresi olmalı (kullanıcı adı, sorgu ya da # içeremez).',
    );
  // Service role anahtarı RLS'i aşar; kullanıcı makinesinde kullanılmaz (ADR 0004 → Karar 3).
  if (/^sb_secret_/.test(anonKey) || jwtRole(anonKey) === 'service_role')
    throw new ConfigError(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY alanında service role anahtarı var. Üretim makinesi yalnız herkese açık (anon) anahtarla çalışır.',
    );
  if (!/^[A-Za-z0-9._-]{20,4096}$/.test(anonKey))
    throw new ConfigError('NEXT_PUBLIC_SUPABASE_ANON_KEY biçimi geçersiz.');

  let pollSeconds = 5;
  if (env.WORKER_POLL_SECONDS !== undefined) {
    pollSeconds = Number(env.WORKER_POLL_SECONDS);
    if (!Number.isFinite(pollSeconds) || pollSeconds < 1 || pollSeconds > 300)
      throw new ConfigError('WORKER_POLL_SECONDS 1 ile 300 arasında olmalı.');
  }
  const p = host.platform === 'win32' ? path.win32 : path.posix;
  const dir = (value: string | undefined, fallback: string, key: string) => {
    if (value === undefined) return fallback;
    if (!p.isAbsolute(value)) throw new ConfigError(`${key} tam yol olmalı.`);
    return p.normalize(value);
  };
  return {
    supabaseUrl: `${url.origin}${url.pathname.replace(/\/+$/, '')}`,
    anonKey,
    account: url.host.toLowerCase(),
    name: machineName(env.WORKER_NAME ?? host.hostname),
    pollMs: Math.round(pollSeconds * 1000),
    heartbeatMs: 30_000,
    leaseSeconds: 120,
    stateDir: dir(
      env.WORKER_STATE_DIR,
      defaultStateDir(host),
      'WORKER_STATE_DIR',
    ),
    workDir: dir(
      env.WORKER_WORK_DIR,
      p.join(host.tmpdir, 'ai-influencer-worker'),
      'WORKER_WORK_DIR',
    ),
  };
}
