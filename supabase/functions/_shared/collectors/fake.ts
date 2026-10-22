// Testler için sahte toplayıcı. Davranış her çağrı için betiklenebilir; gerçek ağ çağrısı yok.
// Üretim kaydına (`index.ts`) eklenmez.
import type {
  CollectedAccount,
  CollectedMetrics,
  CollectedPost,
  Collector,
  CollectorContext,
  PostRef,
  SocialPlatform,
} from './types.ts';

type Step<T> = T | Error | (() => T | Promise<T>);

export interface FakeCollectorScript {
  account?: Step<CollectedAccount>[];
  posts?: Step<CollectedPost[]>[];
  /** externalId → sıralı yanıtlar; son yanıt tekrar kullanılır. */
  metrics?: Record<string, Step<CollectedMetrics | null>[]>;
  /** Her çağrıda harcanan kota birimi. */
  quotaPerCall?: number;
}

export interface FakeCollector extends Collector {
  calls: { method: string; arg?: string }[];
}

async function play<T>(
  steps: Step<T>[] | undefined,
  index: number,
  fallback: T,
) {
  if (!steps || steps.length === 0) return fallback;
  const step = steps[Math.min(index, steps.length - 1)];
  if (step instanceof Error) throw step;
  if (typeof step === 'function') return await (step as () => T | Promise<T>)();
  return step as T;
}

export function createFakeCollector(
  platform: SocialPlatform,
  script: FakeCollectorScript = {},
): FakeCollector {
  const counters = new Map<string, number>();
  const next = (key: string) => {
    const n = counters.get(key) ?? 0;
    counters.set(key, n + 1);
    return n;
  };
  const calls: FakeCollector['calls'] = [];
  const charge = (ctx: CollectorContext) => {
    if (script.quotaPerCall) ctx.reportQuota(script.quotaPerCall);
  };
  return {
    platform,
    calls,
    fetchAccount(ctx) {
      calls.push({ method: 'fetchAccount', arg: ctx.account.id });
      charge(ctx);
      return play(script.account, next('account'), { followers: 0 });
    },
    fetchPosts(ctx) {
      calls.push({ method: 'fetchPosts', arg: ctx.account.id });
      charge(ctx);
      return play(script.posts, next('posts'), []);
    },
    fetchPostMetrics(ctx, post: PostRef) {
      calls.push({ method: 'fetchPostMetrics', arg: post.externalId });
      charge(ctx);
      return play(
        script.metrics?.[post.externalId],
        next(`m:${post.externalId}`),
        {
          views: 0,
          raw: {},
        },
      );
    },
  };
}
