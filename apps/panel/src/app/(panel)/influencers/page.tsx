import { InfluencerList } from './influencer-list';
import { getInfluencerList } from '@/lib/influencers';

export default async function InfluencersPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string }>;
}) {
  const [{ inf = '' }, influencers] = await Promise.all([
    searchParams,
    getInfluencerList({ includeArchived: true }),
  ]);
  return <InfluencerList influencers={influencers} selectedSlug={inf} />;
}
