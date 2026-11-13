#!/usr/bin/env node
// Yeni bir çalışma alanı açar ve verilen kullanıcıyı o alanın owner'ı yapar (#181).
// Kullanım (repo kökünde): pnpm workspace:create ad@ornek.com ["Alan adı"]
//
// İstemciden alan oluşturulamaz (self-serve kayıt sonraki faz); yalnız servis anahtarıyla,
// veritabanındaki `create_workspace_for_user` fonksiyonu üzerinden yapılır. Kullanıcı başka bir
// alanda üyeyse yeni alana TAŞINIR (kullanıcı başına tek alan); o alanın son owner'ıysa işlem
// reddedilir. Kullanıcı yoksa davet e-postası gönderilir.
import { createAdmin, findOrInviteUser, parseEmail } from './lib/admin.mjs';

const USAGE = 'Kullanım: pnpm workspace:create ad@ornek.com ["Alan adı"]';
const email = parseEmail(process.argv[2], USAGE);
const name = (
  process.argv.slice(3).join(' ').trim() ||
  `${email.split('@')[0]} çalışma alanı`
).slice(0, 80);

const { admin, siteUrl } = createAdmin();
const user = await findOrInviteUser(admin, email, siteUrl);

const { data: workspaceId, error } = await admin.rpc(
  'create_workspace_for_user',
  { p_user_id: user.id, p_name: name },
);
if (error) {
  if (error.code === '23514') {
    console.error(
      `${email} mevcut çalışma alanının son owner'ı. Önce o alanda başka bir owner atayın ` +
        '(panel → Ayarlar → Ekip), sonra tekrar deneyin.',
    );
    process.exit(1);
  }
  if (error.code === '22023') {
    console.error('Çalışma alanı adı 1-80 karakter olmalı.');
    process.exit(1);
  }
  throw error;
}

console.log(
  `✓ "${name}" çalışma alanı açıldı (${workspaceId}); ${email} owner. Giriş: ${siteUrl}/login`,
);
