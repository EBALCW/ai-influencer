import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { isIsoDate } from '@/lib/reports/weekly';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const generateSchema = z.object({
  periodStart: z.string().refine(isIsoDate),
  influencerId: z.string().uuid().nullable(),
});

/**
 * Tek tıkla haftalık rapor: POST /api/reports { periodStart, influencerId | null }.
 * Sayılar veritabanında `generate_weekly_report()` ile hesaplanır (RLS geçerli).
 * Aynı hafta tekrar istenirse aynı rapor güncellenir.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, generateSchema);
  if (!body.ok) return body.response;

  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc('generate_weekly_report', {
      p_period_start: body.data.periodStart,
      ...(body.data.influencerId
        ? { p_influencer_id: body.data.influencerId }
        : {}),
    });
    if (error) {
      if (error.code === '22023')
        return jsonError(
          'Rapor dönemi pazartesi başlamalı ve gelecekte olmamalı.',
          400,
        );
      if (error.code === 'P0002')
        return jsonError('Influencer bulunamadı.', 404);
      if (error.code === '42501')
        return jsonError('editor yetkisi gerekli.', 403);
      return apiError(error);
    }
    revalidatePath('/analytics/reports');
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
