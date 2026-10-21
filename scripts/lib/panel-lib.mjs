// scripts/panel.mjs ve scripts/backup.mjs için saf (yan etkisiz) yardımcılar.
// Testler: scripts/lib/*.test.mjs (node --test)

/** Komut satırı bayraklarını ayrıştırır. Bilinmeyen bayrakta hata fırlatır. */
export function parsePanelArgs(argv) {
  const opts = { update: false, open: true, check: false, port: 3000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--update') opts.update = true;
    else if (arg === '--no-open') opts.open = false;
    else if (arg === '--check') {
      opts.check = true;
      opts.open = false;
    } else if (arg === '--port') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new Error('--port 1-65535 arasında bir sayı olmalı');
      }
      opts.port = value;
    } else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Bilinmeyen seçenek: ${arg}`);
  }
  return opts;
}

/** İşletim sistemine göre tarayıcıyı açan komut. */
export function openCommand(platform, url) {
  if (platform === 'darwin') return { cmd: 'open', args: [url] };
  // `start` cmd'nin iç komutu; ilk boş argüman pencere başlığıdır
  if (platform === 'win32')
    return { cmd: 'cmd', args: ['/c', 'start', '', url] };
  return { cmd: 'xdg-open', args: [url] };
}

/**
 * Build gerekiyor mu? Son build'in commit'i farklıysa veya panel/shared kodunda
 * commit'lenmemiş değişiklik varsa yeniden build edilir.
 */
export function needsBuild({ marker, head, dirtyPaths }) {
  if (!marker || typeof marker.commit !== 'string') return true;
  if (marker.commit !== head) return true;
  return dirtyPaths.length > 0 || marker.dirty === true;
}

/** KEY=VALUE satırlarını okur. Yorum ve boş satırları atlar, tırnakları temizler. */
export function parseEnvFile(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    env[m[1]] = value;
  }
  return env;
}

/** Panelin çalışması için eksik olan Supabase değişkenleri. */
export function missingPanelEnv(env) {
  return ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].filter(
    (key) => !env[key],
  );
}

/**
 * Postgres bağlantı adresini pg_dump/psql için parçalar.
 * Şifre argümanlara GİRMEZ, sadece env (PGPASSWORD) olarak döner. Process
 * listesinde görünmesin diye.
 */
export function pgConnection(dbUrl) {
  let url;
  try {
    url = new URL(dbUrl);
  } catch {
    throw new Error('SUPABASE_DB_URL geçerli bir postgresql:// adresi değil');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('SUPABASE_DB_URL postgresql:// ile başlamalı');
  }
  const database =
    decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres';
  const args = [
    '--host',
    url.hostname,
    '--port',
    url.port || '5432',
    '--username',
    decodeURIComponent(url.username || 'postgres'),
    '--dbname',
    database,
  ];
  const env = { PGPASSWORD: decodeURIComponent(url.password) };
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode) env.PGSSLMODE = sslmode;
  else if (!isLocalHost(url.hostname)) env.PGSSLMODE = 'require';
  return { host: url.hostname, args, env };
}

export function isLocalHost(host) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host);
}

/** Yedek klasörü adı: UTC zaman damgası, dosya sistemlerinde güvenli. */
export function backupDirName(date) {
  return date
    .toISOString()
    .replace(/[:]/g, '-')
    .replace(/\.\d{3}Z$/, 'Z');
}

/** Bir yedeği oluşturan pg_dump çağrıları (bağlantı argümanları hariç). */
export function backupPlan() {
  return [
    {
      file: 'schema.sql',
      args: [
        '--schema-only',
        '--schema',
        'public',
        '--no-owner',
        '--no-privileges',
      ],
    },
    {
      file: 'data-public.sql',
      args: [
        '--data-only',
        '--schema',
        'public',
        '--no-owner',
        '--no-privileges',
      ],
    },
    {
      // team_members auth.users'a bağlı; geri yüklemede kullanıcılar da gerekir
      file: 'data-auth.sql',
      args: [
        '--data-only',
        '--table',
        'auth.users',
        '--table',
        'auth.identities',
        '--no-owner',
        '--no-privileges',
      ],
    },
  ];
}

/** Yedek klasörü repo içindeyse true (repo public, yedek oraya yazılmaz). */
export function isInside(child, parent, sep = '/') {
  const norm = (p) => (p.endsWith(sep) ? p : p + sep);
  return norm(child).toLowerCase().startsWith(norm(parent).toLowerCase());
}
