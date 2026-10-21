import { InfluencerList } from './influencer-list';
import { getInfluencerList } from '@/lib/influencers';
import { requireTeamMember } from '@/lib/auth';

export default async function InfluencersPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string }>;
}) {
  const [{ inf = '' }, influencers, member] = await Promise.all([
    searchParams,
    getInfluencerList({ includeArchived: true }),
    requireTeamMember(),
  ]);
  return (
    <InfluencerList
      canEdit={member.role !== 'viewer'}
      influencers={influencers}
      selectedSlug={inf}
    />
  );
}
