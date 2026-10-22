# AGENTS.md

Bu dosya AI coding agent'ları (Codex, Claude Code vb.) için yazıldı. İnsanlar için kurulum rehberi: `docs/SETUP.md`.

## Proje

AI influencer oluşturma, büyütme ve gelire dönüştürme projesi. Kodlanacak ana parça bir **admin panel**: influencer oluşturma ve düzenleme, Instagram / YouTube / TikTok istatistikleri, içerik takvimi, maliyet ve marka takibi.

- **Repo:** `EBALCW/ai-influencer` (**public**, GitHub organization). Koda, issue'ya, PR'a gizli bilgi yazma.
- **Ekip:** 1 kişi macOS + Claude Code, 2 kişi Windows + Codex
- **Durum:** Çekirdek panel modülleri `test`'te çalışıyor (influencer, persona, medya, prompt, AI asistanı, dashboard, analitik, bildirim, kanban/takvim, maliyet, rapor). Güncel tablo: `README.md` → Durum.
- **Stack:** TypeScript · Next.js 16 (App Router, `src/proxy.ts`) · Tailwind 4 · Zod · Vitest · Playwright · Supabase (Postgres + RLS, Auth, Storage, Vault, pg_cron, pg_net, Edge Functions/Deno) · pnpm workspace
- **Sabit sürümler:** Node `.nvmrc` (24) · pnpm `package.json` → `packageManager` (10.34.7) · `engine-strict=true`

## ⛔ Veritabanı kuralı (istisnasız)

Test ve production Supabase veritabanlarına **sadece CI/CD pipeline yazar**. Agent olarak:

- `execute_sql`, `apply_migration` gibi Supabase MCP araçlarını **kullanma**.
- `supabase link`, `supabase db push`, `supabase migration repair` veya uzak `psql` **çalıştırma**.
- Studio ya da SQL editörü üzerinden değişiklik **önerme**.

Şema veya referans verisi değişikliği gerekiyorsa `supabase/migrations/` altına yeni bir migration dosyası yaz ve PR aç. Kullanıcı açıkça istese bile önce bu kuralı hatırlat. Ayrıntılar `docs/DEVELOPMENT.md` → "0. Veritabanı değişiklikleri".

## İlk kurulum

Bu bölümü şu durumlarda uygula: kullanıcı "kur", "kurulumu yap", "ortamı hazırla" dediğinde, repo yeni klonlandığında, `node_modules` yoksa veya doctor başarısızsa.

### Adım 1 — Durumu kontrol et

```
node scripts/doctor.mjs
```

- Komut çalıştı ve zorunlu kontrollerin hepsi `[OK]` ise kurulum zaten yapılmış. Uyarıları kullanıcıya özetle ve dur.
- `node` bulunamadıysa, sürüm yanlışsa ya da `[HATA]` varsa Adım 2'ye geç.

### Adım 2 — İşletim sistemine göre kurulum script'ini çalıştır

| Ortam                        | Komut (repo kökünde)                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| macOS                        | `bash scripts/setup-mac.sh`                                          |
| Windows (PowerShell, native) | `powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1` |
| Linux / WSL / container      | Script yok. "Linux / WSL" bölümündeki adımları uygula                |

Script'ler idempotenttir, tekrar çalıştırmak güvenlidir. Şunları kurar: git, gh, fnm, Node 24, corepack + pnpm, VS Code + eklentiler, `pnpm install`, `.env.local`. En sonda doctor'ı çalıştırır.

**Kurulum ağ erişimi ve workspace dışına yazma gerektirir** (Homebrew/winget, `~/.zshrc`, PowerShell profili). Sandbox bunları engellerse kullanıcıdan bu komut için izin iste (Codex: approval/escalation, Claude Code: permission prompt). Sandbox'ı aşmak için başka yollar deneme.

### Adım 3 — Kullanıcının yapması gereken anlar

Aşağıdaki durumları agent kendisi çözemez. Kullanıcıya ne yapacağını Türkçe ve tek cümleyle söyle, bitirmesini bekle, sonra devam et:

