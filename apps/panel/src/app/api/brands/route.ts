import { NextResponse } from 'next/server';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { brandDbError, refreshBrands } from '@/lib/brands/api';
import { brandSchema } from '@/lib/brands/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Marka (veya hedef marka) ekler. En az editor; created_by trigger'dan gelir. */
export async function POST(request: Request) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const body = await parseJson(request, brandSchema);
    if (!body.ok) return body.response;
    const brand = body.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('brands')
      .insert({
        name: brand.name,
        website: brand.website ?? null,
        contact_name: brand.contactName ?? null,
        contact_email: brand.contactEmail ?? null,
        notes: brand.notes,
      })
      .select('id')
      .single();
    if (error) return brandDbError(error);
    refreshBrands();
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
