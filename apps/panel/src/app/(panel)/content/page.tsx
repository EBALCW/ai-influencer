import { requireTeamMember } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { getContentWorkspace } from '@/lib/content/queries';
import { workspaceQuerySchema } from '@/lib/content/schemas';
import { ContentBoard } from './workspace';

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string; page?: string; source?: string }>;
}) {
  const [member, params] = await Promise.all([
    requireTeamMember(),
    searchParams,
  ]);
  const parsed = workspaceQuerySchema.safeParse(params);
  if (!parsed.success) notFound();
  const workspace = await getContentWorkspace({
    slug: parsed.data.inf,
    page: parsed.data.page,
    role: member.role,
    sourceMissing: parsed.data.source === 'missing',
  });
  return <ContentBoard workspace={workspace} />;
}
