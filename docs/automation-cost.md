# Manuel / MCP üretim karşılaştırması

#13'ün test protokolü ve hesaplama aracı. **Gerçek ölçüm yapılmadı, yöntem kazananı seçilmedi.** #11'de resmi MCP kurulumu, #2 referansları ve #3 bağımsız QC hazır olduğunda altı hücre doldurulur. Dolu kayıtlar, prompt, referanslar ve faturalar public repoya girmez.

## Sabit test düzeni

| Senaryo          | Çıktı                                      | Manuel yöntem          | Otomatik yöntem      |
| ---------------- | ------------------------------------------ | ---------------------- | -------------------- |
| `image`          | Aynı referansla tek görsel                 | Higgsfield web arayüzü | Resmi Higgsfield MCP |
| `image_to_video` | Aynı görselden 5 sn video                  | Higgsfield web arayüzü | Resmi Higgsfield MCP |
| `video_to_video` | Aynı izinli 5 sn hareket referansıyla klip | Higgsfield web arayüzü | Resmi Higgsfield MCP |

Burada “manuel panel” Higgsfield web arayüzüdür. Projenin Next.js paneli Cloud API ve ayrı USD bakiyesi kullanır; bu karşılaştırmaya karıştırılmaz ([MCP rehberi](mcp-setup.md)). Aynı model, sürüm, süre, çözünürlük, referans, prompt ve destekleniyorsa seed kullanılır. Model 5 saniyeyi desteklemiyorsa iki yöntemde aynı desteklenen süre seçilip yeni kurulum kimliği açılır; farklı ayarlar aynı deneyde karşılaştırılmaz.

Her senaryo için özel bir `setup_id` oluştur: bu kimlik, kısıtlı alandaki sabit referans/prompt/ayar paketine gider. Paket değişirse yeni deney dosyası aç. Aynı dosyada bir senaryo için tek kurulum ve model bulunabilir. Aynı hesap/plan ve fiyat dönemini kullan; yöntem sırasını senaryolar arasında değiştir, işleri paralel çalıştırma. Her iş bir çıktı üretir; batch kullanma. Sonuç alındığında dur, “daha iyisini bulmak” için habersiz yeniden üretme.

Her hücreye en çok üç ücretli deneme yapılır; başarısız denemeler silinmez. Böylece testin üst sınırı 18 ücretli denemedir; bu bir harcama yetkisi değildir. Owner'ın önceden belirlediği kredi/para tavanı daha erken dolarsa test durur. Test bütçesi aylık kredinin en çok %10'u olmalı; mevcut bütçede altı ilk deneme bile sığmıyorsa deneye başlanmaz. MCP limiti sert bir sağlayıcı kotası değildir ([maliyet kuralları](cost-rules.md)).

## Kayıt ve kullanım

[`templates/automation-runs.json`](../templates/automation-runs.json) boş listesini repo dışına kopyala; **her sonuçlanmış deneme için** bir nesne ekle. Bekleyen/iptal iş sonuçlanmadan eklenmez; ücretli iptal/iade varsa ekstreyle net tüketim belirlendikten sonra teknik başarısız deneme olarak, özel notuyla kaydedilir. Kimlikler gerçek hesap veya kişi adı içermez.

| Alan                 | Anlam / kabul edilen değer                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                 | Her denemeye ayrı, benzersiz kısa kimlik                                                                                                                                       |
| `scenario`, `method` | Yukarıdaki senaryo; `manual` veya `mcp`                                                                                                                                        |
| `billing`            | Yalnız `higgsfield_subscription`; Cloud API kredileri karıştırılmaz                                                                                                            |
| `setup_id`, `model`  | Sabit özel ayar paketinin kimliği ve gerçek üretim modeli/sürümü; iki yöntemde aynı                                                                                            |
| `assistant_model`    | MCP'de kullanılan Claude modelinin adı; manuelde `null`                                                                                                                        |
| `status`             | `succeeded` veya `failed` (teknik sonuç)                                                                                                                                       |
| `qc`, `quality`      | `passed`, `failed`, `not_reviewed`; bağımsız 1–5 kalite puanı veya incelenmediyse `null`. Teknik başarısız işte `not_reviewed` / `null`.                                       |
| `credits`            | Ekstreyle doğrulanmış, iadeler düşülmüş net tüketim; ondalık metin                                                                                                             |
| `generation_usd`     | Net kredilere dağıtılan üretim gideri, USD ondalık metin; bilinmiyorsa `null`                                                                                                  |
| `assistant_usd`      | Claude token maliyeti (aynı çağrıya ait giriş/çıkış/cache kullanımı ve geçerli model fiyatıyla), USD ondalık metin; bilinmiyorsa `null`. Manuelde gerçekten çağrı yoksa `"0"`. |
| `minutes`            | Başlatmadan sonuca kadar süre, dakika ondalık metin; aktif çalışma süresini ayrıca özel notta tut                                                                              |

