import { requireTeamMember } from '@/lib/auth';
import { loadReplyTemplates } from '@/lib/brands/templates-server';
import { getInbox } from '@/lib/inbox/queries';
import { inboxQuerySchema } from '@/lib/inbox/schemas';
import { InboxView } from './inbox-view';

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [member, raw] = await Promise.all([requireTeamMember(), searchParams]);
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const query = inboxQuerySchema.parse({
    inf: first(raw.inf),
    platform: first(raw.platform),
    view: first(raw.view),
    days: first(raw.days),
    post: first(raw.post),
  });
  const canEdit = member.role !== 'viewer';
  const [data, templates] = await Promise.all([
    getInbox(query),
    canEdit ? loadReplyTemplates('comment-replies.md') : Promise.resolve([]),
  ]);
  return (
    <InboxView
      data={data}
      query={query}
      canEdit={canEdit}
      templates={templates}
    />
  );
}
