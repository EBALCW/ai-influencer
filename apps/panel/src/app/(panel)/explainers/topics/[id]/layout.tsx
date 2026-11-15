import { notFound } from 'next/navigation';
import { parseId } from '@/lib/explainer/api';
import { exists } from '@/lib/explainer/queries';

/** Kimlik doğrulaması sayfa stream edilmeden önce çalışır; başka alanın isteği de 404 döner. */
export default async function TopicRequestLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const id = parseId((await params).id);
  if (!id || !(await exists('topic_requests', id))) notFound();
  return children;
}
