# Panel kimlik doğrulaması

Panel Supabase Auth ile e-posta magic link ve isteğe bağlı Google OAuth kullanır. İki akış da mevcut Supabase Auth kullanıcıları içindir; e-posta girişinde `shouldCreateUser: false` gönderilir ve `supabase/config.toml` içinde kayıt kapalıdır. Hosted Supabase projesinde de Authentication ayarlarından yeni kullanıcı kaydını kapat.

## ⚠️ Kayıt kapatma (hosted projede zorunlu)

`supabase/config.toml` sadece **yerel** Supabase'i ayarlar. Ortak dev ve production projelerinde **Authentication → Sign In / Providers → "Allow new users to sign up"** kapatılmalıdır. Kapatılmazsa herkes magic link ile hesap açabilir. `team_members` boşken bu kişi ilk owner da olabilir.

## İlk owner

Henüz owner yokken ilk hesabı Supabase Dashboard → Authentication → Users bölümünden e-posta daveti göndererek oluştur. Kullanıcı magic link ile ilk kez giriş yaptığında, boş `team_members` tablosunda kendi hesabını owner olarak kaydeder. Bundan sonra yeni üyeler panelde **Ayarlar → Ekip** sayfasından davet edilir. Ekipten çıkarılan biri aynı sayfadan tekrar eklenebilir; auth hesabı silinmez, sadece üyeliği kaldırılır.

İlk owner kurulumunu proje açılır açılmaz yap. `team_members` boşken RLS, giriş yapan ilk kullanıcının kendini owner olarak eklemesine izin verir.

## Ortam değişkenleri

`.env.local` içine `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ve yalnızca sunucu tarafında kullanılan `SUPABASE_SERVICE_ROLE_KEY` eklenmelidir. Service role key hiçbir `NEXT_PUBLIC_` değişkenine taşınmamalıdır; ekip daveti ve üye listesindeki e-posta eşlemesi bu anahtarı gerektirir.

## Redirect ve Google OAuth

Supabase Authentication → URL Configuration bölümünde yerel panel URL'sini (`http://localhost:3000`) ve yayın adresini ekle. Google ile giriş için Supabase Authentication → Providers → Google altında OAuth client ID ve secret değerlerini yapılandır; Google Cloud OAuth istemcisinde Supabase'in gösterdiği callback URL'yi yetkili redirect URI olarak kaydet. Google sağlayıcısı etkin değilse e-posta magic link ile giriş kullanılabilir.

Üye rolü uygulama tablosunda da doğrulanır. `viewer` için yazma RLS politikası yoktur; ekip yönetimi sayfası ve API'leri yalnızca `owner` rolünü kabul eder.

## Kod yapısı

| Dosya                        | Görev                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`               | Her istekte oturumu yeniler; oturum yoksa sayfaları `/login?next=...`'e yönlendirir (API'ler kendi kontrolünü yapar)   |
| `src/app/(panel)/layout.tsx` | Korumalı tüm sayfaların kapısı: `requireTeamMember()`. Yeni sayfa bu klasöre eklenir                                   |
| `src/lib/auth.ts`            | Server Component'ler için `requireTeamMember()` / `requireOwner()`                                                     |
| `src/lib/auth-api.ts`        | API route'ları için `requireApiRole('owner' \| 'editor' \| 'viewer')`, `parseJson(request, zodSchema)`, `apiError()`   |
| `src/lib/safe-redirect.ts`   | `next` parametresini aynı origin'e indirger (open redirect koruması)                                                   |
| `src/lib/supabase/admin.ts`  | Service role istemcisi, `server-only`. Sadece RLS'i bilerek aşmak gereken yerlerde (davet, e-posta listesi) kullanılır |
| `src/app/auth/signout`       | Çıkış (POST form) ve üye olmayanların oturumunu kapatma (GET)                                                          |

Kurallar:

- Yeni API route'u **her zaman** `requireApiRole(...)` ile başlar, gövdeyi `parseJson` + Zod ile doğrular.
- Service role istemcisi `'use client'` dosyasından import edilemez (`server-only` build'i kırar).
- Yetki UI'da gizlemeyle değil, sunucuda (API + RLS) uygulanır.

## E2E testleri

- `e2e/guest.spec.ts`: Oturumsuz senaryolar. Her ortamda çalışır.
- `e2e/app.spec.ts`: Oturumlu senaryolar. Sadece **yerel** Supabase'e karşı çalışır (`pnpm supabase:start`, ardından `supabase status` değerlerini env olarak ver). Global setup ortak dev projesine asla test kullanıcısı yazmaz. CI bu testleri yerel Supabase ile her PR'da çalıştırır.
