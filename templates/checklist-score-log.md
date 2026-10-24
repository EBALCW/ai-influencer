# Kontrol listesi puan kaydı (son 5 paylaşım)

Amaç: `templates/pre-publish-checklist.md` puanlarının gerçek performansla ilişkisini görmek (#22, #25). Her yayından sonra bir satır eklenir; 24 saat dolunca performans sütunları doldurulur. Panel kullanılıyorsa puanlar içerik kartındaki kontrol listesinden, performans 5.4 (#24) tablosundan alınır.

Kayıt kuralları:

- Kişi adı değil rol yazılır. Puanlayan, içeriği üretenden farklı kişi olmalıdır.
- Performans değeri tahminle doldurulmaz; ölçüm yoksa `yok` yazılır.
- Edit'e geri dönen her içerik ayrı satırda kalır (ilk puan + edit sonrası puan).

| #   | Yayın tarihi / slot | İçerik kartı | Format | Kanca puanı (1–5) | Etkileşim puanı (1–5) | Karar (ilk) | Edit'e döndü mü? Neden? | Edit sonrası puanlar | Puanlayan (rol) | 24s izlenme | Tamamlanma / ort. izlenme süresi | Yorum | Paylaşım | Kaydetme |
| --- | ------------------- | ------------ | ------ | ----------------- | --------------------- | ----------- | ----------------------- | -------------------- | --------------- | ----------- | -------------------------------- | ----- | -------- | -------- |
| 1   |                     |              |        |                   |                       |             |                         |                      |                 |             |                                  |       |          |          |
| 2   |                     |              |        |                   |                       |             |                         |                      |                 |             |                                  |       |          |          |
| 3   |                     |              |        |                   |                       |             |                         |                      |                 |             |                                  |       |          |          |
| 4   |                     |              |        |                   |                       |             |                         |                      |                 |             |                                  |       |          |          |
| 5   |                     |              |        |                   |                       |             |                         |                      |                 |             |                                  |       |          |          |

## Özet (5 satır dolunca)

- Hepsi kontrol listesinden geçti mi? `evet / hayır`
- "Geçmedi → edit'e geri dön" kuralı: `__` kez uygulandı · hiç gerekmediyse: `gerekmedi` (tarih, puanlayan rol)
- Kanca puanı 4–5 olanların 24s izlenme ortalaması: `____` · 3 olanların: `____`
- Etkileşim puanı 4–5 olanların yorum+paylaşım ortalaması: `____` · 3 olanların: `____`
- Sonuç (2 hafta sonra, #25): puan ile performans arasında ilişki `var / yok / veri yetersiz`. Yoksa revize edilecek maddeler: `____`
