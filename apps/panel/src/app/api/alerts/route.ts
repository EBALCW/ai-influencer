import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { listAlerts } from '@/lib/alerts/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

/** Bildirim merkezi: son uyarılar + kişi başı okunmamış sayısı. Ekipteki herkes okur. */
export async function GET(request: Request) {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;
  const raw = new URL(request.url).searchParams.get('limit');
  const limit = limitSchema.safeParse(raw ?? undefined);
  if (!limit.success) return jsonError('Geçersiz limit.', 400);
  try {
    const db = await createSupabaseServerClient();
    const data = await listAlerts(db, limit.data);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
