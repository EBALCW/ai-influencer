import { notFound } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { getResearchWorkspace } from '@/lib/research/queries';
import { researchQuerySchema } from '@/lib/research/schemas';
import { ResearchView } from './research-view';

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const single = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const filter = researchQuerySchema.safeParse(single);
  if (!filter.success) notFound();
  const workspace = await getResearchWorkspace(filter.data);
  if (!workspace) notFound();
  return (
    <ResearchView
      workspace={workspace}
      filter={filter.data}
      canWrite={member.role !== 'viewer'}
    />
  );
}
