import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Slug doğrulaması sayfa stream edilmeden önce çalışır; istemciye 404 döner. */
export default async function InfluencerSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('influencers')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Influencer doğrulanamadı: ${error.message}`);
  if (!data) notFound();
  return children;
}
