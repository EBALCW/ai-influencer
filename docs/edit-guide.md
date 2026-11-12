# Kurgu ve final export standardı

#18 için tekrarlanabilir kurgu şablonu. Gerçek üç final video, telefon/Instagram önizlemesi ve ≤30 dakika edit hedefi henüz doğrulanmadı. Doldurulmuş kayıtlar ve videolar ekibin kısıtlı alanında tutulur.

## Araç ve proje şablonu

Kurgu için DaVinci Resolve kullanılır; son dosyayı standarda dönüştürmek için repodaki FFmpeg komutu kullanılır. Araç ücretleri/lisansları bu rehberle satın alma onayı almış sayılmaz. FFmpeg ve ffprobe sistemde kurulu olmalı; `ffmpeg -version` / `ffprobe -version` ile kontrol et. Komut bunları otomatik kurmaz.

Yeni proje açıp aşağıdaki ayarlarla boş bir master proje kaydet; her içerikte kopyasını kullan:

| Alan             | Şablon                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Timeline         | Dikey 1080×1920, 30 fps, progressive                                                                                |
| Video katmanları | V1 ana plan, V2 insert/B-roll, V3 ekran metni ve altyazı                                                            |
| Ses katmanları   | A1 konuşma, A2 efekt, A3 kullanım hakkı doğrulanmış müzik                                                           |
| Altyazı          | Noto Sans Bold veya eşdeğer lisanslı font, başlangıç 56 px, beyaz metin, 3 px siyah kontur; en çok 2 satır          |
| Güvenli alan     | Başlangıç kılavuzu: soldan 90 px, sağdan 180 px, üstten 240 px, alttan 384 px boşluk. Metin bu alanın içinde kalır. |
| Kapanış          | Varsayılan uzun outro yok; loop kullanılacaksa son plan ilk kareye hareket/ses bakımından bağlanır.                 |

Güvenli alan bir ekip kılavuzudur; bütün platform arayüzlerini garanti etmez. Her platformun gerçek yükleme önizlemesinde caption ve butonları açarak kontrol et. Export komutu altyazı eklemez, metinleri yeniden konumlandırmaz ve otomatik loop oluşturmaz; bunlar master projede yapılır. Dolu bir `.drp` projesi bu teslimde yoktur; yukarıdaki kurulum ve komut yeniden kullanılabilir şablondur.

## Kurgu sırası

1. Kaynak hakkını ve asset QC sonucunu doğrula: [uyum](compliance.md), [QC](qc-checklist.md). Kritik hata varsa kurguyla gizlemek yerine üretime geri gönder.
2. İlk saniyede hareket veya okunabilir metin, ilk üç saniyede kanca göster. Normalde 2–3 saniyeden uzun durağan plan bırakma; gerekli dramatik beklemeyi gerekçelendir. Kesimleri müzik vuruşlarına oturt.
3. Konuşmadaki önemli cümleleri altyazıya geçir. Türkçe karakterleri ve yazımı kontrol et; sessizde hikayenin anlaşılmasını dene. Telefon ekranında okunmuyorsa satırı kısalt veya fontu büyüt.
4. Konuşma müziğin üstünde anlaşılır olmalı; clipping olmamalı. Başlangıç miks hedefi −14 LUFS integrated, en fazla −1 dBTP true peak; bunlar ekip hedefidir, platform zorunluluğu değildir. Export komutu ses yüksekliği normalizasyonu yapmaz.
5. Trend ses gerekiyorsa lisansı [caption rehberindeki](caption-guide.md) kurala göre platformda ekle; dışarıdan alınmış trend müziği final dosyaya gömme. Cross-post için sesi her platformda ayrı doğrula. Sponsorlu işte ticari kullanım hakkını kontrol et.
6. AI ses kullanılacaksa aynı persona sesi ve izinli ses modeli korunur; seçim panelde persona notuna, ücret `/costs` kaydına yazılır. Gerçek kişinin sesi izinsiz klonlanmaz.
7. [Yayın öncesi kontrol listesini](../templates/pre-publish-checklist.md) üreten dışında biri doldurur. Final export sonrası görüntü, ses ve altyazı tekrar kontrol edilir.

## Export komutu

Önce editörden kurgu dosyasını çıkar; sonra repo kökünde:

```text
pnpm video:export "/yerel/kurgu.mp4" "/yerel/final/2026-10-27_karakter_kart-id_v1.mp4"
pnpm video:export "/yerel/kurgu.mp4" "/yerel/final/2026-10-27_karakter_kart-id_v2.mp4" --mute
```

Windows'ta aynı komutta tırnak içinde `C:\...` yolları kullanılır. Çıktı klasörü önceden var olmalı. Gerçek dosyaları repo dışında tut. Adlandırma: `<YYYY-MM-DD>_<influencer-slug>_<içerik-id>_v<n>.mp4`; işletim sistemi için güvenli kısa slug kullan. Komut adlandırmayı zorlamaz.

- H.264 (`libx264`), 1080×1920, 30 fps, kare piksel, `yuv420p`, CRF 18, 16 Mbit/s tavan ve 32 Mbit tampon. CRF değişken bitrate'tir; dosya başına sabit bitrate garantisi değildir.
- En-boy oranı korunur, taşan alan kırpılmaz; gerekirse siyah boşluk eklenir. Yatay kaynak dikey kompozisyona dönüşmüş sayılmaz; karakter kadrajını editörde düzenle.
- İlk video ve varsa ilk ses kanalı seçilir. Ses AAC 192 kbit/s olur; `--mute` bütün sesi çıkarır. Sessiz kaynak da kabul edilir. Ayrı altyazı kanalları kopyalanmaz; gereken altyazıyı editörde görüntüye işle.
- Kaynak dosya değiştirilmez; mevcut çıktı ezilmez. Başarısız iş final dosyası bırakmaz. Çıktı dosya sistemi hard link desteklemeli (ör. NTFS/APFS/ext4); desteklemiyorsa önce yerel diske export et. Yeni denemede versiyon numarasını artır. Ani sistem kapanması geçici `.video-export-*` klasörü bırakabilir; çalışan export yokken yalnız bu geçici klasörü temizle.
- Kapsayıcı metadata ve chapter bilgileri aktarılmaz. Görüntü/ses içinde görünen özel bilgiler otomatik temizlenmez. Dış URL girdi olarak kabul edilmez; yerel dosya kullanılır.

## Final kabulü

[Edit kabul kaydını](../templates/edit-review.md) üç gerçek içerik için kopyala. Edit süresine kesim, altyazı, ses ve QC düzeltmeleri dahil edilir; render süresi ayrı tutulur. Hedef aktif edit ≤30 dakika/video. Sentetik test videosu gerçek içerik kabulüne sayılmaz.

Dosyayı telefonda sesli ve sessiz tam ekran izle; kanca, altyazı, yüz/el artefaktı, ses dengesi ve loop geçişini kontrol et. Her hedef platformda yükleme önizlemesini açıp metinlerin arayüz altında kalmadığını doğrula. Üreten dışındaki kişi onaylamadan yayınlama.

Geçen final dosya panelin medya kütüphanesine `final_video` olarak yüklenir ve içerik kartına bağlanır. Kartın kaynak, caption, AI açıklaması ve gerekiyorsa reklam etiketi kontrolleri tamamlanır. Teknik export başarısı yayın onayı değildir.
