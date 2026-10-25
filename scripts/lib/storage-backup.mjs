import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const LIMIT = 100;
const MAX = 100000;
const fail = () => {
  throw new Error('Storage yedeği doğrulanamadı; işlem durduruldu.');
};
function unwrap(result) {
  if (result.error || !Array.isArray(result.data)) fail();
  return result.data;
}
function text(value) {
  if (typeof value !== 'string' || !value || value.length > 4096) fail();
  return value;
}

async function inventory(storage) {
  const buckets = [];
  const ids = new Set();
  for (let offset = 0; ; offset += LIMIT) {
    if (offset >= MAX) fail();
    const page = unwrap(
      await storage.listBuckets({
        limit: LIMIT,
        offset,
        sortColumn: 'id',
        sortOrder: 'asc',
      }),
    );
    for (const bucket of page) {
      text(bucket.id);
      if (ids.has(bucket.id)) fail();
      ids.add(bucket.id);
      buckets.push({
        id: bucket.id,
        public: bucket.public === true,
        fileSizeLimit: bucket.file_size_limit ?? null,
        allowedMimeTypes: bucket.allowed_mime_types ?? null,
      });
    }
    if (page.length < LIMIT) break;
  }
  const objects = [];
  for (const bucket of buckets) {
    const folders = [''];
    const seen = new Set();
    for (let cursor = 0; cursor < folders.length; cursor++) {
      if (cursor >= MAX) fail();
      const prefix = folders[cursor];
      for (let offset = 0; ; offset += LIMIT) {
        if (offset >= MAX) fail();
        const page = unwrap(
          await storage.from(bucket.id).list(prefix, {
            limit: LIMIT,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          }),
        );
        for (const row of page) {
          const name = text(row.name);
          // API folder listing returns one path segment, never an absolute path.
          if (name === '.' || name === '..' || /[/\\\x00]/.test(name)) fail();
          const key = prefix ? `${prefix}/${name}` : name;
          if (seen.has(key) || seen.size >= MAX || key.length > 4096) fail();
          seen.add(key);
          if (row.id === null) {
            folders.push(key);
            continue;
          }
          text(row.id);
          const size = row.metadata?.size;
          if (!Number.isSafeInteger(size) || size < 0) fail();
          objects.push({
            bucket: bucket.id,
            key,
            id: row.id,
            updatedAt: row.updated_at ?? null,
            size,
          });
          if (objects.length > MAX) fail();
        }
        if (page.length < LIMIT) break;
      }
    }
  }
  objects.sort((a, b) =>
    JSON.stringify([a.bucket, a.key]).localeCompare(
      JSON.stringify([b.bucket, b.key]),
      'en',
    ),
  );
  return { buckets, objects };
}

/** New directory only. Provider keys stay in the manifest, never in local paths. */
export async function exportStorage(storage, dir) {
  await mkdir(dir, { mode: 0o700 });
  await mkdir(join(dir, 'objects'), { mode: 0o700 });
  const before = await inventory(storage);
  const objects = [];
  for (const [index, object] of before.objects.entries()) {
    const file = `objects/${String(index).padStart(8, '0')}.bin`;
    const { data, error } = await storage
      .from(object.bucket)
      .download(
        object.key,
        {},
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(300000),
        },
      )
      .asStream();
    if (error || !data) fail();
    const hash = createHash('sha256');
    let size = 0;
    await pipeline(
      data,
      async function* (source) {
        for await (const chunk of source) {
          size += chunk.length;
          if (size > object.size) fail();
          hash.update(chunk);
          yield chunk;
        }
      },
      createWriteStream(join(dir, file), { flags: 'wx', mode: 0o600 }),
    );
    if (size !== object.size) fail();
    objects.push({ ...object, file, sha256: hash.digest('hex') });
  }
  // Listings are not a transaction: refuse observable changes during export.
  if (JSON.stringify(before) !== JSON.stringify(await inventory(storage)))
    fail();
  await writeFile(
    join(dir, 'storage-manifest.json'),
    JSON.stringify(
      {
        version: 1,
        buckets: before.buckets,
        objects,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  return verifyStorageBackup(dir);
}

export async function verifyStorageBackup(dir) {
  const manifestPath = join(dir, 'storage-manifest.json');
  const info = await lstat(manifestPath);
  if (!info.isFile() || info.size > 32 * 1024 * 1024) fail();
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (
    manifest?.version !== 1 ||
    !Array.isArray(manifest.buckets) ||
    !Array.isArray(manifest.objects) ||
    manifest.objects.length > MAX
  )
    fail();
  const buckets = new Set(manifest.buckets.map((b) => text(b.id)));
  if (buckets.size !== manifest.buckets.length) fail();
  const seen = new Set();
  for (const object of manifest.objects) {
    if (
      !buckets.has(object.bucket) ||
      !/^objects\/[0-9]{8}\.bin$/.test(object.file) ||
      !Number.isSafeInteger(object.size) ||
      object.size < 0 ||
      !/^[a-f0-9]{64}$/.test(object.sha256)
    )
      fail();
    text(object.key);
    const key = JSON.stringify([object.bucket, object.key]);
    if (seen.has(key) || seen.has(object.file)) fail();
    seen.add(key);
    seen.add(object.file);
    const path = join(dir, object.file);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size !== object.size) fail();
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    if (hash.digest('hex') !== object.sha256) fail();
  }
  return { buckets: buckets.size, files: manifest.objects.length };
}
