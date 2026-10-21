import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@ai-influencer/shared';
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from './config';

export function createSupabaseAdminClient() {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!config || !serviceRoleKey) return null;

  return createClient<Database>(config.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
