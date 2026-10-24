# Sponsorlu içerik üretim süreci

> **Kapsam:** AI karakterin başrolde olduğu, markaya özel dikey sponsorlu içerik (#30). Bu belge operasyonel bir akıştır, hukuki görüş değildir. Açıklama kuralları ve kaynakları için esas belge [`docs/compliance.md`](compliance.md)'dir; burada yalnızca sponsorlu içeriğe uygulanışı anlatılır. **Son kontrol:** 24 Ekim 2026.

Şablonlar:

- Brief: [`templates/brand-brief.md`](../templates/brand-brief.md). Alanları panelde deal detayındaki **Brief** formuyla (`brand_deals.brief`) aynıdır.
- Yayın sonrası rapor: [`templates/brand-report.md`](../templates/brand-report.md)
- Sözleşme iskeleti: [`templates/brand-contract.md`](../templates/brand-contract.md). Hukuki kontrol gerekir.
- Marka yazışmaları: [`templates/brand-replies.md`](../templates/brand-replies.md). Panelde deal detayındaki “Yanıt şablonları” bölümünde görünür.

## Akış ve deal aşamaları

Panelde her anlaşma `/brands` altında bir deal kartıdır (#60). İçerik üretimi ise içerik kanbanında (#57) ilerler. Deal'e bağlanan içerik kartları (`brand_deal_content_items`) yayında otomatik olarak “ücretli ortaklık” sayılır.

| #   | Adım                          | Deal aşaması (`stage`)  | İçerik kartı aşaması      | Kim / çıktı                                                                                                                                      | Geçiş koşulu                                                                                                                                   |
| --- | ----------------------------- | ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Talep geldi                   | `lead` (Lead)           | —                         | Marka kaydı ve deal açılır. “İlk temas” yanıt şablonuyla medya kiti (#28) gönderilir, brief istenir.                                             | Marka brief vermeye istekli.                                                                                                                   |
| 2   | Brief                         | `negotiation` (Görüşme) | —                         | [`brand-brief.md`](../templates/brand-brief.md) alanları panele girilir. Eksik zorunlu bilgi markaya sorulur.                                    | `product`, `goal`, `format`, `schedule`, `revisions`, `usageRights`, `payment`, `reporting` dolu; marka AI karakteri ve etiketleri kabul etti. |
| 3   | Teklif ve sözleşme            | `negotiation`           | —                         | “Fiyat bildirimi” şablonu. `fee`, `currency`, `due_date` ve teslimat listesi (`deliverables`) girilir. Sözleşme taslağı hukuki kontrolden geçer. | Sözleşme imzalandı, deal dosyalarına yüklendi.                                                                                                 |
| 4   | Konsept / senaryo (2 seçenek) | `signed` (Anlaşma)      | `idea` → `script`         | Her teslimat için bir içerik kartı açılır ve deal'e bağlanır. İki konsept/senaryo markaya gönderilir.                                            | Marka bir konsepti yazılı olarak onayladı.                                                                                                     |
| 5   | Üretim                        | `signed`                | `production` → `qc`       | Ürün yerleştirme kuralları (aşağıda). Üretim maliyeti kaydedilir (#27).                                                                          | QC geçti (#3).                                                                                                                                 |
| 6   | Taslak video ve revizyon      | `signed`                | `edit`                    | Taslak (filigranlı veya düşük çözünürlüklü önizleme) markaya gönderilir. Revizyon turları `revisions` alanındaki hak kadar yapılır.              | Revizyon hakkı doldu veya marka memnun.                                                                                                        |
| 7   | Final onay                    | `signed`                | `edit`                    | Final video, caption ve yayın zamanı markaya gönderilir. Marka **yazılı** onay verir; onay deal notuna tarihle yazılır.                          | Final onay alındı **ve** check-list (#22, #57) eksiksiz.                                                                                       |
| 8   | Yayın                         | `signed`                | `scheduled` → `published` | Açıklama gereksinimleri (aşağıda). Instagram'da elle yayın.                                                                                      | Post yayında ve içerik kartıyla eşleşti.                                                                                                       |
| 9   | Teslim                        | `delivered` (Teslim)    | `published`               | Tüm teslimatlar `deliverables` listesinde işaretlenir. Post linkleri markaya gönderilir.                                                         | Tüm teslimatlar yayında.                                                                                                                       |
| 10  | Rapor                         | `delivered`             | —                         | [`brand-report.md`](../templates/brand-report.md) ile 24 saat ve 7 gün raporları (#55, #62).                                                     | Raporlar gönderildi.                                                                                                                           |
| 11  | Ödeme                         | `paid` (Ödendi)         | —                         | Ödeme alınınca `paid_at` girilir (Ödendi aşamasında zorunlu).                                                                                    | —                                                                                                                                              |
| —   | Vazgeçildi                    | `lost` (Kaybedildi)     | —                         | “Nazik ret” şablonu. Bağlı içerik kartları deal'den çıkarılır veya arşivlenir.                                                                   | —                                                                                                                                              |

Kurallar:

- Marka onayları (konsept, final) yazılı alınır: e-posta veya yazılı mesaj. Onay tarihi ve kanalı deal notuna yazılır, yazışmanın kendisi kısıtlı depoda tutulur.
- Final onaydan sonra caption veya videoda yapılan her değişiklik yeniden onaya gider.
- Marka “Reklam” ibaresini, AI etiketini veya ücretli ortaklık etiketini kaldırmayı isterse yayın yapılmaz. Bu madde sözleşmede de bulunur.

## Ürün yerleştirme

- Ürün fotoğrafları referans olarak kullanılıp karakterle birlikte görsel üretilir.
- AI logo, ambalaj metni ve ürün şeklini bozabilir. Her karede logo, yazı ve ürün formu kontrol edilir. Bozulma varsa ürün/logo edit aşamasında (#18) markanın verdiği gerçek görselle **composite** edilir.
- Ürünün gerçek özellikleri yanlış gösterilmez: abartılı sonuç (ör. kozmetikte cilt değişimi), olmayan özellik veya renk, gerçek dışı boyut gösterilmez. Gerçeğe aykırı ürün gösterimi yanıltıcı reklam sayılabilir.
- Karakter ürünü “kullanmış ve sonucunu görmüş” gibi konuşmaz. Örnek ifade: “Markanın paylaştığı bilgiye göre…”. Ayrıntı için [`docs/compliance.md`](compliance.md) → İzleyici sorularına yanıt.
- Arka planda başka marka logosu veya telifli karakter bulunmaz. Ses için sponsorlu içerik kuralı geçerlidir: yalnızca ticari kullanım için lisanslı ses ([`docs/compliance.md`](compliance.md) → Müzik ve ses).

## Açıklama gereksinimleri

Her sponsorlu yayında üçü birden zorunludur. Yayınlanan sponsorlu içeriklerin %100'ünde bulunmalıdır.

1. **Türkiye “Reklam” ibaresi:** Caption'ın ilk kelimesi **“Reklam”** olur ve tüm hashtag/etiketlerden önce gelir. Videoda da ilk saniyeden itibaren okunaklı, arka plandan ayırt edilebilen ve hiçbir yazının örtmediği bir “Reklam” yazısı bulunur. Story'de her karede, carousel'de kapakta yer alır. Aynı içerik başka bir platformda veya formatta yeniden paylaşılırsa her paylaşımda tekrarlanır. Yalnızca “iş birliği”, “#ad” veya “#sp” yeterli sayılmaz. Dayanak: 1 Ağustos 2026'da yürürlüğe giren yönetmelik değişikliği, ayrıntılar [`docs/compliance.md`](compliance.md) → Türkiye bölümünde.
2. **Platformun ücretli ortaklık etiketi:**
   - Instagram: Gelişmiş ayarlar → Branded content → **Add paid partnership label**, ardından marka **ortak** olarak eklenir. Markanın onayı gerekebilir; yayın gününden önce test edin. Menü adları resmî yardım sayfasından doğrulanamadı ve uygulamada değişebilir.
   - TikTok: Yükleme ekranındaki ticari içerik açıklaması (content disclosure) açılır, üçüncü taraf marka seçeneğiyle “Paid partnership” etiketi alınır.
   - YouTube: Panelden yayında `hasPaidProductPlacement` otomatik gönderilir. Elle yüklemede Studio'daki **Paid promotion** bölümünde branded content (ücretli tanıtım) seçeneği işaretlenir.
3. **AI etiketi (#32):** Platformun AI açıklaması açılır (Instagram AI etiketi, TikTok AI-generated content, YouTube AI use = Yes). Yönetmelik, insandan ayırt edilemeyen dijital karakter içeren reklamlarda bunun açıkça belirtilmesini istediği için caption'a da yazılır. Önerilen ilk satır:

   ```text
   Reklam · [Marka] iş birliği. Bu videodaki karakter yapay zekâ ile oluşturulmuştur.
   ```

Check-list'teki `commercial_disclosure`, `commercial_tool` ve `ai_disclosure` maddeleri ancak bu adımlar platform ekranında gerçekten yapıldıktan sonra işaretlenir. Panel check-list'i tamamlanmadan kart planlanamaz; `ai_disclosure` işaretli değilse yayın işi açılmaz ([`docs/compliance.md`](compliance.md) → Panelde zorunlu adım).

## Instagram'da elle yayın

Panelin Instagram yayını Instagram Login API'sini kullanır ve bu API ücretli ortaklık etiketini veremez. Bu yüzden deal'e bağlı bir içerik için Instagram yayın işi açılırsa worker işi **`manual_required` (Elle yayın gerekli)** yapar ve bir uyarı gönderir: “Ücretli ortaklık etiketi bu platformda API ile verilemiyor; uygulamadan elle yayınlayın ve postu eşleştirin.” Sponsorlu Instagram içeriği bu yüzden baştan elle yayın olarak planlanır:

1. Kartı check-list'i tamamlayıp `Planlandı` aşamasına alın. Final video ve caption panelde hazır olsun.
2. Yayın saatinde final videoyu Instagram uygulamasından yükleyin. Ses gerekiyorsa ticari kullanıma uygun sesi uygulamada ekleyin.
3. Caption'ı panelden kopyalayın. İlk kelimenin “Reklam” olduğunu kontrol edin.
4. AI etiketini açın, **Add paid partnership label** ile markayı ortak olarak ekleyin.
5. Paylaşın. Post panelin `posts` tablosuna geldiğinde içerik kartında **Yayınlanmış postu eşleştir** ile bağlayın; kart `Yayında` aşamasına geçer. Instagram veri toplayıcısı (#50) henüz tamamlanmadığı için post panele gelene kadar kart `Planlandı` aşamasında kalır. Post linkini bu sürede deal notuna yazın.
6. Yayından sonra etiketleri profilden kontrol edin: Ücretli ortaklık, AI info ve caption'daki ibare görünüyor mu?

YouTube'da panelden yayın sponsorlu içerikte de çalışır, çünkü AI ve ücretli tanıtım bayrakları API ile gönderilir. TikTok'ta her yayın zaten elle yapılır.

## Sözleşme ve fatura

- Sözleşme iskeleti: [`templates/brand-contract.md`](../templates/brand-contract.md). İlk anlaşmadan önce metni hukuk danışmanına kontrol ettirin.
- Fatura türünü (şahıs/şirket, serbest meslek makbuzu vb.) mali müşavirle belirleyin. Bu repoya vergi veya fatura bilgisi yazılmaz.
- İmzalı sözleşme ve faturalar deal dosyalarına (private `contracts` bucket) yüklenir.

## Deneme sponsorlu içerik (prova)

İlk gerçek anlaşmadan önce akış **hayali bir ürünle** baştan sona prova edilir ve sonuç yayınlanmaz:

1. Panelde “Deneme Marka (prova)” adıyla bir marka ve deal açın. Gerçek bir marka adı kullanmayın.
2. Brief'i hayali ürünle doldurun. Hayali logo ve ürün görselini kendiniz üretin.
3. Adım 4–7'yi uygulayın. Ekipten biri “marka” rolünü üstlenip onay ve revizyon verir.
4. Check-list'i doldurun. Instagram yayın adımlarını paylaşmadan, taslak olarak deneyin.
5. Deal'i `lost` (Kaybedildi) aşamasına alın. Takılan adımları bu belgeye geri yazın.

## Doğrulama

- Her sponsorlu içerik için check-list (#22, #57) ve brief maddeleri tek tek işaretlenir: teslim formatı, zorunlu/yasak ifadeler, yayın tarihi.
- Yayın sonrası 24 saat içinde: Ücretli ortaklık + “Reklam” ibaresi + AI etiketi görünüyor mu? Eksikse post düzenlenir. Düzenlenemiyorsa kaldırılır ve markaya bilgi verilir.
