// QueueStore'un Supabase (service role) implementasyonu. Service role RLS'i aşar; her sorgu
// üretim id'si ve influencer_id ile açıkça filtrelenir (docs/DEVELOPMENT.md §9).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { InputFile } from '../_shared/generation/provider.ts';
import type { JobPatch, QueueJob, QueueStore } from './worker.ts';

const BUCKET = 'assets';
const SIGNED_URL_SECONDS = 60 * 60;

export function createSupabaseStore(db: SupabaseClient): QueueStore {
  return {
    async claim(tools, limit, leaseSeconds) {
      const { data, error } = await db.rpc('claim_generations', {
        p_tools: tools,
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new Error(`claim_generations: ${error.message}`);
      return (data ?? []) as QueueJob[];
    },

    async update(id: string, patch: JobPatch) {
      const { error } = await db
        .from('generations')
        .update(patch)
        .eq('id', id)
        .in('status', ['queued', 'running']);
      if (error) throw new Error(`generations update: ${error.message}`);
    },

    async inputMedia(job) {
      if (!job.input_asset_ids?.length) return { images: [], video: null };
      const { data, error } = await db
        .from('assets')
        .select('id, storage_path, mime_type')
        .in('id', job.input_asset_ids)
        .eq('influencer_id', job.influencer_id);
      if (error) throw new Error(`assets: ${error.message}`);
      const images: InputFile[] = [];
      let video: InputFile | null = null;
      for (const asset of data ?? []) {
        const signed = await db.storage
          .from(BUCKET)
          .createSignedUrl(asset.storage_path, SIGNED_URL_SECONDS);
        if (signed.error || !signed.data)
          throw new Error('signed url oluşturulamadı');
        const file = {
          url: signed.data.signedUrl,
          mimeType: asset.mime_type ?? null,
        };
        if (String(asset.mime_type ?? '').startsWith('video/')) {
          video ??= file;
        } else {
          images.push(file);
        }
      }
      return { images, video };
    },

    async upload(path, bytes, contentType) {
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
        contentType,
        upsert: true,
      });
      if (error) throw new Error(`storage upload: ${error.message}`);
    },

    async complete(id, path, mimeType, size, credits, costUsd) {
      // Gerçek tutar (USD) önce yazılır; costs kaydını complete_generation'ın durum
      // değişikliği tetikler (generations_record_cost, migration 20261024130000).
      if (costUsd !== null) {
        const { error: costError } = await db
          .from('generations')
          .update({ cost_usd: costUsd })
          .eq('id', id)
          .in('status', ['queued', 'running']);
        if (costError)
          throw new Error(`generations cost_usd: ${costError.message}`);
      }
      const { error } = await db.rpc('complete_generation', {
        p_id: id,
        p_storage_path: path,
        p_mime_type: mimeType,
        p_file_size_bytes: size,
        p_credits: credits,
      });
      if (error) throw new Error(`complete_generation: ${error.message}`);
    },

    async heartbeat(state) {
      const { error } = await db.from('generation_worker_status').upsert({
        id: true,
        last_run_at: new Date().toISOString(),
        providers: state.providers,
        claimed: state.claimed,
        message: state.message,
      });
      if (error)
        console.error('generation_worker_status yazılamadı', error.message);
    },
  };
}
