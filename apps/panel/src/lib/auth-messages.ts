export const authMessages = {
  loginTitle: 'Tekrar hoş geldin',
  loginSubtitle: 'Stüdyona güvenli şekilde giriş yap.',
  emailLabel: 'E-posta adresi',
  emailPlaceholder: 'ad@ornek.com',
  emailLink: 'Giriş bağlantısı gönder',
  google: 'Google ile devam et',
  divider: 'veya',
  magicSent: 'Giriş bağlantısı e-posta adresine gönderildi.',
  emailRequired: 'Geçerli bir e-posta adresi gir.',
  setupRequired:
    'Giriş için Supabase adresini ve public key değerini .env.local dosyasında yapılandır.',
  noPublicSignup:
    'Bu çalışma alanına yalnızca davet edilen ekip üyeleri girebilir.',
  accessDeniedTitle: 'Bu çalışma alanına erişimin yok',
  accessDeniedBody:
    'Ekip sahibi seni davet ettiğinde e-posta bağlantısıyla giriş yapabilirsin.',
  sessionError:
    'Giriş doğrulanamadı. Bağlantı süresi dolmuş olabilir; yeni bağlantı iste.',
  teamTitle: 'Ekip üyeleri',
  teamDescription: 'Ekip erişimini ve uygulama rollerini yönet.',
  teamEmail: 'E-posta',
  teamRole: 'Rol',
  teamRoleOwner: 'Sahip',
  teamRoleEditor: 'Düzenleyici',
  teamRoleViewer: 'Görüntüleyici',
  inviteTitle: 'Ekip üyesi davet et',
  invite: 'Davet gönder',
  updateRole: 'Rolü kaydet',
  removeMember: 'Erişimi kaldır',
  currentUser: 'Sen',
  ownerOnly: 'Ekip davetlerini ve rollerini yalnızca sahipler yönetebilir.',
  serviceKeyMissing:
    'Ekip davetlerini göndermek için sunucu tarafında Supabase service role anahtarı yapılandırılmalı.',
  noMembers: 'Henüz ekip üyesi yok.',
  inviteSuccess: 'Davet e-postası gönderildi.',
  roleSuccess: 'Üye rolü güncellendi.',
  removeSuccess: 'Üyenin erişimi kaldırıldı.',
  actionFailed:
    'İşlem tamamlanamadı. Yetkini ve Supabase bağlantısını kontrol et.',
} as const;
