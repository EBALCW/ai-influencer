# 🛠 Kurulum Destek Alanı

Bu sayfa, ekipteki herkesin (Windows ve Mac) **aynı araçların aynı sürümlerini** tek seferde kurması için hazırlandı.

|                 | Sürüm                         | Nereden sabitleniyor              |
| --------------- | ----------------------------- | --------------------------------- |
| Node.js         | 24 LTS                        | `.nvmrc`                          |
| pnpm            | 10.34.7                       | `package.json` → `packageManager` |
| Dil             | TypeScript                    | (panel kodu #37 ile gelecek)      |
| Satır sonu      | LF                            | `.gitattributes`, `.editorconfig` |
| Editör ayarları | VS Code + önerilen eklentiler | `.vscode/`                        |

Sürümleri elle kurmana gerek yok. Script bu dosyaları okuyup doğru sürümü kendisi kurar. Biri sürümü güncellerse, diğerleri script'i tekrar çalıştırınca aynı sürüme geçer.

Üç yöntem var. **Yöntem A** çoğu durumda yeterli.

---

## Ön koşul: repo erişimi

Repo, **EBALCW** organization'ı altında ve private. GitHub kullanıcı adını Batu'ya ilet, seni organization'a üye olarak davet etsin. Daveti e-postadan veya [github.com/orgs/EBALCW/invitation](https://github.com/orgs/EBALCW/invitation) sayfasından kabul et.

> Codex veya Claude Code kullanıyorsan bu sayfayı okumana gerek yok. README'deki **AI agent ile kurulum** bölümündeki metni agent'a yapıştırman yeterli.

---

## Yöntem A — Tek yapıştırma (önerilen)

Aşağıdaki bloğu **tamamen kopyala**, terminale yapıştır ve Enter'a bas. Komutlar sırayla şunları yapar:

1. Git ve GitHub CLI'yi kurar.
2. Tarayıcıda GitHub girişini açar.
3. Repoyu `~/Projects/ai-influencer` klasörüne indirir.
4. Kurulum script'ini çalıştırır.

### 🪟 Windows (PowerShell)

Başlat menüsünde **PowerShell** ara ve aç (yönetici olarak açmana gerek yok).

```powershell
winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements --silent
winget install --id GitHub.cli -e --source winget --accept-source-agreements --accept-package-agreements --silent
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
gh auth status 2>$null; if ($LASTEXITCODE -ne 0) { gh auth login --web --git-protocol https }
gh auth setup-git
$dir = "$HOME\Projects\ai-influencer"
if (-not (Test-Path $dir)) { gh repo clone EBALCW/ai-influencer $dir }
Set-Location $dir
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

> `gh auth login` adımında terminalde bir kod çıkar. Enter'a basınca tarayıcı açılır, kodu oraya yapıştır ve onayla.

### 🍎 macOS (Terminal)

Spotlight'ta (⌘ + Space) **Terminal** yaz ve aç.

```bash
command -v brew >/dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
brew install git gh
gh auth status >/dev/null 2>&1 || gh auth login --web --git-protocol https
gh auth setup-git
mkdir -p ~/Projects
[ -d ~/Projects/ai-influencer ] || gh repo clone EBALCW/ai-influencer ~/Projects/ai-influencer
cd ~/Projects/ai-influencer && bash scripts/setup-mac.sh
```

> Homebrew ilk kurulumda Mac şifreni ister. Şifreyi yazarken ekranda bir şey görünmez, bu normal.

### Script ne kuruyor?

| Adım                  | Windows                                      | macOS                           |
| --------------------- | -------------------------------------------- | ------------------------------- |
| Paket yöneticisi      | winget (Windows'ta hazır gelir)              | Homebrew                        |
| Git, GitHub CLI       | ✓                                            | ✓                               |
| Node sürüm yöneticisi | fnm                                          | fnm                             |
| Node.js 24            | fnm ile `.nvmrc`'den                         | fnm ile `.nvmrc`'den            |
| pnpm                  | corepack ile `package.json`'dan              | corepack ile `package.json`'dan |
| VS Code + eklentiler  | ✓                                            | ✓                               |
| Proje bağımlılıkları  | `pnpm install`                               | `pnpm install`                  |
| `.env.local`          | `.env.example`'dan kopyalar                  | `.env.example`'dan kopyalar     |
| Git ayarı             | `core.longpaths=true`, `core.autocrlf=false` | —                               |
| Sağlık kontrolü       | `doctor`                                     | `doctor`                        |

Script'i tekrar çalıştırmak güvenlidir, kurulu olan araçları atlar. Sorun yaşarsan önce script'i bir kez daha çalıştır.

---

## Yöntem B — Kurulumsuz: GitHub Codespaces

Bilgisayarına hiçbir şey kurmak istemiyorsan veya Yöntem A çalışmadıysa bunu kullan. Proje tarayıcıda açılan bir VS Code içinde çalışır. Ortam `.devcontainer/` ayarlarından kurulur, yani herkesin ortamı birebir aynı olur.

1. Repo sayfasında **Code → Codespaces → Create codespace on main**
2. 2-3 dakika bekle. Kurulum otomatik yapılır, en sonda `doctor` çıktısı görünür.
3. Panel çalışınca **Ports** sekmesinden 3000 portunu aç.

Notlar:

- Kişisel GitHub hesaplarında aylık ücretsiz Codespaces kotası var. Kullanmadığında codespace'i durdur.
- Sosyal medya OAuth callback'leri (#49) `localhost` yerine Codespaces adresine yönlenir. Bağlantı testlerini Yöntem A ile yapmak daha kolay.
- Docker Desktop kuruluysa aynı ortam yerelde de açılabilir: VS Code → **Dev Containers: Reopen in Container**.

---

## Yöntem C — Elle kurulum

1. [Git](https://git-scm.com/downloads), [GitHub CLI](https://cli.github.com) ve [VS Code](https://code.visualstudio.com) kur.
2. [fnm](https://github.com/Schniz/fnm#installation) kur, ardından repo klasöründe `fnm install --corepack-enabled && fnm use` çalıştır.
3. `corepack enable && corepack install && pnpm install`
4. `.env.example` dosyasını `.env.local` adıyla kopyala.
5. `pnpm doctor`

---

## Doğrulama

```bash
pnpm doctor
```

Zorunlu kontrollerin hepsi `[OK]` olmalı. `[UYARI]` satırları kurulumu engellemez. Örneğin `.env.local` değerleri ilk gün boş olabilir.

## Anahtarları almak: `pnpm env:pull`

Kurulumdan sonra panelin test veritabanına bağlanması için:

```bash
pnpm env:pull
```

Komut test Supabase projesinin anahtarlarını GitHub'dan **şifreli** olarak çekip `.env.local`'e yazar. Kimseden anahtar istemen veya mesajla göndermen gerekmez.

- **Nasıl çalışır:** GitHub secret'ları geri okunamaz. Bir workflow secret'ları senin GitHub hesabındaki SSH anahtarınla şifreler, script indirip senin bilgisayarında çözer. Repo public olsa da şifreli paketi sadece sen açabilirsin.
- **İlk seferde:** SSH anahtarın yoksa script oluşturur ve GitHub'a ekler. Yetki hatası alırsan `gh auth refresh -h github.com -s admin:public_key` çalıştırıp tekrar dene.
- **Kapsam:** Sadece test projesinin anahtarları gelir. Production anahtarları ve veritabanı şifresi gelmez, veritabanına sadece pipeline yazar (`docs/DEVELOPMENT.md` §0).

## Anahtarlar (`.env.local`)

- Gerçek anahtarlar **sadece** kökteki `.env.local` dosyasına yazılır. Bu dosya git'e gönderilmez, panel de bu dosyayı okur.
- Değerler **ekip parola yöneticisinin paylaşılan kasasında** tutulur. WhatsApp, Slack, e-posta, issue veya agent sohbeti ile paylaşılmaz.
- Panelin çalışması için `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` yeterli. `SUPABASE_SERVICE_ROLE_KEY` ekip daveti için gerekli, sadece owner'ın bilgisayarında olması yeterli. `SUPABASE_DB_URL` sadece yedek alan kişide olur.
- **Aynı veriyi görmek için** herkesin `.env.local`'ı aynı ortak dev Supabase projesini göstermeli. `pnpm supabase:start` ile açılan yerel Supabase her bilgisayarda ayrı bir veritabanıdır.
- Bir anahtar yanlışlıkla commit'lenir veya paylaşılırsa hemen ekibe haber ver. Anahtar iptal edilip yenisi alınır.

## Paneli açmak

```bash
pnpm panel
```

Bu komut sırasıyla şunları yapar:

1. Ortamı kontrol eder (`doctor`).
2. Kod değiştiyse paneli build eder. İlk seferde 1-2 dakika sürer, sonrasında atlanır.
3. Paneli başlatır ve tarayıcıda `http://127.0.0.1:3000` adresini açar.

Kapatmak için terminalde **Ctrl+C**.

| Seçenek                  | Ne yapar                                                         |
| ------------------------ | ---------------------------------------------------------------- |
| `pnpm panel --update`    | Önce en son kodu çeker (`git pull` + `pnpm install`), sonra açar |
| `pnpm panel --port 3001` | 3000 portu doluysa başka port                                    |
| `pnpm panel --no-open`   | Tarayıcıyı açmaz                                                 |

`.env.local`'da Supabase değerleri yoksa panel yine açılır ama giriş çalışmaz. Script bunu uyarı olarak söyler.

> Geliştirme yapıyorsan `pnpm panel` yerine `pnpm dev` kullan. Değişiklikler anında yansır.

## Güncel kalmak

Her çalışma gününe şununla başla (Windows ve Mac'te aynı):

```bash
pnpm panel --update
```

Sadece kodu güncellemek istiyorsan `git pull` ve ardından `pnpm install`.

Commit'lenmemiş değişikliğin varsa `--update` durur ve seni uyarır. `.nvmrc` veya `packageManager` değiştiyse `doctor` Node/pnpm sürümünün yanlış olduğunu söyler. O durumda kurulum script'ini tekrar çalıştır.

## Yedekleme ve geri yükleme

**Neyi yedekliyoruz:** Supabase veritabanı. Şema (`schema.sql`), uygulama verisi (`data-public.sql`) ve ekip kullanıcıları (`data-auth.sql`) ayrı dosyalara yazılır. Storage'daki görsel/video dosyaları henüz yedeklenmiyor, bucket'lar #45 ile gelecek.

**Supabase'in kendi yedeği:** Otomatik günlük yedekler Supabase'in ücretli planlarında var. Ücretsiz planda olup olmadığını ve saklama süresini proje açılırken [supabase.com/pricing](https://supabase.com/pricing) sayfasından doğrula. Kendi yedeğimizi her durumda **haftada bir** alıyoruz.

**Gereksinim:** PostgreSQL 17 istemci araçları (`pg_dump`, `psql`)

- macOS: `brew install postgresql@17`
- Windows: [PostgreSQL 17](https://www.postgresql.org/download/windows/) kurulumunda sadece "Command Line Tools" seç, `bin` klasörünü PATH'e ekle.

**Yedek almak** (`.env.local`'da `SUPABASE_DB_URL` olmalı):

```bash
pnpm backup
```

Başarılı yedekte `manifest.json`, üç SQL dosyasının boyutunu ve SHA-256 özetini tutar. Büyük dosyalar akışla okunur. Kopyalama sonrası `pnpm backup:verify <yedek-klasörü>` ile veritabanına bağlanmadan bütünlüğü kontrol edebilirsin. Geri yükleme bu kontrolü **yerel veriyi silmeden önce** zorunlu çalıştırır; eksik, boş veya değişmiş dosyada durur. Manifesti olmayan eski yedek için güncel script ile yeni yedek al. Bu kontrol yanlışlıkla bozulmayı yakalar; şifreleme veya kaynağın doğruluğuna dair imza sağlamaz. Yedekleri erişimi kısıtlı, şifreli alanda tut. macOS/Linux üzerinde yeni klasör/dosyalar yalnız kullanıcıya açık izinlerle oluşturulur; Windows’ta klasörün kullanıcı erişim izinlerini kontrol et.

Yedek `~/ai-influencer-backups/<tarih>/` klasörüne yazılır. Script repo içine yazmayı reddeder, çünkü repo public ve yedek hassas veri içerir. Bu klasörü ekibin erişimi kısıtlı bulut alanına kopyala.

**Geri yükleme testi** (ayda bir, sadece yerel Supabase'e, Docker gerekir):

```bash
pnpm supabase:start
pnpm supabase:db-reset
pnpm backup:restore ~/ai-influencer-backups/<tarih>
```

Script ortak dev veya production projesine geri yüklemeyi reddeder, sadece `127.0.0.1` kabul eder. Test sonucunu `docs/incidents.md` şablonuyla ekibin kısıtlı alanına kaydet.

---

## Sık Sorunlar

**Windows: `winget` tanınmıyor**
Microsoft Store'u aç, **App Installer** uygulamasını ara ve güncelle (ya da kur). PowerShell'i kapatıp yeniden aç.

**Windows: "running scripts is disabled on this system"**
Şunu çalıştır, sonra komutu tekrar dene:
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

**Kurulum bitti ama yeni terminalde `node` / `pnpm` bulunamıyor**
Terminali tamamen kapatıp yeniden aç. fnm ayarı yeni açılan terminallerde yüklenir. Yine olmazsa script'i tekrar çalıştır.

- Mac: `~/.zshrc` dosyasında `fnm env` satırı olmalı.
- Windows: `notepad $PROFILE` ile profil dosyasını aç, `fnm env` satırı olmalı.

**`corepack` hatası (signature / keyid / prompt)**
`npm i -g corepack@latest` çalıştır, sonra script'i tekrar çalıştır.

**`pnpm install` → "Unsupported engine"**
Node sürümün yanlış. Repo klasöründe `fnm use` çalıştır. `node -v` çıktısı `v24...` olmalı.

**Git her dosyayı değişmiş gösteriyor (Windows)**
Satır sonu sorunu. Şunu çalıştır:
`git config --global core.autocrlf false; git rm --cached -r .; git reset --hard`
(Dikkat: commit'lenmemiş değişikliklerin silinir. Önce kaydet.)

**`gh repo clone` → "Could not resolve to a Repository"**
EBALCW organization davetini henüz kabul etmemişsin ya da `gh auth login` ile başka bir hesaba giriş yaptın. `gh auth status` ile kontrol et.

**Mac: `code` komutu bulunamıyor**
VS Code'u aç → ⌘⇧P → **Shell Command: Install 'code' command in PATH**.

## Hâlâ çözülmediyse

[**Kurulum sorunu** issue'su aç](https://github.com/EBALCW/ai-influencer/issues/new?template=kurulum-sorunu.yml). Hata çıktısını ve `pnpm doctor` çıktısını ekle.
