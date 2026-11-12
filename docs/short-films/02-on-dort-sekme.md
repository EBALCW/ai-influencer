# 02 — On Dört Sekme

> Şablon: [`templates/short-film-script.md`](../../templates/short-film-script.md) · Durum: üretime hazır (taslak) · Kredi birimleri örnek değerdir, bkz. [`docs/pipeline.md`](../pipeline.md#kredi-hesabı)

## Künye

| Alan                | Değer                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Başlık              | On Dört Sekme                                                                                                                                  |
| Format              | `short_film` (dikey 9:16, 1080×1920)                                                                                                           |
| Süre hedefi         | 35 sn                                                                                                                                          |
| Kanca türü          | Absürt / komik                                                                                                                                 |
| İçerik sütunu       | AI ve teknoloji gündelik hayatta                                                                                                               |
| Logline (1 cümle)   | Mina'nın açık bıraktığı 14 tarayıcı sekmesi küçük ışıklı kartlara dönüşüp masasını işgal eder; hepsini kapattığında kahvesi çoktan soğumuştur. |
| Mekânlar (tekrar)   | A: Mina'nın çalışma masası (krem duvar, analog fotoğraf makinesi, kahve kupası) · tek mekân                                                    |
| Ses/müzik           | Orijinal veya telifsiz kütüphaneden lisanslı hafif, tempolu pizzicato/marimba; sekme "pıt" sesleri ses efekti; Mina'nın VO'su (AI ses)         |
| Tahmini kredi       | **203** (örnek birim)                                                                                                                          |
| Trend/ilham kaynağı | Orijinal (persona örnek caption'ı #4)                                                                                                          |

## Yapı

| Bölüm            | Zaman    | Bu senaryoda                                                                                            |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| Kanca            | 0–3 sn   | Mina kahvesine uzanırken ekrandan ışıklı bir kart fırlar ve kupanın önüne kurulur                       |
| Gelişme          | 3–18 sn  | Kartlar çoğalır, her biri bir "hızlıca bakarım" bahanesi; Mina tek tek kapatmaya çalışır                |
| Twist / duygu    | 18–27 sn | Son kart "Kahveni iç" der; Mina kupayı alır, kahve buz gibi                                             |
| Kapanış + loop   | 27–35 sn | Mina refleksle yeni sekme açar: "kahve nasıl ısıtılır"; ekrandan yeni bir kart fırlar (ilk kareye loop) |
| CTA (yorum için) | 27–35 sn | "Senin küçük dijital kaosun ne?"                                                                        |

## Sahne tablosu

| #   | Süre (sn) | Mekân | Kamera açısı                      | Aksiyon                                                                                    | Ekran metni                                                                         | Ses / VO / müzik                                                       | Mod              |
| --- | --------: | ----- | --------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------- |
| 1   |         3 | A     | Masa seviyesi, orta yakın plan    | Mina kupaya uzanır; laptop ekranından küçük ışıklı bir kart fırlayıp kupanın önüne konar   | "Kahvemi soğutan şey hava değil."                                                   | "Pıt" sesi, müzik girer                                                | `image_to_video` |
| 2   |         7 | A     | Tepeden (top-down) masa çekimi    | Kartlar çoğalır, masaya dağılır; Mina şaşkın, bir tanesini parmağıyla iter                 | Kartların üstünde (edit'te): "Sadece fiyatına bak" · "3 dk'lık video" · "O e-posta" | VO: "Bir sekme açtım. Sonra bir tane daha. Sadece hızlıca bakacaktım." | `image_to_video` |
| 3   |         8 | A     | Orta plan, hafif el kamerası      | Mina kartları tek tek kapatır (her dokunuşta kart küçülüp kaybolur); kartlar geri döner    | Sayaç (edit'te): "14 → 9 → 11"                                                      | Her kapanışta "pıt", müzik hızlanır. VO: "Kapattıkça çoğaldılar."      | `image_to_video` |
| 4   |         9 | A     | Yakın plan, kupa ve Mina'nın yüzü | Son kart "Kahveni iç" der; Mina gülümseyerek kupayı alır, bir yudum, yüzü buruşur          | Kart (edit'te): "Kahveni iç." → "Kahve: buz gibi."                                  | Müzik durur. VO: "Sonunda haklı olan tek sekme."                       | `image_to_video` |
| 5   |         8 | A     | Sahne 1 ile aynı kadraj           | Mina refleksle laptop'a döner, yazar; ekrandan yeni bir kart fırlar ve kupanın önüne konar | Arama kutusu (edit'te): "kahve nasıl ısıtılır" · "Senin küçük dijital kaosun ne?"   | "Pıt" (Sahne 1 ile aynı) → loop                                        | `image_to_video` |

**Toplam süre:** 3 + 7 + 8 + 9 + 8 = **35 sn** ✓ (30–60)

## Görsel prompt'lar

`<karakter_base>` ve ortak negatif prompt: [şablon](../../templates/short-film-script.md#görsel-promptlar). Kartlar metinsiz, yumuşak ışıklı küçük paneller olarak üretilir; yazılar edit'te eklenir. Laptop ve kupada logo olmaz.

**Sahne 1**

- Keyframe (`text_to_image`): `<karakter_base>, sitting at a small wooden desk against a cream wall, unbranded laptop, ceramic coffee mug, vintage analog film camera on the desk, warm desk lamp, eye-level medium close-up, she reaches for the mug, a small glowing blank card hovering in front of the mug, cozy evening light, cinematic but phone-camera realism, 9:16 vertical`
- Hareket (`image_to_video`): `static camera, a small glowing blank card pops out of the laptop screen and lands in front of the mug, she pauses mid-reach, 3 s, no cuts`

**Sahne 2**

- Keyframe: `top-down view of the same wooden desk, many small glowing blank cards scattered across the desk around the laptop and mug, a woman's hand with cobalt blue hair clip visible at the edge of frame, warm lamp light, playful, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `static top-down camera, glowing cards multiply and slide across the desk, her finger pushes one card away, 5 s, no cuts` · 2 klip (1: çoğalma, 2: itme), edit'te 7 sn

**Sahne 3**

- Keyframe: `<karakter_base>, same desk, medium shot, she taps floating glowing blank cards to close them, focused and slightly annoyed expression, warm lamp light, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `subtle handheld, she taps cards one by one and each shrinks and disappears, new cards reappear behind, 5 s, no cuts` · 2 klip, edit'te hızlandırılıp 8 sn

**Sahne 4**

- Keyframe: `<karakter_base>, close-up, holding the ceramic coffee mug near her face, one glowing blank card floating beside her, warm lamp light, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `slow push-in, she smiles, takes a sip and her face scrunches at the cold coffee, 5 s, no cuts` · 2 klip (1: gülümseme + yudum, 2: yüz buruşması), edit'te 9 sn

**Sahne 5**

- Keyframe: Sahne 1 keyframe'i yeniden kullanılır (yeni görsel üretilmez).
- Hareket: `static camera, she turns to the laptop and types quickly, a new glowing blank card pops out and lands in front of the mug, 5 s, no cuts` · 2 klip (1: yazma, 2: kart fırlaması), edit'te 8 sn

## Kredi tahmini

Örnek birimler: `K_img = 2`, `K_test = 5`, `K_final = 12` (5 sn, 720p), `r = 1,5` → final birim başına 18.

| #      | Mod              | Görsel aday | Test klip | Final birim | Kredi |
| ------ | ---------------- | ----------: | --------: | ----------: | ----: |
| 1      | `image_to_video` |           2 |         1 |           1 |    27 |
| 2      | `image_to_video` |           2 |         1 |           2 |    45 |
| 3      | `image_to_video` |           2 |         1 |           2 |    45 |
| 4      | `image_to_video` |           2 |         1 |           2 |    45 |
| 5      | `image_to_video` |  0 (tekrar) |         1 |           2 |    41 |
| Toplam |                  |           8 |         5 |           9 |   203 |

## Yorum kancası

- **İzleyici neden sonuna kadar izlesin?** İlk karede absürt görüntü (ekrandan fırlayan kart); kartlar çoğaldıkça tempo artıyor; "buz gibi kahve" payoff'u; son sahne aynı kadrajla başa dönüyor.
- **İzleyici neden yorum yapsın / paylaşsın?** Herkesin tanıdığı küçük dijital kaos ("benim 47 sekmem var") → itiraf yorumları ve "bu tam sen" etiketlemesi. Meme malzemesi: kahveyi tadan yüz.
- **Caption taslağı:** "Kahvemi soğutan şey hava değil; 'şunu da hızlıca kontrol edeyim' diye açtığım 14 sekme. Senin küçük dijital kaosun ne? ☕ #yapayzeka #dijitalhayat #kısafilm #aikarakter"

## Uyum kontrolü

- [x] AI açıklaması: platform AI etiketi açılacak; Mina gerçek kişi gibi sunulmuyor.
- [x] Gerçek kişi/marka yok: laptop, kupa ve tarayıcı markasız; kart metinleri jenerik.
- [x] Müzik orijinal veya telifsiz/lisanslı.
- [x] Ürün/sağlık/finans iddiası yok.
- [x] Sponsorlu değil.
