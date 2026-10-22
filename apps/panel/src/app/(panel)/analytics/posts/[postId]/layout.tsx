import { notFound } from 'next/navigation';
import { z } from 'zod';
import { postExists } from '@/lib/analytics/queries';

/** Post doğrulaması sayfa stream edilmeden önce çalışır; istemciye gerçek 404 döner. */
export default async function PostDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  if (!z.uuid().safeParse(postId).success) notFound();
  if (!(await postExists(postId))) notFound();
  return children;
}
