# Branch, PR ve CI/CD Akışı

```
feature/xyz ──PR──▶ test ──PR──▶ main
     │               ▲  │           │
     │   (doğrudan   │  │ CD: test  │ CD: production + Release
     └── push da ────┘  │ ortamı    │
         olur)          ▼           ▼
                   CI + deploy   CI + deploy ──▶ main → test geri senkron
```

| Dal                 | Doğrudan push      | PR          | Ne olur                                                                                   |
| ------------------- | ------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| `main`              | ❌ Yasak (ruleset) | ✅ Zorunlu  | CI geçerse PR otomatik onaylanır ve merge edilir → **production** deploy + GitHub Release |
| `test`              | ✅ Serbest         | ✅ Olabilir | Her push'ta CI + **test** ortamına deploy                                                 |
| `feat/*`, `fix/*` … | ✅                 | —           | PR açılınca CI çalışır                                                                    |

`main` ve `test` dallarında force-push ve dal silme her iki dalda da kapalı.

## Günlük akış

1. `test`'ten dal aç: `git switch test && git pull && git switch -c feat/kisa-ad`
2. Çalış, commit at, `pnpm check` ile kontrol et.
3. PR aç:
   - Denemek için: `gh pr create --base test` (veya küçük işlerde doğrudan `git push origin HEAD:test`)
   - Canlıya almak için: `test` → `main` PR'ı → `gh pr create --base main --head test --title "Release: <özet>"`
4. CI geçince PR **otomatik onaylanır ve merge edilir**. Feature dalları squash edilip silinir, `test → main` merge commit ile birleşir.
5. Merge sonrası ilgili ortama CD otomatik çalışır.

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

## CD (`.github/workflows/cd.yml`)

| Tetikleyici                 | Ortam        | Adımlar                                                                                      |
| --------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `test`'e push / merge       | `test`       | CI → Supabase migration + Edge Functions                                                     |
| `main`'e merge              | `production` | CI → Supabase migration + Edge Functions → GitHub Release → `main`'i `test`'e geri birleştir |
| Actions → CD → Run workflow | seçilen      | Elle yeniden deploy                                                                          |

Panel her ekip bilgisayarında yerel çalıştığı için deploy edilen kısım Supabase'dir (veritabanı şeması ve zamanlanmış işler). Panel kodu `git pull` ile güncellenir.

### Ortam secret'ları (tek seferlik kurulum)

Supabase projeleri açıldığında (#38) **Settings → Environments** altında `test` ve `production` için şunlar eklenir:

| Secret                  | Nereden                                            |
| ----------------------- | -------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens             |
| `SUPABASE_PROJECT_REF`  | Proje URL'indeki `<ref>.supabase.co`               |
| `SUPABASE_DB_PASSWORD`  | Proje oluşturulurken belirlenen veritabanı şifresi |

Secret'lar yokken CD hata vermez, Supabase adımını atlar ve uyarı yazar.

## Sık sorular

**PR merge olmadı.** PR sayfasındaki notice'a bak: draft, `bekle` label'ı, CI'dan sonra yeni commit gelmesi veya fork olması merge'i engeller. Yeni commit geldiyse CI tekrar çalışır ve merge eder.

**`main → test senkronizasyonu (çakışma var)` PR'ı açıldı.** `main`'e test dışından gelen bir değişiklik `test` ile çakışıyor. Çakışmayı çöz ve PR'ı merge et (`test` korumalı değil, elle merge edilebilir).

**Acil düzeltme.** `main`'e doğrudan PR açılabilir (`--base main`). CI geçince merge olur ve `test`'e otomatik geri birleştirilir.
