// owner:create ve workspace:create script'lerinin ortak parçaları: .env.local'i yükler, servis
// anahtarıyla Supabase istemcisi açar, kullanıcıyı e-postayla bulur ya da davet eder.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(value, usage) {
  const email = value?.trim().toLowerCase();
  if (!email || !EMAIL.test(email)) {
    console.error(usage);
    process.exit(1);
  }
  return email;
}

export function createAdmin() {
  const rootEnv = fileURLToPath(
    new URL('../../../../.env.local', import.meta.url),
  );
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      '.env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.',
    );
    process.exit(1);
  }
  return {
    admin: createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    siteUrl: process.env.SITE_URL ?? 'http://localhost:3000',
  };
}

async function findUser(admin, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match || data.users.length < 200) return match ?? null;
  }
  return null;
}

/** Kullanıcı varsa onu döndürür; yoksa davet e-postası gönderir. */
export async function findOrInviteUser(admin, email, siteUrl) {
  const existing = await findUser(admin, email);
  if (existing) {
    console.log(`Mevcut kullanıcı bulundu: ${email}`);
    return existing;
  }
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });
  if (error) throw error;
  console.log(`Davet e-postası gönderildi: ${email}`);
  return data.user;
}
