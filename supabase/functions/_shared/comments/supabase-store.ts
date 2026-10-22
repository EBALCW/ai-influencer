// CommentStore'un service role ile çalışan uygulaması. RLS uygulanmaz; her sorgu hesap/post/
// yanıt id'siyle açıkça filtrelenir (docs/DEVELOPMENT.md §9). Hesap listesi ve token okuma
// #53'ün store'undan alınır (aynı kurallar, tek yer).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseStore as createSyncStore } from '../sync/supabase-store.ts';
import type { CommentStore, QueuedReply } from './store.ts';

const fail = (what: string, error: { message: string; code?: string }) =>
  new Error(`${what}: ${error.code ?? ''} ${error.message}`.trim());

const one = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export function createSupabaseCommentStore(
  url: string,
  serviceRoleKey: string,
  fetchFn?: typeof fetch,
): CommentStore {
  const sync = createSyncStore(url, serviceRoleKey, fetchFn);
  const db: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: fetchFn ? { fetch: fetchFn } : undefined,
  });

  return {
    listAccounts: () => sync.listAccounts(),
    readToken: (accountId) => sync.readToken(accountId),
    setAccountStatus: (accountId, status) =>
      sync.setAccountStatus(accountId, status),

    async recentPosts(accountId, since, limit) {
      const { data, error } = await db
        .from('posts')
        .select('id, external_id, published_at')
        .eq('account_id', accountId)
        .not('external_id', 'is', null)
        .gte('published_at', since.toISOString())
        .order('published_at', { ascending: false })
        .limit(limit);
      if (error) throw fail('Postlar okunamadı', error);
      return (data ?? []).map((r) => ({
        id: r.id as string,
        externalId: r.external_id as string,
        publishedAt: new Date(r.published_at as string),
      }));
    },

    async latestCommentAt(postId) {
      const { data, error } = await db
        .from('comments')
        .select('published_at')
        .eq('post_id', postId)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw fail('Son yorum okunamadı', error);
      return data?.published_at ? new Date(data.published_at) : null;
    },

    async upsertComments(rows) {
      // status / brand_deal_id gönderilmez: panelde verilen durum korunur.
      const { data, error } = await db
        .from('comments')
        .upsert(rows, { onConflict: 'account_id,external_id' })
        .select('id');
      if (error) throw fail('Yorumlar yazılamadı', error);
      return data?.length ?? 0;
    },

    async dueReplies(at, limit) {
      const { data, error } = await db
        .from('comment_replies')
        .select(
          'id, comment_id, body, attempts, comments!inner(external_id, account_id, platform)',
        )
        .eq('status', 'queued')
        .lte('next_attempt_at', at.toISOString())
        .order('created_at')
        .limit(limit);
      if (error) throw fail('Yanıt kuyruğu okunamadı', error);
      const out: QueuedReply[] = [];
      for (const r of data ?? []) {
        const c = one(
          r.comments as
            | { external_id: string; account_id: string; platform: string }
            | { external_id: string; account_id: string; platform: string }[]
            | null,
        );
        if (!c) continue;
        out.push({
          id: r.id as string,
          commentId: r.comment_id as string,
          body: r.body as string,
          attempts: Number(r.attempts ?? 0),
          commentExternalId: c.external_id,
          accountId: c.account_id,
          platform: c.platform as QueuedReply['platform'],
        });
      }
      return out;
    },

    async claimReply(reply) {
      // Koşullu güncelleme tek satırlık atomik kilit: aynı yanıtı iki çalışma alamaz.
      const { data, error } = await db
        .from('comment_replies')
        .update({ status: 'sending', attempts: reply.attempts + 1 })
        .eq('id', reply.id)
        .eq('status', 'queued')
        .select('id');
      if (error) throw fail('Yanıt alınamadı', error);
      return (data?.length ?? 0) > 0;
    },

    async completeReply(id, externalId) {
      const { error } = await db
        .from('comment_replies')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          external_id: externalId,
          error: null,
        })
        .eq('id', id)
        .eq('status', 'sending');
      if (error) throw fail('Yanıt kapatılamadı', error);
    },

    async failReply(id, message) {
      const { error } = await db
        .from('comment_replies')
        .update({ status: 'failed', error: message.slice(0, 500) })
        .eq('id', id)
        .in('status', ['queued', 'sending']);
      if (error) throw fail('Yanıt durumu yazılamadı', error);
    },

    async requeueReply(id, nextAttemptAt, message) {
      const { error } = await db
        .from('comment_replies')
        .update({
          status: 'queued',
          next_attempt_at: nextAttemptAt.toISOString(),
          error: message.slice(0, 500),
        })
        .eq('id', id)
        .eq('status', 'sending');
      if (error) throw fail('Yanıt yeniden sıraya alınamadı', error);
    },

    async startRun(run) {
      const { data, error } = await db
        .from('sync_runs')
        .insert({
          job: run.job,
          platform: run.platform,
          account_id: run.accountId,
        })
        .select('id')
        .single();
      if (error) throw fail('Senkronizasyon günlüğü açılamadı', error);
      return data.id as string;
    },

    async finishRun(id, result) {
      const { error } = await db
        .from('sync_runs')
        .update({
          status: result.status,
          processed_count: result.processedCount,
          quota_units: result.quotaUnits,
          error: result.error,
        })
        .eq('id', id);
      if (error) throw fail('Senkronizasyon günlüğü kapatılamadı', error);
    },
  };
}
