import { z } from 'zod';
import { platforms } from './metrics';
const count = z.number().int().safe().nonnegative();
const nullable = count.nullable();
const platform = z.enum(platforms);
const ranked = z.object({
  id: z.uuid(),
  caption: z.string(),
  platform,
  views: count,
});
const content = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  stage: z.string(),
  scheduled_at: z.string().nullable(),
});
export const dashboardSchema = z.object({
  validInfluencer: z.boolean(),
  accounts: count,
  followers: nullable,
  followerChange: z.number().int().safe().nullable(),
  accountsMeasured: count,
  views: nullable,
  measuredPostDays: count,
  postsWithoutBaseline: count,
  published: count,
  engagementViews: nullable,
  interactions: nullable,
  postsMeasured: count,
  costs: z.array(
    z.object({
      currency: z.string().length(3),
      total: z.string(),
      perVideo: z.string().nullable(),
    }),
  ),
  daily: z.array(
    z.object({
      day: z.iso.date(),
      views: nullable,
      measured: count,
      engagement_views: nullable,
      interactions: nullable,
      followers: z.array(z.object({ platform, value: nullable })),
    }),
  ),
  best: z.array(ranked),
  worst: z.array(ranked),
  today: z.array(content),
  todayCount: count,
  pending: z.array(content),
  pendingCount: count,
  comparisons: z.array(
    z.object({
      content_item_id: z.uuid(),
      title: z.string(),
      posts: z.array(z.object({ platform, views: nullable, postId: z.uuid() })),
    }),
  ),
});
export type DashboardData = z.infer<typeof dashboardSchema>;
