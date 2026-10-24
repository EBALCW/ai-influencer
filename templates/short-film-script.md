# Dikey kısa film senaryo şablonu

> Kullanım: Bu dosyayı `docs/short-films/NN-kisa-ad.md` olarak kopyala, köşeli parantezli alanları doldur. Doldurulmuş örnekler: [`docs/short-films/`](../docs/short-films/). Panelde senaryo, içerik kartının **Senaryo** (`script`) aşamasında tutulur (`/content`); akışın tamamı [`docs/pipeline.md`](../docs/pipeline.md).
>
> Kurallar: Persona [`docs/persona.md`](../docs/persona.md) ses tonuna uyar, uyum kuralları [`docs/compliance.md`](../docs/compliance.md) geçerlidir. Toplam süre **30–60 sn**, sahne sayısı **en çok 6**. Mekânları ve keyframe görsellerini tekrar kullan (maliyet + tutarlılık).

## Künye

| Alan                | Değer                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| Başlık              | [kısa, akılda kalan başlık]                                                           |
| Format              | `short_film` (dikey 9:16, 1080×1920)                                                  |
| Süre hedefi         | [30–60] sn                                                                            |
| Kanca türü          | [merak · absürt/komik · duygusal · POV]                                               |
| İçerik sütunu       | [AI ve teknoloji gündelik hayatta · mini hikâye / what-if · üretim süreci · topluluk] |
| Logline (1 cümle)   | [Kim, ne ister, ne engel olur, ne değişir]                                            |
| Mekânlar (tekrar)   | [en çok 2–3 mekân]                                                                    |
| Ses/müzik           | [orijinal veya lisanslı/telifsiz kaynak; trend ses kullanılacaksa platform lisansı]   |
| Tahmini kredi       | [toplam, hesap tablosundan]                                                           |
| Bağlı içerik kartı  | [panel `/content` kart başlığı]                                                       |
| Trend/ilham kaynağı | [link veya "orijinal"; başka üreticinin videosu birebir kopyalanmaz]                  |

## Yapı

| Bölüm            | Zaman       | Bu senaryoda                                  |
| ---------------- | ----------- | --------------------------------------------- |
| Kanca            | 0–3 sn      | [ilk karede Mina net; görsel/metinsel kanca]  |
| Gelişme          | 3–15 sn     | [durumu kur, tempo düşmesin]                  |
| Twist / duygu    | 15–40 sn    | [beklenmeyen dönüş veya duygusal an]          |
| Kapanış + loop   | son 5–10 sn | [payoff + son kare ilk kareye bağlanıyor mu?] |
| CTA (yorum için) | kapanışta   | [izleyiciye soru]                             |

## Sahne tablosu

