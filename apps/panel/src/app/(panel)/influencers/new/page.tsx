import { notFound, redirect } from 'next/navigation';
import { InfluencerWizard } from '../wizard-client';
import { requireTeamMember } from '@/lib/auth';
import { getWizardDraftById } from '@/lib/influencer-wizard-data';

export default async function NewInfluencerPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; step?: string }>;
}) {
  const [query, member] = await Promise.all([searchParams, requireTeamMember()]);
  if (member.role === 'viewer') redirect('/influencers');
  const draft = query.draft ? await getWizardDraftById(query.draft) : null;
  if (query.draft && !draft) notFound();
  return (
    <InfluencerWizard
      initial={draft}
      initialStep={Number(query.step) || (draft ? (draft.persona ? 3 : 2) : 1)}
    />
  );
}
