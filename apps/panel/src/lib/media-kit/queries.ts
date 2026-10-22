import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MEDIA_KIT_WINDOW_DAYS, type MediaKitInput } from './build';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** PostgREST satır sınırı (config.toml max_rows = 1000); sayfalı okunur. */
const PAGE = 1000;
const MAX_PAGES = 20;

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(`Medya kiti verisi alınamadı: ${error.message}`);
}

async function readAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await fetchPage(
      page * PAGE,
      page * PAGE + PAGE - 1,
    );
    throwOnError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
  throw new Error('Medya kiti verisi çok büyük; dönem daraltılmalı.');
}

async function chunked<T>(
  ids: string[],
  load: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = [];
  for (let i = 0; i < ids.length; i += 100)
    result.push(...(await load(ids.slice(i, i + 100))));
  return result;
}

/**
 * Medya kiti için ham veriler (RLS geçerli). Influencer görünmüyorsa null.
 * Takipçi değişimi için dönem başından önceki son ölçüm de gerekir; bu yüzden hesap
 * ölçümleri dönem başından bir pencere öncesine kadar okunur.
 */
export async function loadMediaKitInput(
  slug: string,
  asOf: Date = new Date(),
  supabaseClient?: Supabase,
): Promise<MediaKitInput | null> {
  const supabase = supabaseClient ?? (await createSupabaseServerClient());
  const { data: influencer, error } = await supabase
    .from('influencers')
    .select('id, name, slug, niche')
    .eq('slug', slug)
    .maybeSingle();
  throwOnError(error);
  if (!influencer) return null;

  const end = asOf.toISOString();
  const windowMs = MEDIA_KIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const start = new Date(asOf.getTime() - windowMs).toISOString();
  const snapshotFrom = new Date(asOf.getTime() - 3 * windowMs).toISOString();

  const [persona, accounts] = await Promise.all([
    supabase
      .from('influencer_personas')
      .select('bio')
      .eq('influencer_id', influencer.id)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('social_accounts')
      .select('id, platform, handle')
      .eq('influencer_id', influencer.id)
      .order('platform'),
  ]);
  throwOnError(persona.error);
  throwOnError(accounts.error);
  const accountIds = (accounts.data ?? []).map((account) => account.id);

  const [accountSnapshots, posts] = accountIds.length
    ? await Promise.all([
        readAll((from, to) =>
          supabase
            .from('account_snapshots')
            .select('account_id, captured_at, followers')
            .in('account_id', accountIds)
            .gte('captured_at', snapshotFrom)
            .lte('captured_at', end)
            .order('captured_at', { ascending: false })
            .range(from, to),
        ),
        readAll((from, to) =>
          supabase
            .from('posts')
            .select('id, account_id, caption, url, published_at')
            .in('account_id', accountIds)
            .gt('published_at', start)
            .lte('published_at', end)
            .order('published_at', { ascending: false })
            .range(from, to),
        ),
      ])
    : [[], []];

  const metricSnapshots = await chunked(
    posts.map((post) => post.id),
    (ids) =>
      readAll((from, to) =>
        supabase
          .from('metric_snapshots')
          .select(
            'post_id, captured_at, views, likes, comments, shares, saves, avg_watch_time_s',
          )
          .in('post_id', ids)
          .lte('captured_at', end)
          .order('captured_at', { ascending: false })
          .range(from, to),
      ),
  );

  return {
    asOf: end,
    influencer: {
      name: influencer.name,
      slug: influencer.slug,
      niche: influencer.niche,
      bio: persona.data?.bio?.trim() || null,
    },
    accounts: accounts.data ?? [],
    accountSnapshots,
    posts,
    metricSnapshots,
  };
}
