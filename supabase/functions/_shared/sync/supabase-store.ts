// SyncStore'un service role ile çalışan uygulaması. RLS uygulanmaz; her sorgu hesap/post
// id'siyle açıkça filtrelenir (docs/DEVELOPMENT.md §9).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SocialToken, SyncAccount } from '../collectors/types.ts';
import type { DueSnapshot, SyncStore } from './store.ts';

const fail = (what: string, error: { message: string; code?: string }) =>
  new Error(`${what}: ${error.code ?? ''} ${error.message}`.trim());

export function createSupabaseStore(
  url: string,
  serviceRoleKey: string,
  fetchFn?: typeof fetch,
): SyncStore {
  const db: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: fetchFn ? { fetch: fetchFn } : undefined,
  });

  return {
    async listAccounts(accountId) {
      let query = db
        .from('social_accounts')
        .select('id, influencer_id, platform, handle, external_id, status')
        .in('status', ['active', 'error'])
        .not('token_ref', 'is', null)
        .order('platform')
        .order('id');
      if (accountId) query = query.eq('id', accountId);
      const { data, error } = await query;
      if (error) throw fail('Hesaplar okunamadı', error);
      return (data ?? []).map((r): SyncAccount => ({
        id: r.id,
        influencerId: r.influencer_id,
        platform: r.platform,
        handle: r.handle,
        externalId: r.external_id,
        status: r.status,
      }));
    },

    async readToken(accountId) {
      const { data, error } = await db.rpc('read_social_token', {
        p_account_id: accountId,
      });
      // Hata mesajı token içermez (RPC genel mesaj döndürür).
      if (error) throw fail('Token okunamadı', error);
      if (
        !data ||
        typeof data !== 'object' ||
        typeof data.access_token !== 'string'
      )
        return null;
      const token: SocialToken = { accessToken: data.access_token };
      if (typeof data.refresh_token === 'string')
        token.refreshToken = data.refresh_token;
      if (typeof data.token_type === 'string')
        token.tokenType = data.token_type;
      if (typeof data.scope === 'string') token.scope = data.scope;
      return token;
    },

    async dueSnapshots(at, limit, accountId) {
      const { data, error } = await db.rpc('due_snapshots', {
        p_at: at.toISOString(),
        p_limit: limit,
        p_account_id: accountId ?? null,
      });
      if (error) throw fail('Zamanı gelen snapshot listesi okunamadı', error);
      return ((data ?? []) as Record<string, string | number>[]).map(
        (r): DueSnapshot => ({
          postId: String(r.post_id),
          accountId: String(r.account_id),
          platform: r.platform as DueSnapshot['platform'],
          externalId: String(r.external_id),
          publishedAt: new Date(String(r.published_at)),
          targetHours: Number(r.target_hours),
        }),
      );
    },

    async latestPublishedAt(accountId) {
      const { data, error } = await db
        .from('posts')
        .select('published_at')
        .eq('account_id', accountId)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw fail('Son post okunamadı', error);
      return data?.published_at ? new Date(data.published_at) : null;
    },

    async upsertPosts(rows) {
      // Düz UNIQUE (account_id, external_id) kısıtı (migration 20261022231000).
      const { data, error } = await db
        .from('posts')
        .upsert(rows, { onConflict: 'account_id,external_id' })
        .select('id');
      if (error) throw fail('Postlar yazılamadı', error);
      return data?.length ?? 0;
    },

    async insertMetricSnapshot(row) {
      const { data, error } = await db
        .from('metric_snapshots')
        .upsert(row, {
          onConflict: 'post_id,target_hours',
          ignoreDuplicates: true,
        })
        .select('id');
      if (error) throw fail('Metrik snapshot yazılamadı', error);
      return (data?.length ?? 0) > 0;
    },

    async upsertAccountSnapshot(row) {
      const { error } = await db
        .from('account_snapshots')
        .upsert(row, { onConflict: 'account_id,captured_at' });
      if (error) throw fail('Hesap snapshot yazılamadı', error);
    },

    async setAccountStatus(accountId, status) {
      const { error } = await db
        .from('social_accounts')
        .update({ status })
        .eq('id', accountId);
      if (error) throw fail('Hesap durumu yazılamadı', error);
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
