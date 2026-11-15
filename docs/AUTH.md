# Panel kimlik doğrulaması

Panel Supabase Auth ile e-posta magic link ve isteğe bağlı Google OAuth kullanır. İki akış da mevcut Supabase Auth kullanıcıları içindir; e-posta girişinde `shouldCreateUser: false` gönderilir ve `supabase/config.toml` içinde kayıt kapalıdır. Hosted Supabase projesinde de Authentication ayarlarından yeni kullanıcı kaydını kapat.

## ⚠️ Kayıt kapatma (hosted projede zorunlu)

`supabase/config.toml` sadece **yerel** Supabase'i ayarlar. Ortak dev ve production projelerinde **Authentication → Sign In / Providers → "Allow new users to sign up"** kapatılmalıdır. Kapatılmazsa herkes magic link ile hesap açabilir. Bu kişi ekip üyesi olmadığı için panele giremez, ama gereksiz auth hesapları birikir.

## Çalışma alanları (#181)

Her kullanıcı tam olarak bir **çalışma alanının** üyesidir ve yalnız o alanın verisini görür. Roller (owner / editor / viewer) alan içinde geçerlidir. Yalıtım veritabanında uygulanır: her kiracı tablosunda `workspace_id` ve RESTRICTIVE bir RLS policy'si vardır (`docs/adr/0003-workspaces.md`, `docs/data-model.md` → Çalışma alanları).

- `requireTeamMember()` ve `requireApiRole()` üyenin `workspaceId`'sini döndürür.
- **Service role istemcisi RLS'i aşar.** Onu kullanan her sorgu `workspaceId` ile açıkça filtrelenir (ekip listesi, davet, rol değiştirme, üye çıkarma, e-posta eşlemesi). Davet edilen kişi davet edenin alanına eklenir.
- Kullanıcı başına tek alan: başka bir alanın üyesi davet edilemez ("Bu kişi zaten bir çalışma alanının üyesi").
- Alanın adını owner **Ayarlar** sayfasından değiştirir (`PATCH /api/workspace`). İstemciden alan oluşturulamaz, silinemez.

## İlk owner ve yeni çalışma alanı

Uygulama içinden hiç kimse kendini owner yapamaz ve kendine alan açamaz. Bunu RLS engelliyor ve tablo boşken de geçerli. İkisi de servis anahtarıyla yapılır:

```bash
pnpm owner:create ad@ornek.com                   # tek alanlı kurulum: mevcut alana owner ekler
pnpm workspace:create ad@ornek.com "Alan adı"    # yeni bir çalışma alanı + owner'ı
```

Script'ler `.env.local`'deki `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` değerlerini kullanır. Kullanıcı yoksa davet e-postası gönderilir.

- **`owner:create`** kurulumda **tam olarak bir** alan varken çalışır (ilk kurulum, yerel geliştirme): kullanıcıyı o alana owner olarak ekler, zaten üyeyse rolünü owner'a çıkarır. Birden çok alan varsa hangi alanın kastedildiği belirsiz olduğu için durur ve aşağıdaki iki yola yönlendirir.
- **`workspace:create`** yeni bir alan açar ve kullanıcıyı onun owner'ı yapar (`create_workspace_for_user`). Kullanıcı başka bir alanda üyeyse yeni alana **taşınır**; o alanın son owner'ıysa işlem reddedilir (önce başka bir owner atanmalı). Ad verilmezse e-postanın kullanıcı adından türetilir.
- Mevcut bir alana üye eklemek için o alanın owner'ı panelde **Ayarlar → Ekip** sayfasını kullanır. Ekipten çıkarılan biri aynı sayfadan tekrar eklenebilir; auth hesabı silinmez, sadece üyeliği kaldırılır.

İkinci alan açıldıktan sonra oturumsuz (service role) yazımlar alanı açıkça vermek ya da üst kayıttan türetmek zorundadır; `seed.sql` ve yerel demo verisi tek alan varsayar (ADR 0003 → "tek alan uyumluluğu"). Kendi kendine kayıt ve alan değiştirme sonraki fazdır.

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
| `src/lib/auth.ts`            | Server Component'ler için `requireTeamMember()` / `requireOwner()` (rol + `workspaceId`)                               |
| `src/lib/auth-api.ts`        | API route'ları için `requireApiRole('owner' \| 'editor' \| 'viewer')`, `parseJson(request, zodSchema)`, `apiError()`   |
| `src/lib/safe-redirect.ts`   | `next` parametresini aynı origin'e indirger (open redirect koruması)                                                   |
| `src/lib/supabase/admin.ts`  | Service role istemcisi, `server-only`. Sadece RLS'i bilerek aşmak gereken yerlerde (davet, e-posta listesi) kullanılır |
| `src/app/auth/signout`       | Çıkış yalnız POST form. GET sadece `?error=not_allowed` ile ve kullanıcı gerçekten üye değilse oturumu kapatır (CSRF)  |

