# 01 — Gece Yarısı Tabelaları

> Şablon: [`templates/short-film-script.md`](../../templates/short-film-script.md) · Durum: üretime hazır (taslak) · Kredi birimleri örnek değerdir, bkz. [`docs/pipeline.md`](../pipeline.md#kredi-hesabı)

## Künye

| Alan                | Değer                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Başlık              | Gece Yarısı Tabelaları                                                                                                                                      |
| Format              | `short_film` (dikey 9:16, 1080×1920)                                                                                                                        |
| Süre hedefi         | 40 sn                                                                                                                                                       |
| Kanca türü          | Merak                                                                                                                                                       |
| İçerik sütunu       | Mini hikâye / görsel what-if                                                                                                                                |
| Logline (1 cümle)   | Saat 23.59'da İstanbul'daki bütün tabelalar Mina'ya kişisel hatırlatmalar yazmaya başlar, son tabela ise ona cevap veremeyeceği bir soru sorar.             |
| Mekânlar (tekrar)   | A: yağmurlu ara sokak (neon tabelalar) · B: aynı sokakta saçak altı                                                                                         |
| Ses/müzik           | Orijinal veya telifsiz kütüphaneden lisanslı lo-fi synth altyapı; yağmur ve neon vızıltısı ses efekti; Mina'nın VO'su (AI ses, gerçek kişi sesi klonlanmaz) |
| Tahmini kredi       | **189** (örnek birim)                                                                                                                                       |
| Trend/ilham kaynağı | Orijinal (persona örnek caption'ı #2)                                                                                                                       |

## Yapı

| Bölüm            | Zaman    | Bu senaryoda                                                                                     |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------ |
| Kanca            | 0–3 sn   | Mina yağmurda yukarı bakıyor, yüzünde neon yansıması; ekran metni saatin 23.59 olduğunu söylüyor |
| Gelişme          | 3–17 sn  | Tabelalar tek tek değişip ona küçük hatırlatmalar yazıyor; şemsiye hatırlatması gerçek çıkıyor   |
| Twist / duygu    | 17–35 sn | Son tabela soru soruyor: "Yarın kendine neyi hatırlatmamı istersin?" Mina'nın cevabı yok         |
| Kapanış + loop   | 35–40 sn | Saat yine 23.59; tabela boş, imleç yanıp sönüyor. Son kare ilk kareye bağlanıyor                 |
| CTA (yorum için) | 35–40 sn | "Senin cevabın ne? Yoruma yaz, yarın tabelaya ben yazayım."                                      |

## Sahne tablosu

| #   | Süre (sn) | Mekân | Kamera açısı                               | Aksiyon                                                                             | Ekran metni                                                            | Ses / VO / müzik                                            | Mod              |
| --- | --------: | ----- | ------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------- |
| 1   |         3 | A     | Yakın plan, alt açı                        | Mina yürürken durur, yukarı bakar; gözlüğünde neon yansıması                        | "Saat 23.59. Şehirdeki bütün tabelalar değişti."                       | Yağmur sesi, synth tek nota girer                           | `image_to_video` |
| 2   |         6 | A     | Geniş plan, omuz üstü                      | Sokak boyunca tabelalar sırayla titreyip yeni yazıya geçer                          | Tabelalarda (edit'te): "Su içtin mi?" · "O mesaja dön." · "Erken yat." | VO: "Önce reklam sandım. Sonra hepsi bana yazmaya başladı." | `image_to_video` |
| 3   |         8 | A → B | Orta plan, takip çekimi                    | Bir tabela "Şemsiyeni aç" yazar; Mina güler, şemsiyesini açar, yağmur o an hızlanır | Tabela (edit'te): "Şemsiyeni aç. 3… 2… 1…"                             | VO: "Bunu bilmesi biraz ürkütücüydü." Yağmur sesi yükselir  | `image_to_video` |
| 4   |        10 | B     | Ters açı, Mina'nın başının üstünden tabela | Saçak altındaki büyük tabela yavaşça yeni yazıya geçer; Mina donup kalır            | Tabela (edit'te): "Yarın kendine neyi hatırlatmamı istersin?"          | Müzik kesilir, sadece yağmur. VO: "İlk kez bir şey sordu."  | `image_to_video` |
| 5   |         8 | B     | Çok yakın plan, telefon ekranı ve eller    | Mina telefonda yazmaya başlar, siler, tekrar yazar (yüz görünmez, eller sabit)      | Telefon ekranı (edit'te): yazılıp silinen metin                        | VO: "Cevabım hazır değildi."                                | `still`          |
| 6   |         5 | A     | Sahne 1 ile aynı kadraj                    | Mina tekrar yukarı bakar; tabela boş, imleç yanıp söner. Saat yine 23.59            | "Senin cevabın ne? Yoruma yaz, yarın tabelaya ben yazayım."            | Synth tek nota (Sahne 1 ile aynı) → loop                    | `image_to_video` |

**Toplam süre:** 3 + 6 + 8 + 10 + 8 + 5 = **40 sn** ✓ (30–60)

## Görsel prompt'lar

`<karakter_base>` ve ortak negatif prompt: [şablon](../../templates/short-film-script.md#görsel-promptlar). Tabela yüzeyleri boş/soyut ışık olarak üretilir, yazılar edit'te eklenir.

**Sahne 1**

- Keyframe (`text_to_image`): `<karakter_base>, rainy narrow Istanbul back street at night, glowing blank neon signboards in cobalt and warm terracotta, reflections on wet cobblestones, close-up from slightly low angle, she stops and looks up, neon light reflected on her glasses, cinematic but phone-camera realism, 9:16 vertical`
- Hareket (`image_to_video`): `slow push-in, she lifts her head and looks up at the signs, raindrops falling, neon flicker, 3 s, no cuts`

**Sahne 2**

- Keyframe: `<karakter_base>, same rainy back street seen over her shoulder, wide shot, row of blank glowing signboards along the street, light rain, shallow depth of field, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `static camera, signboards flicker one after another from near to far, light rain, she stands still, 5 s, no cuts` · 2 klip (1: yakın tabelalar, 2: uzak tabelalar), edit'te 6 sn'ye kırpılır

**Sahne 3**

- Keyframe: `<karakter_base>, holding a closed cream-colored umbrella, medium shot, walking toward a shop awning on the same rainy street, one blank signboard glowing above her, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `handheld tracking shot, she laughs and opens the umbrella, rain suddenly gets heavier, 5 s, no cuts` · 2 klip (1: yürüyüş, 2: şemsiye açılışı), edit'te 8 sn

**Sahne 4**

- Keyframe: `<karakter_base>, under a shop awning, back of her head and shoulders in foreground, large blank glowing signboard above in cobalt light, reverse angle, rain curtain behind, moody, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `very slow push-in toward the signboard, the sign glow pulses once, she freezes, rain continues, 5 s, no cuts` · 2 klip ardışık (ikinci klip birincinin son karesinden), edit'te 10 sn

**Sahne 5**

- Keyframe (`still`): `extreme close-up of a woman's hands holding a smartphone with a blank glowing screen, terracotta crossbody bag strap visible, rain drops on the screen edge, cobalt neon light, no visible logos, cinematic but phone-camera realism, 9:16 vertical`
- Edit hareketi: yavaş zoom-in + metin animasyonu (yazılıp silinen cevap). Video üretimi yok.

**Sahne 6**

- Keyframe: Sahne 1 keyframe'i yeniden kullanılır (yeni görsel üretilmez).
- Hareket: `slow push-in, she looks up again, the signboard above shows a single blinking cursor glow, rain, 5 s, no cuts`

## Kredi tahmini

Örnek birimler: `K_img = 2`, `K_test = 5`, `K_final = 12` (5 sn, 720p), `r = 1,5` → final birim başına 18.

| #      | Mod              | Görsel aday | Test klip | Final birim | Kredi |
| ------ | ---------------- | ----------: | --------: | ----------: | ----: |
| 1      | `image_to_video` |           2 |         1 |           1 |    27 |
| 2      | `image_to_video` |           2 |         1 |           2 |    45 |
| 3      | `image_to_video` |           2 |         1 |           2 |    45 |
| 4      | `image_to_video` |           2 |         1 |           2 |    45 |
| 5      | `still`          |           2 |         0 |           0 |     4 |
| 6      | `image_to_video` |  0 (tekrar) |         1 |           1 |    23 |
| Toplam |                  |          10 |         5 |           8 |   189 |

## Yorum kancası

- **İzleyici neden sonuna kadar izlesin?** İlk karede "bütün tabelalar değişti" vaadi; her tabela yeni bir hatırlatma (tempo 3 sn'den uzun durmuyor); son tabelanın sorusu payoff; son kare ilk kareyle aynı kadraj (loop).
- **İzleyici neden yorum yapsın / paylaşsın?** Doğrudan soru ("yarın kendine neyi hatırlatırdın?") ve yorumu bir sonraki videoda tabelaya yazma vaadi (topluluk sütunu). "Bunu bana tabela yazsa…" diye arkadaş etiketleme.
- **Caption taslağı:** "Saat 23.59'da şehirdeki bütün ekranlar aynı soruyu sordu: 'Yarın kendine neyi hatırlatmamı istersin?' Cevabım hazır değildi. Seninki? 🌃 #yapayzeka #kısafilm #istanbul #aikarakter"

## Uyum kontrolü

- [x] AI açıklaması: yayın sırasında platform AI etiketi açılacak; Mina gerçek kişi gibi sunulmuyor.
- [x] Gerçek kişi/marka yok: tabelalar boş üretilip metin edit'te ekleniyor; okunabilir marka yok.
- [x] Müzik orijinal veya telifsiz/lisanslı; ses klonu yok.
- [x] Sağlık/finans iddiası yok ("su içtin mi?" tavsiye değil, gündelik hatırlatma).
- [x] Sponsorlu değil.
