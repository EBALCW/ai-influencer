'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@ai-influencer/shared';
import { getSupabasePublicEnv } from './env';

export function createSupabaseBrowserClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error('Supabase ortam değişkenleri tanımlı değil.');
  return createBrowserClient<Database>(env.url, env.key);
}
