// sync-dispatch (#53): pg_cron/pg_net (ve panelden "Şimdi senkronize et" → public.request_sync)
// tarafından `x-cron-secret` ile çağrılır. Gövde: { job: 'metrics'|'posts'|'accounts'|'manual',
// account_id?: uuid }. İş arka planda sürer (EdgeRuntime.waitUntil), yanıt hemen 202 döner.
import { errorResponse, json, requireCronSecret } from '../_shared/http.ts';
import {
  type CollectorRegistry,
  collectors,
} from '../_shared/collectors/index.ts';
import { runSync, type SyncSummary } from '../_shared/sync/orchestrator.ts';
import type { SyncJob, SyncStore } from '../_shared/sync/store.ts';
import { createSupabaseStore } from '../_shared/sync/supabase-store.ts';

const JOBS: readonly SyncJob[] = ['metrics', 'posts', 'accounts', 'manual'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface HandlerDeps {
  secret?: string | null;
  createStore: () => SyncStore;
  collectors: CollectorRegistry;
  fetch: typeof fetch;
  /** Varsa iş arka planda sürer ve 202 döner; yoksa sonuç beklenir (testler). */
  waitUntil?: (task: Promise<unknown>) => void;
}

export function parseBody(
  body: unknown,
): { job: SyncJob; accountId?: string } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { job, account_id: accountId } = body as Record<string, unknown>;
  if (typeof job !== 'string' || !JOBS.includes(job as SyncJob)) return null;
  if (accountId === undefined || accountId === null)
    return { job: job as SyncJob };
  if (typeof accountId !== 'string' || !UUID.test(accountId)) return null;
  return { job: job as SyncJob, accountId };
}

export function createHandler(deps: HandlerDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST')
      return errorResponse(405, 'method_not_allowed', 'Yalnız POST');
    const denied =
      deps.secret === undefined
        ? requireCronSecret(req)
        : requireCronSecret(req, deps.secret);
    if (denied) return denied;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return errorResponse(400, 'invalid_json', 'Geçersiz JSON gövdesi');
    }
    const body = parseBody(raw);
    if (!body)
      return errorResponse(400, 'invalid_body', 'Geçersiz iş veya hesap');

    let store: SyncStore;
    try {
      store = deps.createStore();
    } catch (error) {
      console.error(
        'sync-dispatch yapılandırması eksik',
        error instanceof Error ? error.message : '',
      );
      return errorResponse(
        503,
        'not_configured',
        'Fonksiyon yapılandırılmamış',
      );
    }

    const task = runSync(
      body.job,
      { store, collectors: deps.collectors, fetch: deps.fetch },
      {
        accountId: body.accountId,
      },
    ).then((summary: SyncSummary) => {
      console.log(
        `sync ${summary.job}: ${summary.runs.length} hesap, ${summary.skipped.length} atlandı, ` +
          `${summary.runs.filter((r) => r.status === 'failed').length} başarısız`,
      );
      return summary;
    });

    if (deps.waitUntil) {
      deps.waitUntil(
        task.catch((error) =>
          console.error(
            'sync-dispatch başarısız',
            error instanceof Error ? error.message : '',
          ),
        ),
      );
      return json({ accepted: true, job: body.job }, 202);
    }
    try {
      return json(await task);
    } catch (error) {
      console.error(
        'sync-dispatch başarısız',
        error instanceof Error ? error.message : '',
      );
      return errorResponse(500, 'sync_failed', 'Senkronizasyon tamamlanamadı');
    }
  };
}

type EdgeRuntimeGlobal = {
  EdgeRuntime?: { waitUntil(p: Promise<unknown>): void };
};

if (import.meta.main) {
  const runtime = (globalThis as EdgeRuntimeGlobal).EdgeRuntime;
  Deno.serve(
    createHandler({
      createStore: () => {
        const url = Deno.env.get('SUPABASE_URL');
        const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!url || !key)
          throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok');
        return createSupabaseStore(url, key);
      },
      collectors,
      fetch: globalThis.fetch.bind(globalThis),
      waitUntil: runtime ? (p) => runtime.waitUntil(p) : undefined,
    }),
  );
}
