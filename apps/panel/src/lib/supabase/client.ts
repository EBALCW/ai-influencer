'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@ai-influencer/shared';
import { getSupabasePublicConfig } from './config';

export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error('Supabase bağlantısı yapılandırılmamış.');
  return createBrowserClient<Database>(config.url, config.key);
}
