// Yayın kuyruğu worker'ı (#58). pg_cron + pg_net her dakika, yalnız zamanı gelen iş varsa
// `x-cron-secret` ile çağırır (migration 20261022240000_publishing.sql).

import { createClient } from '@supabase/supabase-js';
import { errorResponse, json, requireCronSecret } from '../_shared/http.ts';
import { publishConfigFromEnv } from '../_shared/publishers/config.ts';
import { createPublishers } from '../_shared/publishers/index.ts';
import { createSupabaseStore } from './store.ts';
import { runPublishWorker } from './worker.ts';

Deno.serve(async (req) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    return errorResponse(503, 'not_configured', 'Fonksiyon yapılandırılmamış');
  }
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const config = publishConfigFromEnv(Deno.env);
  try {
    const result = await runPublishWorker({
      store: createSupabaseStore(db),
      publishers: createPublishers(config),
      config,
    });
    return json(result);
  } catch (error) {
    console.error(
      'publish-scheduled',
      error instanceof Error ? error.message : error,
    );
    return errorResponse(500, 'internal', 'Yayın kuyruğu işlenemedi');
  }
});
