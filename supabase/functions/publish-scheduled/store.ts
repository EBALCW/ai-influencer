// PublishStore'un Supabase (service role) implementasyonu. Service role RLS'i aşar; her sorgu
// iş, içerik, hesap ve influencer id'siyle açıkça filtrelenir (docs/DEVELOPMENT.md §9).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SocialToken } from '../_shared/collectors/types.ts';
import type { JobContext, PublishJob, PublishStore } from './worker.ts';

const BUCKET = 'assets';

const fail = (what: string, error: { message: string; code?: string }) =>
  new Error(`${what}: ${error.code ?? ''} ${error.message}`.trim());

export function createSupabaseStore(db: SupabaseClient): PublishStore {
  return {
    async claim(limit, leaseSeconds) {
      const { data, error } = await db.rpc('claim_publish_jobs', {
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw fail('claim_publish_jobs', error);
      return (data ?? []) as PublishJob[];
    },

    async context(job): Promise<JobContext | null> {
      const content = await db
        .from('content_items')
        .select('id, influencer_id, checklist')
        .eq('id', job.content_item_id)
        .maybeSingle();
      if (content.error) throw fail('İçerik okunamadı', content.error);
      if (!content.data) return null;
      const influencerId = content.data.influencer_id as string;
      const [account, asset] = await Promise.all([
        db
          .from('social_accounts')
          .select('id, external_id, status, token_ref')
          .eq('id', job.account_id)
          .eq('influencer_id', influencerId)
          .maybeSingle(),
        job.asset_id
          ? db
              .from('assets')
              .select(
                'storage_path, mime_type, file_size_bytes, width, height, duration_ms',
              )
              .eq('id', job.asset_id)
              .eq('influencer_id', influencerId)
              .eq('kind', 'final_video')
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (account.error) throw fail('Hesap okunamadı', account.error);
      if (asset.error) throw fail('Asset okunamadı', asset.error);
      return {
        checklist: content.data.checklist,
        account: account.data
          ? {
              id: account.data.id,
              externalId: account.data.external_id,
              status: account.data.status,
              connected: account.data.token_ref !== null,
            }
          : null,
        asset: asset.data
          ? {
              storagePath: asset.data.storage_path,
              mimeType: asset.data.mime_type,
              sizeBytes: asset.data.file_size_bytes,
              width: asset.data.width,
              height: asset.data.height,
              durationMs: asset.data.duration_ms,
            }
          : null,
      };
    },

    async readToken(accountId) {
      const { data, error } = await db.rpc('read_social_token', {
        p_account_id: accountId,
      });
      // RPC genel mesaj döndürür; token içermez.
      if (error) throw fail('Token okunamadı', error);
      if (
        !data ||
        typeof data !== 'object' ||
        typeof data.access_token !== 'string'
      ) {
        return null;
      }
      const token: SocialToken = { accessToken: data.access_token };
      if (typeof data.refresh_token === 'string')
        token.refreshToken = data.refresh_token;
      return token;
    },

    async signedUrl(path, seconds) {
      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(path, seconds);
      if (error || !data) throw new Error('İmzalı video adresi oluşturulamadı');
      return data.signedUrl;
    },

    async download(path) {
      const { data, error } = await db.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error('Final video indirilemedi');
      return new Uint8Array(await data.arrayBuffer());
    },

    async update(id, patch) {
      const { error } = await db
        .from('publish_jobs')
        .update(patch)
        .eq('id', id)
        .eq('status', 'processing');
      if (error) throw fail('publish_jobs güncellenemedi', error);
    },

    async complete(id, result) {
      const { error } = await db.rpc('complete_publish_job', {
        p_id: id,
        p_external_id: result.externalId,
        p_url: result.url,
        p_published_at: (result.publishedAt ?? new Date()).toISOString(),
        p_duration_s: result.durationS,
        p_is_short: result.isShort,
      });
      if (error) throw fail('complete_publish_job', error);
    },

    async setAccountStatus(accountId, status) {
      const { error } = await db
        .from('social_accounts')
        .update({ status })
        .eq('id', accountId);
      if (error) throw fail('Hesap durumu yazılamadı', error);
    },
  };
}
