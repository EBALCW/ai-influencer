import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@ai-influencer/shared';
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from './env';

export function createSupabaseAdminClient() {
  const env = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!env || !serviceRoleKey) {
    throw new Error('Supabase sunucu yapılandırması eksik.');
  }

  return createClient<Database>(env.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
