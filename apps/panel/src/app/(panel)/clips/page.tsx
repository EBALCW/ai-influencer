import { notFound } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { getClipsWorkspace } from '@/lib/clips/queries';
import { clipsQuerySchema } from '@/lib/clips/schemas';
import { ClipsView } from './clips-view';

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const inf = Array.isArray(params.inf) ? params.inf[0] : params.inf;
  const filter = clipsQuerySchema.safeParse({ inf });
  if (!filter.success) notFound();
  const workspace = await getClipsWorkspace(filter.data);
  if (!workspace) notFound();
  return (
    <ClipsView workspace={workspace} canWrite={member.role !== 'viewer'} />
  );
}
