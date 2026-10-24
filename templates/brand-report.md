# Marka yayın sonrası rapor şablonu

Sponsorlu içerik yayınlandıktan sonra markaya gönderilir (#30). Varsayılan zamanlama: yayından **24 saat** ve **7 gün** sonra (brief `reporting` alanı farklı bir şey söylüyorsa o geçerlidir). Metrikler panelden alınır: post detay sayfası (#55, `metric_snapshots` 24 s ve 168 s anlık görüntüleri) veya Raporlar → CSV dışa aktarma (#62, `metrics` veri seti). Instagram/TikTok'ta panelde olmayan metrikler (ör. link tıklaması, Story yanıtları) uygulamadaki istatistik ekranından okunur ve ekran görüntüsü eklenir.

> Bu dosya public repodadır. Doldurulmuş rapor buraya yazılmaz; deal dosyalarına (private `contracts` bucket) yüklenir veya markaya e-postayla gönderilir.

```markdown
# [Kampanya adı] — Yayın raporu ([24 saat | 7 gün])

Marka: [marka] · Karakter: [influencer adı] · Rapor tarihi: YYYY-MM-DD

## Yayınlar

| #   | Platform          | Format        | Yayın tarihi/saati | Bağlantı     |
| --- | ----------------- | ------------- | ------------------ | ------------ |
| 1   | [Instagram Reels] | [9:16, 20 sn] | YYYY-MM-DD HH:MM   | [post linki] |

## Metrikler

| #   | Görüntülenme | Erişim | Beğeni | Yorum | Paylaşım | Kaydetme | Ort. izlenme / tamamlama | Link tıklaması |
| --- | ------------ | ------ | ------ | ----- | -------- | -------- | ------------------------ | -------------- |
| 1   |              |        |        |       |          |          |                          |                |

Kaynak: panel metrik anlık görüntüsü ([24 s | 168 s]) + uygulama istatistik ekran görüntüleri (ekte).

## Uyum

- [ ] Ücretli ortaklık / branded content etiketi açık, marka ortak olarak ekli
- [ ] Caption'da ilk kelime “Reklam”, videoda okunaklı “Reklam” yazısı
- [ ] Platform AI etiketi açık; caption'da AI karakter açıklaması var

## Öne çıkanlar

- [İzleyici yorumlarından 2–3 gözlem; kişisel veri ve kullanıcı adı yazmadan]
- [Hedefe göre değerlendirme: bilinirlik / satış / indirme]

## Ekler

- [Ekran görüntüleri]
```
