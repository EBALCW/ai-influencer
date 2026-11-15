// Günlük ve denetim kaydı için kırpma. Kural: serbest metin ASLA yazılmaz; yalnız türü ve
// uzunluğu yazılır. Kimlikler (uuid), kısa sabit değerler (durum, tür, dil) ve sayılar kalır.
// Token ya da anahtar biçimine benzeyen her şey, hangi alanda olursa olsun, maskelenir.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Küçük harfli kısa sabitler: 'event', 'explainer.script', 'tr', 'tr-TR', 'script_ready' … */
const TOKEN_LIKE_CONSTANT = /^[a-z][a-z0-9_.-]{0,39}$|^[a-z]{2}-[A-Z]{2}$/;

const SECRET_PATTERNS: readonly RegExp[] = [
  // JWT (erişim token'ı, anon / service role anahtarı)
  /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g,
  // Supabase yeni biçim anahtarları
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g,
  // Authorization başlığı
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  // refresh_token=…, "refresh_token":"…", access_token, apikey, code, code_verifier
  /\b(refresh_token|access_token|apikey|api_key|code_verifier|code|password|token)\b("?\s*[:=]\s*"?)[^\s"&,}]{4,}/gi,
];

/** Metindeki sır biçimli parçaları maskeler (hata iletileri ve stderr günlükleri için). */
export function redactText(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, key?: string, sep?: string) =>
      typeof key === 'string' && typeof sep === 'string'
        ? `${key}${sep}[gizlendi]`
        : '[gizlendi]',
    );
  }
  return out;
}

export type RedactedValue =
  | null
  | boolean
  | number
  | string
  | { readonly tur: 'metin'; readonly uzunluk: number }
  | {
      readonly tur: 'dizi';
      readonly adet: number;
      readonly ornek?: RedactedValue;
    }
  | { readonly [key: string]: RedactedValue };

const MAX_DEPTH = 6;
const MAX_KEYS = 40;

/**
 * Araç argümanlarının denetim kaydına yazılacak özeti. Serbest metin yerine uzunluğu yazılır;
 * böylece kayıt senaryo, kaynak adresi ya da kişisel veri içermez.
 */
export function redactArgs(value: unknown, depth = 0): RedactedValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    if (UUID.test(value)) return value.toLowerCase();
    if (TOKEN_LIKE_CONSTANT.test(value) && redactText(value) === value)
      return value;
    return { tur: 'metin', uzunluk: value.length };
  }
  if (depth >= MAX_DEPTH) return { tur: 'metin', uzunluk: 0 };
  if (Array.isArray(value)) {
    return value.length === 0
      ? { tur: 'dizi', adet: 0 }
      : {
          tur: 'dizi',
          adet: value.length,
          ornek: redactArgs(value[0], depth + 1),
        };
  }
  if (typeof value === 'object') {
    const out: Record<string, RedactedValue> = {};
    for (const [key, inner] of Object.entries(value).slice(0, MAX_KEYS)) {
      // Anahtar adı da model girdisidir: yalnız tanımlayıcı biçimindeyse yazılır.
      const safeKey = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(key)
        ? key
        : '[alan]';
      out[safeKey] = redactArgs(inner, depth + 1);
    }
    return out;
  }
  return null;
}