Ondalık metinler negatif olamaz, en çok altı ondalık ve dokuz tam basamak içerir. Örneğin 2,5 kredi `"2.5"` yazılır. Bilinmeyen tutarı sıfır yazma. Claude aboneliğinde çağrı başına gerçek token kullanımı/fiyatı yoksa bunu `null` bırak; tahmini tutarı gerçekleşmiş gibi kullanma. Aynı üretim için abonelik alımını ve kredi tüketimini iki kez gider yazma; [mutabakat şablonunu](../templates/cost-review.md) kullan.

```text
pnpm automation:report "/özel/automation-runs.json"
```

Komut yalnız yerel dosyayı okur, altı satırlık JSON özetini standart çıktıya verir; API çağrısı veya üretim yapmaz. Raporu kaydedeceksen kısıtlı konuma yönlendir. Teknik başarı/QC sonucu, deneme sayısı, toplam kredi/süre, teknik başarısızlık oranı/kredisi/maliyeti, ortalama kalite ve kullanılabilir çıktı başı kredi/USD hesaplanır. Başarısız veya QC'de elenmiş işin maliyeti toplamdan çıkarılmaz. Kredi ve para hesabı altı ondalık sabit hassasiyettedir; çıktı başı bölmede altıncı basamaktan sonrası kesilir.

Altı hücreden biri boşsa, QC bekliyorsa veya USD tutarı eksikse `measurement_complete = false`. Hiç kullanılabilir çıktı yoksa çıktı başı maliyet `null`; teknik olarak sıfır maliyet ölçülmüşse `0.000000` döner. Tamlık bayrağı bir kapanış/onay değildir: her hücre teknik olarak başarısız olabilir. Komut kazanan seçmez veya fatura doğrulamaz.

## Kalite, israf ve karar

Üreten dışındaki değerlendirici [QC listesini](qc-checklist.md) uygular. Kimlik/anatomi/hareket kritik hatası varsa kalite puanı yüksek olsa bile `qc = failed`. Ölçek: 1 kullanılamaz, 2 büyük düzeltme, 3 belirgin küçük düzeltme, 4 yayına uygun, 5 güçlü ve tutarlı. Model/deneme yöntemi mümkünse değerlendiriciden gizlenir.

Özel notta her deneme için şu nedenlerden uygun olanı işaretle: istenmeyen yeniden üretim, gereksiz yüksek çözünürlük, hatalı parametre, kötü referans, anatomi/kimlik, teknik hata, diğer. Teknik başarı ama QC başarısızlığı ayrı sayılır; bunlar panelin teknik başarısızlık metriğiyle aynı değildir.

Başlamadan önce owner kredi ve USD tahminini, bekleyen iş yükünü ve oturum sınırını onaylar. Her yeni ücretli işten önce tahmin tekrar kontrol edilir; onaysız final render veya yeni deneme açılmaz. Bu bir model talimatı garantisi değildir, uygulayan kişinin durdurma kuralıdır. Ölçüm sonrası senaryo başına `manuel / MCP / hibrit` kararı verilir; kabul edilen kalite/QC'de en düşük kullanılabilir çıktı maliyeti, süre ve israf birlikte değerlendirilir. Örneklem küçükse güven “düşük” olarak yazılır ve ikinci haftada yeniden ölçülür.

Kapanış için: altı gerçek hücre, net kredi tüketiminin hesap bakiyesiyle mutabakatı, video başı maliyet, uygulanacak oturum limiti ve gerekçeli üç yöntem kararı gerekir. Bunlar sağlanana kadar #13 açık kalır.
