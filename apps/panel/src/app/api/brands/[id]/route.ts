import { NextResponse } from 'next/server';
import type { Update } from '@ai-influencer/shared';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { brandDbError, idSchema, refreshBrands } from '@/lib/brands/api';
import { brandPatchSchema } from '@/lib/brands/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Marka bilgisi ve araştırma notlarını günceller. En az editor. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return jsonError('Marka bulunamadı.', 404);
    const body = await parseJson(request, brandPatchSchema);
    if (!body.ok) return body.response;

    const patch: Update<'brands'> = {};
    const input = body.data;
    if (input.name !== undefined) patch.name = input.name;
    if (input.website !== undefined) patch.website = input.website;
    if (input.contactName !== undefined) patch.contact_name = input.contactName;
    if (input.contactEmail !== undefined)
      patch.contact_email = input.contactEmail;
    if (input.notes !== undefined) patch.notes = input.notes;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('brands')
      .update(patch)
      .eq('id', id.data)
      .select('id')
      .single();
    if (error) return brandDbError(error);
    refreshBrands();
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return apiError(error);
  }
}
