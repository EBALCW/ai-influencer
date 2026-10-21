import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const OWNER_STATE = 'e2e/.auth/owner.json';
export const OWNER_EMAIL = 'e2e-owner@example.test';
export const VIEWER_STATE = 'e2e/.auth/viewer.json';
export const VIEWER_EMAIL = 'e2e-viewer@example.test';
export const EDITOR_STATE = 'e2e/.auth/editor.json';
export const EDITOR_EMAIL = 'e2e-editor@example.test';

/**
 * Oturumlu testler için yerel Supabase'te owner ve viewer kullanıcıları oluşturur ve
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

type Role = 'owner' | 'editor' | 'viewer';

export default async function globalSetup() {
  await mkdir(dirname(OWNER_STATE), { recursive: true });
  if (!hasLocalSupabase()) {
    const empty = JSON.stringify({ cookies: [], origins: [] });
    await writeFile(OWNER_STATE, empty);
    await writeFile(VIEWER_STATE, empty);
    await writeFile(EDITOR_STATE, empty);
    return;
  }
  // Owner önce: viewer üyeliğini de owner'ın created_by'ı ile kaydetmek için
  const ownerId = await createSession(OWNER_EMAIL, 'owner', OWNER_STATE);
  await createSession(VIEWER_EMAIL, 'viewer', VIEWER_STATE, ownerId);
  await createSession(EDITOR_EMAIL, 'editor', EDITOR_STATE, ownerId);
}

export async function createSession(
  email: string,
  role: Role,
  statePath: string,
  createdBy?: string,
): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const password = `e2e-${crypto.randomUUID()}`;

  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  let user = list.users.find((item) => item.email === email);
  if (user) {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password,
    });
    if (updated.error) throw updated.error;
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }

  const { error: memberError } = await admin
    .from('team_members')
    .upsert({ user_id: user.id, role, created_by: createdBy ?? user.id });
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
    email,
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
  await writeFile(statePath, JSON.stringify({ cookies, origins: [] }));
  return user.id;
}
