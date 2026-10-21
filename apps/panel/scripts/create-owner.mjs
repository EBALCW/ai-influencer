#!/usr/bin/env node
// İlk owner'ı (veya ek bir owner'ı) servis anahtarıyla oluşturur.
// Kullanım (repo kökünde): pnpm owner:create ad@ornek.com
//
// Uygulama içinden kimse kendini owner yapamaz (RLS); ilk owner sadece bu yolla eklenir.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const rootEnv = fileURLToPath(new URL('../../../.env.local', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Kullanım: pnpm owner:create ad@ornek.com');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    '.env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';

async function findUser() {
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

let user = await findUser();
if (user) {
  console.log(`Mevcut kullanıcı bulundu: ${email}`);
} else {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });
  if (error) throw error;
  user = data.user;
  console.log(`Davet e-postası gönderildi: ${email}`);
}

const { error } = await admin
  .from('team_members')
  .upsert({ user_id: user.id, role: 'owner' }, { onConflict: 'user_id' });
if (error) throw error;

console.log(`✓ ${email} owner olarak eklendi. Giriş: ${siteUrl}/login`);
