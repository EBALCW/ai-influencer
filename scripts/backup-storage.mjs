#!/usr/bin/env node
// Read-only remote Storage export; never uploads or deletes objects.
import { existsSync } from 'node:fs';
import { mkdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupDirName, isInside, isLocalHost } from './lib/panel-lib.mjs';
import { exportStorage, verifyStorageBackup } from './lib/storage-backup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.umask(0o077);
try {
  const args = process.argv.slice(2);
  if (args[0] === 'verify') {
    if (args.length !== 2) throw new Error();
    const result = await verifyStorageBackup(resolve(args[1]));
    console.log(
      `Storage yedeği doğrulandı: ${result.buckets} bucket, ${result.files} dosya.`,
    );
  } else {
    if (args.length && (args.length !== 2 || args[0] !== '--out'))
      throw new Error();
    const env = join(root, '.env.local');
    if (existsSync(env)) process.loadEnvFile(env);
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (
      !key ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && isLocalHost(url.hostname)))
    )
      throw new Error();
    const base = args[1]
      ? resolve(args[1])
      : join(homedir(), 'ai-influencer-backups');
    if (isInside(base, root, sep)) throw new Error();
    await mkdir(base, { recursive: true, mode: 0o700 });
    if (isInside(await realpath(base), await realpath(root), sep))
      throw new Error();
    const require = createRequire(join(root, 'apps/panel/package.json'));
    const { createClient } = require('@supabase/supabase-js');
    const client = createClient(url.origin, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            redirect: 'error',
            signal: init?.signal ?? AbortSignal.timeout(30000),
          }),
      },
    });
    const dir = join(base, `${backupDirName(new Date())}-storage`);
    const result = await exportStorage(client.storage, dir);
    console.log(
      `Storage yedeği tamam: ${result.buckets} bucket, ${result.files} dosya.\n${dir}`,
    );
  }
} catch {
  console.error(
    'Storage işlemi başarısız. Komut: pnpm backup:storage [--out <repo-dışı-klasör>] veya pnpm backup:storage:verify <yedek>. Yapılandırmayı, erişimi ve dosya bütünlüğünü kontrol edin. Eksik yedek tamamlanmış sayılmaz.',
  );
  process.exitCode = 1;
}
