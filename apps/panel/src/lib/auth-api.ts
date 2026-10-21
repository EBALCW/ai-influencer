import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from './supabase/server';

export async function requireApiOwner() {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Supabase ortam değişkenleri tanımlı değil.' },
        { status: 503 },
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 }),
    };
  }

  const { data: member, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || member?.role !== 'owner') {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Owner yetkisi gerekli.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, user };
}
