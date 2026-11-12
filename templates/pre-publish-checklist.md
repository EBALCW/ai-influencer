# Yayın öncesi kontrol listesi

İçerik: ____________________ Platform: ____________________ Tarih: __________

Üreten (rol): ____________ Puanlayan (rol, üretenden farklı kişi): ____________

> Bu listedeki 25 madde paneldeki içerik kartı kontrol listesiyle birebir aynıdır (`apps/panel/src/lib/content/checklist-schema.ts`, `content_checklist_ready()`). Madde metni değişirse iki yer birlikte güncellenir; yeni madde eklemek migration gerektirir. Panel, bütün maddeler işaretlenmeden, iki puan en az 3 olmadan ve karar "Yayına hazır" seçilmeden içeriği "Planlandı" aşamasına geçirmez; yayın işi (#58) de bu kontrolü ve AI etiketi maddesini (`ai_disclosure`) yeniden denetler.
>
> **Puanlayan ≠ üreten:** Panel puanları veya yayın kararını son kaydeden kişiyi kendisi yazar (`checklist_scored_by`). Bu kişi üretenle (kartın sorumlusu; sorumlu atanmamışsa kartı açan) aynıysa kart planlanmaz ve yayın işi açılmaz. Üreten puanları girdiyse ikinci kişi puanlardan birini veya kararı değiştirip kaydeder. Video-to-video içerikte kaynak türü de kayıtlı olmalıdır (`docs/compliance.md` → Kaynak içerik).
>
> **Zorunlu / önerilen:** Kutulu 25 madde zorunludur (kırmızı). "Koşullu" maddeler (ör. loop, reklam ibaresi) içerikte o durum yoksa kontrol edilip işaretlenir. Her bölümün altındaki _Puanlama soruları_ önerilendir; maddeyi engellemez, puanı belirler.

## 1. İzlenme kancası

- [ ] İlk 1–3 saniyede belirgin bir görsel veya metinsel kanca var.
- [ ] İlk karede karakter net; boş veya karanlık açılış yok.
- [ ] Ortada 3 saniyeden uzun durağan bölüm yok.
- [ ] Sonda merak ödülü, twist veya payoff var.
- [ ] Loop varsa son kare ilk kareye doğal bağlanıyor. _(koşullu)_

_Puanlama soruları — "İnsanlar bu videoyu neden sonuna kadar izlesin?"_ Kanca beklenmedik hareket, soru metni, absürt durum veya "sonunu bekle" vaadi mi? İlk 3 saniyede neden kaydırılmasın? Sondaki ödül kancanın vaadini karşılıyor mu?

**Puan (1–5):** _____

## 2. Yorum/paylaşım nedeni

- [ ] İçerik izleyiciye yorum veya paylaşım için doğal bir neden veriyor.
- [ ] Caption persona tonunda; gerekiyorsa açık bir soru/CTA içeriyor.
- [ ] Caption şablonu hazır; 3–5 alakalı hashtag seçildi ve hashtag sayfaları kısıtlı değil. _(şablon ve hashtag seti A/B/C: `docs/caption-guide.md`)_
- [ ] Yapay tartışma veya yanıltıcı iddia yaratmıyor.

_Puanlama soruları — "İnsanlar bu videoya neden yorum yapsın veya paylaşsın?"_ Görüş ayrılığı veya "sen olsan ne yapardın?" sorusu var mı? Biri bunu bir arkadaşına göndermek ister mi (etiketlenebilir mi)? Meme/tepki malzemesi var mı? Caption'da soru/CTA ve 3–5 alakalı hashtag var mı (`docs/caption-guide.md`)?

**Puan (1–5):** _____

### Puan ölçeği (iki bölüm için aynı)

| Puan | Anlamı                                                                               |
| ---: | ------------------------------------------------------------------------------------ |
|    1 | Neden yok. Kanca/etkileşim nedeni bulunamıyor.                                       |
|    2 | Zayıf. Neden var ama ilk saniyelerde görünmüyor veya jenerik.                        |
|    3 | **Geçer.** Net bir neden var; puanlama sorularının en az biri açıkça "evet".         |
|    4 | Güçlü. Birden fazla neden var, tempo boyunca sürüyor.                                |
|    5 | Çok güçlü. Puanlayan kişi kendiliğinden tekrar izlemek veya birine göndermek istedi. |

> **Geçme eşiği:** Her iki puan da **en az 3** olmalı. 1. veya 2. bölüm 3'ün altındaysa **video edit aşamasına geri döner** (panel bunu otomatik yapar: puanlardan biri 1 veya 2 ise kart "Edit" aşamasına alınır). Edit sonrası liste baştan doldurulur. Geri dönüş kaydı `templates/checklist-score-log.md` dosyasına yazılır.

## 3. Teknik kalite

- [ ] 9:16 ve platformun güncel çözünürlük şartlarına uygun.
- [ ] Yüz, uzuv, metin ve hareket artefaktları QC'den geçti.
- [ ] Ekran yazısı güvenli alanda; altyazı okunaklı. _(alt %20 ve sağ kenardaki arayüz butonlarının altında kalmıyor)_
- [ ] Sessizde izleyici mesajı anlayabiliyor.
- [ ] Ses seviyesi dengeli; ses/müzik bu platform ve kullanım türü için lisanslı. _(trend ses doğru yerde; sponsorlu içerikte ticari kütüphane, `docs/caption-guide.md` → Ses kuralları)_
- [ ] Kapak karesi seçildi.

## 4. AI ve doğruluk açıklaması

- [ ] Gerçekçi AI üretimi ise platformun AI / altered-content açıklaması açıldı.
- [ ] Bio ve içerik kurgusal AI karakter olduğunu gizlemiyor.
- [ ] Gerçek kişi/marka/kurum taklidi veya izinsiz yüz/ses kullanımı yok.
- [ ] Gerçek olmayan ürün deneyimi, sağlık/finans/haber iddiası yok.
- [ ] Görseldeki markalar, ürünler, mekânlar ve iddialar kontrol edildi.

## 5. Ticari, telif ve güvenlik

- [ ] Ücret, hediye, indirim, davet veya başka menfaat varsa açık “reklam” / “tanıtım” ibaresi eklendi.
- [ ] Platformun ücretli ortaklık/branded-content aracı gerekiyorsa etkinleştirildi.
- [ ] Kaynak ve kullanım izni kaydedildi; üçüncü taraf video/ses kullanım hakkı doğrulandı.
- [ ] Bot, satın alınmış etkileşim, engagement pod veya yanıltıcı CTA yok.
- [ ] Reşit olmayan ya da çocuk gibi görünen karakteri cinselleştiren içerik yok.

## Karar

- [ ] Yayına hazır
- [ ] Düzeltmeye geri gönder
- [ ] Hukuk/marka/platform kontrolü bekliyor

Kontrol eden: ____________________ Not: __________________________________________

## Panel dışında kalan öneriler

Aşağıdakiler panel maddesi değildir; puanlamada ve caption hazırlığında elle kontrol edilir. "3–5 hashtag / caption" 2. bölüme madde olarak, "puanlayan ≠ üreten" panelde sunucu kuralı olarak eklendi (#22, migration `20261024100000_content_source_fields.sql`).

- [ ] Caption ilk satırı kısa ve kesilmeden okunuyor; seçilen caption şablonu ve hashtag seti (A/B/C) içerik kartının notlarına yazıldı.
