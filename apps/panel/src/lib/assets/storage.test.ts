import { describe, expect, it, vi } from 'vitest';
import type { Row } from '@ai-influencer/shared';
import {
  ASSET_PAGE_SIZE,
  assetFileExtension,
  assetStoragePaths,
  deleteAssets,
  fetchAssetPage,
  isAllowedAssetMime,
  mergeAssetItems,
  oldestAsset,
  signAssetItems,
  updateAssets,
  type AssetItem,
} from './storage';

const INF = '11111111-1111-4111-8111-111111111111';

function asset(id: string, overrides: Partial<Row<'assets'>> = {}) {
  return {
    id,
    influencer_id: INF,
    storage_path: `${INF}/${id}.png`,
    thumbnail_path: `${INF}/${id}-thumb.webp`,
    created_at: '2026-10-22T10:00:00.000Z',
    tags: [],
    ...overrides,
  } as unknown as Row<'assets'>;
}

const item = (a: Row<'assets'>): AssetItem => ({
  asset: a,
  url: null,
  thumbnailUrl: null,
});

/** Zincirlenebilir PostgREST sorgu sahtesi; await edilince `result` döner. */
function query(result: unknown) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const name of [
    'select',
    'eq',
    'in',
    'order',
    'limit',
    'or',
    'delete',
    'update',
  ]) {
    builder[name] = (...args: unknown[]) => {
      calls.push([name, args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return { builder, calls };
}

function client({
  table,
  storage = {},
}: {
  table?: ReturnType<typeof query>;
  storage?: Record<string, (...args: never[]) => Promise<unknown>>;
}) {
  const order: string[] = [];
  const bucket = {
    createSignedUrls: storage.createSignedUrls ?? vi.fn(),
    remove: vi.fn(async (...args: unknown[]) => {
      order.push('storage.remove');
      const remove =
        storage.remove ?? (async () => ({ error: null }) as unknown);
      return (remove as (...a: unknown[]) => Promise<unknown>)(...args);
    }),
  };
  return {
    order,
    bucket,
    supabase: {
      from: vi.fn(() => {
        order.push('table');
        return table?.builder;
      }),
      storage: { from: vi.fn(() => bucket) },
    } as never,
  };
}

describe('dosya yolu ve tür kuralları', () => {
  it('uzantı MIME türünden gelir, dosya adı yolda kullanılmaz', () => {
    expect(assetFileExtension('image/jpeg')).toBe('jpg');
    expect(assetFileExtension('video/webm')).toBe('webm');
    expect(() => assetFileExtension('image/svg+xml')).toThrow();
    expect(assetStoragePaths(INF, 'abc', 'png')).toEqual({
      storagePath: `${INF}/abc.png`,
      thumbnailPath: `${INF}/abc-thumb.webp`,
    });
  });

  it('sadece bucket ile aynı MIME türlerini kabul eder', () => {
    expect(isAllowedAssetMime('image/png')).toBe(true);
    expect(isAllowedAssetMime('image/svg+xml')).toBe(false);
    expect(isAllowedAssetMime('application/pdf')).toBe(false);
  });
});

describe('signAssetItems', () => {
  it('tüm yollar için tek istek atar ve URL’leri eşler', async () => {
    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `signed:${path}` })),
      error: null,
    }));
    const { supabase } = client({ storage: { createSignedUrls } });
    const items = await signAssetItems(supabase, [
      asset('a'),
      asset('b', { thumbnail_path: null }),
    ]);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0]![0]).toHaveLength(3);
    expect(items[0]).toMatchObject({
      url: `signed:${INF}/a.png`,
      thumbnailUrl: `signed:${INF}/a-thumb.webp`,
    });
    expect(items[1]!.thumbnailUrl).toBeNull();
  });

  it('boş listede istek atmaz, hata olursa yutmaz', async () => {
    const createSignedUrls = vi.fn(async () => ({
      data: null,
      error: { message: 'x' },
    }));
    const { supabase } = client({ storage: { createSignedUrls } });
    await expect(signAssetItems(supabase, [])).resolves.toEqual([]);
    expect(createSignedUrls).not.toHaveBeenCalled();
    await expect(signAssetItems(supabase, [asset('a')])).rejects.toThrow();
  });
});

