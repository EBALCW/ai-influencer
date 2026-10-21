import 'server-only';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import type { Row, TeamRole } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { detailSchema, type ContentDetails } from './schemas';

export type ContentCard = Row<'content_items'> & { details: ContentDetails };
export type ContentWorkspace = {
  items: ContentCard[];
  count: number;
  page: number;
  role: TeamRole;
  slug: string;
  influencers: Array<Pick<Row<'influencers'>, 'id' | 'name' | 'slug'>>;
  accounts: Array<
    Pick<Row<'social_accounts'>, 'id' | 'influencer_id' | 'platform' | 'handle'>
  >;
  members: Array<Pick<Row<'team_members'>, 'user_id' | 'role'>>;
  assets: Array<
    Pick<Row<'assets'>, 'id' | 'influencer_id' | 'kind' | 'version_tag'>
  >;
  generations: Array<
    Pick<
      Row<'generations'>,
      'id' | 'influencer_id' | 'type' | 'tool' | 'status'
    >
  >;
  posts: Array<
    Pick<
      Row<'posts'>,
      'id' | 'account_id' | 'url' | 'published_at' | 'content_item_id'
    >
  >;
  slots: Row<'posting_slots'>[];
};
function check(error: { message: string } | null) {
  if (error) throw new Error('İçerik verileri alınamadı.');
}
export async function getContentWorkspace(options: {
  slug?: string;
  page?: number;
  role: TeamRole;
  from?: string;
  to?: string;
}): Promise<ContentWorkspace> {
  const supabase = await createSupabaseServerClient();
  const influencers = await supabase
    .from('influencers')
    .select('id,name,slug')
    .order('name');
  check(influencers.error);
  const selected = options.slug
    ? (influencers.data?.find((i) => i.slug === options.slug)?.id ??
      '00000000-0000-0000-0000-000000000000')
    : null;
  if (options.slug && selected === '00000000-0000-0000-0000-000000000000')
    notFound();
  let itemQuery = supabase
    .from('content_items')
    .select('*', { count: 'exact' })
    .order('sort_order')
    .order('created_at', { ascending: false })
    .order('id');
  let accountQuery = supabase
    .from('social_accounts')
    .select('id,influencer_id,platform,handle')
    .order('handle');
  let assetQuery = supabase
    .from('assets')
    .select('id,influencer_id,kind,version_tag')
    .order('created_at', { ascending: false })
    .limit(200);
  let generationQuery = supabase
    .from('generations')
    .select('id,influencer_id,type,tool,status')
    .order('created_at', { ascending: false })
    .limit(200);
  if (selected) {
    itemQuery = itemQuery.eq('influencer_id', selected);
    accountQuery = accountQuery.eq('influencer_id', selected);
    assetQuery = assetQuery.eq('influencer_id', selected);
    generationQuery = generationQuery.eq('influencer_id', selected);
  }
  if (options.from) itemQuery = itemQuery.gte('scheduled_at', options.from);
  if (options.to) itemQuery = itemQuery.lt('scheduled_at', options.to);
  const page = options.page ?? 1;
  const [items, accounts, members, assets, generations] = await Promise.all([
    itemQuery.range((page - 1) * 100, page * 100 - 1),
    accountQuery,
    supabase.from('team_members').select('user_id,role').order('user_id'),
    assetQuery,
    generationQuery,
  ]);
  for (const r of [items, accounts, members, assets, generations])
    check(r.error);
  const accountIds = accounts.data?.map((a) => a.id) ?? [];
  const [details, posts, slots] = await Promise.all([
    supabase.rpc('content_item_details', {
      p_ids: items.data?.map((item) => item.id) ?? [],
    }),
    accountIds.length
      ? supabase
          .from('posts')
          .select('id,account_id,url,published_at,content_item_id')
          .in('account_id', accountIds)
          .not('published_at', 'is', null)
          .order('published_at', { ascending: false })
          .limit(200)
      : { data: [], error: null },
    accountIds.length
      ? supabase
          .from('posting_slots')
          .select('*')
          .in('account_id', accountIds)
          .order('weekday')
          .order('local_time')
      : { data: [], error: null },
  ]);
  for (const r of [details, posts, slots]) check(r.error);
  const parsed = z.array(detailSchema).parse(details.data ?? []);
  const byId = new Map(parsed.map((d) => [d.id, d]));
  return {
    items: (items.data ?? []).map((item) => ({
      ...item,
      details: byId.get(item.id) ?? {
        id: item.id,
        warnings: [],
        asset_ids: [],
        generation_ids: [],
        posts: [],
      },
    })),
    count: items.count ?? 0,
    page,
    role: options.role,
    slug: options.slug ?? '',
    influencers: influencers.data ?? [],
    accounts: accounts.data ?? [],
    members: members.data ?? [],
    assets: assets.data ?? [],
    generations: generations.data ?? [],
    posts: posts.data ?? [],
    slots: slots.data ?? [],
  };
}
