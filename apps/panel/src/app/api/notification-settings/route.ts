import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  notificationSettingsSchema,
  settingsFromRow,
  settingsToRow,
} from '@/lib/alerts/settings-schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Eşik ve kanal ayarları: ekip okur, owner/editor değiştirir. Kanal sırları Vault'ta, burada yok. */
export async function GET() {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('notification_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error) throw new Error(`Bildirim ayarları okunamadı: ${error.message}`);
    return NextResponse.json(
      { settings: settingsFromRow(data), canEdit: auth.role !== 'viewer' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, notificationSettingsSchema);
  if (!body.ok) return body.response;
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('notification_settings')
      .update(settingsToRow(body.data))
      .eq('id', true)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.code === '23514') {
        return jsonError('Ayar değerleri geçersiz.', 400);
      }
      throw new Error(`Bildirim ayarları kaydedilemedi: ${error.message}`);
    }
    if (!data) return jsonError('Bildirim ayarları kaydedilemedi.', 403);
    return NextResponse.json({ ok: true, settings: body.data });
  } catch (error) {
    return apiError(error);
  }
}
