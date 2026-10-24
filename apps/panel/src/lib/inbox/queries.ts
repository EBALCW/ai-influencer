import 'server-only';
import type { SocialPlatform } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CommentStatus, InboxQuery } from './schemas';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const INBOX_LIMIT = 100;

export type InboxReply = {
  id: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: string;
};

export type InboxComment = {
  id: string;
  platform: SocialPlatform;
  authorName: string;
  text: string;
  publishedAt: string;
  likeCount: number | null;
  isBrandInquiry: boolean;
  status: CommentStatus;
  repliedAt: string | null;
  brandDealId: string | null;
  post: { id: string; url: string | null; caption: string };
  account: { handle: string };
  influencer: { id: string; name: string; slug: string; language: string };
  /** En yeni yanıt denemesi (kuyruk durumu). */
  reply: InboxReply | null;
};

export type InboxData = {
  influencers: { id: string; name: string; slug: string }[];
  influencer: { id: string; name: string; slug: string } | null;
  brands: { id: string; name: string }[];
  comments: InboxComment[];
  newCount: number;
  truncated: boolean;
  postFilter: { id: string; caption: string } | null;
};

function check(error: { message: string } | null) {
  if (error) throw new Error(`Gelen kutusu okunamadı: ${error.message}`);
}

/** Filtreli yorum listesi (RLS: ekip okur). En yeni INBOX_LIMIT yorum. */
export async function getInbox(
  query: InboxQuery,
  now: Date = new Date(),
): Promise<InboxData> {
  const db: Supabase = await createSupabaseServerClient();
  const [influencers, brands] = await Promise.all([
    db
      .from('influencers')
      .select('id, name, slug')
      .neq('status', 'archived')
      .order('name'),
    db.from('brands').select('id, name').order('name').limit(500),
  ]);
  check(influencers.error);
  check(brands.error);
  const influencer =
    influencers.data?.find((item) => item.slug === query.inf) ?? null;

  const empty: InboxData = {
    influencers: influencers.data ?? [],
    influencer,
    brands: brands.data ?? [],
    comments: [],
    newCount: 0,
    truncated: false,
    postFilter: null,
  };

  let accountIds: string[] | null = null;
  if (influencer) {
    const accounts = await db
      .from('social_accounts')
      .select('id')
      .eq('influencer_id', influencer.id);
    check(accounts.error);
    accountIds = (accounts.data ?? []).map((a) => a.id);
    if (accountIds.length === 0) return empty;
  }

  const since = new Date(now.getTime() - query.days * 86_400_000).toISOString();
  let list = db
    .from('comments')
    .select(
      'id, platform, author_name, text, published_at, like_count, is_brand_inquiry, status, replied_at, brand_deal_id, posts(id, url, caption), social_accounts(handle, influencers(id, name, slug, language)), comment_replies(id, body, status, error, created_at)',
    )
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .order('created_at', {
      referencedTable: 'comment_replies',
      ascending: false,
    })
    .limit(INBOX_LIMIT + 1);
  let unread = db
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')
    .gte('published_at', since);
  if (accountIds) {
    list = list.in('account_id', accountIds);
    unread = unread.in('account_id', accountIds);
  }
  if (query.platform) {
    list = list.eq('platform', query.platform);
    unread = unread.eq('platform', query.platform);
  }
  if (query.post) list = list.eq('post_id', query.post);
  if (query.view === 'unanswered') list = list.in('status', ['new', 'read']);
  else if (query.view === 'brand')
    list = list.eq('is_brand_inquiry', true).neq('status', 'hidden');
  else if (query.view === 'hidden') list = list.eq('status', 'hidden');
  else list = list.neq('status', 'hidden');

  const [rows, count] = await Promise.all([list, unread]);
  check(rows.error);
  check(count.error);

  type Row = {
    id: string;
    platform: SocialPlatform;
    author_name: string;
    text: string;
    published_at: string;
    like_count: number | null;
    is_brand_inquiry: boolean;
    status: string;
    replied_at: string | null;
    brand_deal_id: string | null;
    posts: { id: string; url: string | null; caption: string } | null;
    social_accounts: {
      handle: string;
      influencers: {
        id: string;
        name: string;
        slug: string;
        language: string;
      } | null;
    } | null;
    comment_replies: {
      id: string;
      body: string;
      status: string;
      error: string | null;
      created_at: string;
    }[];
  };
  const data = (rows.data ?? []) as unknown as Row[];
  const comments = data.slice(0, INBOX_LIMIT).flatMap((r): InboxComment[] => {
    const inf = r.social_accounts?.influencers;
    if (!r.posts || !inf) return [];
    const latest = r.comment_replies[0];
    return [
      {
        id: r.id,
        platform: r.platform,
        authorName: r.author_name,
        text: r.text,
        publishedAt: r.published_at,
        likeCount: r.like_count,
        isBrandInquiry: r.is_brand_inquiry,
        status: r.status as CommentStatus,
        repliedAt: r.replied_at,
        brandDealId: r.brand_deal_id,
        post: r.posts,
        account: { handle: r.social_accounts!.handle },
        influencer: inf,
        reply: latest
          ? {
              id: latest.id,
              body: latest.body,
              status: latest.status,
              error: latest.error,
              createdAt: latest.created_at,
            }
          : null,
      },
    ];
  });

  let postFilter: InboxData['postFilter'] = null;
  if (query.post) {
    const post = await db
      .from('posts')
      .select('id, caption')
      .eq('id', query.post)
      .maybeSingle();
    check(post.error);
    postFilter = post.data;
  }

  return {
    ...empty,
    comments,
    newCount: count.count ?? 0,
    truncated: data.length > INBOX_LIMIT,
    postFilter,
  };
}
