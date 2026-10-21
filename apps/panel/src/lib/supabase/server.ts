import { createServerClient } from '@supabase/ssr';
import type { Database } from '@ai-influencer/shared';
import { cookies } from 'next/headers';
import { getSupabasePublicEnv } from './env';

export async function createSupabaseServerClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error('Supabase ortam değişkenleri tanımlı değil.');

  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });
}
