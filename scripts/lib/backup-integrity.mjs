import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { backupPlan } from './panel-lib.mjs';

const MANIFEST = 'manifest.json';
const FILES = backupPlan().map((part) => part.file);

async function fingerprint(dir, file) {
  const path = join(dir, file);
  const info = await lstat(path);
  if (!info.isFile() || info.size === 0)
    throw new Error('Yedek dosyası boş veya normal dosya değil.');
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { file, size, sha256: hash.digest('hex') };
}

/** Yalnız tüm dump'lar tamamlandıktan sonra yazılır; sır/bağlantı adresi içermez. */
export async function writeBackupManifest(dir) {
  const files = [];
  for (const file of FILES) files.push(await fingerprint(dir, file));
  await writeFile(
    join(dir, MANIFEST),
    JSON.stringify({ version: 1, files }, null, 2) + '\n',
    {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    },
  );
}

/** Bozuk/eksik/eski yedek yerel veri silinmeden önce reddedilir. */
export async function verifyBackupManifest(dir) {
  let manifest;
  try {
    const info = await lstat(join(dir, MANIFEST));
    if (!info.isFile() || info.size > 16384) throw new Error();
    manifest = JSON.parse(await readFile(join(dir, MANIFEST), 'utf8'));
  } catch {
    throw new Error(
      'Yedek manifesti yok veya geçersiz. Güncel pnpm backup ile yeni yedek alın.',
    );
  }
  if (
    manifest?.version !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== FILES.length
  )
    throw new Error('Yedek manifesti desteklenmiyor.');
  const seen = new Set();
  for (const entry of manifest.files) {
    if (
      !entry ||
      !FILES.includes(entry.file) ||
      seen.has(entry.file) ||
      !Number.isSafeInteger(entry.size) ||
      entry.size <= 0 ||
      typeof entry.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw new Error('Yedek manifestindeki dosya listesi geçersiz.');
    seen.add(entry.file);
    const actual = await fingerprint(dir, entry.file);
    if (actual.size !== entry.size || actual.sha256 !== entry.sha256)
      throw new Error(
        'Yedek bütünlük kontrolü başarısız. Geri yükleme yapılmadı.',
      );
  }
  return { files: FILES.length };
}
