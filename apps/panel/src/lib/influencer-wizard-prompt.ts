/**
 * Wizard'ın karakter prompt'u, prompt kütüphanesinde (#46) influencer'a özel
 * `character` kategorisinde tek bir soy olarak tutulur. Wizard ve okuyan her yer
 * aynı anahtarı kullanır; böylece kütüphanede "Adsız prompt / default" olarak
 * görünmez ve versiyonlar tek soyda birikir.
 */
export const CHARACTER_PROMPT_KEY = 'character';

export function characterPromptTitle(influencerName: string): string {
  return `${influencerName.trim()} · karakter prompt’u`.slice(0, 120);
}
