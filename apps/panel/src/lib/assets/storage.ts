import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Row } from '@ai-influencer/shared';

/**
 * Medya kütüphanesinin Storage + `assets` tablosu işlemleri.
 * Hem sunucu sayfası hem istemci bileşeni aynı kuralları kullanır; bu yüzden
 * `server-only` değildir. Yetki RLS ile (tablo + storage.objects) uygulanır.
 */

type Client = SupabaseClient<Database>;
type Asset = Row<'assets'>;

export const ASSET_BUCKET = 'assets';
export const ASSET_PAGE_SIZE = 100;
/** Bucket ile aynı sınır (supabase/config.toml ve migration). */
export const MAX_ASSET_BYTES = 100 * 1024 * 1024;
export const ASSET_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
] as const;
/** Sayfa uzun süre açık kalınca görseller kırılmasın diye 1 saat. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type AssetItem = {
  asset: Asset;
  url: string | null;
  thumbnailUrl: string | null;
};

export function isAllowedAssetMime(mime: string): boolean {
  return (ASSET_MIME_TYPES as readonly string[]).includes(mime);
}

const MIME_EXTENSIONS: Record<(typeof ASSET_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/**
 * Uzantı doğrulanmış MIME türünden gelir, dosya adından değil: kullanıcının verdiği ad
 * yolda hiç kullanılmaz (path traversal yok) ve uzantı içerik türüyle her zaman uyuşur.
 */
export function assetFileExtension(mime: string): string {
  if (!isAllowedAssetMime(mime)) throw new Error('Desteklenmeyen dosya türü.');
  return MIME_EXTENSIONS[mime as keyof typeof MIME_EXTENSIONS];
}

export function assetStoragePaths(
  influencerId: string,
  id: string,
  extension: string,
) {
  return {
    storagePath: `${influencerId}/${id}.${extension}`,
    thumbnailPath: `${influencerId}/${id}-thumb.webp`,
  };
}

/** Tüm kayıtlar için signed URL'leri tek istekte üretir (kayıt başına iki istek yerine). */
export async function signAssetItems(
  supabase: Client,
  assets: Asset[],
): Promise<AssetItem[]> {
  const paths = [
    ...new Set(
      assets.flatMap((asset) =>
        asset.thumbnail_path
          ? [asset.storage_path, asset.thumbnail_path]
          : [asset.storage_path],
      ),
    ),
  ];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await supabase.storage
      .from(ASSET_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error('Medya bağlantıları oluşturulamadı.');
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
    }
  }
  return assets.map((asset) => ({
    asset,
    url: urls.get(asset.storage_path) ?? null,
    thumbnailUrl: asset.thumbnail_path
      ? (urls.get(asset.thumbnail_path) ?? null)
      : null,
  }));
}

/**
 * Bir sayfa kayıt getirir. Sıralama (created_at, id) üzerinden keyset ile yapılır:
 * offset kullanılsaydı araya yeni yükleme girdiğinde kayıtlar tekrar eder veya atlanırdı.
 */
export async function fetchAssetPage(
  supabase: Client,
  influencerId: string,
  after?: Pick<Asset, 'created_at' | 'id'>,
): Promise<{ assets: Asset[]; hasMore: boolean }> {
  let query = supabase
    .from('assets')
    .select('*')
    .eq('influencer_id', influencerId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(ASSET_PAGE_SIZE + 1);
  if (after) {
    query = query.or(
      `created_at.lt."${after.created_at}",and(created_at.eq."${after.created_at}",id.lt.${after.id})`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error('Medya kütüphanesi alınamadı.');
  const rows = data ?? [];
  return {
    assets: rows.slice(0, ASSET_PAGE_SIZE),
    hasMore: rows.length > ASSET_PAGE_SIZE,
  };
}

/** Listeye yeni öğeleri ekler, aynı id ikinci kez görünmez. */
export function mergeAssetItems(
  current: AssetItem[],
  incoming: AssetItem[],
  position: 'start' | 'end',
): AssetItem[] {
  const ids = new Set(incoming.map(({ asset }) => asset.id));
  const rest = current.filter(({ asset }) => !ids.has(asset.id));
  return position === 'start' ? [...incoming, ...rest] : [...rest, ...incoming];
}

/** Listede en eski (sıralamada en sondaki) kayıt; sonraki sayfanın imleci. */
export function oldestAsset(items: AssetItem[]): Asset | undefined {
  return items.reduce<Asset | undefined>((oldest, { asset }) => {
    if (!oldest) return asset;
    if (asset.created_at < oldest.created_at) return asset;
    if (asset.created_at === oldest.created_at && asset.id < oldest.id)
      return asset;
    return oldest;
  }, undefined);
}

export type DeleteAssetsResult = {
  deletedIds: string[];
  /** RLS veya hata yüzünden silinemeyen kayıt var. */
  incomplete: boolean;
  /** Kayıt silindi ama Storage'daki dosya temizlenemedi (dosya artık hiçbir yerden görünmez). */
  storageCleanupFailed: boolean;
};

/**
 * Önce `assets` satırını siler (RLS'in sessizce 0 satır döndürmesine karşı `select` ile doğrular),
 * sonra Storage nesnelerini kaldırır. Ters sıra, satır silinemediğinde dosyası olmayan
 * bir kayıt bırakıyordu. Avatar bağlantısı FK (`ON DELETE SET NULL`) ile otomatik temizlenir.
 */
export async function deleteAssets(
  supabase: Client,
  assets: Asset[],
): Promise<DeleteAssetsResult> {
  if (!assets.length)
    return { deletedIds: [], incomplete: false, storageCleanupFailed: false };
  const { data, error } = await supabase
    .from('assets')
    .delete()
    .in(
      'id',
      assets.map((asset) => asset.id),
    )
    .select('id');
  if (error)
    return { deletedIds: [], incomplete: true, storageCleanupFailed: false };
  const deletedIds = (data ?? []).map((row) => row.id);
  const deleted = new Set(deletedIds);
  const paths = assets
    .filter((asset) => deleted.has(asset.id))
    .flatMap((asset) =>
      asset.thumbnail_path
        ? [asset.storage_path, asset.thumbnail_path]
        : [asset.storage_path],
    );
  let storageCleanupFailed = false;
  if (paths.length) {
    const { error: storageError } = await supabase.storage
      .from(ASSET_BUCKET)
      .remove(paths);
    storageCleanupFailed = Boolean(storageError);
  }
  return {
    deletedIds,
    incomplete: deletedIds.length !== assets.length,
    storageCleanupFailed,
  };
}

/**
 * Kayıtları günceller ve gerçekten kaç satırın değiştiğini döner.
 * RLS yetkisiz güncellemede hata vermez, 0 satır döner; bunu başarı saymamak için.
 */
export async function updateAssets(
  supabase: Client,
  ids: string[],
  values: Database['public']['Tables']['assets']['Update'],
): Promise<{ updatedIds: string[]; complete: boolean }> {
  if (!ids.length) return { updatedIds: [], complete: true };
  const { data, error } = await supabase
    .from('assets')
    .update(values)
    .in('id', ids)
    .select('id');
  if (error) return { updatedIds: [], complete: false };
  const updatedIds = (data ?? []).map((row) => row.id);
  return { updatedIds, complete: updatedIds.length === ids.length };
}
