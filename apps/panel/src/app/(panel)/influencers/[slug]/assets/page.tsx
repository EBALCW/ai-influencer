import { notFound } from 'next/navigation';
import { fetchAssetPage, signAssetItems } from '@/lib/assets/storage';
import { requireTeamMember } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AssetManager } from './asset-manager';

export default async function InfluencerAssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ wizard?: string }>;
}) {
  const [{ slug }, query, member, supabase] = await Promise.all([
    params,
    searchParams,
    requireTeamMember(),
    createSupabaseServerClient(),
  ]);
  const { data: influencer, error: influencerError } = await supabase
    .from('influencers')
    .select('id, avatar_asset_id')
    .eq('slug', slug)
    .maybeSingle();
  if (influencerError) throw new Error('Influencer bilgisi alınamadı.');
  if (!influencer) notFound();

  const page = await fetchAssetPage(supabase, influencer.id);
  const items = await signAssetItems(supabase, page.assets);

  const returnTo =
    query.wizard === '4' || query.wizard === '5'
      ? `/influencers/${encodeURIComponent(slug)}/setup?step=${query.wizard}`
      : undefined;

  return (
    <AssetManager
      assets={items}
      avatarAssetId={influencer.avatar_asset_id}
      canEdit={member.role !== 'viewer'}
      hasMore={page.hasMore}
      influencerId={influencer.id}
      returnTo={returnTo}
    />
  );
}
