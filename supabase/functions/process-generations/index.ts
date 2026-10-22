// Üretim kuyruğu worker'ı (#47). pg_cron + pg_net her dakika `x-cron-secret` ile çağırır
// (migration 20261022230000_generation_queue.sql). Sağlayıcı anahtarları yoksa işler kuyrukta
// kalır ve panel "sağlayıcı yapılandırılmamış" gösterir.

import { createClient } from '@supabase/supabase-js';
import { errorResponse, json, requireCronSecret } from '../_shared/http.ts';
import { higgsfieldFromEnv } from '../_shared/generation/higgsfield.ts';
import type { GenerationProvider } from '../_shared/generation/provider.ts';
import { createSupabaseStore } from './store.ts';
import { runWorker } from './worker.ts';

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

  const providers: GenerationProvider[] = [];
  const higgsfield = higgsfieldFromEnv(Deno.env);
  if (higgsfield) providers.push(higgsfield);

  const timeout = Number(Deno.env.get('GENERATION_RUNNING_TIMEOUT_MINUTES') ?? '');
  try {
    const result = await runWorker({
      store: createSupabaseStore(db),
      providers,
      runningTimeoutMinutes: Number.isFinite(timeout) && timeout > 0 ? timeout : 30,
    });
    return json(result);
  } catch (error) {
    console.error('process-generations', error instanceof Error ? error.message : error);
    return errorResponse(500, 'internal', 'Kuyruk işlenemedi');
  }
});
