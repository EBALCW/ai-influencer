# AGENTS.md

Bu dosya AI coding agent'ları (Codex, Claude Code vb.) için yazıldı. İnsanlar için kurulum rehberi: `docs/SETUP.md`.

## Proje

AI influencer oluşturma, büyütme ve gelire dönüştürme projesi. Kodlanacak ana parça bir **admin panel**: influencer oluşturma ve düzenleme, Instagram / YouTube / TikTok istatistikleri, içerik takvimi, maliyet ve marka takibi.

- **Repo:** `EBALCW/ai-influencer` (private, GitHub organization)
- **Ekip:** 1 kişi macOS + Claude Code, 2 kişi Windows + Codex
- **Durum:** Planlama aşamasında. Kurulum altyapısı hazır, panel kodu yok (#37 ile başlayacak)
- **Stack (plan, #36):** TypeScript · Next.js 15 (App Router) · Tailwind + shadcn/ui · Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) · pnpm workspace
- **Sabit sürümler:** Node `.nvmrc` (24) · pnpm `package.json` → `packageManager` (10.34.7) · `engine-strict=true`

## İlk kurulum

Bu bölümü şu durumlarda uygula: kullanıcı "kur", "kurulumu yap", "ortamı hazırla" dediğinde, repo yeni klonlandığında, `node_modules` yoksa veya doctor başarısızsa.

### Adım 1 — Durumu kontrol et

```
node scripts/doctor.mjs
```

- Komut çalıştı ve zorunlu kontrollerin hepsi `[OK]` ise kurulum zaten yapılmış. Uyarıları kullanıcıya özetle ve dur.
- `node` bulunamadıysa, sürüm yanlışsa ya da `[HATA]` varsa Adım 2'ye geç.

### Adım 2 — İşletim sistemine göre kurulum script'ini çalıştır

| Ortam | Komut (repo kökünde) |
|---|---|
| macOS | `bash scripts/setup-mac.sh` |
| Windows (PowerShell, native) | `powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1` |
| Linux / WSL / container | Script yok. "Linux / WSL" bölümündeki adımları uygula |

Script'ler idempotenttir, tekrar çalıştırmak güvenlidir. Şunları kurar: git, gh, fnm, Node 24, corepack + pnpm, VS Code + eklentiler, `pnpm install`, `.env.local`. En sonda doctor'ı çalıştırır.

**Kurulum ağ erişimi ve workspace dışına yazma gerektirir** (Homebrew/winget, `~/.zshrc`, PowerShell profili). Sandbox bunları engellerse kullanıcıdan bu komut için izin iste (Codex: approval/escalation, Claude Code: permission prompt). Sandbox'ı aşmak için başka yollar deneme.

### Adım 3 — Kullanıcının yapması gereken anlar

Aşağıdaki durumları agent kendisi çözemez. Kullanıcıya ne yapacağını Türkçe ve tek cümleyle söyle, bitirmesini bekle, sonra devam et:

| Durum | Kullanıcıya söylenecek |
|---|---|
| Homebrew şifre istiyor (macOS) | "Terminalde Mac şifreni yaz (yazarken görünmez)." Gerekirse komutu kullanıcının kendisinin çalıştırmasını iste (Claude Code'da `! <komut>`) |
| Windows UAC penceresi | "Açılan Windows izin penceresinde Evet'e tıkla." |
| `gh auth login` | "Tarayıcıda açılan GitHub sayfasına terminaldeki kodu gir ve onayla." |
| `winget` bulunamadı | "Microsoft Store'dan App Installer'ı kur/güncelle, sonra haber ver." |

Kullanıcıdan şifre, token veya API anahtarını sohbete yazmasını **asla isteme**.

### Adım 4 — Doğrula ve raporla

1. `node scripts/doctor.mjs` komutunu tekrar çalıştır.
2. Sonucu kullanıcıya Türkçe ve kısa bir tabloyla bildir.
3. Kalan uyarıları açıkla:
   - `.env.local` değerlerinin boş olması normal. Değerleri kullanıcı ekip parola yöneticisinden kendisi doldurur. Agent bu dosyaya gerçek değer yazmaz.
   - `GitHub girişi` uyarısı varsa `gh auth login` gerekiyor.
4. Son olarak kullanıcıya yeni bir terminal açmasını söyle (fnm ayarı yeni terminalde yüklenir).

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

- **Dil:** Kullanıcıyla Türkçe konuş. Commit mesajları Türkçe ve conventional commits formatında (`feat:`, `fix:`, `docs:`, `chore:`).
- **Branch + PR:** `main`'e doğrudan push yapma. Branch adı `<tür>/<kısa-ad>` (ör. `feat/influencer-wizard`). PR açıklamasında `Closes #<issue>` olsun.
- **İşe başlamadan:** İlgili issue'yu ve bağlı olduğu epic'i oku (`gh issue view <n>`). Kabul kriterleri bitti tanımıdır. Bağımlılıklar kapanmamışsa kullanıcıya söyle.
- **Paket yöneticisi:** Sadece `pnpm`. `npm install` veya `yarn` kullanma, `package-lock.json` oluşturma.
- **Sürümler:** `.nvmrc` ve `packageManager` alanını kullanıcı istemeden değiştirme. Değiştirirsen herkesin setup script'ini tekrar çalıştırması gerekir, PR'da bunu belirt.
- **Çapraz platform:** Kod ve script'ler Windows'ta da çalışmalı. `package.json` script'lerinde `rm -rf`, `export`, `&&` zinciriyle bash'e özgü komutlar kullanma. Gerekirse Node script'i yaz (`scripts/*.mjs`). Dosya yollarında `path.join` kullan.
- **Satır sonu:** LF (`.gitattributes`). `.ps1` dosyaları CRLF.
- **Gizli bilgiler:** API anahtarları ve token'lar sadece `.env.local` (git'e girmez) veya Supabase secret/Vault içinde durur. Koda, commit'e, issue'ya ve loglara yazılmaz. Yeni bir env değişkeni eklersen `.env.example`'a boş olarak ve açıklamasıyla ekle.
- **`scripts/` değişikliği:** `Kurulum testi` CI'ı (macOS + Windows) geçmeli.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm doctor` | Ortam sağlık kontrolü |
| `pnpm setup:mac` / `pnpm setup:win` | Kurulum script'leri |
| `pnpm install` | Bağımlılıklar |

Panel kodu geldikçe (#37) `dev`, `build`, `lint`, `typecheck`, `test` komutları buraya eklenecek.

## Repo haritası

```
AGENTS.md            agent talimatları (bu dosya)
CLAUDE.md            Claude Code girişi (AGENTS.md'yi içe aktarır)
docs/SETUP.md        insanlar için kurulum rehberi + sık sorunlar
scripts/             setup-mac.sh, setup-windows.ps1, doctor.mjs
.devcontainer/       Codespaces ortamı
.github/             issue şablonları, CI (setup-check.yml)
apps/panel/          (planlanan) Next.js admin panel
supabase/            (planlanan) migration'lar, edge functions
packages/shared/     (planlanan) ortak tipler
```

## Yol haritası

Epic'ler: #5, #9, #14, #20, #26, #31, #35 (operasyon) · #63, #64, #65, #66 (admin panel). Öncelik label'ları `P0` > `P1` > `P2`. Panel geliştirmesi #36 (ADR) → #37 (iskelet) → #38 (DB) sırasıyla başlar.
