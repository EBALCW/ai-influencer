// İş birliği fırsatı etiketi (#61): anahtar kelime + e-posta adresi. Saf fonksiyon.
//
// Türkçe büyük/küçük harf: `toLowerCase()` "İ"yi "i̇" (noktalı + birleşik nokta) yapar, "I"yı
// "i" yapar. Önce `toLocaleLowerCase('tr')`, sonra aksanlar atılır (ş→s, ğ→g) ve "ı" "i"ye
// katlanır; böylece "İŞ BİRLİĞİ", "işbirliği", "is birligi" ve "PARTNERSHIP" aynı biçime iner.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i;

/** Katlanmış metinde aranır (yalnız ASCII harf kalır). */
const KEYWORDS: readonly RegExp[] = [
  /\bcollab/, // collab, collaboration
  /\bsponsor/, // sponsor, sponsorluk, sponsorship
  /\bis\s*-?\s*birlig/, // iş birliği, işbirliğine, iş-birliği
  /\bpartnership\b/,
];

export function foldText(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i');
}

export function detectBrandInquiry(text: string): boolean {
  if (!text) return false;
  if (EMAIL.test(text)) return true;
  const folded = foldText(text);
  return KEYWORDS.some((re) => re.test(folded));
}
