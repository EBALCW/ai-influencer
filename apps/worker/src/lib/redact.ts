// Log ve hata metinlerinden sır ayıklama. Saf fonksiyonlar.
// Kural: token, anahtar ve imzalı adres hiçbir zaman konsola, dosyaya ya da veritabanına yazılmaz.

const MASK = '[gizli]';

/** Değeri olduğu gibi yazılmayacak alan adları. */
const SECRET_KEY =
  /(token|secret|password|parola|sifre|authorization|apikey|api_key|cookie|credential|private_?key|ciphertext|poll)/i;

const PATTERNS: readonly RegExp[] = [
  // JWT (erişim token'ı, anon/service anahtarı)
  /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g,
  // Authorization başlığı
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  // Supabase yeni anahtar biçimleri ve yaygın sağlayıcı anahtarları
  /\b(sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,})/g,
  // anahtar=değer biçiminde sır (sorgu dizesi, ortam değişkeni dökümü)
  /\b([A-Za-z0-9_]*(?:token|secret|password|apikey|api_key|signature)[A-Za-z0-9_]*)=([^\s&"']{4,})/gi,
  // PEM blokları
  /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g,
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface RedactOptions {
  /** Ev klasörü: `~` ile değiştirilir (kullanıcı adı loga girmesin). */
  home?: string | undefined;
  /** Bilinen sırlar (ör. bellekteki yenileme token'ı): geçtikleri yerde maskelenir. */
  secrets?: readonly string[] | undefined;
}

export function redactText(text: string, options: RedactOptions = {}): string {
  let out = text;
  for (const secret of options.secrets ?? []) {
    if (secret.length >= 6) out = out.split(secret).join(MASK);
  }
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, (match: string, ...groups: unknown[]) => {
      // anahtar=değer: anahtar adı kalır, değer gizlenir
      if (
        typeof groups[1] === 'string' &&
        typeof groups[0] === 'string' &&
        match.startsWith(`${groups[0]}=`)
      )
        return `${groups[0]}=${MASK}`;
      return MASK;
    });
  }
  const home = options.home;
  if (home && home.length > 1) {
    out = out.replace(new RegExp(escapeRegExp(home), 'g'), '~');
    // Windows'ta aynı yol / ile de yazılabilir
    const forward = home.replace(/\\/g, '/');
    if (forward !== home)
      out = out.replace(new RegExp(escapeRegExp(forward), 'g'), '~');
  }
  return out;
}

/** Log alanlarını derinlemesine temizler: sır adlı alanlar maskelenir, metinler ayıklanır. */
export function redactValue(
  value: unknown,
  options: RedactOptions = {},
  depth = 0,
): unknown {
  if (typeof value === 'string') return redactText(value, options);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 6) return '[…]';
  if (value instanceof Error) return redactText(value.message, options);
  if (Array.isArray(value))
    return value
      .slice(0, 50)
      .map((item) => redactValue(item, options, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key)
      ? MASK
      : redactValue(item, options, depth + 1);
  }
  return out;
}

/** Veritabanına yazılacak hata metni: sırsız, tek paragraf, sınırlı uzunluk. */
export function safeErrorMessage(
  error: unknown,
  options: RedactOptions = {},
  maxLength = 500,
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Bilinmeyen hata.';
  const clean = redactText(raw, options).replace(/\s+/g, ' ').trim();
  const text = clean.length > 0 ? clean : 'Bilinmeyen hata.';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
