import 'server-only';
import type { ReplyContext } from '@/lib/ai/schemas';
import type { createSupabaseServerClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * AI yanıt önerisinin bağlamı (#61). RLS ile okunur; yorum bu influencer'ın hesabına ait
 * değilse null (404). Modele yalnız yorum metni, post caption'ı ve persona gider; yorum
 * yazarının adı ve hesap bilgileri gönderilmez.
 */
export async function loadReplyContext(
  db: Supabase,
  influencerId: string,
  input: { commentId: string; language: 'tr' | 'en' },
): Promise<ReplyContext | null> {
  const comment = await db
    .from('comments')
    .select('text, platform, posts(caption), social_accounts(influencer_id)')
    .eq('id', input.commentId)
    .maybeSingle();
  if (comment.error) throw new Error('comment_read');
  if (
    !comment.data ||
    comment.data.social_accounts?.influencer_id !== influencerId
  )
    return null;

  const [influencer, persona] = await Promise.all([
    db
      .from('influencers')
      .select('name, niche')
      .eq('id', influencerId)
      .maybeSingle(),
    db
      .from('influencer_personas')
      .select('tone, bio')
      .eq('influencer_id', influencerId)
      .eq('is_current', true)
      .maybeSingle(),
  ]);
  if (influencer.error || persona.error) throw new Error('persona_read');
  if (!influencer.data) return null;

  return {
    language: input.language,
    persona: {
      name: influencer.data.name,
      niche: influencer.data.niche ?? '',
      tone: persona.data?.tone ?? '',
      bio: persona.data?.bio ?? '',
    },
    post: {
      platform: comment.data.platform,
      caption: (comment.data.posts?.caption ?? '').slice(0, 2000),
    },
    comment: { text: comment.data.text.slice(0, 2000) },
  };
}
