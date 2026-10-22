// comments-dispatch (#61): pg_cron/pg_net tarafından `x-cron-secret` ile çağrılır.
// Gövde: { job: 'fetch' | 'reply' }.
//   fetch → son 7 günün postlarındaki yorumları toplar (private.invoke_comments('fetch'))
//   reply → kuyruktaki yanıtları gönderir (yeni yanıtta trigger + 5 dk'da bir cron)
// İş arka planda sürer (EdgeRuntime.waitUntil), yanıt hemen 202 döner.
import { errorResponse, json, requireCronSecret } from '../_shared/http.ts';
import {
  type CommentAdapterRegistry,
  commentAdapters,
} from '../_shared/comments/index.ts';
import { fetchComments, sendReplies } from '../_shared/comments/runner.ts';
import type { CommentStore } from '../_shared/comments/store.ts';
import { createSupabaseCommentStore } from '../_shared/comments/supabase-store.ts';

export type CommentsJob = 'fetch' | 'reply';
const JOBS: readonly CommentsJob[] = ['fetch', 'reply'];

export interface HandlerDeps {
  secret?: string | null;
  createStore: () => CommentStore;
  adapters: CommentAdapterRegistry;
  fetch: typeof fetch;
  waitUntil?: (task: Promise<unknown>) => void;
}

export function parseBody(body: unknown): { job: CommentsJob } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { job } = body as Record<string, unknown>;
  if (typeof job !== 'string' || !JOBS.includes(job as CommentsJob))
    return null;
  return { job: job as CommentsJob };
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
    if (!body) return errorResponse(400, 'invalid_body', 'Geçersiz iş');

    let store: CommentStore;
    try {
      store = deps.createStore();
    } catch (error) {
      console.error(
        'comments-dispatch yapılandırması eksik',
        error instanceof Error ? error.message : '',
      );
      return errorResponse(
        503,
        'not_configured',
        'Fonksiyon yapılandırılmamış',
      );
    }

    const runDeps = { store, adapters: deps.adapters, fetch: deps.fetch };
    const task: Promise<unknown> =
      body.job === 'fetch'
        ? fetchComments(runDeps).then((summary) => {
            console.log(
              `comments fetch: ${summary.runs.length} hesap, ${summary.skipped.length} atlandı, ` +
                `${summary.runs.filter((r) => r.status === 'failed').length} başarısız`,
            );
            return summary;
          })
        : sendReplies(runDeps).then((summary) => {
            console.log(
              `comments reply: ${summary.sent} gönderildi, ${summary.failed} başarısız, ` +
                `${summary.requeued} yeniden sırada`,
            );
            return summary;
          });

    if (deps.waitUntil) {
      deps.waitUntil(
        task.catch((error) =>
          console.error(
            'comments-dispatch başarısız',
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
        'comments-dispatch başarısız',
        error instanceof Error ? error.message : '',
      );
      return errorResponse(500, 'comments_failed', 'Yorum işi tamamlanamadı');
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
        return createSupabaseCommentStore(url, key);
      },
      adapters: commentAdapters,
      fetch: globalThis.fetch.bind(globalThis),
      waitUntil: runtime ? (p) => runtime.waitUntil(p) : undefined,
    }),
  );
}
