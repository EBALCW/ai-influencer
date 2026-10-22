import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireTeamMember } from '@/lib/auth';
import { getDealDetail } from '@/lib/brands/queries';
import { loadReplyTemplates } from '@/lib/brands/templates-server';
import { DealDetailView } from './deal-detail';

export default async function DealPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const [member, { dealId }] = await Promise.all([requireTeamMember(), params]);
  // Layout ile paralel render edilebilir; geçersiz id'yi veritabanına göndermeden ele
  if (!z.uuid().safeParse(dealId).success) notFound();
  const [detail, templates] = await Promise.all([
    getDealDetail(dealId),
    loadReplyTemplates(),
  ]);
  if (!detail) notFound();
  return (
    <DealDetailView detail={detail} role={member.role} templates={templates} />
  );
}
