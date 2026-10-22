import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { readAiSettings } from '@/lib/ai/config';
import { aiSettingsSchema } from '@/lib/ai/settings-schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export async function GET() {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;
  try {
    const settings = await readAiSettings();
    const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    return NextResponse.json(
      {
        settings,
        enabled: auth.role !== 'viewer' && hasKey && Boolean(settings),
        hasKey,
        canEdit: auth.role === 'owner',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return jsonError('AI ayarları okunamadı.', 503);
  }
}
export async function PUT(request: Request) {
  const auth = await requireApiRole('owner');
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, aiSettingsSchema);
  if (!body.ok) return body.response;
  try {
    const db = await createSupabaseServerClient();
    const { error } = await db
      .from('app_settings')
      .upsert({ key: 'ai', value: body.data }, { onConflict: 'key' });
    if (error) return jsonError('AI ayarları kaydedilemedi.', 500);
    revalidatePath('/settings/ai');
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError('AI ayarları kaydedilemedi.', 500);
  }
}