describe('deleteAssets', () => {
  it('önce kaydı siler, sonra yalnızca silinen kayıtların dosyalarını kaldırır', async () => {
    const remove = vi.fn(async () => ({ error: null }));
    const table = query({ data: [{ id: 'a' }], error: null });
    const { supabase, order } = client({ table, storage: { remove } });
    const result = await deleteAssets(supabase, [asset('a'), asset('b')]);
    expect(order).toEqual(['table', 'storage.remove']);
    expect(remove).toHaveBeenCalledWith([
      `${INF}/a.png`,
      `${INF}/a-thumb.webp`,
    ]);
    // RLS b'yi sessizce silmedi: başarı sayılmaz
    expect(result).toEqual({
      deletedIds: ['a'],
      incomplete: true,
      storageCleanupFailed: false,
    });
  });

  it('kayıt silinemezse dosyalara dokunmaz', async () => {
    const remove = vi.fn(async () => ({ error: null }));
    const table = query({ data: null, error: { message: 'denied' } });
    const { supabase } = client({ table, storage: { remove } });
    const result = await deleteAssets(supabase, [asset('a')]);
    expect(remove).not.toHaveBeenCalled();
    expect(result.incomplete).toBe(true);
    expect(result.deletedIds).toEqual([]);
  });

  it('depo temizliği başarısızsa bunu ayrıca bildirir', async () => {
    const table = query({ data: [{ id: 'a' }], error: null });
    const { supabase } = client({
      table,
      storage: { remove: vi.fn(async () => ({ error: { message: 'x' } })) },
    });
    const result = await deleteAssets(supabase, [asset('a')]);
    expect(result).toEqual({
      deletedIds: ['a'],
      incomplete: false,
      storageCleanupFailed: true,
    });
  });
});

describe('updateAssets', () => {
  it('RLS yüzünden değişmeyen satırları eksik sayar', async () => {
    const table = query({ data: [{ id: 'a' }], error: null });
    const { supabase } = client({ table });
    await expect(
      updateAssets(supabase, ['a', 'b'], { tags: ['x'] }),
    ).resolves.toEqual({ updatedIds: ['a'], complete: false });
    expect(table.calls.map(([name]) => name)).toEqual([
      'update',
      'in',
      'select',
    ]);
  });

  it('hata durumunda hiçbir şeyi güncellenmiş saymaz', async () => {
    const table = query({ data: null, error: { message: 'x' } });
    const { supabase } = client({ table });
    await expect(
      updateAssets(supabase, ['a'], { qc_status: 'passed' }),
    ).resolves.toEqual({ updatedIds: [], complete: false });
  });
});

describe('sayfalama', () => {
  it('bir fazla satır isteyip hasMore’u ondan çıkarır', async () => {
    const rows = Array.from({ length: ASSET_PAGE_SIZE + 1 }, (_, index) =>
      asset(String(index)),
    );
    const table = query({ data: rows, error: null });
    const { supabase } = client({ table });
    const page = await fetchAssetPage(supabase, INF);
    expect(page.hasMore).toBe(true);
    expect(page.assets).toHaveLength(ASSET_PAGE_SIZE);
    expect(table.calls.find(([name]) => name === 'or')).toBeUndefined();
  });

  it('sonraki sayfayı (created_at, id) imleciyle ister', async () => {
    const table = query({ data: [], error: null });
    const { supabase } = client({ table });
    const page = await fetchAssetPage(supabase, INF, {
      created_at: '2026-10-22T10:00:00.000Z',
      id: 'b',
    });
    expect(page).toEqual({ assets: [], hasMore: false });
    expect(table.calls.find(([name]) => name === 'or')?.[1][0]).toBe(
      'created_at.lt."2026-10-22T10:00:00.000Z",and(created_at.eq."2026-10-22T10:00:00.000Z",id.lt.b)',
    );
  });

  it('en eski kaydı bulur ve listeleri tekrar etmeden birleştirir', () => {
    const items = [
      item(asset('c', { created_at: '2026-10-22T12:00:00.000Z' })),
      item(asset('b', { created_at: '2026-10-22T10:00:00.000Z' })),
      item(asset('a', { created_at: '2026-10-22T10:00:00.000Z' })),
    ];
    expect(oldestAsset(items)?.id).toBe('a');
    expect(oldestAsset([])).toBeUndefined();
    const merged = mergeAssetItems(items, [items[1]!, item(asset('d'))], 'end');
    expect(merged.map(({ asset: a }) => a.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(
      mergeAssetItems(items, [item(asset('n'))], 'start').map(
        ({ asset: a }) => a.id,
      ),
    ).toEqual(['n', 'c', 'b', 'a']);
  });
});
