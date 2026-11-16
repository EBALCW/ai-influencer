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

| Dosya                        | Görev                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`               | Her istekte oturumu yeniler; oturum yoksa sayfaları `/login?next=...`'e yönlendirir (API'ler kendi kontrolünü yapar)                                                                                                |
| `src/app/(panel)/layout.tsx` | Korumalı tüm sayfaların kapısı: `requireTeamMember()`. Yeni sayfa bu klasöre eklenir                                                                                                                                |
| `src/lib/auth.ts`            | Server Component'ler için `requireTeamMember()` / `requireOwner()` (rol + `workspaceId`)                                                                                                                            |
| `src/lib/auth-api.ts`        | API route'ları için `requireApiRole('owner' \| 'editor' \| 'viewer')`, `parseJson(request, zodSchema)`, `apiError()`                                                                                                |
| `src/lib/safe-redirect.ts`   | `next` parametresini aynı origin'e indirger (open redirect koruması)                                                                                                                                                |
| `src/lib/supabase/admin.ts`  | Service role istemcisi, `server-only`. Sadece RLS'i bilerek aşmak gereken yerlerde (davet, e-posta listesi) kullanılır                                                                                              |
| `src/app/auth/signout`       | Çıkış yalnız POST form. GET sadece `?error=not_allowed` ile ve kullanıcı gerçekten üye değilse oturumu kapatır (CSRF); bu yol yalnız geçerli oturumu kapatır (`scope: 'local'`), üyenin diğer oturumlarına dokunmaz |

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

`pnpm worker:login` makinede üye olarak giriş yapar; panelin kullandığı yöntemin aynısıdır (e-posta bağlantısı). E-posta beklemeden girmek için `pnpm worker:login --code` kullanılır: 1. ve 2. adımın yerine panelde üretilen tek kullanımlık kod sorulur ([Araç girişi](#araç-girişi-kodla-giriş)); 3. ve 4. adım aynıdır.

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

Ürün sahibinin kararıyla v1 ekibin kendi bilgisayarlarında bu modelle çalışır; aşağıdakiler ayrı bir sertleştirme işine bırakıldı (#245):

- Makineye özel kimlik: makine sırrı + kısa ömürlü, yalnız makine RPC'lerinde geçerli token (makine hiçbir zaman üye oturumu taşımaz).
- Okuma kapsamının makinenin aldığı işlerle sınırlanması.
- Makinede fiziksel sahiplik kodu isteyen eşleme akışı (oltalamaya karşı) ve editor makineleri için owner onayı.
- Yeni makine eklendiğinde owner'a panel bildirimi.
- Otomasyon oturumunun (makine, MCP) Auth uçlarındaki etkisinin sınırlanması: oturum Auth'un gözünde üyenin kendi oturumudur; token'ı elinde tutan Auth'u doğrudan çağırarak üye adına işlem yapabilir (ör. genel kapsamla çıkış). Panel yolu kapatıldı: `/auth/signout?error=not_allowed` üye sayılmayan oturumu yalnız yerel kapsamla kapatır, yani bir panel sayfasına gelen otomasyon oturumu üyenin tarayıcıdaki oturumunu artık kapatmaz (`apps/panel/e2e/machines.app.spec.ts`).
- MCP oturumları için panel ekranı (liste, yetki kaldırma; RPC'ler hazır: `list_mcp_sessions`, `revoke_mcp_session`), viewer üyeler için salt okur MCP oturumu ve ekip düzeyinde MCP denetim tablosu (`docs/mcp-panel.md` → "Sonraya kalanlar").

İlk tasarımdaki eşleme kodlu giriş güvenlik incelemesinde dört bulgu aldı (istemcinin yazdığı başlığa dayanan hız sınırı, oturumsuz yazımın yol açtığı engelleme, onaylatma yoluyla oltalama, sunucunun üye adına oturum açması). Dördü de eşleme yüzeyi bütünüyle kaldırılarak kapatıldı: oturumsuz hiçbir uç, service role ile oturum açma ve token aktarımı yoktur. Sonradan eklenen kodla giriş bu kararı geri almaz; farkları [Araç girişi](#araç-girişi-kodla-giriş) bölümünde tek tek yazılıdır.

## MCP oturumu (#241)

Panel MCP sunucusu (`apps/mcp`, `docs/mcp-panel.md`) da bir ekip üyesinin kendi Auth oturumuyla çalışır. `pnpm mcp:login` (tarayıcıyla ya da `--code` ile, bkz. [Araç girişi](#araç-girişi-kodla-giriş)) girişten hemen sonra, token kasaya yazılmadan önce `register_mcp_session()` çağırır; oturum o andan sonra kalıcı olarak **MCP oturumu**dur (`private.worker_sessions.kind = 'mcp'`; şema: `docs/data-model.md` → "Otomasyon oturumu türleri").

- Tablolarda ve genel RPC'lerde `viewer` sayılır; `team_members`'ı okuyamaz, bu yüzden panel sunucusu onu üye saymaz (API 403, sayfa çıkışa yönlenir ve yalnız o oturum kapanır).
- Yalnız taslak RPC'lerinde üyenin gerçek rolüyle (owner/editor) çalışır: seri, konu isteği / önerisi, bölüm, senaryo kaydı, ön hazırlık işi, iptal isteği.
- Onay veremez, üretim işi açamaz, arşivleyemez, taşıyamaz, ekip / ayar / anahtar değiştiremez, makine olamaz, makine RPC'lerini çağıramaz. "Hiçbir otomasyon oturumu onay veremez ve yayın yapamaz" kuralı pgTAP (`supabase/tests/mcp_sessions.test.sql`) ve gerçek Auth oturumlarıyla MCP entegrasyon testinde (`apps/mcp/src/integration.test.ts`) kanıtlanır.
- Makine oturumu ile MCP oturumu birbirine dönüşemez; makine oturumunun kuralları (#211) değişmedi.
- Sınırlamak: `pnpm mcp:logout` (o bilgisayardaki oturumu kapatır) ya da bir insan oturumundan `revoke_mcp_session()` (Auth oturumu silinir; panel ekranı #245'te). Kayıttan önceki an ve çalınan token için makine oturumundaki notlar aynen geçerlidir: MCP oturumu ele geçerse saldırgan o üyenin alanındaki veriyi okur ve **taslak** yazar; onay, üretim ve yayın kapalıdır.
- Viewer hesabı v1'de MCP oturumu açamaz.

## Araç girişi: kodla giriş

Barındırılan Supabase projesinin yerleşik e-posta sağlayıcısı proje genelinde saatte yalnız birkaç e-posta gönderir ([Rate limits](https://supabase.com/docs/guides/auth/rate-limits): "2 emails per hour with the built-in email provider", okuma 2026-11-16). Panel, MCP ve makine girişleri bu sınırı paylaşır. Kodla giriş, araçlara (`pnpm mcp:login`, `pnpm worker:login`) e-posta beklemeden giriş yolu verir. Gücü, üyenin **kendine giriş e-postası istemesiyle aynıdır**; tek fark kodun e-postayla değil, üyenin zaten açık olan panel oturumunda ekranda verilmesidir.

### Akış

1. Üye panelde **Ayarlar → Üretim makineleri → Araç girişi** bölümünde **Giriş kodu üret**'e basar (owner / editor). Bölüm makineler sayfasındadır, çünkü makine ekleme yönergesi ve yetki kaldırma aynı yerdedir.
2. `POST /api/tool-login` çağıranın **kendi** hesabı için tek kullanımlık bir kod döndürür. Kod ekranda maskeli gösterilir, kopyalanır; "Bu kod senin hesabınla giriş yapar; kimseyle paylaşma" uyarısı yanında durur.
3. Üye kendi bilgisayarında `pnpm mcp:login --code` ya da `pnpm worker:login --code` çalıştırır ve kodu sorulan yere yapıştırır (yazılan görünmez). Kod standart girdiden de okunur (macOS: `pbpaste | pnpm mcp:login --code`). Kod **komut satırı argümanı olarak kabul edilmez** (`--code <kod>` ve `--code=<kod>` reddedilir ve yankılanmaz): kabuk geçmişine ve süreç listesine girmesin.
4. Araç kodu anon anahtarla `POST /auth/v1/verify` (`type: magiclink`, `token_hash`) ucunda oturuma çevirir ve mevcut akışına aynen devam eder: MCP önce `register_mcp_session()` + onay yoklaması, sonra kasa; makine kasa + `register_worker()`. Ret yolları değişmedi (viewer MCP oturumu açamaz, kasa yoksa giriş başlamaz, kayıt başarısızsa oturum kapatılır). Bu modda e-posta istenmez.

Her araç için ayrı kod üretilir (kod tek kullanımlıktır).

### Kod nedir (doğrulandı)

Kod, Supabase Auth'un giriş e-postasındaki bağlantıda taşıdığı özetin aynısıdır: yönetici API'si `auth.admin.generateLink({ type: 'magiclink', email })` yanıtındaki `properties.hashed_token`. Panel yalnız bu alanı döndürür; `action_link` ve `email_otp` (6 haneli kod) istemciye verilmez. Kaynak: [supabase/auth `internal/api/mail.go` → `adminGenerateLink`](https://github.com/supabase/auth/blob/master/internal/api/mail.go), [`internal/api/verify.go`](https://github.com/supabase/auth/blob/master/internal/api/verify.go), [`internal/models/user.go` → `Recover`](https://github.com/supabase/auth/blob/master/internal/models/user.go) (okuma 2026-11-16).

| Soru                                  | Yanıt ve dayanak                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yanıtta ne var?                       | `action_link`, `email_otp`, `hashed_token`, `verification_type`, `redirect_to` + kullanıcı (`GenerateLinkResponse`). Oturum ya da yenileme token'ı yoktur                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| E-posta gönderir mi?                  | Hayır. `adminGenerateLink` özeti kullanıcıya yazar ve yanıtı döndürür; içinde e-posta gönderen çağrı yoktur (belgedeki tanım: "Generates email links and OTPs to be sent via a custom email provider"). CI kanıtı: MCP entegrasyon testi kod üretip kullandıktan sonra yerel posta kutusunda o adrese yeni ileti olmadığını doğrular                                                                                                                                                                                                                                                           |
| E-posta gönderim sınırına takılır mı? | Hayır. Sınır e-posta gönderen uçlardadır; `/admin/generate_link` yolunda hız sınırı ara katmanı yoktur ([`internal/api/api.go`](https://github.com/supabase/auth/blob/master/internal/api/api.go)). Kodun doğrulandığı `/auth/v1/verify` IP başına ayrı bir sınıra tabidir (varsayılan 5 dakikada 30)                                                                                                                                                                                                                                                                                          |
| Tek kullanımlık mı?                   | Evet. Doğrulama `recovery_token`'ı siler (`Recover` → `ClearAllOneTimeTokensForUser`); belge: "Magic Links … are one-time use only". CI kanıtı: aynı kodla ikinci giriş MCP ve makine entegrasyon testlerinde ve panel E2E'sinde reddedilir                                                                                                                                                                                                                                                                                                                                                    |
| Ömrü ne kadar?                        | Auth'un e-posta OTP süresi (`isOtpExpired(user.RecoverySentAt, config.Mailer.OtpExp)`). Barındırılan projede varsayılan **1 saat** ([Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless): "expire after 1 hour"); yerelde `supabase/config.toml` değer vermediği için CLI varsayılanı geçerlidir. Süre panel kodunda kısaltılamaz (kod sunucuda saklanmaz); owner panodan **Authentication → Email → Email OTP Expiration** ile kısaltabilir. **Süre dolumu CI'da denenmedi** (bir saat beklemek ya da Auth ayarını değiştirmek gerekir); dayanak kaynak koddur |
| Aynı anda kaç kod geçerli?            | Kullanıcı başına bir. Yeni kod üretmek ya da giriş e-postası istemek öncekini geçersiz kılar (aynı `recovery_token` alanı). CI kanıtı: MCP entegrasyon testi                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Yan etki                              | Kod üretmek `recovery_sent_at`'i günceller: aynı kullanıcı sonraki ~60 saniyede giriş e-postası isterse Auth "biraz bekleyin" der. Bekleyen bir giriş e-postası bağlantısı da geçersiz olur                                                                                                                                                                                                                                                                                                                                                                                                    |
| Kullanıcı yoksa?                      | `generateLink` `magiclink` türünde bilinmeyen e-posta için kullanıcı açabilir. Uç e-postayı istekten almaz, oturumdaki kullanıcının e-postasını kullanır ve dönen kullanıcı kimliği ile türü (`magiclink`) eşleşmiyorsa kodu vermez                                                                                                                                                                                                                                                                                                                                                            |

### Denetimler (`apps/panel/src/app/api/tool-login/route.ts`)

- Yalnız POST; `requireApiRole('editor')`; istek kaynağı (`isSameOrigin`) panelin kendisi olmalı.
- Kod yalnız çağıranın kendi hesabı içindir: **istek gövdesi okunmaz**, e-posta ve kullanıcı kimliği oturumdan gelir.
- Yalnız insan oturumu üretebilir. Makine ve MCP oturumları `team_members`'ı okuyamadığı için zaten üye sayılmaz (403); uç ayrıca `is_worker_session()` sorar ve yanıt kesin "hayır" değilse reddeder.
- Kullanıcı başına süreç içi hız sınırı: 10 dakikada 5 kod (`src/lib/tool-login/rate-limit.ts`). Anahtar sunucunun doğruladığı kullanıcı kimliğidir, istemcinin yazdığı bir başlık değil.
- Kod sunucuda saklanmaz ve loglanmaz; yanıt `Cache-Control: no-store` taşır. Tarayıcıda yalnız bileşenin belleğindedir (adres, depolama yok). Araçlar kodu argüman olarak almaz, ekrana ve loga yazmaz.
- Panel tarayıcıya oturum ya da yenileme token'ı döndürmez; üyenin zaten sahip olduğundan fazlasını vermez.

Testler: `src/app/api/tool-login/route.test.ts` (rol, kaynak, otomasyon reddi, yalnız kendi hesabı, hız sınırı, loga sızmama), `e2e/tool-login.app.spec.ts` + `tool-login.viewer.spec.ts` (gerçek uç ve arayüz; kodla açılan oturumun MCP / makine olarak kaydı ve onay reddi; ikinci kullanım; viewer ve otomasyon oturumu üretemez), `apps/mcp/src/auth/code-login.test.ts`, `apps/mcp/src/integration.test.ts`, `apps/worker/src/lib/login.test.ts`, `apps/worker/src/cli.test.ts`, `apps/worker/src/integration.test.ts`.

### Kaldırılan eşleme tasarımından farkı

Kaldırılan tasarımda makine oturumsuz bir uca yazıyor, panel onay verince sunucu makineye **kendiliğinden** oturum teslim ediyordu. Kodla girişte:

| Eşleme tasarımındaki bulgu                                  | Kodla girişte durum                                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| İstemcinin yazdığı başlığa dayanan hız sınırı               | Sınırın anahtarı doğrulanmış kullanıcı kimliğidir                                                                                                                                                       |
| Oturumsuz yazımın yol açtığı engelleme                      | Oturumsuz uç yoktur; tek uç oturum + rol + kaynak denetimlidir ve veritabanına satır yazmaz                                                                                                             |
| Onaylatma yoluyla oltalama                                  | Onaylanacak bir makine isteği yoktur. Akışı üye kendisi başlatır; kodu kendi terminaline kendisi taşır. (Birinin üyeyi kodu **kendisine göndermeye** ikna etmesi riski aşağıda)                         |
| Sunucunun üye adına oturum açıp makineye aktarması (yüksek) | Sunucu oturum açmaz ve hiçbir makineye bir şey göndermez. Yalnız isteyen üyenin kendi hesabı için, o üyenin giriş e-postasıyla eşdeğer tek kullanımlık kod üretir; oturumu Auth, kodu sunan tarafa açar |

### Kalan riskler

- **Açık ve kilitsiz bir panel oturumuna erişen kişi kod üretebilir.** Bu, o kişinin paneli zaten kullanabilmesiyle aynı düzeydedir; ek olarak kodla **başka bir cihazda** insan oturumu açılabilir (kod Auth'a doğrudan sunulursa otomasyon olarak işaretlenmemiş bir üye oturumu verir; giriş e-postası bağlantısı için de aynısı geçerlidir). Ortak bilgisayarda paneli açık bırakma.
- **Omuz üstünden okuma / ekran paylaşımı:** kod varsayılan olarak maskelidir; "Kodu göster" bilinçli bir adımdır.
- **Pano:** kopyalanan kod panoda kalır; pano yöneticileri ve eşitlenen panolar onu görebilir. Kod tek kullanımlıktır: kullanılınca panodaki değer işe yaramaz. Kullanmayacaksan yeni kod üretip eskisini geçersiz kıl.
- **Sosyal mühendislik:** biri üyeden kodu isteyebilir. Uyarı metni bunun içindir; kod parolayla aynı özenle korunur.
- **Ömür:** kod kullanılmazsa Auth'un OTP süresi boyunca (varsayılan 1 saat) geçerlidir.
- **Hız sınırı süreç içidir:** panel yeniden başlayınca sıfırlanır; birden çok panel süreci varsa her biri ayrı sayar.

Daha sıkı seçenek #245'te izlenir: araca bağlı (cihazda üretilen anahtarla eşleşen), dakikalarla ölçülen ömürlü, yalnız otomasyon oturumu açabilen kod.

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
