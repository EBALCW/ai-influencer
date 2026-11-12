# Onaylanan geliştirme dalgaları — 2026-11-06

> Bu dosya uygulama tamamlandı raporu değildir. 19 iş için geliştirme ve doğrulama sözleşmesidir. `test` tabanlı PR'larla ilerlenir. Gerçek hesap, Windows/macOS, GPU veya ücretli API testi yapılmadan "doğrulandı" denmez.

## Bağımlılık sırası

| Dalga                         | İşler                                     | Kabul kanıtı                                                                                                 |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 0 — Mevcut durumu doğrula     | A01 #49, A02 #50, A03 #93, A04 #41        | Mevcut kodu ve açık kabul koşullarını karşılaştır; `pnpm check`, `pnpm build`, ilgili CI ve kurulum testleri |
| 1 — Güvenli içerik temeli     | E01 #32, E02 #33, E03 #34, B01 #2, B02 #3 | Politika/lisans kuralları, karakter referans kimliği, otomatik QC testleri                                   |
| 2 — Üretim                    | B03 #15, B04 #17, B05 #18, D01 #19        | Kaynak lisans doğrulaması → referans → sahne → render → export; deterministik testler ve örnek artefakt      |
| 3 — Araştırma ve maliyet      | C01 #10, C02 #11, C03 #12, C04 #13        | Kaynaklı trend kayıtları, API capability detection, read-only agent sınırları, maliyet karşılaştırması       |
| 4 — Yayın ve ticari operasyon | D02 #21, F01 #30                          | Yayın kontrolleri, metriklerin kaynağı, sponsorlu içerik iş akışı                                            |

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

## Açık issue denetimi — 6 Kasım 2026

GitHub açık issue aramasında **39 açık kayıt** bulundu (epic'ler dahil). Bu belge yalnız onaylı 19 işin takip sözleşmesidir; 39 kaydın tamamının tamamlandığı iddia edilmez.

- **Mevcut kodu olan fakat harici kabul bekleyenler:** #49 OAuth (gerçek platform hesapları), #50 Instagram collector (canlı Business/Creator hesabı), #41 kurulum/yedek (ikinci cihaz ve gerçek restore), #34 hesap güvenliği (gerçek hesap/Storage yedeği), #18 edit (gerçek videolar), #13 maliyet karşılaştırması (gerçek üretim kredileri), #3 QC (gerçek referans ve bağımsız inceleme).
- **Harici ortam/erişim bekleyen:** #93 production release ve ekip ortamları.
- **Üretim veya operasyon kabulü açık:** #2, #10, #11, #12, #15, #17, #19, #21, #30, #32, #33. Bu işler için yalnız doküman ya da sentetik test yeterli kabul kanıtı değildir.
- **Onaylı 19 iş dışındaki açık issue'lar:** #4, #6, #7, #8, #22, #23, #24, #25, #27, #28, #29 ve epic kayıtları #5, #9, #14, #20, #26, #31, #35, #63, #65. Ayrı issue kabul koşulları izlenmelidir.

### Aktif değişiklikler ve test durumu

- PR #170: bu takip matrisi; uygulama tamamlandı sayılmaz.
- PR #171: #41 kapsamında tek psql transaction restore, test edilebilir `scripts/lib/restore-args.mjs` ve `scripts/lib/restore-args.test.mjs` eklendi. **Gerçek yerel Supabase restore ve PR CI kabulü doğrulanmadan merge/kapanış yapılmaz.**
- Secret'lar issue, PR veya dokümana yazılmaz; uzak veritabanına elle SQL uygulanmaz.

### Kullanıcı kararı gerektiren somut kabul girdileri

1. **T01:** Meta/Google/TikTok test uygulamaları ve yetkili hesaplar (#49, #50).
2. **T02:** İkinci Windows/macOS ekip cihazı ve gerçek yerel Supabase yedeği (#41, #93, #34).
3. **T03:** Onaylı karakter referans seti, lisanslı kaynak medya ve gerçek üretim sağlayıcı erişimi (#2, #3, #15, #17, #18).
4. **T04:** Trend araştırma hesapları ve gerçek sağlayıcı kredi/ölçüm erişimi (#10–#13).
5. **T05:** Gerçek yayın, AI açıklama, lisans ve sponsor kabul materyalleri (#19, #21, #30, #32, #33).

**Not:** Bu girdilerin eksikliği bağımsız yazılım işlerinin otomatik olarak engellendiği anlamına gelmez; her issue ayrı doğrulanmalıdır.
