# Görsel ve video kalite kontrolü

İlgili iş: #3. Bu rehber hazırlık çıktısıdır; referans seti veya video kabulünün yapıldığını göstermez. #2 referans seti hazır olduğunda her dosyaya uygulanır. Sonuçlar erişimi kısıtlı ekip alanında tutulur; prompt, özel asset bağlantısı ve kişi bilgisi public repoya yazılmaz.

## Karar ve uygulama

Önce ilk beş dakikada kimlik, anatomi, yüz ve video sürekliliğini tara. Ardından tam çözünürlükte ve telefon boyutunda bütün maddeleri kontrol et. Videoyu normal hızda, yavaş ve sorunlu aralıklarda kare kare incele. Ses varsa dudak eşleşmesini de değerlendir.

Her madde için geçti / kaldı / uygulanamaz seçilir; uygulanamaz gerekçesi yazılır. Kritik tek hata sonucu failed yapar; kontrol edilmemiş madde pending kalır. Minör hata ancak yayın görünümünü etkilemediği gerekçesi ve ikinci göz onayı kaydedilirse kabul edilir. Üreten kişi dışında bir ekip üyesi bağımsız kontrol yapar. Düzeltme sonrası tüm kontrol tekrarlanır; özellikle kimlik yeniden karşılaştırılır.

## Kontrol listesi

| No  | Kontrol                                                       | Hata sınıfı |
| --- | ------------------------------------------------------------- | ----------- |
| 1   | Görünen el ve parmakların sayısı anatomik olarak doğru        | Kritik      |
| 2   | Parmak uzunlukları ve eklemler doğal, birleşmiş parmak yok    | Kritik      |
| 3   | El, bilek ve kol bağlantısı kesintisiz                        | Kritik      |
| 4   | Boyun, omuz ve gövde oranları doğal                           | Kritik      |
| 5   | Kol ve bacak uzunlukları, eklem yönleri anatomik              | Kritik      |
| 6   | Yüz referans kimliğiyle aynı                                  | Kritik      |
| 7   | Gözler, göz bebekleri ve bakış yönü uyumlu                    | Kritik      |
| 8   | Diş, ağız ve kulaklarda birleşme veya çoğalma yok             | Kritik      |
| 9   | Saç rengi ve ana stil referansla tutarlı                      | Kritik      |
| 10  | Saç kenarında küçük halo veya kesilme yok                     | Minör       |
| 11  | Cilt dokusu doğal, belirgin plastik yüz yok                   | Kritik      |
| 12  | Kıyafet ve aksesuarlar erimiyor, vücuda birleşmiyor           | Kritik      |
| 13  | Yazı veya logo kullanılıyorsa biçimi ve okunurluğu doğru      | Kritik      |
| 14  | Arka plan nesnelerinde belirgin perspektif/anatomi hatası yok | Kritik      |
| 15  | Önemsiz arka plan dokusunda hafif düzensizlik yok             | Minör       |
| 16  | Işık, gölge ve yansımalar sahneyle tutarlı                    | Kritik      |
| 17  | Videoda yüz ve kimlik kareler boyunca sabit                   | Kritik      |
| 18  | Hareket sırasında eller ve uzuvlar bozulmuyor                 | Kritik      |
| 19  | Nesneler sebepsiz kaybolmuyor veya çoğalmıyor                 | Kritik      |
| 20  | Konuşmada dudaklar sesle eşleşiyor                            | Kritik      |
| 21  | Geçişte kıyafet, saç ve aksesuar sürekliliği korunuyor        | Kritik      |
| 22  | Küçük arka plan titreşimi izlemeyi etkilemiyor                | Minör       |

## Düzeltme ve tekrar sınırı

Yerel küçük hatada inpainting, kimlik veya büyük anatomik hatada yeniden üretim denenir. Her deneme ve kredi #27 kaydına eklenir. İki düzeltmede çözülemeyen dosya referans setinden çıkarılır; başarısız dosya silinmeden özel arşivde tutulur. Yeni sürüm ayrı asset olarak kaydedilir. Kritik hata varken yayın veya sonraki üretimde referans olarak kullanım yapılmaz.

## Kaçınılacak sahneler

Aşağıdaki altı risk üretim öncesi değerlendirilir; bunlar doğrulanmış üretim sonucu veya negatif prompt metni değildir. Araca özel promptlar paneldeki özel prompt kütüphanesinde sürümlenir.

- Ellerin yüzü ve ana kimlik özelliklerini kapatması.
- Yakın planda birbirinin üzerine binen çok sayıda parmak.
- Karmaşık, hızlı el hareketleri ve çapraz uzuvlar.
- Birden fazla kişinin birbirini örttüğü sahneler.
- Ayna ve çoklu yansımayla aynı yüzün çoğalması.
- İnce yazı, küçük logo veya karmaşık aksesuarın ana odak olması.

## Kabul kanıtı

Özel QC kaydında asset kimliği/sürümü, kontrol tarihi, kontrol listesi sürümü (bu dosyanın commit SHA'sı), her maddenin sonucu, video zaman aralığı, kritik/minör hata, düzeltme denemesi, kredi, ikinci göz sonucu ve nihai karar bulunur. Bilinmeyen değer doldurulmaz; pending yazılır.

#3 kapanmadan önce tüm #2 referans dosyaları taranmalı, kritik hata kalmamalı, ikinci göz incelemesi ve iki deneme videosunun kontrolü kaydedilmelidir. Bu dokümanın varlığı bu kabul adımlarının yerine geçmez.
