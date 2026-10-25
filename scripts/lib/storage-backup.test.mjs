import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { exportStorage, verifyStorageBackup } from './storage-backup.mjs';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'storage-backup-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  return join(base, 'export');
}
const ok = (data) => ({ data, error: null });
function source({
  paths = ['folder/a.png'],
  failDownload = false,
  change = false,
  badName,
} = {}) {
  let scans = 0;
  const calls = [];
  return {
    calls,
    async listBuckets() {
      scans++;
      return ok([{ id: 'assets', public: false }]);
    },
    from(bucket) {
      assert.equal(bucket, 'assets');
      return {
        async list(prefix, { offset, limit, sortBy }) {
          calls.push({ prefix, offset });
          assert.deepEqual(sortBy, { column: 'name', order: 'asc' });
          if (badName)
            return ok([{ id: 'x', name: badName, metadata: { size: 1 } }]);
          const names = new Map();
          for (const path of paths) {
            if (prefix && !path.startsWith(prefix + '/')) continue;
            const rest = prefix ? path.slice(prefix.length + 1) : path;
            const [name, ...tail] = rest.split('/');
            names.set(
              name,
              tail.length
                ? { name, id: null }
                : {
                    name,
                    id: path,
                    updated_at: change && scans > 1 ? 'new' : 'old',
                    metadata: { size: 3 },
                  },
            );
          }
          return ok(
            [...names.values()]
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice(offset, offset + limit),
          );
        },
        download(key, options, parameters) {
          assert(paths.includes(key));
          assert(parameters.signal instanceof AbortSignal);
          return {
            asStream: async () =>
              failDownload
                ? { error: { message: 'secret' } }
                : ok(
                    new ReadableStream({
                      start(c) {
                        c.enqueue(new Uint8Array([1, 2]));
                        c.enqueue(new Uint8Array([3]));
                        c.close();
                      },
                    }),
                  ),
          };
        },
      };
    },
  };
}

test('iç içe klasör, 100+ dosya, güvenli yerel adlar ve çevrimdışı verify', async (t) => {
  const dir = await fixture(t);
  const paths = Array.from(
    { length: 101 },
    (_, i) => `folder/child/file-${i}.png`,
  );
  paths.push('CON:image?.png'); // Provider names never become Windows filenames.
  const storage = source({ paths });
  assert.deepEqual(await exportStorage(storage, dir), {
    buckets: 1,
    files: 102,
  });
  assert(
    storage.calls.some((c) => c.prefix === 'folder/child' && c.offset === 100),
  );
  const manifest = JSON.parse(
    await readFile(join(dir, 'storage-manifest.json')),
  );
  assert(
    manifest.objects.every((o) => /^objects\/[0-9]{8}\.bin$/.test(o.file)),
  );
  assert.equal(
    manifest.objects.find((o) => o.key === 'CON:image?.png').size,
    3,
  );
  const cli = fileURLToPath(new URL('../backup-storage.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'verify', dir], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('indirme hatası ve eşzamanlı değişiklik tamamlandı manifesti üretmez', async (t) => {
  for (const config of [{ failDownload: true }, { change: true }]) {
    const dir = await fixture(t);
    await assert.rejects(exportStorage(source(config), dir));
    await assert.rejects(access(join(dir, 'storage-manifest.json')));
  }
});

test('traversal ve tekrarlayan sayfa reddedilir; mevcut yedek ezilmez', async (t) => {
  for (const badName of ['..', '../escape', 'a\\b', '/absolute']) {
    const dir = await fixture(t);
    await assert.rejects(exportStorage(source({ badName }), dir));
  }
  const dir = await fixture(t);
  const storage = source();
  storage.from = () => ({
    list: async () =>
      ok(Array.from({ length: 100 }, () => ({ name: 'duplicate', id: null }))),
  });
  await assert.rejects(exportStorage(storage, dir));
  await assert.rejects(exportStorage(source(), dir));
});

test('aynı boyutlu bozulma ve sahte manifest dosya yolu reddedilir', async (t) => {
  const dir = await fixture(t);
  await exportStorage(source(), dir);
  const path = join(dir, 'storage-manifest.json');
  const manifest = JSON.parse(await readFile(path));
  await writeFile(
    join(dir, manifest.objects[0].file),
    new Uint8Array([3, 2, 1]),
  );
  await assert.rejects(verifyStorageBackup(dir));
  manifest.objects[0].file = '../escape';
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(verifyStorageBackup(dir));
});

test('boş bucket ve sıfır bayt dosya doğrulanır', async (t) => {
  const empty = await fixture(t);
  assert.deepEqual(await exportStorage(source({ paths: [] }), empty), {
    buckets: 1,
    files: 0,
  });
  const dir = await fixture(t);
  const storage = source();
  storage.from = () => ({
    list: async () => ok([{ name: 'empty', id: 'e', metadata: { size: 0 } }]),
    download: () => ({
      asStream: async () =>
        ok(
          new ReadableStream({
            start(c) {
              c.close();
            },
          }),
        ),
    }),
  });
  assert.deepEqual(await exportStorage(storage, dir), { buckets: 1, files: 1 });
});

test('eksik ve fazla indirme baytı tamamlanmış yedek olmaz', async (t) => {
  for (const length of [2, 4]) {
    const dir = await fixture(t);
    const storage = source({ paths: ['file'] });
    const from = storage.from.bind(storage);
    storage.from = (bucket) => ({
      ...from(bucket),
      download: () => ({
        asStream: async () =>
          ok(
            new ReadableStream({
              start(c) {
                c.enqueue(new Uint8Array(length));
                c.close();
              },
            }),
          ),
      }),
    });
    await assert.rejects(exportStorage(storage, dir));
    await assert.rejects(access(join(dir, 'storage-manifest.json')));
  }
});

test('sabit SDK ile gerçek list/download.asStream sözleşmesi (ağsız)', async (t) => {
  const dir = await fixture(t);
  const require = createRequire(
    new URL('../../apps/panel/package.json', import.meta.url),
  );
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        assert.equal(
          new Headers(init.headers).get('authorization'),
          'Bearer fixture-key',
        );
        if (url.pathname === '/storage/v1/bucket') {
          assert.equal(url.searchParams.get('sortColumn'), 'id');
          return Response.json([{ id: 'assets', public: false }]);
        }
        if (url.pathname === '/storage/v1/object/list/assets') {
          assert.equal(init.method, 'POST');
          return Response.json([
            { name: 'a.png', id: 'a', metadata: { size: 3 } },
          ]);
        }
        assert.equal(url.pathname, '/storage/v1/object/assets/a.png');
        assert.equal(init.method, 'GET');
        return new Response(new Uint8Array([1, 2, 3]));
      },
    },
  });
  assert.deepEqual(await exportStorage(client.storage, dir), {
    buckets: 1,
    files: 1,
  });
});
