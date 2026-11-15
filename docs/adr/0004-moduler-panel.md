# ADR 0004: Modüler üretim paneli

- **Durum:** Önerildi (ekip onayı bekliyor)
- **Tarih:** 2026-11-15
- **İlgili issue:** [#199](https://github.com/EBALCW/ai-influencer/issues/199) · yol haritası [#236](https://github.com/EBALCW/ai-influencer/issues/236) · kapsam `docs/scope-v1.md`

## Bağlam

Panel tek modül için kuruldu: her şey bir AI influencer karakterine bağlı. Kapsam kararıyla (15 Kasım 2026) panel üç modüllü oluyor: anlatım videoları, yayıncı klipleri ve park edilen AI influencer. Karakter yalnız üçüncüsünde zorunlu. Render kullanıcının kendi makinesinde (macOS ve Windows) çalışacak, sağlayıcılar değiştirilebilecek, kullanıcının bağladığı yapay zekâ orkestratör olacak.

Bugünkü durum (hepsi `test` dalından okundu):

| Yer                                  | `influencer_id` bağı                                                                                                                                                | Kaynak                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `content_items`                      | `NOT NULL`; trigger'lar hedef hesabın, medyanın ve postun aynı influencer'a ait olmasını ister                                                                      | `20261021090000_initial_schema.sql:129`, `20261022130000_content_pipeline.sql:82-145`               |
| `generations`                        | `NOT NULL`; `enqueue_generation`, `generations_prepare` ve `complete_generation` influencer üzerinden çalışır                                                       | `initial_schema.sql:95`, `20261022230000_generation_queue.sql`                                      |
| `social_accounts`, `oauth_states`    | `NOT NULL`; OAuth RPC'leri `p_influencer_id` alır                                                                                                                   | `initial_schema.sql:112`, `20261024210000_oauth_state_store.sql:5`                                  |
| `costs`                              | `NOT NULL`; `/api/ai/suggest` de `influencerId` ister                                                                                                               | `initial_schema.sql:201`, `apps/panel/src/app/api/ai/suggest/route.ts:46`                           |
| `brand_deals`, `influencer_personas` | `NOT NULL` (yalnız influencer modülünü ilgilendirir)                                                                                                                | `initial_schema.sql:39,232`                                                                         |
| `assets`                             | Kolon boş olabilir, ama `assets` bucket'ına yazma ve okuma yalnız `<influencer uuid>/…` klasöründe mümkün                                                           | `initial_schema.sql:57`, `20261022150000_asset_storage_hardening.sql`, `workspaces.sql:1714`        |
| `clips`                              | Boş olabilir, ama `push_clip_to_backlog` hedef influencer olmadan hata verir                                                                                        | `20261112100000_streamer_clips.sql:59,241`                                                          |
| Zaten boş olabilenler                | `prompts`, `budgets`, `alerts`, `reports`, `trends`, `learnings`                                                                                                    | ilgili migration'lar                                                                                |
| `assets` bucket'ı                    | 100 MB sınırı; yalnız JPEG, PNG, WebP, AVIF, MP4, WebM (ses, SRT ve JSON yüklenemez)                                                                                | `20261021180000_asset_storage.sql:3-7`                                                              |
| Anahtarlar                           | Kurulum geneli: `ANTHROPIC_API_KEY` panel sunucusunda, Higgsfield ve OAuth istemci sırları Edge Function secret'ında. Sosyal hesap token'ları hesap başına Vault'ta | `.env.example`, `docs/adr/0003-workspaces.md`, `20261022160000_oauth_vault_helpers.sql`             |
| Video hatları                        | Yalnız skill ve komut satırı; dosyalar repo dışında `~/ai-influencer-films`, `~/ai-influencer-clips`. Anlatım hattı Windows'ta denenmedi                            | `docs/explainer-guide.md`, `docs/clip-guide.md`, `.claude/skills/anlatim-videosu/blender/README.md` |

## Karar 1: Modül kavramı ve karakter bağı

Modül, kodda tanımlı sabit bir listedir (`packages/shared` → `MODULES`: `influencer`, `explainer`, `clip`; park durumu da orada). Veritabanında `text` + `CHECK` olarak tutulur; ayrı bir modül tablosu yoktur.

| Seçenek                                                                   | Artı                   | Eksi                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (a) Her yerde `influencer_id` boş olabilir + `module` + modüle özel sahip | Tek tablo ailesi       | Sahipliği influencer eşitliğiyle denetleyen bütün trigger ve RPC'ler yeniden yazılır; `generations` gibi dokunmaya gerek olmayan tablolar da açılır    |
| (b) Modül başına "kanal" satırı influencer rolünü oynar                   | Migration gerekmez     | Persona, wizard, liste, dashboard ve raporlar sahte karakterlerle dolar; "karakter yalnız influencer modülünde" ilkesi arayüzde her yerde süzgeç ister |
| (c) Modül başına ayrı tablo ailesi, yalnız iş ve varlık ortak             | Mevcut şemaya dokunmaz | Takvim, yayın kuyruğu, post ve analitik `content_items` üzerinde; hepsinin ikinci kopyası gerekir                                                      |

**Karar: (c) ile (a)'nın birleşimi.** Modüle özgü veri kendi tablolarında durur; `influencer_id` yalnız bütün modüllerin geçtiği ortak omurgada gevşetilir.

- **Modül tabloları.** Anlatım: `series`, `topic_suggestions`, `episodes` (#216; `episodes.series_id` boş olabilir, bölüm numarası seri içinde tekil). Klip: mevcut `clip_sources`, `clips`. Influencer: mevcut tablolar, değişmez.
- **Gevşetilen ortak omurga** (`ALTER COLUMN influencer_id DROP NOT NULL` + `module text NOT NULL DEFAULT 'influencer'` + `CHECK (module <> 'influencer' OR influencer_id IS NOT NULL)`): `content_items` (modüller arası yayın kartı; takvim, `publish_jobs`, `posts` ve analitik bunun üstünde kalır), `social_accounts` (Karar 6), `costs`.
- **Dokunulmayan:** `generations`. Karakterli ücretli üretici çağrılarının defteri olarak kalır (Karar 2). Karaktersiz bir modül ücretli görsel üreticiye ilk kez bağlandığında (#203) o issue'da gevşetilir.
- **Storage.** Yeni özel bucket `productions`, yol `<workspace_id>/<job_id>/<dosya>`. `assets` bucket'ı ve içindeki nesneler yerinde kalır. Modül çıktıları `assets` tablosuna `influencer_id = NULL` ve yeni `bucket` kolonuyla (`DEFAULT 'assets'`) kaydedilir; `assets_paths_in_influencer_folder` kısıtı influencer boşken yolu zaten denetlemiyor.

Modül başına alanlar:

| Modül      | Zorunlu                                                            | İsteğe bağlı                                                                                                                               |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Anlatım    | İstek ya da konu, dil, görsel yol                                  | Seri; seri varsa bölüm numarası. Tema, görsel stil, ses, altyazı stili: seri varsayılanı → bölümde üstüne yazma → işe alınırken dondurulur |
| Klip       | Kaynak adresi, hak durumu (`granted` + referans olmadan kesim yok) | Kanal takibi, karakter ataması                                                                                                             |
| Influencer | Karakter, referans görseller, persona                              | Marka, prompt kütüphanesi                                                                                                                  |

**Migration etkisi.** Yalnız yeni, ileri yönlü migration'lar; mevcut dosyalar düzenlenmez. Her yeni tablo ADR 0003 kalıbını izler: `workspace_id`, RESTRICTIVE `<tablo>_workspace` policy'si, `aa_set_workspace` trigger'ı (ör. `episodes` için `series_id=series.id`), `supabase/tests/workspaces.test.sql`. `set_workspace_from_parent()` boş FK'yi atlar ve alanı `DEFAULT current_workspace_id()`'den bırakır (`workspaces.sql:146-218`); yani influencer'sız satır oturumlu kullanıcıda doğru alana düşer, service role yazımı `workspace_id` vermek zorundadır. `storage_object_in_workspace` yeni migration'da `CREATE OR REPLACE` ile `productions` dalını alır: ilk klasör `current_workspace_id()::text` olmalı. Yeniden yazılacak fonksiyonlar: `content_items` doğrulama trigger'ları (influencer eşitliği yalnız `module = 'influencer'` iken), `push_clip_to_backlog` (influencer'sız kart açabilmeli), OAuth state ve bağlama RPC'leri.

**Mevcut satırlar.** Hepsi `module = 'influencer'` olur, `influencer_id` değerleri değişmez, hiçbir Storage nesnesi taşınmaz.

**Çıkarım (kod okunarak, denenmedi):** İçerik check-list'i 25 madde ister ve anatomi maddeleri içerir (`content_pipeline.sql:68`); karaktersiz modüller için madde kümesi #205'te modüle göre tanımlanmalı. AI etiketi, kaynak/hak alanı ve "puanlayan ≠ üreten" kuralı her modülde kalır.

## Karar 2: Ortak üretim işi modeli

| Seçenek                                | Değerlendirme                                                                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generations`'ı genişletmek            | Tablo tek sağlayıcı çağrısını modelliyor: `influencer_id`, `prompt_id`, `mode`, `credits`, `provider_job_id`; maliyet trigger'ı satır başına tek tutar yazar. Aşama, onay ve makine kavramı yok |
| **Yeni `jobs` + `job_stages`** (karar) | Bütün modüller aynı kuyruğu kullanır. `generations` ücretli sağlayıcı çağrısı defteri olarak kalır; bir aşama üretici çağırırsa `generations.job_id` ile bağlanır                               |

- **`jobs`:** `module`, `kind` (ör. `explainer.render`, `clip.preview`, `clip.cut`), sahip FK'si (`episode_id` ya da `clip_source_id`), dondurulmuş `params`, `status` (`queued`, `running`, `awaiting_approval`, `succeeded`, `failed`, `cancelled`), `stop_at`, `progress`, `required_capabilities text[]`, `worker_id`, `lease_expires_at`, `attempts` / `max_attempts`, `cancel_requested_at`, `failed_stage`, `error`, `retry_of`.
- **`job_stages`:** iş başına sıralı aşamalar; `status`, `progress`, `attempts`, `error`, `requires_approval`, `approved_by`, `approved_at`, kısa `output` özeti.
- **`job_assets`:** iş ↔ `assets` bağı ve rol (ses, altyazı, ara kare, final).
- **RPC'ler** (`generations` kalıbı: `public` INVOKER sarmalayıcı + `internal` DEFINER çekirdek, alan filtresi çekirdekte): `enqueue_job`, `claim_job`, `report_progress` (kirayı da uzatır), `complete_stage`, `fail_stage`, `approve_job_stage`, `request_cancel_job`, `retry_job`.
- **Kira.** `claim_job` `FOR UPDATE SKIP LOCKED` ile alır ve `lease_expires_at` yazar. `generations`'taki gibi `next_run_at`'i üç amaçla kullanmak yerine kira ayrı kolondur. Kira dolarsa iş kuyruğa döner ve `attempts` artar; `max_attempts` aşılırsa `failed`.
- **Yeniden deneme.** Geçici hata aynı aşamada `attempts` artırır. Kullanıcının "yeniden dene"si `retry_of` ile yeni iş açar, tamamlanmış aşamaların çıktıları yeniden kullanılır.
- **İptal.** Başlamamış iş anında `cancelled`; çalışan işte `cancel_requested_at` yazılır, makine bir sonraki ilerleme çağrısında görüp durur.
- **`stop_at` ve onay.** Onay gerektiren aşama bitince iş `awaiting_approval` olur. Sonraki aşamaya geçişi yalnız çekirdek fonksiyon yapar ve önceki aşamada `approved_at` yoksa reddeder. `approved_by` / `approved_at` yalnız `approve_job_stage()` ile, `auth.uid()`'den yazılır; doğrudan `UPDATE` trigger'la engellenir. Üretim makinesi oturumu onay veremez (Karar 3).

## Karar 3: Üretim makinesinin kimliği

| Seçenek                                             | Değerlendirme                                                                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service role anahtarı makinede                      | **Reddedildi.** Anahtar RLS'i aşar; tek bir ekip bilgisayarının ele geçmesi bütün çalışma alanlarını, Vault RPC'lerini ve Auth yönetimini açar. Anahtar döndürülmeden geri alınamaz |
| **Ekip üyesi oturumu + alanla sınırlı RPC** (karar) | Mevcut RLS ve Storage policy'leri aynen geçerli. İptal: oturumu kapatmak ya da üyeyi çıkarmak. Ek altyapı küçük                                                                     |
| Edge Function'ın bastığı makine token'ı             | En dar yetki, ama kendi imzalama, yenileme ve iptal mekanizmamızı gerektirir. Aşağıdaki oturum işaretleme doğrulanamazsa yedek seçenek                                              |

- **Program:** `apps/worker` (Node 24, TypeScript, pnpm workspace). Kullanıcı sürecidir; Windows servisi olarak çalışmaz, çünkü kimlik kasasına kullanıcı bağlamında erişir.
- **Giriş.** `pnpm worker login` eşleme kodu gösterir; kullanıcı kodu panelde (`/settings/machines`) oturumu açıkken onaylar; makine kendi ayrı oturumunu alır. Yenileme token'ı işletim sistemi kasasında durur (macOS Keychain, Windows Credential Manager). Kasa yoksa program düz dosyaya yazmaz, durur. Supabase Auth'ta hazır bir cihaz akışı görmedik; eşleme ucunu biz yazacağız (**çıkarım**, #211'de doğrulanacak).
- **Kayıt.** `production_workers`: ad, platform, sürüm, `capabilities`, `user_id`, oturum kimliği, `last_seen_at`, `revoked_at`.
- **Yetenek ve kalp atışı.** `worker_heartbeat(worker_id, capabilities)` 30 saniyede bir; 90 saniye sessiz kalan makine çevrimdışı sayılır. Yetenekler #212 denetiminden gelir (ffmpeg + libass, yt-dlp, Blender, HyperFrames, Python ortamı, konuşma tanıma, yerel ajan, makinedeki sağlayıcı anahtarları).
- **İş alma.** `claim_job` yalnız çağıranın alanındaki, `required_capabilities` kümesi makinenin yeteneklerinin alt kümesi olan işi verir. v1'de 5 saniyelik yoklama; Realtime sonraya.
- **Yükleme.** Makine Storage'a kullanıcı JWT'siyle yazar: `productions/<workspace_id>/<job_id>/…`. Alan dışına yazmayı `storage_objects_workspace` reddeder. Devam ettirilebilir yükleme ve boyut kuralı #215.
- **Ele geçmiş makine ne yapabilir?** O üyenin kendi alanındaki yetkisi kadar okur ve yazar. Yapamadıkları: başka alan, Vault, service role işleri. Ek sınır: makine oturumu `production_workers`'a kayıtlıdır; onay, yayın, ekip ve sağlayıcı anahtarı RPC'leri kayıtlı makine oturumundan gelen çağrıyı reddeder. Bu, erişim token'ındaki oturum kimliği claim'ine dayanır (**doğrulanmadı**; #211'in ilk işi. Tutmazsa üçüncü seçeneğe geçilir).
  - **#211 notu (2026-11-16):** Claim doğrulandı (`docs/AUTH.md` → "Üretim makinesi oturumu"). Uygulama bu maddeden daha dardır: makine oturumu `viewer` gibi okur, yazabildiği yalnız makine RPC'leri ve kirasındaki işin `productions` klasörüdür; reddedilen RPC'ler tek tek işaretlenmez, `can_write_data()` makine oturumunda `false` döner.
- **Windows.** Yollar `path.join` ile; bash'e özgü komut yok (AGENTS.md → çapraz platform). Rehberlerde macOS yolları sabit yazılı (`/Applications/Blender.app/…`, `/opt/homebrew/opt/ffmpeg-full/…`); araç yolları yetenek denetiminden okunmalı. Kurulum yönergesi winget ile. Skia, HyperFrames, Blender ve klip aracı Windows'ta henüz denenmedi (#213); CI'da Windows işi sahte render ile başlar (#211).

## Karar 4: AI orkestratörü ve sağlayıcı bağımsızlığı

| Seçenek                                               | Artı                                                                           | Eksi                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| (a) Makinede kullanıcının kendi kodlama ajanı, başsız | Mevcut abonelik, API anahtarı yok; proje skill'leri (araştırma, senaryo) hazır | Tek satıcı; makine kapalıyken çalışmaz; ekibin ikisi Codex kullanıyor            |
| (b) API anahtarıyla sağlayıcıdan bağımsız çağrı       | Makine gerekmez; `/api/ai/suggest` yolu zaten böyle çalışıyor                  | Token başına ücret; çok adımlı araştırma için araç ve ajan döngüsünü biz yazarız |
| **(c) Hibrit** (karar)                                | Kısa metin işleri her zaman çalışır; çok adımlı iş hazır ajanı kullanır        | İki arka uç, iki test yolu                                                       |

- **Akışı model yönetmez.** Aşama sırası, `stop_at` ve onay kapıları `jobs` / `job_stages` içindedir (Karar 2). "Orkestratör", istek kutusundaki metni bir işe çeviren ve aşamaları sırayla yürüten koddur; model yalnız aşamanın içini doldurur. Bu yüzden sağlayıcı değişince akış değişmez.
- **`TextProvider`** (dar arayüz): konu önerisi, senaryo taslağı, başlık/açıklama/etiket, çeviri, klip değerlendirmesi. Girdi ve çıktı Zod şemasıdır. İlk arka uç mevcut `apps/panel/src/lib/ai/claude.ts`; ikinci arka uç arayüzü doğrulamak için eklenir. Sunucuda çalışır, makine gerekmez.
- **`AgentBackend`** (isteğe bağlı): araştırma, kaynak toplama ve doğruluk notu gibi çok adımlı aşamalar. İlk uygulama makinede `claude -p`. Yerel sürümde (2.1.325, `claude --help`) doğrulanan bayraklar: `-p/--print`, `--output-format json|stream-json`, `--json-schema`, `--allowedTools`, `--tools`, `--permission-mode` (`dontAsk` dahil), `--max-budget-usd`, `--append-system-prompt`, `--resume`, `--bare`. Resmî belgeye göre `-p` modunda skill'ler istemde `/skill-adı` yazılarak çalışır; `--bare` abonelik girişini okumaz ve ileride `-p` için varsayılan olacağı duyurulmuş ([kaynak](https://code.claude.com/docs/en/headless), okuma 2026-11-15). Sonuç: abonelikle çalışma bugün mümkün, ama bu davranışa kalıcı diye güvenilmez; arka uç arayüzün arkasında durur, anahtarla çalışan yol her zaman yedektir.
- **Ajan yoksa** çok adımlı aşamalar `TextProvider` ile tek çağrılık sade sürüme düşer (web araştırması yok; kaynakları kullanıcı girer). Makinede ajan var ama alanda anahtar yoksa kısa metin işleri de ajan üzerinden kısa iş olarak çalışır.
- **Güvenilmeyen içerik** (transkript, web sayfası, yorum):
  1. Dosya ya da ayrılmış veri bloğu olarak verilir, sistem talimatına karışmaz.
  2. Aşama çıktısı şemaya uymak zorundadır (`--json-schema` / Zod); şemaya uymayan çıktı aşamayı `failed` yapar.
  3. Ajan dar izin listesiyle başlar: iş klasöründe okuma ve yazma, web araması. `bypassPermissions` kullanılmaz. Supabase oturumu ve sağlayıcı anahtarları ajan sürecinin ortamına verilmez; veritabanına ajan değil makine programı yazar.
  4. Ajanın yayınlama ya da onay verme aracı yoktur; kapılar veritabanındadır.
  5. Test: içine talimat gömülü transkript ve sayfa örnekleri çıktıyı ve araç çağrılarını değiştirmemeli (#204 kabul ölçütü).

## Karar 5: Sağlayıcı arayüzleri ve anahtar saklama

Arayüzler `packages/shared` altında tip olarak tanımlanır; her uygulama nerede çalıştığını bildirir:

| Arayüz            | Örnek uygulamalar                                                                   | Çalıştığı yer   |
| ----------------- | ----------------------------------------------------------------------------------- | --------------- |
| `TextProvider`    | Anthropic API, ikinci bir API                                                       | Sunucu          |
| `AgentBackend`    | Claude Code başsız                                                                  | Makine          |
| `VoiceProvider`   | edge-tts (ses + kelime zamanları), ileride ücretli ses                              | Makine          |
| `VisualProvider`  | Skia, HyperFrames, Blender, stok, meme; ileride ücretli üretici                     | Makine / sunucu |
| `CaptionProvider` | Kelime zamanından altyazı, konuşma tanıma, çeviri                                   | Makine          |
| `PublishProvider` | Mevcut `Publisher` (`supabase/functions/_shared/publishers/types.ts`), dışa aktarma | Sunucu          |

Ayar: `provider_settings` (çalışma alanı + iş türü → sağlayıcı, gizli olmayan `config`). Ekip okur, owner yazar.

| Anahtar nerede dursun?                                | Değerlendirme                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase Vault** (karar, sunucuda çalışanlar için)  | Sosyal token'larda kullanılan kalıp hazır: yalnız service role'e açık dar RPC, ada bağlı okuma. Ad: `provider-key:<workspace_id>:<sağlayıcı>` |
| Şifreli kolon + DEFINER fonksiyon                     | Aynı güvenceyi verir, ama şifreleme anahtarını ve döndürmeyi biz yönetiriz                                                                    |
| **Yalnız makinede** (karar, makinede çalışanlar için) | Stok görüntü anahtarı gibi makinede kullanılan anahtar işletim sistemi kasasında kalır, Supabase'e hiç gitmez                                 |

Kural: anahtar kullanıldığı yerde durur ve oradan çıkmaz. Vault'taki anahtar makineye, makinedeki anahtar Supabase'e gönderilmez. Tarayıcıya yalnız "tanımlı mı" ve son güncelleme zamanı döner. Bugünkü kurulum geneli anahtarlar (`ANTHROPIC_API_KEY`, Higgsfield) yalnız kurulumda tek çalışma alanı varken yedek olarak okunur; ikinci alan açılınca devre dışı kalır (ADR 0003'teki tek alan uyumluluğuyla aynı kural). Platform OAuth istemci sırları kurulum geneli kalır.

## Karar 6: Yayın hesapları

- **Token'lar** bugünkü gibi Vault'ta, hesap başına (`social-token:<account_id>`). Değişmez.
- **Hesap çalışma alanına aittir.** `social_accounts.influencer_id` boş olabilir; OAuth state ve bağlama RPC'leri influencer'sız çalışan yeni sürümlerini alır.
- **Eşleme:** `publish_targets` (çalışma alanı, modül, isteğe bağlı seri, platform → hesap). Çözüm sırası: paylaşım anında seçilen → seri varsayılanı → modül varsayılanı. Influencer modülünde bugünkü influencer → hesap bağı sürer.
- **Dışa aktarma** v1'in garantili yoludur. Mevcut `manual_required` durumu ve elle post eşleştirme (`POST /api/content-items/[id]/post`) kullanılır; paket = video + başlık + açıklama + etiketler + künye. TikTok için kodda yayıncı yok (`PublishPlatform = 'instagram' | 'youtube'`); denetim bitene kadar yalnız dışa aktarma.

Platform kısıtları (resmî belgeler, okuma 2026-11-15):

| Platform  | Bulgu                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube   | `videos.insert` ile `status.containsSyntheticMedia` yazılabiliyor. Belge kotayı "günde 100 çağrı, Video Uploads kovasında 1 birim" diye veriyor ve "doğrulanmamış API projelerinden yüklenen videolar gizli moda kısıtlanmaz" diyor ([kaynak](https://developers.google.com/youtube/v3/docs/videos/insert?hl=en)). Kodumuz 1600 birim varsayıyor (`publishers/youtube.ts:29`), `.env.example` gizli kilidinden söz ediyor: #233'te güncellenmeli   |
| Instagram | Profesyonel hesap; izin `instagram_business_content_publish` (Instagram Login). Medya, deneme anında herkese açık bir adreste olmalı (kodumuz kısa ömürlü imzalı Storage adresi veriyor). 24 saatte 100 API paylaşımı; aynı belgenin carousel bölümü 50 diyor. AI beyanı `is_ai_generated` ([kaynak](https://developers.facebook.com/docs/instagram-platform/content-publishing))                                                                  |
| TikTok    | Denetimden geçmemiş istemci: yalnız `SELF_ONLY`, paylaşım anında hesap gizli olmalı, 24 saatte en çok 5 kullanıcı. `post_info.is_aigc` AI etiketi. `PULL_FROM_URL` doğrulanmış alan adı ister; bizde `FILE_UPLOAD` gerekir. Paylaşım ekranında yaratıcı bilgisi ve açık onay zorunlu ([yönerge](https://developers.tiktok.com/doc/content-sharing-guidelines), [API](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)) |

## Karar 7: Gezinme

Modüller üst düzey bölümdür; ortak sayfalar modül süzgeci alır. Mevcut adresler değişmez.

| Grup      | Sayfa                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ana ekran | `/`: modül kartları (park edilen işaretli), son üretimler, makine durumu                                                                                             |
| Modüller  | `/explainers` (yeni: seriler, bölümler, öneriler) · `/clips` · `/influencers` (Park; altında `/prompts`, `/research`, `/brands`)                                     |
| Üretim    | `/production`: bütün modüllerin işleri ve makineler; bugünkü üretici kuyruğu burada sekme olur · varlık kütüphanesi (#207)                                           |
| Yayın     | `/content`, `/calendar`, `/inbox`, `/analytics`: modül ve seri süzgeciyle ortak                                                                                      |
| Yönetim   | `/costs` (modül kırılımı) · `/settings`: ekip, sağlayıcılar (bugünkü `/settings/ai` buraya girer), sosyal hesaplar ve eşleme, makineler, bildirimler, senkronizasyon |

Kenar çubuğundaki genel influencer seçici (`?inf=`, `apps/panel/src/components/panel-shell.tsx:81`) yalnız influencer modülünde görünür. Bugünkü `/` dashboard'u influencer verisine dayanıyor (**çıkarım**, `dashboard.tsx`); içeriği `/influencers` özetine taşınır.

## Sonuçlar

**Olumlu:** Mevcut influencer verisi ve akışı yerinde kalır. Takvim, yayın kuyruğu ve analitik tek kopya olarak bütün modüllere hizmet eder. Service role anahtarı hiçbir kullanıcı makinesine gitmez. Onay kapıları modelden ve makineden bağımsızdır.

**Maliyet ve risk:**

- `content_items` trigger'ları ve OAuth RPC'leri yeniden yazılır; mevcut pgTAP testleri (`content_pipeline`, `publishing`, `oauth_*`) güncellenir.
- İki ayrı kuyruk (`jobs`, `generations`) bir süre yan yana yaşar.
- Makine oturumu bir ekip üyesinin yetkisini taşır; oturum işaretleme doğrulanana kadar onay kapısının makineye karşı güvencesi eksiktir.
- Abonelikle başsız ajan çalıştırma satıcının değiştirebileceği bir davranıştır.
- Makine kapalıyken render ve ajan aşamaları bekler; kısa metin işleri ve yayın çalışmaya devam eder.

## Kapsam dışı

- Kiralık ya da sunucuda render.
- Makine programının kurulum paketi, otomatik güncellemesi, Windows servisi olarak çalışması.
- Çoklu alan üyeliği, kendi kendine kayıt (ADR 0003 sonraki fazları).
- Çalışma alanı başına modül açma/kapama ve faturalama.
- Mevcut Storage nesnelerinin yeni bucket'a taşınması.
- Denetim tamamlanmadan TikTok'a otomatik paylaşım; trend ses ekleme.
- Kendi modelimizi eğitmek.

## Açık sorular

1. **Windows'taki iki ekip üyesi hangi ajanı kullanacak?** Varsayılan: `AgentBackend` arayüzü + önce Claude Code uygulaması; ajanı olmayan makine sade yola düşer. Codex için ikinci uygulama v1'e girecekse ekip söylemeli.
2. **Abonelik girişiyle gözetimsiz `claude -p` çalıştırmak plan koşullarına uygun mu?** Doğrulayamadık. Ürün sahibi teyit edene kadar varsayılan: herkes kendi makinesinde kendi girişiyle çalıştırır, panel kimlik bilgisi taşımaz; anahtarlı yol yedekte.
3. **Supabase planı ve dosya boyutu sınırı.** Beş dakikalık bir film 100 MB'ı aşabilir. Varsayılan: `productions` bucket'ı aynı sınırla açılır, makine sınıra sığacak şekilde yeniden kodlar (#215).
4. **Platform geliştirici uygulamaları kimin hesabında açılacak ve TikTok denetimine kim başvuracak?** (#49, #232). Yayın fazının takvimi buna bağlı.

## Uygulama sırası

Yol haritasıyla (#236) aynı sıra; her adım ayrı PR ve ayrı migration.

1. **Temel.** `jobs`, `job_stages`, `job_assets`, `production_workers` + RPC'ler + pgTAP (#201) → `productions` bucket'ı, `storage_object_in_workspace` dalı, `assets.bucket` → `apps/worker` iskeleti, eşleme girişi, sahte render, Windows CI (#211, #212) → gezinme (#200) → `provider_settings` ve Vault RPC'leri (#203) → `TextProvider` ayrıştırması, `costs.influencer_id` gevşetme, ajan keşfi (#204) → onay RPC'leri (#205).
2. **Anlatım.** `series`, `topic_suggestions`, `episodes` (#216) → öneri ve senaryo (#217, #218) → ses, altyazı, HyperFrames aşamaları (#219, #220) → `content_items` gevşetme + `module` ve dışa aktarma paketi (#234).
3. **Klip.** Klip aracı iş olarak çalışır (#226, #227); `push_clip_to_backlog` influencer'sız kart açar.
4. **Yayın.** `social_accounts` gevşetme, OAuth RPC'lerinin yeni sürümleri (#232) → `publish_targets` (#235) → zamanlanmış paylaşım ve tek takvim (#233, #206).
5. **Genişletme.** Kalan görsel yollar, varlık kütüphanesi, maliyet ve bütçe (#209), çok dil, Windows doğrulaması (#213).
6. **AI influencer** parktan çıkınca `generations.job_id` bağı ve gerekirse `generations` gevşetmesi.
