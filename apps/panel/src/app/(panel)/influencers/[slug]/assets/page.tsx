import { notFound } from 'next/navigation';
import type { Row } from '@ai-influencer/shared';
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
      const { data: thumbnail } = asset.thumbnail_path
        ? await supabase.storage
            .from('assets')
            .createSignedUrl(asset.thumbnail_path, 600)
        : { data: null };
      return {
        asset: asset as Row<'assets'>,
        url: data?.signedUrl ?? null,
        thumbnailUrl: thumbnail?.signedUrl ?? null,
      };
    }),
  );

  const returnTo =
    query.wizard === '4' || query.wizard === '5'
      ? `/influencers/${encodeURIComponent(slug)}/setup?step=${query.wizard}`
      : undefined;

  return (
    <AssetManager
      assets={items}
      avatarAssetId={influencer.avatar_asset_id}
      canEdit={member.role !== 'viewer'}
      hasMore={(assets?.length ?? 0) === 100}
      influencerId={influencer.id}
      returnTo={returnTo}
    />
  );
}
