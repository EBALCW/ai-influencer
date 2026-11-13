#!/usr/bin/env node
// TEK çalışma alanlı kurulumda ilk owner'ı (veya ek bir owner'ı) servis anahtarıyla oluşturur.
// Kullanım (repo kökünde): pnpm owner:create ad@ornek.com
//
// Uygulama içinden kimse kendini owner yapamaz (RLS); ilk owner sadece bu yolla eklenir.
// Kullanıcı, kurulumdaki tek çalışma alanına eklenir. Birden çok alan varsa hangi alanın
// kastedildiği belirsizdir: yeni bir alan için `pnpm workspace:create`, mevcut bir alana üye
// eklemek için panel → Ayarlar → Ekip kullanılır (#181, docs/AUTH.md).
import { createAdmin, findOrInviteUser, parseEmail } from './lib/admin.mjs';

const email = parseEmail(
  process.argv[2],
  'Kullanım: pnpm owner:create ad@ornek.com',
);
const { admin, siteUrl } = createAdmin();

const { data: workspaces, error: workspaceError } = await admin
  .from('workspaces')
  .select('id, name')
  .limit(2);
if (workspaceError) throw workspaceError;
if (workspaces.length !== 1) {
  console.error(
    workspaces.length === 0
      ? 'Hiç çalışma alanı yok. Yeni alan açmak için: pnpm workspace:create ad@ornek.com'
      : 'Birden çok çalışma alanı var. Yeni bir alan + owner için: pnpm workspace:create ad@ornek.com\n' +
          'Mevcut bir alana üye eklemek için o alanın owner’ı panelde Ayarlar → Ekip sayfasını kullanır.',
  );
  process.exit(1);
}
const [workspace] = workspaces;

const user = await findOrInviteUser(admin, email, siteUrl);

// Tek alan olduğu için kullanıcının varsa mevcut üyeliği de bu alandadır; rolü owner'a çıkar.
// workspace_id açıkça verilir: service role yazımı varsayılana bırakılmaz.
const { error } = await admin
  .from('team_members')
  .upsert(
    { user_id: user.id, role: 'owner', workspace_id: workspace.id },
    { onConflict: 'user_id' },
  );
if (error) throw error;

console.log(
  `✓ ${email}, "${workspace.name}" alanına owner olarak eklendi. Giriş: ${siteUrl}/login`,
);
