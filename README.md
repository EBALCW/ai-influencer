# AI Influencer

Yapay zeka ile influencer karakteri oluşturma, büyütme ve gelire dönüştürme projesi. Proje iki parçadan oluşuyor:

1. **Operasyon:** Karakter tasarımı, hesap kurulumu, trend araştırması, içerik üretimi, yayın ve monetizasyon. [Bu videodaki](https://youtu.be/YCthYjhIY90) 7 günlük süreç temel alındı.
2. **Admin Panel:** Ekip bilgisayarlarında açılan bir web uygulaması. Influencer oluşturma ve düzenleme, YouTube / Instagram / TikTok istatistikleri, içerik takvimi, maliyet takibi ve marka iş birlikleri buradan yönetilecek.

## 🛠 Kurulum

### 🤖 AI agent ile kurulum (Codex / Claude Code) — önerilen

**Ön koşul:** EBALCW organization davetini kabul etmiş olmalısın.

1. Bir terminal aç (Windows: PowerShell, Mac: Terminal). Agent'ı ev klasöründe başlat: `codex` veya `claude`.
2. Aşağıdaki metni olduğu gibi agent'a yapıştır.
3. Agent kurulum komutları için izin istediğinde onayla. GitHub girişi, şifre veya Windows izin penceresi çıkarsa agent ne yapacağını söyleyecek.

```text
EBALCW/ai-influencer reposunu bu bilgisayara kur ve geliştirmeye hazır hale getir.

1. GitHub CLI (gh) kurulu değilse kur (Windows: winget install --id GitHub.cli -e, Mac: brew install gh).
2. `gh auth status` ile kontrol et. Giriş yoksa `gh auth login --web --git-protocol https`
   çalıştır, tarayıcıda ne yapmam gerektiğini bana söyle ve bekle. Ardından `gh auth setup-git`.
3. Repoyu ev klasöründeki Projects/ai-influencer klasörüne klonla
   (`gh repo clone EBALCW/ai-influencer`). Klasör zaten varsa içinde `git pull` yap.
4. Repo kökündeki AGENTS.md dosyasını oku ve "İlk kurulum" bölümünü adım adım uygula.
5. Sonunda doctor sonucunu Türkçe, kısa bir tabloyla özetle ve benim yapmam gereken bir şey kaldıysa söyle.
```

Agent'lar talimatlarını repodaki dosyalardan okur: Codex → [`AGENTS.md`](AGENTS.md), Claude Code → [`CLAUDE.md`](CLAUDE.md) (o da `AGENTS.md`'yi içe aktarır). Kurulum adımları ve çalışma kuralları bu dosyalarda olduğu için kurulumdan sonra da agent'lar aynı kurallarla çalışır.

### Elle kurulum

Windows ve Mac için tek yapıştırmalık komutlar, Codespaces seçeneği ve sık sorunlar: **[docs/SETUP.md](docs/SETUP.md)**

Kurulumdan sonra kontrol için: `pnpm doctor`

## Geliştirme

Kurulum (yukarıdaki agent metni veya `docs/SETUP.md`) bittikten sonra:

| Komut                           | Ne yapar                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                      | Paneli başlatır → http://localhost:3000                                             |
| `pnpm check`                    | Format + lint + typecheck + unit test (PR açmadan önce çalıştır)                    |
| `pnpm build`                    | Production build                                                                    |
| `pnpm test:e2e`                 | Playwright uçtan uca testleri (ilk seferde `pnpm exec playwright install chromium`) |
| `pnpm supabase:start` / `:stop` | Yerel Supabase (opsiyonel, Docker Desktop gerekir)                                  |

Geliştirme kuralları: **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** · Branch, PR ve CI/CD akışı: **[docs/WORKFLOW.md](docs/WORKFLOW.md)** (`feature → test → main`, CI geçince otomatik onay + merge)

Supabase için varsayılan yol ortak **dev** projesidir, değerleri `.env.local`'a yazılır ve Docker gerekmez. Yerel Supabase sadece migration denemek için gerekir.

## Yol haritası

| Epic                   | Konu                                                           |
| ---------------------- | -------------------------------------------------------------- |
| [#5](../../issues/5)   | 1 · AI karakter oluşturma ve imaj                              |
| [#9](../../issues/9)   | 2 · Hesap kurulumu ve algoritma ısıtma                         |
| [#14](../../issues/14) | 3 · Trend araştırması, otomasyon, AI entegrasyonları           |
| [#20](../../issues/20) | 4 · İçerik üretim hattı                                        |
| [#26](../../issues/26) | 5 · Yayın stratejisi ve analitik                               |
| [#31](../../issues/31) | 6 · Bütçe ve monetizasyon                                      |
| [#35](../../issues/35) | 7 · Risk, uyum ve platform kuralları                           |
| [#63](../../issues/63) | 8 · Admin panel: altyapı ve mimari                             |
| [#64](../../issues/64) | 9 · Admin panel: Influencer Studio                             |
| [#65](../../issues/65) | 10 · Admin panel: sosyal medya entegrasyonları ve analitik     |
| [#66](../../issues/66) | 11 · Admin panel: operasyon (içerik, yayın, maliyet, markalar) |

Öncelikler `P0` / `P1` / `P2` label'larıyla işaretli. İşe `P0` ile başlanır.

## Admin panel (plan)

```
[Ekip bilgisayarı: Next.js panel (localhost:3000)]
          │
          ▼
[Supabase: Postgres · Auth · Storage · Vault]
          ▲
          │  pg_cron → Edge Functions (Instagram / YouTube / TikTok sync)
          ▼
[Instagram Graph API · YouTube Data & Analytics API · TikTok API · Higgsfield · Claude API]
```

Panel her bilgisayarda yerel olarak çalışır, veri Supabase'de ortak tutulur. Böylece ekipteki herkes aynı veriyi görür ve istatistik toplama job'ları bilgisayarlar kapalıyken de çalışır. Mimari karar ve seçenek karşılaştırması: [ADR 0001](docs/adr/0001-admin-panel-stack.md) · [#36](../../issues/36).

## Durum

Proje altyapısı ve admin panel başlangıç iskeleti hazır. Influencer yönetimi ve diğer ürün özellikleri yol haritasındaki işler kapsamında geliştirilecek.