Her sahnede süre ve görsel prompt zorunlu. `Mod` sütunu panel üretim modlarıdır (ADR 0002): `text_to_image` (keyframe), `image_to_video` (keyframe'den klip), `video_to_video` (motion transfer). `still` = sadece görsel üretilir, hareket edit'te verilir (zoom/pan); kredi tasarrufu sağlar.

| #   | Süre (sn) | Mekân | Kamera açısı | Aksiyon | Ekran metni | Ses / VO / müzik | Mod |
| --- | --------: | ----- | ------------ | ------- | ----------- | ---------------- | --- |
| 1   |           |       |              |         |             |                  |     |
| 2   |           |       |              |         |             |                  |     |
| 3   |           |       |              |         |             |                  |     |
| 4   |           |       |              |         |             |                  |     |
| 5   |           |       |              |         |             |                  |     |
| 6   |           |       |              |         |             |                  |     |

**Toplam süre:** [toplam] sn (30–60 aralığında olmalı)

## Görsel prompt'lar

Prompt metni İngilizce yazılır (görsel modeller İngilizcede daha tutarlı). Her prompt `<karakter_base>` ile başlar; bu, panel prompt kütüphanesindeki (`/prompts`, kategori `character`) sabit karakter prompt'udur. Kimlik kartı ve görsel kanca sabit, mekân/ışık/kamera değişkendir.

Referans `<karakter_base>` (kütüphanedeki sürüm esastır):

```text
Mina Arven, fictional adult woman (25), short dark chestnut bob haircut with a single cobalt blue hair clip, amber-tinted semi-transparent geometric glasses, small terracotta crossbody bag, modern illustrative-realistic editorial look, natural skin texture, color palette cobalt / warm terracotta / cream
```

Ortak negatif prompt:

```text
extra fingers, deformed hands, distorted face, celebrity likeness, real person likeness, brand logos, readable brand names, watermark, garbled text, childlike appearance, oversexualized, plastic skin
```

Sahne başına iki satır doldur:

- **Sahne N, keyframe (`text_to_image`):** `<karakter_base>, [mekân], [ışık], [kamera açısı / lens], [aksiyon/poz], cinematic but phone-camera realism, 9:16 vertical`
- **Sahne N, hareket (`image_to_video`):** `[kamera hareketi], [karakter hareketi], [ortam hareketi], [süre] s, no cuts`

Notlar:

- Ekran yazısı, tabela ve telefon arayüzü metinleri **modelde üretilmez**; boş/soyut yüzey üretilir, metin edit'te eklenir (model yazıyı bozar).
- Konuşan ağız (dudak senkronu) yerine seslendirme (VO) + B-roll tercih edilir; dudak senkronu QC'de en sık kritik hatadır.
- Gerçek marka, logo, ünlü veya tanınabilir kişi prompt'a yazılmaz.

## Kredi tahmini

Formül ve örnek birim fiyatlar [`docs/pipeline.md` → Kredi hesabı](../docs/pipeline.md#kredi-hesabı) bölümünde. Sahne başına:

`kredi = görsel_aday × K_img + test_klip × K_test + final_birim × K_final × r`

(`final_birim` = ⌈sahne süresi / 5⌉; `r` = ortalama yeniden deneme çarpanı)

| #      | Mod | Görsel aday | Test klip | Final birim | Kredi |
| ------ | --- | ----------: | --------: | ----------: | ----: |
| 1      |     |             |           |             |       |
| Toplam |     |             |           |             |       |

## Yorum kancası

- **İzleyici neden sonuna kadar izlesin?** [#22 Soru 1: kanca, tempo, payoff, loop]
- **İzleyici neden yorum yapsın / paylaşsın?** [#22 Soru 2: soru, etiketlenebilirlik, tepki malzemesi]
- **Caption taslağı:** [persona tonunda, 1–2 emoji, 3–5 hashtag, açık soru]

## Uyum kontrolü

- [ ] AI açıklaması: platformun AI etiketi açılacak; içerik Mina'yı gerçek kişi gibi sunmuyor.
- [ ] Gerçek kişi/marka/kurum taklidi yok; mekânlarda okunabilir marka yok.
- [ ] Telifli karakter, sahne veya müzik yok. Müzik orijinal, telifsiz kütüphaneden lisanslı veya platformun ticari kullanıma açık ses kütüphanesinden.
- [ ] Sağlık/finans/haber/ürün deneyimi iddiası yok.
- [ ] Sponsorlu ise "reklam"/"tanıtım" ibaresi ve platform ücretli ortaklık aracı.

## Ek: Claude senaryo asistanı talimatı

Bu metin panel prompt kütüphanesine (`/prompts`) kategori **`short_film`**, key **`ai-script`** olarak eklenir; içerik kartındaki AI asistanı (`docs/AI.md`) senaryo görevinde bunu yerleşik talimata ekler. Kütüphaneden indirilen paketler (`/prompts/`) repoya girmez; kaynak metin burada tutulur.

```text
Görev: Mina Arven için dikey (9:16) kısa film senaryosu yaz.
Girdi: konu, kanca türü (merak / absürt-komik / duygusal / POV), hedef süre (30–60 sn).
Kurallar:
- Toplam süre hedef süreyi aşmasın ve 30 sn'nin altına düşmesin. En çok 6 sahne.
- Yapı: 0–3 sn kanca (ilk karede Mina net), 3–15 sn gelişme, 15–40 sn twist veya duygusal an, sonda payoff ve ilk kareye bağlanan loop.
- Ses tonu: meraklı, sakin, hafif ve kendine dönük espri. Abartılı vaat, uzmanlık iddiası, ürün kullanma iddiası yok.
- Mina'nın AI karakter olduğu gizlenmez; gerçek kişi, marka, telifli karakter veya müzik adı geçmez.
- Her sahnede: süre (sn), görsel tarif (mekân, ışık, kamera açısı, aksiyon) ve konuşulacak/ekranda yazacak metin.
- Ekran metni kısa olsun (en çok 8 kelime); tabela/telefon metinleri edit'te eklenecek diye işaretle.
- Mekânları tekrar kullan; mümkünse son sahne ilk sahnenin mekânında geçsin.
- Sonda izleyiciye yorum yaptıracak tek bir açık soru ve persona tonunda caption öner.
```

Test notu: talimat 3 farklı girdiyle (bir merak, bir absürt, bir POV) denenir, en iyi sonuç veren sürüm kütüphanede tutulur, sonuçlar prompt'un versiyon notuna yazılır.
