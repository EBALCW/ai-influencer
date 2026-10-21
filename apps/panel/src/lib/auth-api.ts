import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { TeamRole } from '@ai-influencer/shared';
import type { z } from 'zod';
import { createSupabaseServerClient } from './supabase/server';

type ApiAuthResult =
  | { ok: true; user: User; role: TeamRole }
  | { ok: false; response: NextResponse };

const rank: Record<TeamRole, number> = { viewer: 0, editor: 1, owner: 2 };

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** API route'ları için yetki kontrolü. Rol, RLS'e ek olarak sunucuda da doğrulanır. */
export async function requireApiRole(
  minimum: TeamRole,
): Promise<ApiAuthResult> {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return {
      ok: false,
      response: jsonError('Supabase ortam değişkenleri tanımlı değil.', 503),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, response: jsonError('Giriş gerekli.', 401) };
  }

  const { data: member, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const role = member?.role as TeamRole | undefined;
  if (error || !role || rank[role] < rank[minimum]) {
    return {
      ok: false,
      response: jsonError(`${minimum} yetkisi gerekli.`, 403),
    };
  }

  return { ok: true, user, role };
}

/** İstek gövdesini şemayla doğrular; hata durumunda 400 döner. */
export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError('Geçersiz JSON gövdesi.', 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: jsonError('İstek doğrulanamadı.', 400) };
  }
  return { ok: true, data: parsed.data };
}

/** Beklenmeyen hatalarda iç ayrıntıyı istemciye sızdırmadan yanıt verir. */
export function apiError(error: unknown) {
  // redirect()/notFound() gibi Next.js kontrol akışı hatalarını yutma
  if (error && typeof error === 'object' && 'digest' in error) throw error;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('yapılandırması eksik')) return jsonError(message, 503);
  console.error('[api]', error);
  return jsonError('İşlem tamamlanamadı.', 500);
}
