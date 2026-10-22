// Platform → yorum adaptörü kaydı (#61). Kayıtlı olmayan platformun (TikTok) hesapları
// yorum toplamada sessizce atlanır; o platformdaki bekleyen yanıtlar 'failed' olur.
import type { CommentAdapter, SocialPlatform } from './types.ts';
import { instagramCommentAdapter } from './instagram.ts';
import { youtubeCommentAdapter } from './youtube.ts';

export type CommentAdapterRegistry = Partial<
  Record<SocialPlatform, CommentAdapter>
>;

export const commentAdapters: CommentAdapterRegistry = {
  instagram: instagramCommentAdapter,
  youtube: youtubeCommentAdapter,
};

export function getCommentAdapter(
  registry: CommentAdapterRegistry,
  platform: SocialPlatform,
): CommentAdapter | null {
  const adapter = registry[platform];
  return adapter && adapter.platform === platform ? adapter : null;
}

export * from './types.ts';
