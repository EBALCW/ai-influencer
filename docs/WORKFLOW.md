# Branch, PR ve CI/CD Akışı

```
feature/xyz ──PR──▶ test ──PR──▶ main
     │               ▲  │           │
     │   (doğrudan   │  │ CD: test  │ CD: production + Release
     └── push da ────┘  │ ortamı    │
         olur)          ▼           ▼
                   CI + deploy   CI + deploy ──▶ main → test geri senkron
```

| Dal                 | Doğrudan push      | PR          | Ne olur                                                                                      |
| ------------------- | ------------------ | ----------- | -------------------------------------------------------------------------------------------- |
| `main`              | ❌ Yasak (ruleset) | ✅ Zorunlu  | CI geçerse PR otomatik onaylanır ve merge edilir → **production** migration + GitHub Release |
| `test`              | ✅ Serbest         | ✅ Olabilir | Her push'ta CI + **test** ortamına deploy                                                    |
| `feat/*`, `fix/*` … | ✅                 | —           | PR açılınca CI çalışır                                                                       |

`main` ve `test` dallarında force-push ve dal silme her iki dalda da kapalı.

## Günlük akış

0. Issue'yu kendine ata ve `in progress` label'ı ekle: `gh issue edit <n> --add-assignee @me --add-label "in progress"`
1. `test`'ten dal aç: `git switch test && git pull && git switch -c feat/kisa-ad`
2. Çalış, commit at, `pnpm check` ile kontrol et.
3. PR aç:
   - Denemek için: `gh pr create --base test` (veya küçük işlerde doğrudan `git push origin HEAD:test`)
   - Canlıya almak için: `test` → `main` PR'ı → `gh pr create --base main --head test --title "Release: <özet>"`
4. CI ve PR'daki diğer kontrollerin hepsi (ör. kurulum script'i değiştiyse `Kurulum testi`) geçince PR **otomatik onaylanır ve merge edilir**. Feature dalları squash edilip silinir, `test → main` merge commit ile birleşir.
5. Merge sonrası ilgili ortama CD otomatik çalışır.
6. PR açıklamasındaki `Closes #N` issue'ları, PR `test`'e merge edildiğinde otomatik kapanır. GitHub bunu normalde sadece `main`'de yapar, bu adımı otomatik merge workflow'u ekliyor.

### Otomatik merge'i durdurmak

- PR'ı **draft** aç, ya da
- PR'a **`bekle`** label'ı ekle (tartışma/inceleme gerekiyorsa). Label'ı kaldırınca bir sonraki CI çalışmasında merge olur; hemen istersen Actions → CI → "Re-run".

Fork'lardan gelen PR'lar ve yazma yetkisi olmayan kişilerin PR'ları **asla** otomatik merge edilmez.

## CI (`.github/workflows/ci.yml`)

Her PR'da (main ve test'e) çalışır:

| İş                                   | İçerik                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| Lint · Typecheck · Unit test · Build | `format:check`, `lint` (uyarı = hata), `typecheck`, `test`, `build` |
| E2E (Playwright)                     | Build edilen panel üzerinde uçtan uca test                          |
| Windows uyumluluğu                   | lint + typecheck + test Windows'ta                                  |
| Secret taraması                      | gitleaks ile tüm git geçmişi                                        |
| **ci-ok**                            | Hepsi başarılıysa yeşil, `main` korumasının zorunlu kontrolü        |

Kurulum script'leri değişirse ayrıca `Kurulum testi` (macOS + Windows) çalışır.

## CD: test ve production için ayrı pipeline

| Workflow                                        | Tetikleyici                               | Adımlar                                                                                            |
| ----------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Deploy · test` (`deploy-test.yml`)             | `test`'e push veya merge, elle çalıştırma | CI → **test** veritabanına migration'lar (`_migrate.yml`)                                          |
| `Deploy · production` (`deploy-production.yml`) | `main`'e merge, elle çalıştırma           | CI → **production** veritabanına migration'lar → GitHub Release → `main`'i `test`'e geri birleştir |

Migration adımı (`_migrate.yml`), iki ortamda da aynı sırayla çalışır:

1. Secret kontrolü. Eksikse deploy **hata verir**, atlamaz.
2. `supabase link`, ardından `migration list` (hangi migration uygulanmış, hangisi bekliyor).
3. `db push --dry-run`. Uzakta repoda olmayan bir migration varsa burada durur.
4. `db push`: bekleyen migration'lar uygulanır.
5. **Sapma kontrolü** (`db diff --linked`): Migration dışı bir şema değişikliği varsa deploy kırmızıya düşer.
6. Edge Function'lar varsa deploy edilir.

Seed verisi (`supabase/seed.sql`) uzak veritabanlarına **uygulanmaz**, sadece yerel ve CI içindir.

### Ortam secret'ları

**Settings → Environments** altında `test` (AiInfTest projesi) ve `production` (AiInfMain projesi) için:

| Secret                  | Nereden                                                   |
| ----------------------- | --------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens ("EBALCW General") |
| `SUPABASE_PROJECT_REF`  | Proje URL'indeki `<ref>.supabase.co`                      |
| `SUPABASE_DB_PASSWORD`  | Proje oluşturulurken belirlenen veritabanı şifresi        |

Token veya şifre değişirse: `gh secret set <AD> --env <test|production> -R EBALCW/ai-influencer` (değeri gizli olarak sorar).

## Sık sorular

**PR merge olmadı.** PR sayfasındaki notice'a bak: draft, `bekle` label'ı, CI'dan sonra yeni commit gelmesi veya fork olması merge'i engeller. Yeni commit geldiyse CI tekrar çalışır ve merge eder.

**`main → test senkronizasyonu (çakışma var)` PR'ı açıldı.** `main`'e test dışından gelen bir değişiklik `test` ile çakışıyor. Çakışmayı çöz ve PR'ı merge et (`test` korumalı değil, elle merge edilebilir).

**Acil düzeltme.** `main`'e doğrudan PR açılabilir (`--base main`). CI geçince merge olur ve `test`'e otomatik geri birleştirilir.
