import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { toPersonaInput, type PersonaInput } from './persona';
import { createSupabaseServerClient } from './supabase/server';
import { CHARACTER_PROMPT_KEY } from './influencer-wizard-prompt';

export type InfluencerWizardDraft = {
  id: string;
  name: string;
  slug: string;
  niche: string | null;
  language: string;
  persona: PersonaInput | null;
  promptBody: string | null;
  referenceCount: number;
  avatarAssetId: string | null;
};

async function loadDraft(
  query: (
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) => PromiseLike<{
    data: Row<'influencers'> | null;
    error: { message: string } | null;
  }>,
) {
  const supabase = await createSupabaseServerClient();
  const { data: influencer, error } = await query(supabase);
  if (error) throw new Error(`Taslak alınamadı: ${error.message}`);
  if (!influencer || influencer.status !== 'draft') return null;

  const [
    { data: persona, error: personaError },
    { data: prompt, error: promptError },
    { count: referenceCount, error: assetsError },
  ] = await Promise.all([
    supabase
      .from('influencer_personas')
      .select('*')
      .eq('influencer_id', influencer.id)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('prompts')
      .select('body')
      .eq('influencer_id', influencer.id)
      .eq('category', 'character')
      .eq('key', CHARACTER_PROMPT_KEY)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('influencer_id', influencer.id)
      .eq('kind', 'reference'),
  ]);
  const stepError = personaError ?? promptError ?? assetsError;
  if (stepError)
    throw new Error(`Taslak adımları alınamadı: ${stepError.message}`);

  return {
    id: influencer.id,
    name: influencer.name,
    slug: influencer.slug,
    niche: influencer.niche,
    language: influencer.language,
    persona: persona ? toPersonaInput(persona) : null,
    promptBody: prompt?.body ?? null,
    referenceCount: referenceCount ?? 0,
    avatarAssetId: influencer.avatar_asset_id,
  } satisfies InfluencerWizardDraft;
}

export function getWizardDraftBySlug(slug: string) {
  return loadDraft((supabase) =>
    supabase.from('influencers').select('*').eq('slug', slug).maybeSingle(),
  );
}

export function getWizardDraftById(id: string) {
  return loadDraft((supabase) =>
    supabase.from('influencers').select('*').eq('id', id).maybeSingle(),
  );
}
