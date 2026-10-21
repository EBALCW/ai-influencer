'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireTeamMember } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function updateInfluencerStatus(formData: FormData) {
  const member = await requireTeamMember();
  if (member.role === 'viewer')
    throw new Error('Bu işlem için düzenleme yetkisi gerekir.');
  const input = z
    .object({
      id: z.uuid(),
      status: z.enum(['active', 'paused', 'archived']),
    })
    .safeParse({ id: formData.get('id'), status: formData.get('status') });
  if (!input.success) throw new Error('Influencer güncelleme isteği geçersiz.');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('influencers')
    .update({ status: input.data.status })
    .eq('id', input.data.id);
  if (error) throw new Error(`Durum güncellenemedi: ${error.message}`);
  revalidatePath('/influencers');
  revalidatePath('/influencers/[slug]', 'page');
}