| Durum                          | Kullanıcıya söylenecek                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Homebrew şifre istiyor (macOS) | "Terminalde Mac şifreni yaz (yazarken görünmez)." Gerekirse komutu kullanıcının kendisinin çalıştırmasını iste (Claude Code'da `! <komut>`) |
| Windows UAC penceresi          | "Açılan Windows izin penceresinde Evet'e tıkla."                                                                                            |
| `gh auth login`                | "Tarayıcıda açılan GitHub sayfasına terminaldeki kodu gir ve onayla."                                                                       |
| `winget` bulunamadı            | "Microsoft Store'dan App Installer'ı kur/güncelle, sonra haber ver."                                                                        |

Kullanıcıdan şifre, token veya API anahtarını sohbete yazmasını **asla isteme**.

### Adım 4 — Doğrula ve raporla

1. `node scripts/doctor.mjs` komutunu tekrar çalıştır.
2. Sonucu kullanıcıya Türkçe ve kısa bir tabloyla bildir.
3. Kalan uyarıları açıkla:
   - `.env.local` değerlerinin boş olması normal. Değerleri kullanıcı ekip parola yöneticisinden kendisi doldurur. Agent bu dosyaya gerçek değer yazmaz.
   - `GitHub girişi` uyarısı varsa `gh auth login` gerekiyor.
4. Son olarak kullanıcıya yeni bir terminal açmasını söyle (fnm ayarı yeni terminalde yüklenir).

### Adım 4b: Geliştirme anahtarları (`.env.local`)

Kurulumdan sonra `.env.local` değerleri boşsa şunu çalıştır:

```
pnpm env:pull
```

Bu komut test Supabase projesinin URL, anon ve service role anahtarlarını (ve tanımlıysa AI anahtarlarını) GitHub'daki `local-dev` ortamından **şifreli olarak** çeker ve `.env.local`'e yazar. Değerleri ekrana veya sohbete yazma. Kullanıcının GitHub hesabında SSH anahtarı yoksa script bir anahtar oluşturup ekler. Yetki hatası verirse kullanıcıya şunu çalıştırmasını söyle: `gh auth refresh -h github.com -s admin:public_key`. Production anahtarları ve veritabanı şifresi bu yolla **verilmez**, verilmemelidir.

### Hata olursa

1. `docs/SETUP.md` → **Sık Sorunlar** bölümünde hatayla eşleşen çözümü uygula ve script'i **bir kez** tekrar çalıştır.
2. Yine olmazsa dur. Kullanıcıya hatayı ve denediklerini anlat, "Kurulum sorunu" issue'su açmayı öner (şablon: `.github/ISSUE_TEMPLATE/kurulum-sorunu.yml`). Issue'yu kullanıcı onay vermeden açma.
3. Kurulumu geçirmek için `scripts/` veya sürüm dosyalarını değiştirme. Script'te gerçek bir hata bulduysan bunu ayrı bir PR olarak öner.

### Linux / WSL

```bash
curl -fsSL https://fnm.vercel.app/install | bash   # sonra yeni shell veya: eval "$(fnm env --shell bash)"
fnm install --corepack-enabled && fnm use
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable && corepack install
pnpm install
[ -f .env.local ] || cp .env.example .env.local
node scripts/doctor.mjs
```

`git` ve `gh` yoksa dağıtımın paket yöneticisiyle kur (Ubuntu: `sudo apt install git gh`). sudo şifre isterse kullanıcıdan komutu kendisinin çalıştırmasını iste.

## Çalışma kuralları

> **Kod yazmadan önce `docs/DEVELOPMENT.md` dosyasını oku.** Bitti tanımı, veritabanı/RLS, API, arayüz ve test kuralları orada. Panel arayüz kuralları ayrıca `apps/panel/AGENTS.md` içinde. Issue'lardaki "🧭 Uygulama Rehberi" bölümü o işe özgü dosya, tablo ve test planını verir.

- **Dil:** Kullanıcıyla Türkçe konuş. Commit mesajları Türkçe ve conventional commits formatında (`feat:`, `fix:`, `docs:`, `chore:`).
- **Branch + PR:** Akış `feature → test → main` (ayrıntı: `docs/WORKFLOW.md`). `main`'e doğrudan push yasak; işe `test`'ten dal açarak başla, PR'ı `--base test` ile aç. Branch adı `<tür>/<kısa-ad>` (ör. `feat/influencer-wizard`). PR açıklamasında `Closes #<issue>` olsun. CI geçince PR otomatik onaylanıp merge edilir. İnceleme gerekiyorsa PR'ı draft aç veya `bekle` label'ı ekle.
- **PR açmadan önce:** `pnpm check` çalıştır.
- **İşe başlamadan:** İlgili issue'yu ve bağlı olduğu epic'i oku (`gh issue view <n>`). Issue başkasına atanmışsa, `in progress` label'ı varsa veya açık PR'ı varsa (`gh pr list --search "#<n>"`) başlama, kullanıcıya söyle. Değilse kendine ata ve label'ı ekle: `gh issue edit <n> --add-assignee @me --add-label "in progress"`. Kabul kriterleri bitti tanımıdır. Bağımlılıklar kapanmamışsa kullanıcıya söyle.
- **Paket yöneticisi:** Sadece `pnpm`. `npm install` veya `yarn` kullanma, `package-lock.json` oluşturma.
- **Sürümler:** `.nvmrc` ve `packageManager` alanını kullanıcı istemeden değiştirme. Değiştirirsen herkesin setup script'ini tekrar çalıştırması gerekir, PR'da bunu belirt.
- **Çapraz platform:** Kod ve script'ler Windows'ta da çalışmalı. `package.json` script'lerinde `rm -rf`, `export`, `&&` zinciriyle bash'e özgü komutlar kullanma. Gerekirse Node script'i yaz (`scripts/*.mjs`). Dosya yollarında `path.join` kullan.
- **Satır sonu:** LF (`.gitattributes`). `.ps1` dosyaları CRLF.
- **Gizli bilgiler:** API anahtarları ve token'lar sadece `.env.local` (git'e girmez) veya Supabase secret/Vault içinde durur. Koda, commit'e, issue'ya ve loglara yazılmaz. Yeni bir env değişkeni eklersen `.env.example`'a boş olarak ve açıklamasıyla ekle.
- **`scripts/` değişikliği:** `Kurulum testi` CI'ı (macOS + Windows) geçmeli.

