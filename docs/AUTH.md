# Panel kimlik doğrulaması

Panel Supabase Auth ile e-posta magic link ve isteğe bağlı Google OAuth kullanır. İki akış da mevcut Supabase Auth kullanıcıları içindir; e-posta girişinde `shouldCreateUser: false` gönderilir ve `supabase/config.toml` içinde kayıt kapalıdır. Hosted Supabase projesinde de Authentication ayarlarından yeni kullanıcı kaydını kapat.

## ⚠️ Kayıt kapatma (hosted projede zorunlu)

`supabase/config.toml` sadece **yerel** Supabase'i ayarlar. Ortak dev ve production projelerinde **Authentication → Sign In / Providers → "Allow new users to sign up"** kapatılmalıdır. Kapatılmazsa herkes magic link ile hesap açabilir. Bu kişi ekip üyesi olmadığı için panele giremez, ama gereksiz auth hesapları birikir.

## İlk owner

Uygulama içinden hiç kimse kendini owner yapamaz. Bunu RLS engelliyor ve tablo boşken de geçerli. İlk owner servis anahtarıyla oluşturulur:

```bash
pnpm owner:create ad@ornek.com
```

Script `.env.local`'deki `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` değerlerini kullanır. Kullanıcı yoksa davet e-postası gönderir, varsa sadece owner üyeliğini ekler. Bundan sonraki üyeler panelde **Ayarlar → Ekip** sayfasından davet edilir. Ekipten çıkarılan biri aynı sayfadan tekrar eklenebilir; auth hesabı silinmez, sadece üyeliği kaldırılır.

## Ortam değişkenleri

