# Paylaşım takvimi ve zamanlama kuralları

> **Durum:** İlk sürüm, 24 Ekim 2026 (#21). Saat pencereleri hesap verisi olmadan konmuş başlangıç varsayımlarıdır. Instagram Insights / TikTok Analytics / YouTube Analytics verisi oluşunca bu belge ve paneldeki slotlar güncellenir. Takvim her pazar bir sonraki hafta için yeniden planlanır.
>
> İlgili belgeler: `templates/weekly-calendar.md` (haftalık şablon), `templates/pre-publish-checklist.md` (#22), `docs/caption-guide.md` (#23), `docs/compliance.md`, `docs/account-health.md`.

## Temel kurallar

| Kural             | Değer                                                                                                                | Panel karşılığı                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Saat dilimi       | `Europe/Istanbul` (persona: öncelik Türkiye ve Türkçe). Türkiye 2016'dan beri yaz saati uygulamıyor, yıl boyu UTC+3. | `posting_slots.timezone` varsayılanı `Europe/Istanbul`                                    |
| Asgari ara        | Aynı hesapta iki paylaşım arasında **en az 5 saat**. Tam 5 saat geçerlidir, 4 sa 59 dk geçersizdir.                  | Takvim ve içerik kartı `< 5 saat` için uyarı verir (`gapWarning`)                         |
| Günlük üst sınır  | Hesap başına günde en fazla 4 paylaşım.                                                                              | Aynı gün 4'ten fazla planda uyarı (`dailyWarning`)                                        |
| Başlangıç hızı    | Günde 2 slot (13:30, 20:00). Üretim hızı oturunca ve tampon ≥ 3 hazır videoya çıkınca 3, sonra 4 slot.               | Haftanın her günü için iki `posting_slots` satırı (aşağıda)                               |
| Deneme slotu      | Haftada en az 1 slot yeni saat veya yeni format denemesine ayrılır; takvimde `deneme` diye işaretlenir.              | Tek seferlik olduğu için tekrar eden slot değil, içerik kartında `scheduled_at` ile       |
| Format karması    | Aynı formattan **art arda en fazla 2** paylaşım (ör. v2v, v2v, kısa film). Formatlar: `v2v`, `kısa film`, `meme`.    | İçerik kartı "Format" alanı; panel kontrol etmez, haftalık planlamada elle bakılır        |
| Kalite önce gelir | Yayın öncesi kontrol listesinden geçmeyen içerik slota konmaz.                                                       | Kontrol listesi tamamlanmadan "Planlandı" aşamasına geçilemez (`content_checklist_ready`) |

Uyarı notu: Panel 5 saat ve günlük 4 paylaşım kurallarını **uyarı** olarak gösterir, kaydı engellemez. Uyarı çıkan plan bu belgeye göre düzeltilmeden onaylanmaz.

## Platform pencereleri

`(V)` = varsayım, hesap verisiyle doğrulanmadı. `(K)` = resmi kaynakla doğrulanan bilgi. Takipçi sayısı az olduğu dönemde saatler kitle alışkanlığı tahminidir; kesin "en iyi saat" iddiası değildir.

| Platform                    | Başlangıç pencereleri (Europe/Istanbul)                          | Gerekçe                                                                                                                                    | Revizyon kaynağı                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instagram Reels (ana)       | 13:30 ve 20:00. 3-4 slota çıkınca: 08:30 · 13:30 · 18:30 · 23:30 | (V) 18–34 yaş TR kitlesi için öğle arası ve iş/okul sonrası akşam. 08:30 işe/okula gidiş, 23:30 yatmadan önce. Dört slot arası tam 5 saat. | (K) Profesyonel hesapta Insights > Takipçiler > en aktif saatler grafiği. Bu veri için profesyonel hesap ve yaklaşık 100+ takipçi gerektiği üçüncü taraf rehberlerde belirtiliyor; eşik resmi kaynakla doğrulanmadı. |
| TikTok (cross-post)         | Instagram ile aynı saatler, aynı video için sonraki slot         | (V) Aynı kitle varsayımı. TikTok hesabının slotları ayrı hesap olduğu için Instagram'la çakışabilir; 5 saat kuralı hesap başınadır.        | (V) TikTok Analytics'teki takipçi etkinlik verisi oluşunca. Menü adı uygulama sürümüne göre değişebilir.                                                                                                             |
| YouTube Shorts (cross-post) | Instagram ile aynı saatler, aynı video için sonraki slot         | (V) Aynı kitle varsayımı.                                                                                                                  | (K) YouTube Studio > Analytics > Kitle > "İzleyicilerinizin YouTube'da olduğu zamanlar" raporu, son 28 günü gösterir ([YouTube Yardım](https://support.google.com/youtube/answer/9314416)).                          |

Kaynak kontrolü: 24 Ekim 2026. Instagram en aktif saatler verisi için resmi Yardım Merkezi sayfası bulunamadı; yalnız üçüncü taraf rehberlere dayanıyor ve uygulamada kontrol edilmeli.

### Paneldeki slot karşılığı (#57)

Takvim (`/calendar`) > **Yayın slotları** bölümünde her hedef hesap için aşağıdaki satırlar girilir. `weekday` değeri JavaScript `getUTCDay()` düzenindedir: **0 = Pazar, 1 = Pazartesi … 6 = Cumartesi**.

| Hesap                    | `weekday`  | `local_time` | `timezone`        |
| ------------------------ | ---------- | ------------ | ----------------- |
| Instagram                | 0, 1, …, 6 | `13:30`      | `Europe/Istanbul` |
| Instagram                | 0, 1, …, 6 | `20:00`      | `Europe/Istanbul` |
| TikTok / YouTube (varsa) | 0, 1, …, 6 | `13:30`      | `Europe/Istanbul` |
| TikTok / YouTube (varsa) | 0, 1, …, 6 | `20:00`      | `Europe/Istanbul` |

Toplam: hesap başına 14 satır (7 gün × 2 saat). 4 slota geçildiğinde `13:30/20:00` satırları silinir, `08:30`, `13:30`, `18:30`, `23:30` eklenir (7 × 4 = 28 satır). Deneme slotları tekrar eden satır olarak eklenmez; o hafta içerik kartına doğrudan zaman yazılır.

## Planlama aracı

- **Varsayılan:** Panelin zamanlanmış yayını (#58). Instagram Reels ve YouTube için yayın işi kuyruğa alınır; panel kontrol listesi, AI etiketi maddesi (`ai_disclosure`) ve final video yoksa işi reddeder.
- **Manuel atılanlar:**
  - Trend/lisanslı ses gerektiren videolar. Ses API ile eklenemez; uygulamadan elle paylaşılır (`docs/caption-guide.md` → Ses kuralları).
  - Ücretli ortaklık etiketi gereken Instagram içerikleri. Panel bu projede Instagram Login kullandığından etiketi otomatik ekleyemez.
  - TikTok paylaşımları. Panelde otomatik TikTok yayını yok.
- **Geçici alternatif:** Panel erişimi yoksa Meta Business Suite planlayıcı (Instagram + Facebook). Trend ses sınırı burada da geçerli.

## İstisna kuralları

1. **Hazır içerik yoksa slot atlanır.** Kontrol listesinden geçmemiş veya kalitesi düşük video "slotu doldurmak için" paylaşılmaz. Atlanan slot takvimde `atlandı` olarak kalır.
2. **Kaçırılan slot sonraki slota sıkıştırılmaz.** Ör. 13:30 kaçtıysa video 15:00'te atılmaz; 20:00 slotu kendi içeriğiyle kalır, kaçan video sonraki boş slota veya ertesi güne kayar.
3. **Erteleme:** Bir video ilk 1 saatte hesap ortalamasının ≥ 3 katı izlenmeye ulaşırsa sonraki slot 1–2 saat ertelenebilir. Erteleme, kendisinden sonraki slotla 5 saat arayı bozuyorsa o slot da aynı süre kaydırılır veya atlanır. Hesap ortalaması 5.4 (#24) tablosundaki son 10 videonun 1. saat izlenmesidir; 10 video yoksa bu kural uygulanmaz.
4. **Hesap sorunu:** Platform uyarısı, kısıtlama veya güvenlik olayı varsa takvim durdurulur ve `docs/account-health.md` uygulanır. Kanıtsız "shadowban" şüphesiyle sıklık birden değiştirilmez.
5. **Özel gün ve gündem:** Persona siyasi içerik üretmez. Resmi bayram ve gündem günlerinde planlanan içerik bağlamdan bağımsız ve hassasiyet açısından nötr olmalı; değilse kaydırılır.
6. **Tampon:** Backlog'da her zaman ≥ 3 hazır (kontrol listesi tamam) video tutulur. Tampon 3'ün altına inerse slot sayısı artırılmaz; 2 hafta üst üste 1'in altında kalırsa slot sayısı bir azaltılır.

## Cross-post kuralı

- Önce Instagram Reels paylaşılır. TikTok ve YouTube Shorts hesapları Instagram'la aynı slot saatlerini kullanır, ama her slotta **Instagram'ın bir önceki slottaki videosu** paylaşılır. Örnek: 13:30 Instagram videosu → 20:00 TikTok/YouTube; 20:00 videosu → ertesi gün 13:30. Böylece bir video en erken 5,5 saat sonra cross-post edilir, her hesapta 5 saat kuralı korunur ve aynı video aynı saatte üç platformda yarışmaz. Instagram'da atlanan slotun videosu olmadığı için cross-post sırası da bir kayar.
- Her platformda o platformun AI açıklaması ayrı ayrı açılır (`docs/compliance.md`). Instagram'da kullanılan ses, TikTok/YouTube'da lisanslı olmayabilir; cross-post öncesi ses yeniden kontrol edilir (`docs/caption-guide.md`).
- Platform filigranı (başka uygulamanın logosu) taşıyan dışa aktarım kullanılmaz; final dosya kaynak projeden alınır.

## Haftalık döngü

1. **Pazar, 30 dk:** Geçen haftanın planlanan/gerçekleşen tablosu 5.4 (#24) verisiyle karşılaştırılır. Saat başına 24 saatlik izlenme ortalaması çıkarılır; en zayıf slot bir sonraki hafta deneme slotuyla değiştirilir.
2. `templates/weekly-calendar.md` kopyalanır, slotlar backlog'dan doldurulur, format karması ve 5 saat kontrolü yapılır.
3. Panelde içerikler hedef hesap ve zamanla planlanır; takvimde uyarı varsa düzeltilir.
4. Hafta sonunda ≥ %80 gerçekleşme hedefi kontrol edilir; altındaysa neden (üretim, kalite, hesap) not edilir.

## İlk hafta planı (taslak)

> Tarihler örnek: ısıtma (#8) bittikten sonraki ilk pazartesi için kaydırılır. Başlıklar persona içerik sütunlarından (`docs/persona.md`) türetilmiş çalışma adlarıdır; backlog (#19) kartlarıyla değiştirilir. "Sorumlu" alanına kişi adı değil rol yazılır. 29 Ekim resmi tatil; o günkü içerikler gündemden bağımsızdır (istisna 5).

<!-- plan:start -->

| #   | Gün                  | Slot           | İçerik (çalışma adı)                               | Format    | Hashtag seti | Durum  | Sorumlu | Yayın linki |
| --- | -------------------- | -------------- | -------------------------------------------------- | --------- | ------------ | ------ | ------- | ----------- |
| 1   | Pazartesi 2026-10-26 | 13:30          | Arka planı değiştirirken model neyi tahmin ediyor? | v2v       | A            | Planlı | Üretim  |             |
| 2   | Pazartesi 2026-10-26 | 20:00          | Tabelalar bir gece kendi önerisini yazsaydı        | kısa film | B            | Planlı | Üretim  |             |
| 3   | Salı 2026-10-27      | 13:30          | 14 açık sekme ve soğuyan kahve                     | meme      | C            | Planlı | Üretim  |             |
| 4   | Salı 2026-10-27      | 20:00          | Aynı karakteri 3 sahnede tutarlı tutmak            | v2v       | B            | Planlı | Üretim  |             |
| 5   | Çarşamba 2026-10-28  | 13:30          | 23.59'da bütün ekranlar aynı soruyu sordu          | kısa film | C            | Planlı | Üretim  |             |
| 6   | Çarşamba 2026-10-28  | 20:00          | Otomatik tamamlama beni benden iyi mi tanıyor?     | meme      | A            | Planlı | Üretim  |             |
| 7   | Perşembe 2026-10-29  | 08:00 (deneme) | Fotoğraf büyütme gerçekten detay mı ekliyor?       | v2v       | C            | Planlı | Üretim  |             |
| 8   | Perşembe 2026-10-29  | 13:30          | Analog makine ile AI aynı kareyi çekerse           | kısa film | A            | Planlı | Üretim  |             |
| 9   | Perşembe 2026-10-29  | 20:00          | Sesli asistan beni neden yanlış anladı?            | v2v       | B            | Planlı | Üretim  |             |
| 10  | Cuma 2026-10-30      | 13:30          | AI'ya "kısa yaz" dedim                             | meme      | A            | Planlı | Üretim  |             |
| 11  | Cuma 2026-10-30      | 20:00          | Şehir yürüyüşünde kaybolan müzik listesi           | kısa film | B            | Planlı | Üretim  |             |
| 12  | Cumartesi 2026-10-31 | 13:30          | Takipçinin seçtiği nesneyle 20 saniyelik sahne     | v2v       | C            | Planlı | Üretim  |             |
| 13  | Cumartesi 2026-10-31 | 20:00          | Dosya adı: final_final_v3                          | meme      | B            | Planlı | Üretim  |             |
| 14  | Pazar 2026-11-01     | 13:30          | Hatırlatıcı uygulaması bir gün geri konuşsaydı     | kısa film | C            | Planlı | Üretim  |             |
| 15  | Pazar 2026-11-01     | 20:00          | Üretim notu: toka neden sabit referans?            | v2v       | A            | Planlı | Üretim  |             |

<!-- plan:end -->

**Doğrulama (24 Ekim 2026, script ile):** 15 slot, 7 gün. Ardışık iki paylaşım arasındaki en kısa süre **5,5 saat** (Perşembe 08:00 → 13:30). Diğer aralar 6,5 saat (13:30 → 20:00) ve 12–17,5 saattir (gece). Hiçbir iki paylaşım arası 5 saatin altında değil. Aynı formattan art arda en fazla 1 paylaşım var, gün başına en fazla 3 paylaşım var. Hesaplama: her satır `YYYY-MM-DDTHH:MM:00+03:00` olarak çözülüp sıralandı ve ardışık farklar alındı. Format karması kuralı (≤ 2 art arda) ve günlük 4 sınırı da aynı script'le kontrol edildi.

Cross-post bu tabloya ayrı satır olarak eklenmedi. TikTok/YouTube takvimi aynı 15 saati kullanır ve her satırda bir önceki satırın videosu paylaşılır (2. satırda 1 numaralı video … 15. satırda 14 numaralı video; 15 numaralı video bir sonraki haftanın ilk slotuna kalır). Saatler aynı olduğu için aralar da aynıdır, en kısa ara yine 5,5 saattir.
