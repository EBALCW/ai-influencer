import { createClient } from '@supabase/supabase-js';
import { json, requireCronSecret } from '../_shared/http.ts';
import {
  refreshTokens,
  type Credentials,
  type Job,
  type Platform,
  type Store,
} from './worker.ts';
export async function handler(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const credentials: Credentials = {};
  for (const [platform, prefix] of [
    ['youtube', 'GOOGLE'],
    ['tiktok', 'TIKTOK'],
  ] as const) {
    const id = Deno.env.get(`${prefix}_CLIENT_ID`),
      secret = Deno.env.get(`${prefix}_CLIENT_SECRET`);
    if (id && secret) credentials[platform] = { id, secret };
  }
  const url = Deno.env.get('SUPABASE_URL'),
    key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'not_configured' }, 503);
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store: Store = {
    async claim(platforms: Platform[]) {
      const { data, error } = await db.rpc('oauth_refresh_claim', {
        p_platforms: platforms,
      });
      if (error || !Array.isArray(data)) throw new Error('claim_failed');
      return data as Job[];
    },
    async finish(job, result, token, expiresAt) {
      const { data, error } = await db.rpc('oauth_refresh_finish', {
        p_account_id: job.id,
        p_lease_id: job.leaseId,
        p_result: result,
        p_token: token,
        p_expires_at: expiresAt,
      });
      if (error) throw new Error('finish_failed');
      return data === true;
    },
  };
  try {
    const result = await refreshTokens(store, credentials);
    return json(result, result.configured ? 200 : 503);
  } catch {
    return json({ error: 'refresh_failed' }, 500);
  }
}
if (import.meta.main) Deno.serve(handler);
