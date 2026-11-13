# ADR 0003: Çalışma alanları (kiracı başına yalıtım)

- **Durum:** Kabul edildi (uygulama: `supabase/migrations/20261113100000_workspaces.sql`)
- **Tarih:** 2026-11-13
- **İlgili issue:** [#181](https://github.com/EBALCW/ai-influencer/issues/181)

## Bağlam

Panel "tek ortak ekip" olarak tasarlanmıştı: `team_members` tablosundaki herkes bütün satırları görüyor, RLS yalnız rolü (owner / editor / viewer) denetliyordu. Karar (#181): herkes kendi hesabıyla, kendi çalışma alanında çalışacak; uygulama ileride ürün olabilir. Bu bir güvenlik modeli değişikliğidir: artık aynı veritabanında birbirini görmemesi gereken kiracılar var.

## Karar

1. **`workspaces` tablosu, kullanıcı başına tek alan.** `team_members.workspace_id` eklendi; `user_id` birincil anahtar kaldı. Bir kullanıcı aynı anda tek bir alanın üyesidir. Roller alan içinde geçerlidir; son owner kuralı alan başınadır.
2. **Kiracıya ait her tabloda `workspace_id`** (`NOT NULL`, `workspaces` FK, `ON DELETE CASCADE`, indeks, `DEFAULT public.current_workspace_id()`).
3. **Yalıtım RESTRICTIVE policy ile.** Her kiracı tablosunda `<tablo>_workspace` policy'si: `workspace_id = current_workspace_id()` (USING ve WITH CHECK, `FOR ALL TO authenticated`). Mevcut permissive policy'lere (rol kuralları) dokunulmadı.
4. **Üst kayıttan türetme.** `private.set_workspace_from_parent()` trigger'ı INSERT'te `workspace_id`'yi üst kayıttan alır, UPDATE'te değiştirmez ve FK ile bağlanan her üst kaydın aynı alanda olduğunu doğrular.
5. **RLS'i aşan her şey alanı açıkça filtreler:** SECURITY DEFINER fonksiyonlar, cron işleri, Storage policy'leri ve service role kullanan sunucu kodu.
6. **Küresel tekil kısıtlar alan başına tekil oldu** (influencer `slug`, marka adı, ayar anahtarı, kur/kredi fiyatı, rapor dönemi, uyarı `dedupe_key` …).
7. **Yeni alan yalnız servis anahtarıyla açılır:** `pnpm workspace:create <e-posta> ["ad"]` → `create_workspace_for_user()`. İstemciden alan oluşturma yoktur.

Mevcut bütün satırlar ve üyeler migration'da oluşturulan tek alana ("Varsayılan çalışma alanı") taşındı.

## Neden RESTRICTIVE policy

Postgres'te permissive policy'ler birbirleriyle **OR**'lanır; restrictive policy'ler sonuca **AND**'lenir. Alan koşulunu onlarca mevcut policy'nin her birine eklemek yerine tablo başına tek restrictive policy yazmak:

- mevcut rol kurallarını ve onların testlerini olduğu gibi bırakır,
- ileride eklenen permissive bir policy'nin yalıtımı yanlışlıkla gevşetmesini imkânsız kılar (yeni policy ne derse desin alan koşulu AND'lenir),
- katalogdan denetlenebilir: `supabase/tests/workspaces.test.sql`, muafiyet listesinde olmayan her public tabloda bu policy'nin, kolonun, FK'nin ve trigger'ın varlığını doğrular. Yeni tablo unutulursa test kırılır.

## `current_workspace_id()` ve tek alan uyumluluğu

| Çağıran                                                                     | Sonuç                          |
| --------------------------------------------------------------------------- | ------------------------------ |
| Oturumlu üye (`auth.uid()` dolu)                                            | Üyenin alanı                   |
| Oturumlu ama üye olmayan kullanıcı                                          | `NULL` (hiçbir satır eşleşmez) |
| `anon` / `authenticated` JWT'si, kullanıcı kimliği yok                      | `NULL`                         |
| Oturumsuz (service role, postgres, seed, cron), **tam olarak bir alan var** | O alan                         |
| Oturumsuz, **birden çok alan var**                                          | `NULL`                         |

Son iki satır bilinçli bir uyumluluk kuralıdır. Tek alanlı kurulumda (yerel geliştirme, CI, bugünkü production) seed, pgTAP testleri ve service role yazımları değişmeden çalışır. İkinci alan açıldığı anda bu kolaylık kendiliğinden kapanır: üst kaydı olmayan ve alanı verilmemiş bir service role yazımı `NOT NULL` kısıtına takılır. Yani çok alanlı kurulumda sunucu kodu ya `workspace_id`'yi **açıkça verir** ya da satır **üst kayıttan türetilir**; sessizce yanlış alana yazmak mümkün değildir.

Sonuç olarak: service role ile kök tabloya (ör. `influencers`, `brands`) yazan her yeni kod `workspace_id` vermelidir. E2E testlerinde ikinci alan yalnız yalıtım testi sürerken vardır (bkz. `apps/panel/playwright.config.ts` → `isolation` projesi).

## Üst kayıttan türetme

FK kısıtı RLS'e bakmaz: A alanındaki kullanıcı, B alanındaki bir kaydın UUID'sini biliyorsa ona bağlı satır eklemeyi deneyebilir. Trigger bunu iki yolla kapatır:

- **Türetme:** `influencer_id` gibi "sahip" FK'si dolu olan satırın `workspace_id`'si o üst kayıttan alınır; istemcinin ya da DEFAULT'un verdiği değer ezilir. Başka alanın kaydına bağlanan satır o alanın kimliğini alır ve restrictive `WITH CHECK` tarafından reddedilir (42501). Aynı mekanizma `auth.uid()`'siz service role yazımlarını (toplayıcılar, cron, worker) doğru alana düşürür.
- **Doğrulama:** Diğer FK'ler (`assignee_id`, `brand_id`, `asset_id` …) trigger argümanında `?` ile işaretlidir; alanı belirlemezler ama aynı alanda olmak zorundadırlar (23514). Bu denetim service role için de geçerlidir.

`workspace_id` UPDATE'te hiçbir rol için değişmez; satır alan değiştiremez. Trigger `private` şemasında SECURITY DEFINER'dır (boş `search_path`): üst kayıt çağıranın RLS'inde görünmese bile alanı okunabilmelidir. Hangi FK'nin hangi üst tabloya baktığı trigger argümanlarında yazılıdır; pgTAP kiracı tabloları arasındaki her FK'nin listede olduğunu denetler.

## RLS'i aşan kod

- **Kullanıcı tetikli DEFINER çekirdekler** (`internal.cancel_generation`, `internal.request_sync`): kaydı `workspace_id = current_workspace_id()` ile arar.
- **Service role RPC'leri** (OAuth state/connect/revoke): kullanıcı kimliği parametre olarak gelir; influencer ve hesap o kullanıcının alanında olmalıdır.
- **Sistem işleri** (uyarılar, bütçe, maliyet, haftalık rapor): tüm alanlarda çalışır; ürettikleri satırlar ilgili kaydın alanına yazılır, eşik ve fiyatlar o alanın ayarlarından okunur. Kur, kredi fiyatı ve bütçe hesaplarının çekirdekleri `internal` şemasında alanı parametre alır; `public` sarmalayıcıların imzası değişmedi.
- **Storage:** `storage.objects` üzerinde restrictive policy; nesnenin ilk klasörü (influencer ya da deal kimliği) çağıranın alanında olmalıdır. Tanımsız bucket varsayılan olarak kapalıdır.
- **Sunucu kodu:** ekip listesi, davet, rol değiştirme ve üye çıkarma service role kullanır; hepsi `requireApiRole()`'ün döndürdüğü `workspaceId` ile filtrelenir. Manuel senkronizasyon isteği Edge Function'a `workspace_id` ile gider.

Fonksiyon fonksiyon liste, bu değişikliği getiren PR'ın açıklamasındaki denetim tablosundadır.

## Bilinçli sınırlar

- **Push bildirim kanalları** (ntfy / Telegram / e-posta) Vault'ta kurulum genelinde tek settir. Yalnız `workspaces.push_enabled = true` olan alanlar kullanabilir; mevcut alan için açık, yeni alanlar için kapalıdır ve istemci değiştiremez. Alan başına push hedefi sonraki bir iştir.
- **`generation_worker_status`** kurulum geneli tek satırdır (worker sağlığı; kullanıcı verisi içermez).
- **Sosyal hesap `(platform, external_id)`** küresel tekil kaldı: gerçek bir hesap tek alana bağlanır. Yan etkisi: başka alanda bağlı bir hesabı eklemeye çalışan kullanıcı "zaten var" hatasından hesabın sistemde kayıtlı olduğunu anlayabilir.
- **YouTube API kotası** uyarısı alan başına hesaplanır; gerçek kota Google projesi başınadır (kurulum geneli).
- **Sağlayıcı anahtarları** (Higgsfield, OAuth istemcileri, Anthropic) kurulum genelidir; alan başına anahtar yoktur.
- **Alan silme** için arayüz ya da script yok. `ON DELETE CASCADE` tanımlı, ancak `posts.account_id` gibi `RESTRICT` FK'ler yüzünden dolu bir alanın tek komutla silinebildiği doğrulanmadı.

## Sonraki fazlar (ayrı issue'lar)

1. **Self-serve kayıt:** kullanıcının kendi alanını açması (kayıt şu an kapalı; alan yalnız `pnpm workspace:create` ile açılır).
2. **Çoklu alan üyeliği:** `team_members` birincil anahtarının `(workspace_id, user_id)` olması; `current_workspace_id()`'nin etkin alanı oturumdan okuması.
3. **Alan değiştirme** arayüzü ve alan başına push hedefleri / sağlayıcı anahtarları.
