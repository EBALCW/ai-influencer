import { notFound } from 'next/navigation';
import { z } from 'zod';
import { dealExists } from '@/lib/brands/queries';

/** Deal doğrulaması sayfa stream edilmeden önce çalışır; istemciye gerçek 404 döner. */
export default async function DealLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  if (!z.uuid().safeParse(dealId).success) notFound();
  if (!(await dealExists(dealId))) notFound();
  return children;
}
