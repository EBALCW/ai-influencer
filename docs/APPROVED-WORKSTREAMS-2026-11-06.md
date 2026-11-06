# Onaylanan geliştirme dalgaları — 2026-11-06

> Bu dosya uygulama tamamlandı raporu değildir. 19 iş için geliştirme ve doğrulama sözleşmesidir. `test` tabanlı PR'larla ilerlenir. Gerçek hesap, Windows/macOS, GPU veya ücretli API testi yapılmadan "doğrulandı" denmez.

## Bağımlılık sırası

| Dalga | İşler | Kabul kanıtı |
| --- | --- | --- |
| 0 — Mevcut durumu doğrula | A01 #49, A02 #50, A03 #93, A04 #41 | Mevcut kodu ve açık kabul koşullarını karşılaştır; `pnpm check`, `pnpm build`, ilgili CI ve kurulum testleri |
| 1 — Güvenli içerik temeli | E01 #32, E02 #33, E03 #34, B01 #2, B02 #3 | Politika/lisans kuralları, karakter referans kimliği, otomatik QC testleri |
| 2 — Üretim | B03 #15, B04 #17, B05 #18, D01 #19 | Kaynak lisans doğrulaması → referans → sahne → render → export; deterministik testler ve örnek artefakt |
| 3 — Araştırma ve maliyet | C01 #10, C02 #11, C03 #12, C04 #13 | Kaynaklı trend kayıtları, API capability detection, read-only agent sınırları, maliyet karşılaştırması |
| 4 — Yayın ve ticari operasyon | D02 #21, F01 #30 | Yayın kontrolleri, metriklerin kaynağı, sponsorlu içerik iş akışı |

## İş bazında izlenecek doğrulamalar

- **A01/A02:** OAuth refresh, token expiry/revoke, idempotent sync, duplicate ve rate-limit testleri; gerçek platform bağlantısı ayrıca kabul bekler.
- **A03:** Supabase `test` ve `production` ortamları ayrılmalı; migration yalnız CI/CD ile uygulanır. Secret'lar loglanmaz veya repoya yazılmaz. Hesap/secret kurulumu manuel kabul gerektirir.
- **A04:** `pnpm doctor`, Windows/macOS kurulum CI, yedek bütünlüğü ve restore provası. Gerçek cihaz testleri ayrı kabul gerektirir.
- **B01/B02:** Karakter ID ve referans sürümü tüm karelerde izlenir; saç/yüz/sakal/giysi sapmaları QC'de işaretlenir. Görsel kalite için insan/GPU kabulü ayrıdır.
- **B03/B04/B05:** Lisanslı kaynak kontrolü, iş kuyruğu retry/idempotency, sahne durumları, FFmpeg hata yönetimi ve 1080×1920 H.264 çıktı metadata testi. Gerçek render GPU kabulü ayrıdır.
- **C01/C02/C03/C04:** Kaynak ve tarih alanları, yalnız okunur araştırma, resmi API/MCP yetenek kontrolü, kota ve maliyet ölçümü; canlı servis testleri ayrıca bekler.
- **D01/D02:** Pipeline geçişleri ve yayın öncesi onay; gerçek yayın ve metrik sonuçları ayrıca bekler.
- **E01/E02/E03:** Güncel resmi platform politikalarına bağlantı ve gözden geçirme tarihi, izin/lisans kayıtları, 2FA/hesap kurtarma manuel kabulü.
- **F01:** Brief ve sponsorlu içerik açıklaması, CRM veri bütünlüğü; gerçek marka hesabı gerektirmez.

## Durum sözlüğü

- `KOD_BEKLIYOR`: henüz uygulama kanıtı yok.
- `KOD_TAMAM_CI_BEKLIYOR`: kod var, CI kanıtı yok.
- `KOD_TAMAM_LOKAL_KABUL_BEKLIYOR`: otomatik testler geçti, gerçek Windows/macOS/GPU testi bekliyor.
- `KOD_TAMAM_HARICI_KABUL_BEKLIYOR`: otomatik testler geçti, gerçek platform/API/hesap doğrulaması bekliyor.
- `DOGRULANDI`: ilgili kabul kriterleri ve kanıt linkleri tamam.

## Kapanış kuralı

Bir issue yalnızca kendi kabul kriterleri doğrulandığında kapanır. Lokal veya harici kabul gerektiren işler için ayrı takip issue'su açılmadan mevcut issue kapatılmaz. PR'lar küçük ve bağımsız olmalı; `Closes #N` yalnız gerçek tamamlanmada kullanılmalı. Geliştirme PR'ları `test` tabanlıdır; `main` release akışına müdahale edilmez.

## Güvenlik ve test

`AGENTS.md` ve `docs/DEVELOPMENT.md` kuralları geçerlidir. `pnpm check` çalıştırılamayan bir ortamda PR draft kalır; test geçmiş gibi işaretlenmez. Supabase production veritabanına doğrudan yazılmaz.
