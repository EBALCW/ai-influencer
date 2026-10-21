import { notFound } from 'next/navigation';
import { sections } from './sections';

/**
 * Bölüm doğrulaması burada, sayfanın loading (Suspense) sınırının DIŞINDA yapılır.
 * Panel layout'u oturum yüzünden dinamik olduğu için sayfa stream edilir; notFound()
 * Suspense içinde kalırsa HTTP durumu 200 olarak gitmiş olur. Layout'ta ise 404 döner.
 */
export default async function SectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!Object.hasOwn(sections, section)) notFound();
  return children;
}
