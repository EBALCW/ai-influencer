// Yorum işlerinin veritabanı sözleşmesi. Üretimde `supabase-store.ts` (service role),
// testlerde `memory-store.ts`.
import type {
  SocialPlatform,
  SocialToken,
  SyncAccount,
} from '../collectors/types.ts';
import type { SyncRunStatus } from '../sync/store.ts';
import type { CommentPostRef } from './types.ts';

export type CommentJob = 'comments' | 'comment_reply';

/** comments satırı; (account_id, external_id) ile upsert. Panel durumu (status) yazılmaz. */
export interface CommentRow {
  post_id: string;
  account_id: string;
  platform: SocialPlatform;
  external_id: string;
  parent_external_id: string | null;
  author_name: string;
  text: string;
  published_at: string;
  like_count: number | null;
  is_brand_inquiry: boolean;
}

export interface QueuedReply {
  id: string;
  commentId: string;
  body: string;
  attempts: number;
  commentExternalId: string;
  accountId: string;
  platform: SocialPlatform;
}

export interface CommentStore {
  /** status active/error ve token_ref'i olan hesaplar. */
  listAccounts(): Promise<SyncAccount[]>;
  readToken(accountId: string): Promise<SocialToken | null>;
  setAccountStatus(
    accountId: string,
    status: 'active' | 'expired' | 'error',
  ): Promise<void>;
  /** Hesabın `since` sonrası yayımlanmış, external_id'li postları (yeniden eskiye). */
  recentPosts(
    accountId: string,
    since: Date,
    limit: number,
  ): Promise<CommentPostRef[]>;
  /** Postun bilinen en yeni yorum zamanı. */
  latestCommentAt(postId: string): Promise<Date | null>;
  /** Yazılan/güncellenen satır sayısı. */
  upsertComments(rows: CommentRow[]): Promise<number>;

  /** Zamanı gelmiş 'queued' yanıtlar (eskiden yeniye). */
  dueReplies(at: Date, limit: number): Promise<QueuedReply[]>;
  /** queued → sending (attempts + 1). false: başka çalışma aldı. */
  claimReply(reply: QueuedReply): Promise<boolean>;
  completeReply(id: string, externalId: string): Promise<void>;
  failReply(id: string, error: string): Promise<void>;
  requeueReply(id: string, nextAttemptAt: Date, error: string): Promise<void>;

  startRun(run: {
    job: CommentJob;
    platform: SocialPlatform;
    accountId: string;
  }): Promise<string>;
  finishRun(
    id: string,
    result: {
      status: SyncRunStatus;
      processedCount: number;
      quotaUnits: number | null;
      error: string | null;
    },
  ): Promise<void>;
}
