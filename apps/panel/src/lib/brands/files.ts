/**
 * Deal dosyaları (sözleşme). Nesne private `contracts` bucket'ında `<deal_id>/<uuid>.<uzantı>`
 * yolunda durur; kullanıcının verdiği ad yolda kullanılmaz (path traversal yok), sadece
 * `brand_deal_files.file_name` alanında gösterim için saklanır. İndirme kısa ömürlü signed URL ile.
 */
export const CONTRACT_BUCKET = 'contracts';
/** Bucket ile aynı sınır (supabase/config.toml ve migration). */
export const MAX_CONTRACT_BYTES = 20 * 1024 * 1024;
/** Signed URL yalnız indirme anında üretilir; 60 sn yeterli. */
export const CONTRACT_URL_TTL_SECONDS = 60;

const CONTRACT_MIME_EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
} as const;
export type ContractMime = keyof typeof CONTRACT_MIME_EXTENSIONS;
export const CONTRACT_MIME_TYPES = Object.keys(
  CONTRACT_MIME_EXTENSIONS,
) as ContractMime[];

export function isAllowedContractMime(mime: string): mime is ContractMime {
  return Object.hasOwn(CONTRACT_MIME_EXTENSIONS, mime);
}

export function validateContractFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!isAllowedContractMime(file.type))
    return 'Yalnız PDF, DOCX, JPEG veya PNG yüklenebilir.';
  if (file.size <= 0) return 'Dosya boş.';
  if (file.size > MAX_CONTRACT_BYTES) return 'Dosya 20 MB sınırını aşıyor.';
  return null;
}

export function contractStoragePath(
  dealId: string,
  fileId: string,
  mime: string,
): string {
  if (!isAllowedContractMime(mime))
    throw new Error('Desteklenmeyen dosya türü.');
  return `${dealId}/${fileId}.${CONTRACT_MIME_EXTENSIONS[mime]}`;
}

/** Gösterim adı: yol ayırıcıları ve kontrol karakterleri temizlenir, 200 karakter sınırı. */
export function displayFileName(name: string): string {
  const base = name.split(/[\\/]/).at(-1) ?? '';
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (clean || 'dosya').slice(0, 200);
}
