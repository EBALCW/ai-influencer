# Kredi ve maliyet kuralları

Bu rehber #27'nin üretim ve maliyet kayıt standardıdır. Gerçek bütçe, faturalar ve haftalık sonuçlar panelde veya ekibin erişimi kısıtlı alanında tutulur; public repoya eklenmez. İlk iki haftanın maliyet düşüşü henüz ölçülmedi.

İlgili belgeler: [üretim akışı](pipeline.md), [maliyet veri modeli](data-model.md#maliyet-ve-bütçe-59), [sağlayıcı kararı](adr/0002-generation-provider.md), [haftalık kontrol şablonu](../templates/cost-review.md).

## Üretimden önce

1. Owner, `/costs` üzerinden ayın toplam ve gerekiyorsa influencer bütçesini belirler. Ana bütçe USD olarak izlenir; TL karşılığı için geçerlilik tarihli kur girilir. Tutar ekip kararıdır; örnek fiyatlar bütçe olarak kullanılmaz.
2. Bütçe planında karakter/referans, video, deneme, edit araçları ve AI API payları ayrılır. Bu dağılım operasyonel plandır; paneldeki maliyet kategorileriyle aynı olmak zorunda değildir. Payların toplamı aylık tavanı aşamaz.
3. Üretici oturum için USD harcama tavanı ve varsa kredi tavanı kaydeder. Önceki harcama + sıradaki işin tahmini bu tavanı aşacaksa yeni iş göndermez. Tahmin yoksa fiyat doğrulanana kadar bekler. **Oturum tavanı elle uygulanır**; panel bunu otomatik zorlamaz.
4. Açık/kuyruktaki işlerin tahminleri de oturum hesabında tutulur. Panelin aylık kontrolü gerçekleşmiş maliyete bakar; kuyruktaki bütün işlerin tahminlerini bütçeden rezerve etmez. Aynı bütçeyi kullanan üreticiler tek oturum sorumlusu üzerinden ilerler.

| Aylık kullanım | Yapılacak işlem                                                          | Panel davranışı                                                             |
| -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| %50            | Kalan iş adedi ve tahmini maliyetle ay sonu projeksiyonunu gözden geçir. | Bu eşik için ayrı otomatik uyarı yok; elle kontrol edilir.                  |
| %80            | Deneysel işleri durdur; kalan harcamayı owner ile önceliklendir.         | Varsayılan `warn_ratio = 0.8` ile bütçe uyarısı oluşur.                     |
| %100           | Yeni üretimi durdur; bütçe veya kapsam kararı al.                        | Yeni üretim engellenir; yalnız owner açık bütçe aşımı onayıyla iş açabilir. |

Eksik kur, eksik kredi fiyatı veya kaydı oluşmamış ücretli üretim varsa panel toplamı tam kabul edilmez. Owner eksikleri tamamlar; sıfır maliyet varsayımıyla üretime devam edilmez.

## Deneme ve yeniden üretim

- Önce test modunda kısa/düşük maliyetli çıktı al. Model destekliyorsa 480p ve en çok 5 saniye kullan; modelin kabul etmediği çözünürlük veya süreyi zorlamadan, desteklediği en düşük uygun ayarı seç.
- Uzun sahneyi 3–5 saniyelik planlara böl; yalnız QC'den geçen planları final üretime al. Modelin minimum süresi daha uzunsa senaryoyu buna göre planla.
- Aynı sahne için **ilk üretim dahil en fazla üç yaratıcı deneme** yap. Üçüncü denemede de QC geçmiyorsa üretimi durdur; prompt, referans veya sahneyi değiştirip yeni tahmin çıkar.
- Worker'ın aynı isteği ağ hatası nedeniyle otomatik tekrar etmesi yaratıcı deneme değildir. Panelde yeni üretim açmak ayrı denemedir; önceki işin sonucunu kontrol etmeden aynı sahneyi yeniden kuyruğa alma.
- Çalışan prompt'u panelin `/prompts` kütüphanesinde versiyonla; referansı, modeli ve ayarları üretime bağla. Prompt metinlerini repoya koyma.
- QC sonucu başarısız olsa da sağlayıcı ücretlendirmişse maliyeti kaydet. Teknik olarak `succeeded` olan ama kullanılamayan çıktı, panelin `failed` üretim metriğinde görünmeyebilir; QC kaybını ayrıca haftalık kayda ekle.

## Oturum sonu kayıt

Panel tek maliyet kaynağıdır. Ayrı bir Sheets tablosu tutuluyorsa panel kayıtlarının dışa aktarımı olarak kullanılır; aynı harcama iki kez girilmez.

| Bilgi                                                 | Kayıt yeri                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Tarih, araç, işlem, model, çözünürlük/süre, sonuç     | Üretim kaydı (`/production`); panel dışı üretim için kısıtlı oturum kaydı |
| Harcanan kredi ve gerçekleşen para tutarı             | Üretim ve bağlı maliyet kaydı (`/costs`)                                  |
| İçerik bağlantısı                                     | İçerik kartındaki üretim/asset bağlantıları                               |
| Başarısızlık nedeni, QC kaybı, yaratıcı deneme sayısı | İçerik kartı notu ve haftalık kontrol                                     |
| Abonelik, edit aracı, panel dışı ücretli iş           | `/costs` üzerinden ayrı maliyet kaydı                                     |
| Fatura/ekstre ve bakiye kanıtı                        | Ekibin kısıtlı alanı; repoda veya issue'da paylaşılmaz                    |

Otomatik kaydı önce kontrol et: ücretli başarılı/başarısız üretim için mevcut `generation_id` kaydı varsa ikinci satır ekleme. Higgsfield Cloud adaptörü başarılı işin tahminini `cost_usd` olarak kaydeder; bu tutarı ekstreyle doğrula. Sağlayıcının ücretlendirmediği/iade ettiği başarısız iş için ücret uydurma. Krediden fiyatlanan araçlarda geçerli kredi fiyatı eksikse owner `/costs` üzerinden fiyatı girer; kayıtsız bitmiş üretimlerin tamamlandığını kontrol eder.

## Para ve kredi mutabakatı

**Nakit ödeme ile üretim tüketimini ayır.** Ön ödemeli kredi yüklemesi veya kredi içeren abonelik faturası, aynı kredilerin üretim maliyetine eklenirse harcama iki kez sayılır. Panelde kredi tüketimi maliyet olarak tutuluyorsa ilgili kredi alımı ayrıca tüketim gideri olarak girilmez; ödeme kısıtlı mutabakat kaydında izlenir. Krediden bağımsız sabit abonelik/edit ücreti ayrı giderdir. Vergi, kur ve dönem farklarını ayrıca açıkla.

- Kredi birim fiyatı = kredilere ayrılan net ödeme / alınan kredi. Bonus, son kullanma tarihi ve iadeleri ayrıca kaydet; farklı araçların kredilerini toplama.
- Kredi kontrolü: **açılış bakiyesi + alınan/bonus kredi + iade − tüketim − süresi dolan kredi = kapanış bakiyesi**. Sağlayıcı iadeyi tüketimden düşmüş veriyorsa ikinci kez ekleme.
- Para kontrolü: aynı hesap, para birimi, tarih aralığı ve vergi kapsamıyla ekstreyi kayıtlarla eşleştir. Ön ödeme varsa açılış/kapanış kullanılmamış bakiye farkını hesaba kat; tüketim toplamını doğrudan kredi alım faturasıyla karşılaştırma.
- Fark oranı = `|karşılaştırılabilir kayıt toplamı − ekstre toplamı| / ekstre toplamı × 100`. Hedef **en fazla %5**. Ekstre sıfırsa oran hesaplanmaz; kayıt toplamı da sıfır olmalı, değilse fark incelenir.
- Fark %5'i aşıyorsa eksik kayıt, yinelenen gider, tarih, vergi, iade ve kur kontrol edilir. Düzeltmeler panel/API üzerinden yapılır; uzak veritabanına SQL yazılmaz.

## Haftalık ölçüm ve ikinci hafta hedefi

Her hafta [kontrol şablonu](../templates/cost-review.md) doldurulur ve `/reports` haftalık raporuyla birlikte kısıtlı alanda saklanır.

- **Dönem video maliyeti:** dönem gideri / dönemde yayınlanan post sayısı. Bu panelin ortalamasıdır; aynı videonun cross-post edilmesi paydayı artırır. Haftalar arasında aynı platform ve kapsam kullanılır.
- **Doğrudan içerik maliyeti:** içeriğe bağlı bütün ücretli denemeler + ayrıca hesaplanan edit/sabit gider payı. Post detayındaki `direct` tutar bağlı üretimleri kapsar; edit payını otomatik içerdiği varsayılmaz. `average` ise aylık ortalama tahminidir. Cross-post detay maliyetlerini toplayarak toplam gider çıkarma; aynı üretim tekrar sayılır.
- **Başarısızlık:** paneldeki teknik başarısızlık oranı ve maliyeti ile QC'de elenen başarılı işlerin maliyeti ayrı kaydedilir. Ücretli başarısız denemeler karşılaştırmadan çıkarılmaz.
- **1000 izlenme maliyeti:** maliyet × 1000 / aynı kapsamdaki izlenme. İzlenme veya yayın sayısı sıfırsa ilgili oran `hesaplanamaz`; ölçülmeyen değere sıfır yazılmaz. Panel dönem metriği en son snapshot'ları kullanır; 24 saat karşılaştırması yapılacaksa aynı yaştaki snapshot'lar ayrıca seçilir.
- **İyileşme:** `(1. hafta video maliyeti − 2. hafta video maliyeti) / 1. hafta video maliyeti × 100`. Hedef ≥ %30; ilk hafta maliyeti sıfırsa veya kapsamlar farklıysa sonuç hesaplanamaz. Format, kalite ve süre farkları açıklanır; daha düşük kalite tek başına tasarruf sayılmaz.

İlk iki haftadan sonra en fazla harcama yaratan üç neden seçilir (prompt, referans, süre, çözünürlük, anatomi/QC veya teknik hata), her biri için bir aksiyon ve sonraki kontrol tarihi belirlenir. Gerçek fatura mutabakatı ve ikinci hafta ölçümü tamamlanmadan #27 kapanmaz.
