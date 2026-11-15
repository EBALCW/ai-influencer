// Sunucunun yapılandırması: yalnız Supabase adresi ve HERKESE AÇIK (anon / publishable) anahtar.
// İkisi de sır değildir (panelin tarayıcı paketinde de bulunur). Kullanıcının kimliği burada
// DEĞİL, işletim sistemi kasasındaki oturumdadır (auth/credential-store.ts).
//
// Service role anahtarı bu süreçte hiçbir zaman kullanılmaz: `.env.local` okunurken o satır
// belleğe alınmaz, ortamdan ya da dosyadan gelen anahtar service role ise süreç başlamaz.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PanelConfig = {
  readonly supabaseUrl: string;
  readonly anonKey: string;
};

export class ConfigError extends Error {}

const URL_KEYS = ['AI_INFLUENCER_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const ANON_KEYS = [
  'AI_INFLUENCER_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

/** `.env` biçimli metinden YALNIZ istenen anahtarları okur; diğer satırlar belleğe alınmaz. */
export function pickEnvValues(
  content: string,
  keys: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    if (!keys.includes(key)) continue;
    let value = match[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    // Aynı anahtar yinelenirse dolu olan son değer geçerlidir (boş satır dolu değeri ezmez).
    if (value) out[key] = value;
  }
  return out;
}

function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf8'),
    ) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

/** Anahtar herkese açık (anon / publishable) türde mi? Değilse neden reddedildiğini söyler. */
export function assertPublicKey(key: string): void {
  if (/^sb_secret_/i.test(key)) {
    throw new ConfigError(
      'Verilen anahtar gizli (secret) bir anahtar. MCP sunucusu yalnız herkese açık anon anahtarıyla çalışır.',
    );
  }
  const role = jwtRole(key);
  if (role !== null && role !== 'anon') {
    throw new ConfigError(
      'Verilen anahtar anon anahtarı değil (service role olabilir). MCP sunucusu yalnız anon anahtarıyla çalışır.',
    );
  }
  if (role === null && !/^sb_publishable_/i.test(key)) {
    throw new ConfigError('Anon anahtarı tanınmayan bir biçimde.');
  }
}

export function assertSupabaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError('Supabase adresi geçerli bir URL değil.');
  }
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new ConfigError(
      'Supabase adresi https olmalı (yerel adres dışında).',
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ConfigError('Supabase adresi yalnız kök adres olmalı.');
  }
  return url;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  envFile: string = join(repoRoot(), '.env.local'),
): PanelConfig {
  let fromFile: Record<string, string> = {};
  try {
    fromFile = pickEnvValues(readFileSync(envFile, 'utf8'), [
      ...URL_KEYS,
      ...ANON_KEYS,
    ]);
  } catch {
    // .env.local yoksa yalnız ortam değişkenlerine bakılır.
  }
  const first = (keys: readonly string[]) => {
    for (const key of keys) {
      const value = env[key]?.trim() || fromFile[key];
      if (value) return value;
    }
    return '';
  };
  const supabaseUrl = first(URL_KEYS);
  const anonKey = first(ANON_KEYS);
  if (!supabaseUrl || !anonKey) {
    throw new ConfigError(
      'Supabase adresi ya da anon anahtarı bulunamadı. Repo kökünde `pnpm env:pull` çalıştırın ' +
        '(NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY `.env.local` içinde olmalı).',
    );
  }
  const url = assertSupabaseUrl(supabaseUrl);
  assertPublicKey(anonKey);
  return { supabaseUrl: url.origin, anonKey };
}