## Komutlar

| Komut                                                              | Ne yapar                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `pnpm doctor`                                                      | Ortam sağlık kontrolü                                             |
| `pnpm setup:mac` / `pnpm setup:win`                                | Kurulum script'leri                                               |
| `pnpm install`                                                     | Bağımlılıklar                                                     |
| `pnpm panel` (`--update`, `--port`, `--no-open`, `--check`)        | Paneli build edip başlatır, tarayıcıyı açar                       |
| `pnpm backup` / `pnpm backup:restore <klasör>`                     | Supabase yedeği / yerel Supabase'e geri yükleme (`docs/SETUP.md`) |
| `pnpm dev` / `pnpm build`                                          | Geliştirme sunucusu / production build                            |
| `pnpm check`                                                       | Format + lint + typecheck + unit test (PR öncesi zorunlu)         |
| `pnpm test:e2e`                                                    | Playwright (yerel Supabase gerekir; yoksa CI'a bırak)             |
| `pnpm codemap` (`--section pages\|api\|lib\|db\|functions\|tests`) | Güncel kod haritası (aşağıya bak)                                 |
| `pnpm env:pull`                                                    | Test Supabase anahtarlarını `.env.local`'e çeker                  |
| `pnpm release`                                                     | `test` → `main` release PR'ı                                      |
| `cd supabase/functions && deno test --allow-env`                   | Edge Function testleri (`deno lint`, `deno check` de CI'da)       |

Ortam değişkeni ipucu: agent ortamında kurulum/komut takılırsa başına `CI=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0` ekle.

## Hızlı yön bulma (önce bunu yap)

Kod tabanını dosya dosya taramak yerine **`pnpm codemap`** çalıştır (≈1 sn, ağsız). Çıktı koddan üretilir, her zaman günceldir ve commit'lenmez:

- `--section pages` / `api`: her URL ve HTTP metodu → dosyası
- `--section lib`: `apps/panel/src/lib`, `components`, `packages/shared` modülleri ve export adları (yardımcıyı yeniden yazmadan önce burada ara)
- `--section db`: migration'lar sırasıyla ve her birinin oluşturduğu tablo/fonksiyon/trigger/policy/cron; en son migration zaman damgası da buradan görülür
- `--section functions` / `tests`: Edge Function'lar ve tüm test dosyaları

Sabit yerler:

```
apps/panel/src/app/(panel)/<bölüm>/   sayfalar (server component) + istemci bileşenleri
apps/panel/src/app/api/**/route.ts    API (requireApiRole + parseJson, docs/DEVELOPMENT.md §3)
apps/panel/src/lib/<alan>/            saf mantık + sorgular (+ *.test.ts yanında)
apps/panel/src/components/ui.tsx      ortak UI (StatCard, EmptyState, DataTable, Toast …)
apps/panel/e2e/                       Playwright; projeler playwright.config.ts'de
packages/shared/src/                  DB tipleri (database.types.ts üretilmiş), ALERT_TYPES
supabase/migrations/                  tek doğruluk kaynağı (şema, RLS, fonksiyon, cron)
supabase/tests/*.test.sql             pgTAP (her migration'ın testi)
supabase/functions/                   Edge Functions (Deno), ortak kod _shared/
supabase/seed.sql                     yerel/CI demo verisi
docs/                                 kurallar (DEVELOPMENT, WORKFLOW, data-model, AI, AUTH …)
scripts/                              Node script'leri (cross-platform)
```

Alan dokümanları: veri modeli `docs/data-model.md`, AI `docs/AI.md`, auth `docs/AUTH.md`, mimari kararlar `docs/adr/`.

## Paralel çalışma (birden çok agent/geliştirici)

- **Migration zaman damgası:** Yeni dosya, `test`'teki en son migration'dan (bkz. `pnpm codemap --section db`) **büyük** olmalı. PR açıkken başka migration merge olursa ve seninki artık eskiyse dosyayı yeniden adlandır (henüz uygulanmamış migration için serbest). Aynı anda birden çok migration'lı PR varsa merge sırasını korumak için `bekle` label'ı kullanılır.
- **`database.types.ts` çakışması:** Elle birleştirme yaparken üretilmiş formattaki alfabetik sırayı koru. Docker varsa `pnpm supabase:types` ile yeniden üret; yoksa elle düzenle, CI'daki tip farkı denetimi doğrular.
- **Rebase:** `git fetch && git rebase origin/test`, sonra `pnpm check`. Force push sadece `--force-with-lease` ile ve sadece kendi feature dalına.
- **Sahiplik:** Başka bir issue'nun dosyalarına (ör. dashboard, analitik) sadece link/entegrasyon için dokun; büyük değişiklik gerekiyorsa o issue'ya yorum yaz.

## Geçmiş PR'lardan öğrenilenler (tekrarlama)

- Server component'ten client component'e **fonksiyon prop** (ör. lucide ikon bileşeni) geçme → 500. İkonu isimle seç ya da client sarmalayıcı yaz.
- Supabase toplu `insert`'te tüm satırlar **aynı anahtarlara** sahip olsun; eksik anahtar null gider, NOT NULL kırılır.
- Para toplamı SQL'de (`numeric`), JS `number` ile değil. Kur yoksa toplamı gösterme, "eksik kur" de.
- Uyarı tipi eklerken `alerts_type_known` CHECK'i migration'da yeniden kur, `packages/shared` → `ALERT_TYPES` ve `formatAlert`'i güncelle (test bunu denetler).
- View yazarken `WITH (security_invoker = true)`; fonksiyonlar varsayılan `SECURITY INVOKER`. `SECURITY DEFINER` sadece API rollerine kapalı `private` şemasında ve boş `search_path` ile.
- Sırlar (token, webhook URL) migration'a yazılmaz; Vault'tan okunur. Sır yoksa iş sessizce atlanır, hata yağdırmaz.
- Playwright'ta ekran okuyucu metni (ör. "Yeni: ") yüzünden tam eşleşen locator kırılır; `getByRole(..., { name: /…/ })` kullan.
- Edge Function'lar ESLint/tsc ile değil `deno lint/check/test` ile denetlenir; editör "Cannot find name 'Deno'" derse yok say, CI belirleyicidir.

## Yol haritası

Epic'ler: #5, #9, #14, #20, #26, #31, #35 (operasyon) · #63, #64, #65, #66 (admin panel). Öncelik label'ları `P0` > `P1` > `P2`. Sıradaki büyük iş: sosyal hesap bağlama (#49) → toplayıcılar (#50, #51, #52) → zamanlanmış senkronizasyon (#53) → yayınlama (#58) ve yorum kutusu (#61).
