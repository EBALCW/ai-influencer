import { notFound } from 'next/navigation';
import type { Row } from '@ai-influencer/shared';
import { requireTeamMember } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AssetManager } from './asset-manager';

export default async function InfluencerAssetsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, member, supabase] = await Promise.all([
    params,
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

  const { data: assets, error } = await supabase
    .from('assets')
    .select('*')
    .eq('influencer_id', influencer.id)
    .order('created_at', { ascending: false })
    .range(0, 99);
  if (error) throw new Error('Medya kütüphanesi alınamadı.');

  const items = await Promise.all(
    (assets ?? []).map(async (asset) => {
      const { data } = await supabase.storage
        .from('assets')
        .createSignedUrl(asset.storage_path, 600);
      return { asset: asset as Row<'assets'>, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <AssetManager
      assets={items}
      avatarAssetId={influencer.avatar_asset_id}
      canEdit={member.role !== 'viewer'}
      hasMore={(assets?.length ?? 0) === 100}
      influencerId={influencer.id}
    />
  );
}