Kurallar:

- Yeni API route'u **her zaman** `requireApiRole(...)` ile başlar, gövdeyi `parseJson` + Zod ile doğrular.
- Service role istemcisi `'use client'` dosyasından import edilemez (`server-only` build'i kırar).
- Service role ile yapılan her sorgu çağıranın `workspaceId`'siyle filtrelenir; kök tabloya yazarken `workspace_id` açıkça verilir.
- Yetki UI'da gizlemeyle değil, sunucuda (API + RLS) uygulanır.

## E2E testleri

- `e2e/guest.spec.ts`: Oturumsuz senaryolar. Her ortamda çalışır.
- `e2e/isolation.spec.ts`: Çalışma alanı yalıtımı (#181). İkinci alanı ve kullanıcısını kendisi açıp siler; diğer projeler bittikten sonra çalışır (ikinci alan varken oturumsuz yazımlar alan vermek zorundadır, diğer testlerin kurulumları bunu yapmaz).
- `e2e/app.spec.ts`: Oturumlu senaryolar. Sadece **yerel** Supabase'e karşı çalışır (`pnpm supabase:start`, ardından `supabase status` değerlerini env olarak ver). Global setup ortak dev projesine asla test kullanıcısı yazmaz. CI bu testleri yerel Supabase ile her PR'da çalıştırır.

## Üretim makinesi oturumu (#211)

Üretim makinesi programı (`apps/worker`) bir ekip üyesinin **kendi** Supabase Auth oturumuyla çalışır; service role anahtarı kullanıcı makinesine konmaz (`docs/adr/0004-moduler-panel.md` → Karar 3). Şema ve RPC'ler: `docs/data-model.md` → "Üretim makinesi oturumu".

### `session_id` claim'i (doğrulandı)

Makine oturumunu insan oturumundan ayıran her kural erişim token'ındaki `session_id` claim'ine dayanır (`private.current_session_id()`).

- Supabase belgesi claim'i **zorunlu** sayar: "These claims are always present in Supabase JWTs and cannot be removed" listesinde `session_id` vardır ([JWT fields](https://supabase.com/docs/guides/auth/jwt-fields), okuma 2026-11-15).
- Auth kaynağı oturumsuz token üretmez: `GenerateAccessToken` `SessionID` boşsa "Session is required to issue access token" hatası verir ve claim'i oturumun kimliğiyle doldurur ([supabase/auth `internal/tokens/service.go`](https://github.com/supabase/auth/blob/master/internal/tokens/service.go), okuma 2026-11-15).
- CI kanıtı: `scripts/session-claim.integration.test.mjs` yerel Supabase'te gerçek kullanıcıyla giriş yapar, token'ı inceler, yenilemede kimliğin değişmediğini ve veritabanının aynı claim'i okuduğunu doğrular. `apps/panel/e2e/machines.app.spec.ts` ve `apps/worker` entegrasyon testi aynı claim'i gerçek oturumda denetler.
- **Dikkat:** Auth'ta "custom access token hook" açılırsa hook claim'leri yeniden yazar. Hook `session_id`'yi değiştirmemelidir; claim yoksa onay ve makine RPC'leri reddedilir (güvenli taraf).

### Giriş

`pnpm worker:login` makinede üye olarak giriş yapar; panelin kullandığı yöntemin aynısıdır (e-posta bağlantısı), ek bir sunucu ucu yoktur:

1. Program e-posta adresini sorar ve Supabase Auth'tan giriş e-postası ister (yalnız mevcut kullanıcılar; kayıt kapalıdır).
2. Kullanıcı e-postadaki **bağlantının adresini kopyalayıp** programa yapıştırır (bağlantıya tıklanmaz: tıklanırsa tarayıcı giriş yapar ve bağlantı tükenir). E-posta şablonu 6 haneli kod içeriyorsa kod da yazılabilir. Parolası olan hesaplar `--password` ile parolayla girer. Girdi ekranda gösterilmez.
3. Oturumun yenileme token'ı işletim sistemi kasasına yazılır (macOS Keychain, Windows Credential Manager, Linux Secret Service). Kasa yoksa program token'ı saklamaz ve durur; düz dosyaya düşme yolu yoktur.
4. Program `register_worker` ile oturumu makine olarak kaydeder. O andan sonra oturum salt okur ve onay veremez.

### Tehdit modeli (v1)

**v1'de makine üyenin kendi oturumunu taşır.** Ele geçmiş ya da çalınmış bir makine, yetkisi kaldırılana kadar ele geçmiş bir üye oturumudur. Sınırları:

| Durum                                                      | Sonuç                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Makine ele geçti ya da dizüstü çalındı (kasa açılabiliyor) | Saldırgan kayıtlı makine oturumunu ele geçirir: veritabanı tarafında o üyenin çalışma alanındaki veriyi **okur**, makinenin alabileceği işleri alıp ilerletir ve yalnız kirasındaki işin `productions` klasörüne dosya yazar. Veritabanı üzerinden iş açamaz, iptal edemez, onay veremez, yayın yapamaz, içerik ya da ayar değiştiremez, ekibi göremez, panele giremez, başka alana erişemez. **Ama** oturum Auth'un gözünde üyenin kendi oturumudur: Auth uçlarında (hesap e-postası, yeni oturum) üye adına işlem yapılabilir. Vault'taki anahtarlar ve service role makinede yoktur |
| Yetkiyi kaldırma                                           | Panel → Ayarlar → Üretim makineleri → **Yetkiyi kaldır** (owner her makineyi, editor kendisininkini). Auth oturumu silinir (yenileme token'ı ölür); süresi dolmamış erişim token'ı da artık hiçbir satır göremez; elindeki iş kuyruğa döner. Üyeyi ekipten çıkarmak da aynı sonucu verir. Şüphe varsa üye ayrıca hesabının diğer oturumlarını kapatmalıdır                                                                                                                                                                                                                             |
| Kayıttan önce                                              | `register_worker` çağrılana kadar oturum sıradan bir üye oturumudur (tarayıcıdaki panel oturumuyla aynı risk). Program girişten hemen sonra kaydeder                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Kötü niyetli iş parametreleri                              | `params` veridir: makine programı tür başına şemayla doğrular, kabuk komutuna katmaz, talimat olarak yorumlamaz (`apps/worker`)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Ertelenen sertleştirme

Ürün sahibinin kararıyla v1 ekibin kendi bilgisayarlarında bu modelle çalışır; aşağıdakiler ayrı bir sertleştirme işine bırakıldı:

- Makineye özel kimlik: makine sırrı + kısa ömürlü, yalnız makine RPC'lerinde geçerli token (makine hiçbir zaman üye oturumu taşımaz).
- Okuma kapsamının makinenin aldığı işlerle sınırlanması.
- Makinede fiziksel sahiplik kodu isteyen eşleme akışı (oltalamaya karşı) ve editor makineleri için owner onayı.
- Yeni makine eklendiğinde owner'a panel bildirimi.

İlk tasarımdaki eşleme kodlu giriş güvenlik incelemesinde dört bulgu aldı (istemcinin yazdığı başlığa dayanan hız sınırı, oturumsuz yazımın yol açtığı engelleme, onaylatma yoluyla oltalama, sunucunun üye adına oturum açması). Dördü de eşleme yüzeyi bütünüyle kaldırılarak kapatıldı: oturumsuz hiçbir uç, service role ile oturum açma ve token aktarımı yoktur.

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

State çekirdeği Instagram, YouTube ve TikTok start/callback akışlarına bağlıdır.
Canlı kabul için sağlayıcı uygulamaları ve en az iki platform test hesabıyla
bağlantı doğrulaması gerekir; bu bilgiler public repoya veya sohbete yazılmaz.

Kalıcı adaptör: `src/lib/oauth/store.ts`. `createOAuthStateStore()` yalnız servis
anahtarıyla public state RPC'lerini çağırır; zaman kontrolünü DB yapar. Verifier
ve sağlayıcı ayrıntıları hata mesajlarına dahil edilmez. Şema:
`20261024210000_oauth_state_store.sql`; yetki/TTL/replay testleri:
`supabase/tests/oauth_state.test.sql`. YouTube/TikTok route entegrasyonu aşağıda açıklanır.

### Sosyal bağlantı akışları

Instagram Login, YouTube ve TikTok Web Login Kit için `POST /api/oauth/[platform]/start`,
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
`.env.example` içindeki OAuth alanları birer kez doldurulur; `TIKTOK_CLIENT_KEY`
okunmaz. Eski `.env.local` kopyalarında tekrarlanan `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET` ve `TIKTOK_CLIENT_SECRET` satırlarını tekilleştirin;
sonraki boş satır önceki dolu değeri ezebilir. `pnpm env:pull` OAuth client
secret'larını dağıtmaz; bunlar sunucuda ayrıca yapılandırılır.
YouTube S256 PKCE + offline/consent kullanır. TikTok Web dokümanı PKCE belirtmez;
Desktop Kit'in hex SHA256 kuralı Web akışına uygulanmaz. Üretimde HTTPS zorunludur.
Instagram Login için `INSTAGRAM_CLIENT_ID/SECRET` gerekir (Meta uygulamasının
genel kimliği yerine Instagram ürünündeki kimlik). HTTPS callback kullanılır.
State tek kullanımlıdır; sağlayıcıda belgelenmeyen PKCE parametresi gönderilmez.
Kod kısa ömürlü tokena, ardından sunucuda uzun ömürlü tokena çevrilir. İzinlerin
tamamı ve token kimliği doğrulanır. Instagram refresh token vermez; Vault paketine
uydurma refresh token yazılmaz. Graph sürümü `INSTAGRAM_GRAPH_VERSION` ile seçilir.

**Canlı kabul bekliyor:** Meta'nın Business Login/access_token/refresh_access_token
sayfaları 25 Ekim 2026 araştırmasında 429 döndürdü. Resmi Meta Postman çalışma
alanı erişilebilir, ancak token yanıt şekli, revoke ve insights izninin canlı
uygulamadaki davranışı henüz doğrulanmadı. #49 en az iki gerçek platform hesabı
ve yenileme kabulü yapılana kadar açık tutulur; bu değişiklik draft PR'dır.

Resmi referanslar (24 Ekim 2026):
https://developers.google.com/identity/protocols/oauth2/web-server
https://developers.tiktok.com/docs/en/login-kit-web
https://developers.tiktok.com/docs/en/oauth-user-access-token-management

### Token yenileme ve bağlantıyı kaldırma

`refresh-tokens` Edge Function her 5 dakikada pg_cron üzerinden `x-cron-secret`
ile çağrılır. Yalnız ayarı bulunan Instagram/YouTube/TikTok platformları alınır; aynı
çağrı en çok 5 hesabı işler. Süre sonuna 15 dakika kalan token'lar için
`oauth_refresh_claim` üç dakikalık tek-worker rezervasyonu verir. Callback yeni
bir token yazmışsa veya hesap revoked olmuşsa eski worker sonucu
`oauth_refresh_finish` tarafından reddedilir. TikTok'un döndürdüğü yeni refresh
token saklanır; Google yeni refresh token döndürmezse eskisi korunur. Geçici
hata sonraki cron'a kalır; invalid_grant hesabı error yapar, yeniden bağlantı
istenir. Instagram tokenı süresinin bitmesine 7 gün kala yenilenir; Vault sırrı
24 saatten yeni ise alınmaz, süresi geçmiş token yenilenmez. Böylece yeniden
bağlanan hesap erken yenilenmez. Meta code 190 yeniden bağlantı gerektirir.
Token ve sağlayıcı hata gövdesi loglanmaz.

Panel env'si ile Edge Function secret'ları farklıdır: her ortamın function
secret'larında da `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TIKTOK_CLIENT_ID`,
`TIKTOK_CLIENT_SECRET`, `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` gerekir. `CRON_SECRET`, Vault `cron_secret` ve `project_url`
mevcut zamanlayıcı sözleşmesidir. Secret değerleri migration veya PR'a yazılmaz;
fonksiyon yalnız pipeline ile deploy edilir.

`POST /api/social-accounts/[id]/disconnect` editor yetkisi ve aynı origin ister.
`oauth_revoke_begin` yenileme/ikinci kaldırma ile çakışmayı engeller ve hesabı
revoked yaparak yerel işleri durdurur. Önce sağlayıcı revoke çağrısı yapılır;
onaylandıktan sonra `oauth_revoke_finish` nonce kontrolüyle Vault sırrını siler.
Post ve metrik kayıtları silinmez. Sağlayıcı hatasında sır retry için Vault'ta
kalır, yeni bağlantı yazımı durdurulur; üç dakika sonra tekrar denenebilir.
Instagram revoke `DELETE /me/permissions` yanıtında `success=true` ister.
Google revoke aynı projeye verilen diğer OAuth izinlerini de kaldırabilir;
bu etki Hesaplar ekranında kullanıcıya gösterilir.

Yeni OAuth değerleri mevcut şifreli geliştirme aktarım paketine eklenmemiştir.
Yetkili owner bu değerleri yalnız ilgili panel sunucusunun özel ortamında ve
ayrıca Edge Function secret yönetiminde tanımlar. Kullanıcıya çözülebilir
artifact üzerinden yeni OAuth client secret dağıtımı yapılmaz. Değerler repoya,
sohbete veya loga yazılmaz. Kayıtlı callback origin'i gerçek panel adresiyle
eşleşmelidir.

Instagram resmi kaynakları (erişim durumu yukarıda):
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
https://developers.facebook.com/docs/instagram-platform/reference/access_token
https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token
https://www.postman.com/meta/instagram/overview