Kökteki `.env.local` içine (`next.config.ts` bu dosyayı da yükler) `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ve yalnızca sunucu tarafında kullanılan `SUPABASE_SERVICE_ROLE_KEY` eklenmelidir. Service role key hiçbir `NEXT_PUBLIC_` değişkenine taşınmamalıdır; ekip daveti ve üye listesindeki e-posta eşlemesi bu anahtarı gerektirir.

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

## Sosyal hesap OAuth geliştirmesi (#49)

`src/lib/oauth/state.ts`, sosyal hesap OAuth akışları için sunucuya özel state ve
RFC 7636 S256 PKCE çekirdeğidir. Panelin Supabase girişinden ayrıdır.
State 32 rastgele bayttır, depoya SHA-256 hash'i yazılır. PKCE verifier istemciye
verilmez; başlangıç sonucu sadece state ve challenge içerir. State 10 dakika,
oturum kullanıcısı, influencer ve platform ile sınırlıdır.

`OAuthStateStore.consume` üretimde **atomik koşullu silme/RETURNING** uygulamalıdır:
hash + kullanıcı + influencer + platform + süre koşulları sağlanmıyorsa kayıt
silinmez, sağlanıyorsa yalnız bir istek verifier alır. Çok worker çalışmada
process belleği veya yalnız cookie ile replay koruması sağlanmış sayılmaz.
Kısa ömürlü verifier'ın depoya erişimi sunucuyla sınırlanmalı, süresi dolan
kayıtlar temizlenmelidir. Testteki bellek deposu üretim adaptörü değildir.

State çekirdeği YouTube ve TikTok start/callback akışlarına bağlıdır.
Canlı kabul için sağlayıcı uygulamaları ve en az iki platform test hesabıyla
bağlantı doğrulaması gerekir; bu bilgiler public repoya veya sohbete yazılmaz.

Kalıcı adaptör: `src/lib/oauth/store.ts`. `createOAuthStateStore()` yalnız servis
anahtarıyla public state RPC'lerini çağırır; zaman kontrolünü DB yapar. Verifier
ve sağlayıcı ayrıntıları hata mesajlarına dahil edilmez. Şema:
`20261024210000_oauth_state_store.sql`; yetki/TTL/replay testleri:
`supabase/tests/oauth_state.test.sql`. YouTube/TikTok route entegrasyonu aşağıda açıklanır.

### Sosyal bağlantı akışları

YouTube ve TikTok Web Login Kit için `POST /api/oauth/[platform]/start`,
`GET /api/oauth/[platform]/callback` vardır. İki uçta editor yetkisi gerekir.
Başlangıç aynı origin POST formudur; state callback yoluna sınırlı httpOnly,
SameSite=Lax cookie ile tarayıcıya da bağlanır. Callback state'i atomik tüketir,
kodu sunucudan değişir, kimliği sağlayıcıdan okur; token'ı
`oauth_connect_token` RPC'siyle Vault'a yazar. RPC hesap satırını kilitleyip
influencer/platform/external id eşleşmesini ve ekip rolünü tekrar doğrular.
Başka influencer'a bağlı hesap taşınmaz. Başarısız yeni kayıt pending kalabilir;
aynı hesapla yeniden bağlantı tamamlanabilir. Token/API hata gövdesi loglanmaz.

`OAUTH_REDIRECT_BASE` yalnız origin'dir. Callback adresleri sağlayıcı konsoluna
tam olarak kaydedilir. Google `GOOGLE_CLIENT_ID/SECRET`; TikTok portalındaki
client_key `TIKTOK_CLIENT_ID`, secret `TIKTOK_CLIENT_SECRET` olarak sunucuya
verilir. YouTube localhost HTTP kabul eder; TikTok Web HTTPS callback gerektirir.
YouTube S256 PKCE + offline/consent kullanır. TikTok Web dokümanı PKCE belirtmez;
Desktop Kit'in hex SHA256 kuralı Web akışına uygulanmaz. Üretimde HTTPS zorunludur.
Instagram adaptörü henüz etkin değildir, istek 503 ile kapanır. Canlı hesap
kabul testi yapılmadığı ve Instagram akışı eksik olduğu için #49 açık/draft kalır.

Resmi referanslar (24 Ekim 2026):
https://developers.google.com/identity/protocols/oauth2/web-server
https://developers.tiktok.com/docs/en/login-kit-web
https://developers.tiktok.com/docs/en/oauth-user-access-token-management

### Token yenileme ve bağlantıyı kaldırma

`refresh-tokens` Edge Function her 5 dakikada pg_cron üzerinden `x-cron-secret`
ile çağrılır. Yalnız ayarı bulunan YouTube/TikTok platformları alınır; aynı
çağrı en çok 5 hesabı işler. Süre sonuna 15 dakika kalan token'lar için
`oauth_refresh_claim` üç dakikalık tek-worker rezervasyonu verir. Callback yeni
bir token yazmışsa veya hesap revoked olmuşsa eski worker sonucu
`oauth_refresh_finish` tarafından reddedilir. TikTok'un döndürdüğü yeni refresh
token saklanır; Google yeni refresh token döndürmezse eskisi korunur. Geçici
hata sonraki cron'a kalır; invalid_grant hesabı error yapar, yeniden bağlantı
istenir. Token ve sağlayıcı hata gövdesi loglanmaz.

Panel env'si ile Edge Function secret'ları farklıdır: her ortamın function
secret'larında da `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TIKTOK_CLIENT_ID`,
`TIKTOK_CLIENT_SECRET` gerekir. `CRON_SECRET`, Vault `cron_secret` ve `project_url`
mevcut zamanlayıcı sözleşmesidir. Secret değerleri migration veya PR'a yazılmaz;
fonksiyon yalnız pipeline ile deploy edilir.

`POST /api/social-accounts/[id]/disconnect` editor yetkisi ve aynı origin ister.
`oauth_revoke_begin` yenileme/ikinci kaldırma ile çakışmayı engeller ve hesabı
revoked yaparak yerel işleri durdurur. Önce sağlayıcı revoke çağrısı yapılır;
onaylandıktan sonra `oauth_revoke_finish` nonce kontrolüyle Vault sırrını siler.
Post ve metrik kayıtları silinmez. Sağlayıcı hatasında sır retry için Vault'ta
kalır, yeni bağlantı yazımı durdurulur; üç dakika sonra tekrar denenebilir.
Google revoke aynı projeye verilen diğer OAuth izinlerini de kaldırabilir;
bu etki Hesaplar ekranında kullanıcıya gösterilir.

Yeni OAuth değerleri mevcut şifreli geliştirme aktarım paketine eklenmemiştir.
Yetkili owner bu değerleri yalnız ilgili panel sunucusunun özel ortamında ve
ayrıca Edge Function secret yönetiminde tanımlar. Kullanıcıya çözülebilir
artifact üzerinden yeni OAuth client secret dağıtımı yapılmaz. Değerler repoya,
sohbete veya loga yazılmaz. Kayıtlı callback origin'i gerçek panel adresiyle
eşleşmelidir.
