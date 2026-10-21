import { notFound, redirect } from 'next/navigation';
import { InfluencerWizard } from '../../wizard-client';
import { requireTeamMember } from '@/lib/auth';
import { getWizardDraftBySlug } from '@/lib/influencer-wizard-data';

export default async function InfluencerSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ slug }, query, member] = await Promise.all([
    params,
    searchParams,
    requireTeamMember(),
  ]);
  if (member.role === 'viewer') redirect('/influencers');
  const draft = await getWizardDraftBySlug(slug);
  if (!draft) notFound();
  return (
    <InfluencerWizard
      initial={draft}
      initialStep={Number(query.step) || (draft.persona ? 3 : 2)}
    />
  );
}
