# Claude ile trend araştırması: ölçüm ve karar

- **İlgili issue:** [#12](https://github.com/EBALCW/ai-influencer/issues/12) · manuel araştırma ve arşiv formatı: [#10](https://github.com/EBALCW/ai-influencer/issues/10) · Claude kurulumu: [#11](https://github.com/EBALCW/ai-influencer/issues/11), [MCP rehberi](mcp-setup.md)
- **Prompt:** [`trend-research-prompt.md`](trend-research-prompt.md) (v1)
- **Durum:** Protokol ve tablolar hazır. **Gerçek tur yapılmadı, karar verilmedi.** Tur 1 ve tur 2 çalıştırılınca aşağıdaki boş hücreler doldurulur.

## Kurallar (her turda)

- Sadece okuma ve gezinme. Takip, beğeni, yorum, DM, kaydetme yasak. Prompt'un "Yetki sınırları" bölümü değiştirilmeden kullanılır.
- Ayrı Chrome profili. Karakter hesabı bu profilde hiç açılmaz; ajana şifre, 2FA kodu veya çerez verilmez (#34).
- Aynı gün, aynı niş için manuel tur da yapılır ki karşılaştırma adil olsun.
- Tur sonunda aktivite geçmişi kontrol edilir (Instagram → Hesap Merkezi → Etkinliğin: beğeniler, yorumlar, takip). Herhangi bir etkileşim varsa tur "ihlal" sayılır ve ölçüm kaydının notuna yazılır.

## Tur 1: tek niş / hashtag

1. Araştırma profilini aç, kronometreyi başlat.
2. Prompt v1'i "Görev → A" ile doldur: 1 niş, 2-3 hashtag, son 7 gün, 500K+ izlenme, **10 video** hedefi.
3. Claude in Chrome'a ver. Oturum boyunca müdahale etme; ajan durup soru sorarsa cevapla ve bunu not et.
4. CSV çıktısını kaydet, kronometreyi durdur (süre = prompt'u verdiğin andan CSV'nin hazır olduğu ana kadar).
5. Token kullanımını not et (Claude Code: `/cost`; Claude uygulaması: kullanım ekranı veya oturum sonu tahmini). Bilinmiyorsa "bilinmiyor" yaz, tahmin etme.
6. `/research` → **CSV içe aktar** ile yükle (`kaynak=claude`).
7. Doğrulama: rastgele 5 kaydı elle aç; link açılıyor mu, izlenme ekrandakiyle yaklaşık (±%10) aynı mı? Sonra **bütün** kayıtların linkini ve izlenmesini kontrol et (kabul kriteri ≥%80 doğru).
8. Hatalı veya uydurma çıkan her kaydı say. "DOĞRULANMADI" diye işaretlenmiş boş hücre hata sayılmaz; yanlış yazılmış değer sayılır.
9. Kullanılabilir fikir = uyarlama puanı ≥4 **ve** link/izlenme doğrulanmış kayıt. Puanı ekip verir; Claude'un puanı ilk taslaktır.

## Tur 2: rakip hesaplar

1. `research/competitors.md` (#10) listesinden 5 hesap seç.
2. Prompt v1'i "Görev → B" ile doldur: her hesaptan en çok izlenen 2-3 video, toplam 10-15.
3. Tur 1'deki 3-9. adımları aynen uygula.
4. Prompt'u değiştirmen gerektiyse v2 olarak versiyonla ve kayda hangi sürümle çalıştığını yaz.

## Ölçüm kaydı

Her tur (manuel tur dahil) bir satır. Süre dakika, token toplam (girdi + çıktı).

| Tarih | Tur | Yöntem | Prompt sürümü | Hedef video | Bulunan kayıt | Süre (dk) | Kullanılabilir fikir (puan ≥4) | Link + izlenme doğru | Hatalı/uydurma veri | "DOĞRULANMADI" satırı | Token | Tahmini maliyet (USD) | Etkileşim ihlali | Not |
| ----- | --- | ------ | ------------- | ----------- | ------------- | --------- | ------------------------------ | -------------------- | ------------------- | --------------------- | ----- | --------------------- | ---------------- | --- |
|       | 1   | Claude | v1            | 10          |               |           |                                |                      |                     |                       |       |                       |                  |     |
|       | 1   | Manuel | –             | 10          |               |           |                                |                      |                     | –                     | –     | –                     |                  |     |
|       | 2   | Claude | v1            | 10-15       |               |           |                                |                      |                     |                       |       |                       |                  |     |
|       | 2   | Manuel | –             | 10-15       |               |           |                                |                      |                     | –                     | –     | –                     |                  |     |

Maliyet: Claude aboneliği içinde çalışıyorsa USD yerine "abonelik" yaz ve token sayısını yine not et. API ile çalışıyorsa güncel fiyatı [`tool-pricing.md`](tool-pricing.md) üzerinden hesapla.

## Manuel / otomatik karşılaştırma

Ölçüm kaydından hesaplanır. Doldurulduğunda her satırın "Kazanan" hücresi yazılır.

| Ölçüt                           | Hesap                                         | Manuel | Claude | Kazanan |
| ------------------------------- | --------------------------------------------- | ------ | ------ | ------- |
| 10 fikir başına süre (dk)       | süre ÷ kullanılabilir fikir × 10              |        |        |         |
| İsabet oranı                    | uyarlama puanı ≥4 kayıt ÷ bulunan kayıt       |        |        |         |
| Veri doğruluğu                  | link + izlenme doğru ÷ bulunan kayıt          |        |        |         |
| Uydurma/hatalı veri             | hatalı kayıt sayısı                           |        |        |         |
| 10 fikir başına token / maliyet | token (veya USD) ÷ kullanılabilir fikir × 10  | –      |        |         |
| İnsan müdahalesi                | tur sırasında verilen cevap / düzeltme sayısı |        |        |         |
| Etkileşim ihlali                | aktivite geçmişinde görülen eylem             |        |        |         |

## Karar

_Turlar tamamlanınca doldurulur._

- **Otomatik kalacak:** _(ör. hashtag taraması ve ilk taslak tablo)_
- **Manuel kalacak:** _(ör. uyarlama puanı, sayıların son kontrolü)_
- **Prompt:** _(v1 yeterli mi, v2'de ne değişti)_
- **Gerekçe:** _(karşılaştırma tablosundaki hangi ölçütler belirleyici oldu)_

Karar ölçütü önerisi: Claude 10 fikir başına sürede manueli **en az %30** geçiyor, veri doğruluğu **≥%80** ve etkileşim ihlali **0** ise tarama adımı otomatiğe geçer. Doğruluk %80'in altındaysa Claude sadece aday link listesi çıkarır, sayıları insan girer.

## Sonraki adımlar

- Başarılı prompt panelde prompt kütüphanesine (#46) `research` kategorisiyle kaydedilir.
- Panel asistanından (#48) tetikleme ayrı iş; tarayıcı ajanı panel sunucusunda çalışmaz, bu yüzden şimdilik CSV içe aktarma yolu kullanılır.
