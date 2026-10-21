/**
 * Prompt şablon motoru (#46). Saf fonksiyonlar; `eval` / `new Function` kullanılmaz.
 *
 * Sözdizimi:
 * - `{{degisken}}`: değişken. Ad harf veya `_` ile başlar, harf/rakam/`_` içerir
 *   (Türkçe karakterler dahil: `{{kıyafet}}`). Süslü parantez içindeki boşluklar yok sayılır.
 * - `\{{` : kaçış. Çıktıda değişken olarak değil, düz `{{` olarak kalır.
 * - Kurala uymayan `{{ ... }}` (ör. `{{1x}}`) değişken sayılmaz, olduğu gibi kalır.
 */

const VARIABLE = /(\\?)\{\{\s*([\p{L}_][\p{L}\p{N}_]*)\s*\}\}/gu;

export const MAX_VARIABLES = 30;

/** Şablondaki değişken adları, ilk görünme sırasıyla ve tekrarsız. */
export function extractVariables(body: string): string[] {
  const names: string[] = [];
  for (const match of body.matchAll(VARIABLE)) {
    const [, escape, name] = match;
    if (escape || !name || names.includes(name)) continue;
    names.push(name);
  }
  return names;
}

export type RenderResult = {
  text: string;
  /** Değeri verilmemiş veya boş (yalnızca boşluk) değişkenler. */
  missing: string[];
  /** Verilen ama şablonda kullanılmayan değerler. */
  unused: string[];
};

/**
 * Değişkenleri doldurur. Eksik değişkenler metinde `{{ad}}` olarak kalır ve
 * `missing` içinde döner; çağıran taraf eksik varken üretime göndermemelidir.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string | undefined>,
): RenderResult {
  const missing: string[] = [];
  const text = body.replace(
    VARIABLE,
    (whole: string, escape: string, name: string) => {
      if (escape) return whole.slice(1);
      // Sadece kendi alanları: `{{__proto__}}` prototip zincirinden değer okumasın
      const value = Object.hasOwn(values, name) ? values[name] : undefined;
      if (typeof value !== 'string' || value.trim() === '') {
        if (!missing.includes(name)) missing.push(name);
        return `{{${name}}}`;
      }
      return value;
    },
  );
  const used = new Set(extractVariables(body));
  const unused = Object.keys(values).filter((name) => !used.has(name));
  return { text, missing, unused };
}

export class TemplateError extends Error {
  constructor(readonly missing: string[]) {
    super(`Eksik değişken: ${missing.join(', ')}`);
    this.name = 'TemplateError';
  }
}

/** Eksik değişken varsa `TemplateError` atar; üretime gönderimden önce kullanılır. */
export function renderTemplateStrict(
  body: string,
  values: Record<string, string | undefined>,
): string {
  const result = renderTemplate(body, values);
  if (result.missing.length) throw new TemplateError(result.missing);
  return result.text;
}
