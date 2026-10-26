# Üretim aracı fiyat karşılaştırması

Okuma tarihi: **26 Ekim 2026**. Fiyat ve kredi maliyetleri sık değişir; satın almadan hemen önce resmi ödeme ekranı yeniden kontrol edilir. Vergi, banka kuru ve bölgesel fiyat farkı tabloya dahil değildir. Web aboneliği ile API kredisi aynı bakiye sayılmaz.

| Araç / plan             | Resmi fiyat ve kredi                                          | 5 sn video örneği                                                   | Ticari kullanım / not                                                                 | 1.000 TL bütçe kararı                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Higgsfield Starter      | Yıllık faturalamada aylık eşdeğer **$19**, ayda **270 kredi** | Seedance 2.0 Fast 720p yaklaşık 12; Kling 3.0 720p yaklaşık 7 kredi | MCP/CLI/Canvas üretimleri her zaman kredi harcar; abonelik kredisi yenilemede silinir | Mevcut Higgsfield/MCP akışıyla en uyumlu aday. Aylık eşdeğer yaklaşık **945,49 TL**, fakat yıllık peşin ödeme aylık tavanı aşar; owner yıllık bütçe onayı olmadan satın alınmaz. |
| Runway Standard         | Ayda **625 kredi**; fiyat ödeme ekranında doğrulanacak        | Gen-4.5 12 kredi/sn, 5 sn = 60 kredi                                | Standart plan hafif/deneysel kullanım içindir; plan ile API kredileri ayrıdır         | Fiyat doğrulanmadan seçilmez. Kısa test ve Turbo yaklaşımı karşılaştırma benchmark'ına alınır.                                                                                   |
| Luma Dream Machine Lite | Web **$9,99/ay**, **3.200 kredi**                             | Ray3.14 Draft 5 sn 20 kredi                                         | Filigranlı ve kişisel kullanım; ticari yayın için uygun değil                         | Ucuz olsa da proje çıktısı ticari olacağı için elenir.                                                                                                                           |
| Luma Dream Machine Plus | Web **$29,99/ay**, **10.000 kredi**                           | Ray3.14 720p SDR 5 sn 100 kredi; 1080p SDR 5 sn 400 kredi           | Filigransız ve ticari kullanım                                                        | Yaklaşık **1.492,38 TL**; 1.000 TL tavanı aşar, bu dönemde elenir.                                                                                                               |

Kur hesabı: TCMB 26 Ekim 2026 gösterge satış kuru `49,7627 TL/USD`. Yaklaşık tutar `USD × 49,7627`; gerçek satın alma kaydı ödeme sağlayıcısının kuru ve vergilerle girilir.

## Seçim

Teknik uyum nedeniyle **Higgsfield Starter birinci adaydır**; üretim akışı zaten Higgsfield MCP/CLI ve kredi sorgusuna göre belgelenmiştir. Ancak resmi sayfa görünen $19 değeri yıllık faturalama koşuluna bağlar. Yıllık ödeme açıkça onaylanmadan abonelik alınmaz. İlk benchmark, mevcut ücretsiz/eldeki krediyle veya satın alma ekranında aylık seçenek 1.000 TL altında doğrulanırsa yapılır.

Benchmark aynı 5 saniyelik sahnede ve aynı referansla yürütülür: en fazla bir düşük çözünürlük testi; kredi, gerçekleşen TL, süre, QC kritik hata sonucu ve kimlik tutarlılığı kaydedilir. Sadece kredi fiyatına göre seçim yapılmaz. Higgsfield kabul edilmezse Runway Standard fiyatı ödeme ekranından doğrulanır; Luma Plus mevcut bütçe içinde değildir.

## Resmi kaynaklar

- [Higgsfield fiyatlandırma](https://higgsfield.ai/pricing) — plan ve model kredi örnekleri.
- [Higgsfield kredi kuralları](https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work) — yenileme, iade, MCP/CLI harcaması ve kullanım geçmişi.
- [Runway kredi kuralları](https://help.runwayml.com/hc/en-us/articles/15124877443219-How-do-credits-work) ve [Standard plan ayrıntısı](https://help.runwayml.com/hc/en-us/articles/49191105352339-Standard-plan-details).
- [Luma abonelikleri](https://lumalabs.ai/learning-hub/payments-subscriptions) ve [kredi sistemi](https://lumalabs.ai/learning-hub/dream-machine-credit-system).
- [TCMB gösterge kuru özeti](https://www.tcmb.gov.tr/kurlar/kurlar_tr.html) — satın alma tarihinde tekrar okunur.
