import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const OWNER_STATE = 'e2e/.auth/owner.json';
export const OWNER_EMAIL = 'e2e-owner@example.test';

/**
 * Oturumlu testler için yerel Supabase'te owner kullanıcı oluşturur ve
 * @supabase/ssr'nin kendi cookie formatıyla Playwright storage state'i yazar.
 *
 * Sadece yerel Supabase'e (127.0.0.1 / localhost) karşı çalışır; ortak dev
 * projesine asla test kullanıcısı yazmaz. Diğer durumlarda oturumlu testler atlanır.
 */
export function hasLocalSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return (
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url) &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export default async function globalSetup() {
  await mkdir(dirname(OWNER_STATE), { recursive: true });
  if (!hasLocalSupabase()) {
    await writeFile(OWNER_STATE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const password = `e2e-${crypto.randomUUID()}`;

  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((item) => item.email === OWNER_EMAIL);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password });
  } else {
    const created = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }

  const { error: memberError } = await admin
    .from('team_members')
    .upsert({ user_id: user.id, role: 'owner', created_by: user.id });
  if (memberError) throw memberError;

  const jar = new Map<string, string>();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password,
  });
  if (error) throw error;

  const cookies = [...jar].map(([name, value]) => ({
    name,
    value,
    domain: '127.0.0.1',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  }));
  await writeFile(OWNER_STATE, JSON.stringify({ cookies, origins: [] }));
}
