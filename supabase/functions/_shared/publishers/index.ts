// Yayıncı kaydı (#58). Kaydı olmayan platformun işi `failed` olur (TikTok henüz yok).
import { DEFAULT_PUBLISH_CONFIG, type PublishConfig } from './config.ts';
import { createInstagramPublisher } from './instagram.ts';
import type { Publisher, PublishPlatform } from './types.ts';
import { createYoutubePublisher } from './youtube.ts';

export type PublisherRegistry = Partial<Record<string, Publisher>>;

export function createPublishers(
  config: PublishConfig = DEFAULT_PUBLISH_CONFIG,
): Record<PublishPlatform, Publisher> {
  return {
    instagram: createInstagramPublisher(config),
    youtube: createYoutubePublisher(config),
  };
}
