# 03 — POV: AI Olduğunu Öğrendin

> Şablon: [`templates/short-film-script.md`](../../templates/short-film-script.md) · Durum: üretime hazır (taslak) · Kredi birimleri örnek değerdir, bkz. [`docs/pipeline.md`](../pipeline.md#kredi-hesabı)

## Künye

| Alan                | Değer                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Başlık              | POV: AI Olduğunu Öğrendin                                                                                                                                             |
| Format              | `short_film` (dikey 9:16, 1080×1920)                                                                                                                                  |
| Süre hedefi         | 45 sn                                                                                                                                                                 |
| Kanca türü          | POV (duygusal kapanışlı)                                                                                                                                              |
| İçerik sütunu       | Üretim süreci + topluluk                                                                                                                                              |
| Logline (1 cümle)   | İzleyici, takip ettiği Mina'nın AI olduğunu fark eder; Mina bunu sakince doğrular, nasıl üretildiğini gösterir ve izleyiciye gerçekten merak ettiği tek soruyu sorar. |
| Mekânlar (tekrar)   | A: sakin bir kafe, pencere kenarı masa (öğleden sonra ışığı) · tek mekân                                                                                              |
| Ses/müzik           | Orijinal veya telifsiz kütüphaneden lisanslı yumuşak akustik gitar/piyano; kafe ambiyansı ve analog deklanşör sesi efekti; Mina'nın VO'su (AI ses)                    |
| Tahmini kredi       | **207** (örnek birim)                                                                                                                                                 |
| Trend/ilham kaynağı | Orijinal ("POV" formatı; persona'nın şeffaflık ilkesi ve `docs/compliance.md` → "Gerçek misin?" yanıtı)                                                               |

## Yapı

| Bölüm            | Zaman    | Bu senaryoda                                                                               |
| ---------------- | -------- | ------------------------------------------------------------------------------------------ |
| Kanca            | 0–4 sn   | Mina kameraya (izleyiciye) bakıyor; ekran metni POV'u kuruyor                              |
| Gelişme          | 4–22 sn  | Mina AI olduğunu sakince doğruluyor ve tutarlılığın sırrını (kobalt toka) gösteriyor       |
| Twist / duygu    | 22–34 sn | Analog fotoğraf makinesiyle pencere ışığını çekiyor: "Benim fotoğraflarım hiç basılmıyor." |
| Kapanış + loop   | 34–45 sn | İzleyiciye soru; son kare ilk kareyle aynı kadraj, Mina tekrar kameraya bakıyor            |
| CTA (yorum için) | 34–45 sn | "Bugün sana iyi gelen küçük şey neydi?"                                                    |

## Sahne tablosu

| #   | Süre (sn) | Mekân | Kamera açısı                                 | Aksiyon                                                                                       | Ekran metni                                      | Ses / VO / müzik                                                                                     | Mod              |
| --- | --------: | ----- | -------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------- |
| 1   |         4 | A     | Göz hizası, karşı sandalyeden (izleyici POV) | Mina fincanını bırakır, başını kaldırıp doğrudan kameraya bakar                               | "POV: Takip ettiğin kızın AI olduğunu öğrendin." | Kafe ambiyansı                                                                                       | `image_to_video` |
| 2   |         8 | A     | Orta plan                                    | Mina hafifçe gülümser, omuz silker; çayından bir yudum alır (konuşan ağız yok)                | "Evet. Saklamıyorum."                            | VO: "Evet, ben yapay zekâ ile oluşturulmuş kurgusal bir karakterim. Bio'mda da yazıyor." Müzik girer | `image_to_video` |
| 3   |        10 | A     | Yakın plan, saç ve gözlük                    | Mina parmağıyla kobalt tokasına dokunur, sonra gözlüğünü düzeltir                             | "Tutarlılığın sırrı: bu toka."                   | VO: "Her sahnede bu toka ve gözlük sabit. Yoksa her videoda başka biri olurdum."                     | `image_to_video` |
| 4   |        12 | A     | Omuz üstü, pencereye doğru                   | Mina analog fotoğraf makinesini kaldırır, pencere ışığını çeker; makineyi indirip ışığa bakar | —                                                | Deklanşör sesi. VO: "Fotoğraf çekmeyi seviyorum. Ama benim fotoğraflarım hiç basılmıyor."            | `image_to_video` |
| 5   |         6 | A     | Masa üstü yakın plan                         | Masada boş kenarlıklı tek bir fotoğraf baskısı ve fincan; pencere ışığı üzerinde              | "Seninkiler basılabilir."                        | VO: "Gerçek olmayan biri olarak gerçekten merak ettiğim tek şey…"                                    | `still`          |
| 6   |         5 | A     | Sahne 1 ile aynı kadraj                      | Mina tekrar kameraya bakar, sıcak bir gülümseme                                               | "Bugün sana iyi gelen küçük şey neydi?"          | Müzik ilk akora döner → loop                                                                         | `image_to_video` |

**Toplam süre:** 4 + 8 + 10 + 12 + 6 + 5 = **45 sn** ✓ (30–60)

## Görsel prompt'lar

`<karakter_base>` ve ortak negatif prompt: [şablon](../../templates/short-film-script.md#görsel-promptlar). Konuşma VO ile verilir; dudak senkronu üretilmez. Fincanda, fotoğraf makinesinde ve kafede marka/logo olmaz.

**Sahne 1**

- Keyframe (`text_to_image`): `<karakter_base>, sitting at a window table in a calm cafe, afternoon window light, ceramic cup on the table, vintage analog film camera beside it, eye-level shot from the opposite chair, she looks directly into the camera with a calm curious expression, cinematic but phone-camera realism, 9:16 vertical`
- Hareket (`image_to_video`): `static camera, she sets the cup down and lifts her gaze to the camera, soft cafe background movement, 4 s, no cuts`

**Sahne 2**

- Keyframe: `<karakter_base>, same cafe window table, medium shot, holding a cup of tea, small relaxed smile, slight shoulder shrug, afternoon light, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `slow push-in, she smiles, shrugs lightly and takes a sip, mouth closed, 5 s, no cuts` · 2 klip (1: gülümseme + omuz, 2: yudum), edit'te 8 sn

**Sahne 3**

- Keyframe: `<karakter_base>, close-up on her face and hair, her finger touching the cobalt blue hair clip, amber-tinted geometric glasses in sharp focus, window light, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `very slow rack focus from hair clip to glasses, she touches the clip then adjusts her glasses, 5 s, no cuts` · 2 klip ardışık, edit'te 10 sn

**Sahne 4**

- Keyframe: `<karakter_base>, over-the-shoulder shot toward the cafe window, she raises a vintage analog film camera to her eye, soft golden light through the window, dust particles in the light, cinematic but phone-camera realism, 9:16 vertical`
- Hareket: `slow dolly forward over her shoulder, she takes a photo, lowers the camera and looks at the light, 5 s, no cuts` · 3 klip (1: kaldırma, 2: çekim, 3: indirme + bakış), edit'te 12 sn

**Sahne 5**

- Keyframe (`still`): `close-up of a cafe table, a single blank white-bordered photo print and a ceramic cup, warm window light and soft shadows, no people, no text, no logos, cinematic but phone-camera realism, 9:16 vertical`
- Edit hareketi: yavaş pan + metin animasyonu. Video üretimi yok.

**Sahne 6**

- Keyframe: Sahne 1 keyframe'i yeniden kullanılır (yeni görsel üretilmez).
- Hareket: `static camera, she looks into the camera and gives a warm small smile, mouth closed, 5 s, no cuts`

## Kredi tahmini

Örnek birimler: `K_img = 2`, `K_test = 5`, `K_final = 12` (5 sn, 720p), `r = 1,5` → final birim başına 18.

| #      | Mod              | Görsel aday | Test klip | Final birim | Kredi |
| ------ | ---------------- | ----------: | --------: | ----------: | ----: |
| 1      | `image_to_video` |           2 |         1 |           1 |    27 |
| 2      | `image_to_video` |           2 |         1 |           2 |    45 |
| 3      | `image_to_video` |           2 |         1 |           2 |    45 |
| 4      | `image_to_video` |           2 |         1 |           3 |    63 |
| 5      | `still`          |           2 |         0 |           0 |     4 |
| 6      | `image_to_video` |  0 (tekrar) |         1 |           1 |    23 |
| Toplam |                  |          10 |         5 |           9 |   207 |

## Yorum kancası

- **İzleyici neden sonuna kadar izlesin?** POV metni ilk karede merak yaratıyor ("nasıl tepki verecek?"); doğrulama + "toka" sırrı gelişme; "fotoğraflarım hiç basılmıyor" duygusal an; son kare ilk kareyle aynı (loop).
- **İzleyici neden yorum yapsın / paylaşsın?** Kolay ve olumlu bir soru ("bugün sana iyi gelen küçük şey"); AI karakterlerin şeffaflığı üzerine görüş bildirme. Tartışma çıkarsa kurallı yanıt şablonu: [`templates/comment-replies.md`](../../templates/comment-replies.md).
- **Caption taslağı:** "Evet, ben AI ile oluşturulmuş kurgusal bir karakterim; bunu hiç saklamadım. Ama sana sormak istediğim şey gerçek: bugün sana iyi gelen küçük şey neydi? ✨ #yapayzeka #aikarakter #analogfotoğraf #kısafilm"

## Uyum kontrolü

- [x] AI açıklaması: içerik doğrudan AI olduğunu söylüyor; yayında platform AI etiketi de açılacak (`docs/compliance.md` → "Gerçek misin?").
- [x] Gerçek kişi/marka yok: kafe, fincan, makine markasız.
- [x] Müzik orijinal veya telifsiz/lisanslı.
- [x] Duygusal an kişisel deneyim uydurmuyor (Mina'nın fotoğraflarının basılmaması kurgusal karakterin gerçeği).
- [x] Sponsorlu değil.
