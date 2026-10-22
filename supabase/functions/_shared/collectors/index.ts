// Platform → toplayıcı kaydı. Kayıtlı olmayan platformun hesapları sessizce atlanır
// (log satırı, sync_runs satırı yok), böylece toplayıcısı henüz yazılmamış platformlar
// hata fırtınası üretmez.
//
// Yeni toplayıcı: `collectors/<platform>.ts` yaz, aşağıya ekle (README.md).
// Sahte toplayıcı (`fake.ts`) yalnız testler içindir; buraya EKLENMEZ.
import type { Collector, SocialPlatform } from './types.ts';

export type CollectorRegistry = Partial<Record<SocialPlatform, Collector>>;

export const collectors: CollectorRegistry = {
  // instagram: instagramCollector, // #50
  // youtube: youtubeCollector, // #51
};

export function getCollector(
  registry: CollectorRegistry,
  platform: SocialPlatform,
): Collector | null {
  const collector = registry[platform];
  return collector && collector.platform === platform ? collector : null;
}

export * from './types.ts';
