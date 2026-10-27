# Üretim maliyeti ve kredi kuralları

#27 için operasyon rehberi. Fatura, kredi geçmişi, kur ve gerçek içerik bağlantıları ekip erişimiyle sınırlı alanda tutulur; public repoya gerçek satır eklenmez. Panelde `/costs`, `/production` ve `/analytics/reports` hazır olduğunda tek doğruluk kaynağı paneldir. Geçici Sheets kullanımı için [`templates/costs.csv`](../templates/costs.csv) başlıkları `costs` sekmesine aktarılır.

## Başlangıç bütçesi

İlk aylık tavan **1.000 TL**'dir. 26 Ekim 2026 TCMB gösterge satış kuru **1 USD = 49,7627 TL** ile referans karşılığı **20,10 USD**'dir. Satın alma anındaki banka/ödeme sağlayıcısı kuru ve vergiler gerçek maliyete yazılır; referans kur satın alma kararı veya muhasebe kaydı değildir. Kur kaynağı ve tarihi bütçe kaydında saklanır. Bütçe değişikliği owner onayıyla, dönem başlamadan yapılır.

| Kalem                        | Pay | Aylık tavan |
| ---------------------------- | --: | ----------: |
| Video üretimi                | %55 |      550 TL |
| Karakter ve referans üretimi | %15 |      150 TL |
| Deneme / kalite testi        | %15 |      150 TL |
| Edit araçları                | %10 |      100 TL |
| Claude / AI API              |  %5 |       50 TL |

Kalemler arasında aktarım owner onayıyla yapılır; toplam tavan artmaz. Aboneliğin tamamı alındığı gün `subscription`, ek kredi `credit_pack`, tek üretim `credits`, edit aracı `editing`, AI çağrısı `ai_api` kategorisinde kaydedilir. Abonelik ve üretim kredisi aynı maliyet olarak iki kez yazılmaz: abonelik satın alma/nakit akışını, kredi satırı üretim birim maliyetini izler; haftalık üretim maliyeti hesabında yalnız krediye dağıtılmış satırlar kullanılır.

## Uyarılar ve durdurma

- **%50:** kalan ay ve hazır içerik sayısı gözden geçirilir; kullanılmayan abonelik kapatılır.
- **%80:** yeni deneyler durur. Yalnız onaylı backlog ve düzeltme üretimi devam eder. Panel `budget_warning` üretir.
- **%100:** otomatik ve elle yeni üretim durur. Yalnız owner gerekçeli bütçe aşımı verebilir; panel `budget_exceeded` üretir.
- MCP/CLI oturumunda başlamadan önce kredi sınırı yazılır. Bu sınır sağlayıcı tarafında sert limit değildir. Her üretimden önce arayüz/CLI tahmini kontrol edilir; başarısız iş kendiliğinden tekrar başlatılmaz.

## Üretim kuralı

Manuel/MCP yöntem seçimi için [otomasyon ölçüm protokolü](automation-cost.md) ve `pnpm automation:report` kullanılır. Üç senaryo × iki yöntem gerçek verilerle ölçülmeden maliyet avantajı varsayılmaz; oturum sınırı ve en fazla üç ücretli deneme kuralı her iki yöntemde de uygulanır.

1. Önce tek görsel veya **en fazla 5 saniye ve düşük çözünürlükte** test üretin. Kompozisyon, kimlik ve hareket geçmeden final çözünürlüğe çıkmayın.
2. Uzun video yerine 3–5 saniyelik klipler üretip editte birleştirin. Durağan sahnede yeni video yerine pan/zoom değerlendirin.
3. Çalışan prompt'u panel prompt kütüphanesinde sürümleyin; her denemede sıfırdan yazmayın. Prompt metni public repoya konmaz.
4. Aynı sahne için en fazla **3 ücretli deneme** yapılır. Üçüncü başarısızlıktan sonra sahne durur; prompt, referans, model veya sahne karmaşıklığı gözden geçirilir. Yeni tur owner onayı ve yeni limit ister.
5. İade edilen başarısız üretimde kredi ve parasal tutar sıfırlanmaz; ayrı `refund`/not kaydıyla mutabakat kurulur. Sağlayıcı geçmişi iade göstermiyorsa maliyet başarısız üretimde kalır.
6. Batch boyutu birden büyükse her çıktı ayrı üretim sayılır. MCP/CLI ile web “unlimited” hakkının geçerli olduğu varsayılmaz.

## Kayıt sözleşmesi

Her üretim oturumu sonunda başarılı ve başarısız bütün işlemler kaydedilir. Bilinmeyen değer boş bırakılır; `0` yalnız gerçekten sıfır ölçüldüğünde kullanılır.

- `kaynak`: `web`, `mcp`, `cli`, `api`, `panel`; `islem_tipi`: `gorsel`, `img2video`, `video2video`, `upscale`, `abonelik`, `ek_kredi`, `edit`, `ai_api`.
- `kredi_basi_tutar = plan_fiyati / plan_kredisi`; para birimi `oran_para_birimi` alanındadır. Sağlayıcı gerçekleşen USD tutarı veriyorsa tahmin yerine o tutar kullanılır.
- `tutar = kredi × kredi_basi_tutar`; `tl_karsiligi = tutar × tl_kuru`. TL harcamada kur 1 olur. Geçmiş satırlar sonraki fiyat veya kurla yeniden hesaplanmaz.
- `sonuc`: `basarili`, `basarisiz`, `iptal`, `iade`. Başarısızlık nedeni: `yanlis_prompt`, `kotu_referans`, `uzun_sure`, `yuksek_cozunurluk_testi`, `anatomi`, `kimlik_kaymasi`, `teknik_hata`, `diger`.
- Her satır mümkünse panel üretim ve içerik kimliğine bağlanır. Abonelik/ek kredi satırında içerik boş kalır.
- CSV/Sheets'e dışarıdan alınan metin düz metin olarak yapıştırılır; `=`, `+`, `-`, `@` ile başlayan değerler formül olarak çalıştırılmaz.

## Haftalık ve aylık hesaplar

- **Video başına maliyet:** dönemde yayınlanan videolara bağlı doğrudan üretim maliyeti / yayınlanan video sayısı. Payda sıfırsa “ölçülemedi”. Panelde `post_cost` ve `cost_summary` esas alınır.
- **Başarısız üretim oranı:** başarısız ücretli üretim / bütün ücretli üretimler. **Başarısız maliyet:** başarısız ve iade edilmemiş üretimlerin toplamı.
- **1.000 izlenme başına maliyet:** dönemin üretim maliyeti × 1.000 / aynı videoların en güncel izlenmesi. İzlenme yoksa “ölçülemedi”.
- İlk iki hafta hata nedenleri sayısı ve maliyetiyle sıralanır. İkinci hafta video başına maliyet hedefi: `hafta2 <= hafta1 × 0,70`. Kalite/QC puanı düşerse hedef başarılı sayılmaz.
- Haftalık rapora bütçe, harcama, oran, video sayısı, video başı maliyet, başarısızlık oranı/maliyeti, 1.000 izlenme maliyeti, en pahalı üç hata ve gelecek hafta aksiyonu eklenir.
- Ay sonunda Sheets/panel toplamı fatura toplamıyla karşılaştırılır: `mutlak_fark / fatura_toplami × 100`. Sonuç **en fazla %5** olmalı. Kredi mutabakatı: dönem başı + alınan − harcanan − süresi dolan + iadeler = dönem sonu.

Gerçek iki haftalık ölçüm ve ay sonu mutabakatı yapılmadan #27 kapanmaz.
