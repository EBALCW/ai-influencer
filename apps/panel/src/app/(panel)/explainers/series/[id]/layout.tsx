import { notFound } from 'next/navigation';
import { parseId } from '@/lib/explainer/api';
import { exists } from '@/lib/explainer/queries';

/** Kimlik doğrulaması sayfa stream edilmeden önce çalışır; başka alanın serisi de 404 döner. */
export default async function SeriesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const id = parseId((await params).id);
  if (!id || !(await exists('series', id))) notFound();
  return children;
}
