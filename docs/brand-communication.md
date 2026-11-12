# Yorum, DM ve marka iletişim rutini

#29 için operasyon rehberi. Gerçek yazışmalar, kişi bilgileri ve ticari teklifler public repoya girmez. Bu belge bir haftalık gerçek uygulamanın tamamlandığı anlamına gelmez; #28 medya kiti ve #34 hesap güvenliği kabulü ayrıca gereklidir.

## Kayıt yerini hazırlama

[`templates/deals.csv`](../templates/deals.csv) yalnız başlık içeren boş şablondur. Ekip erişimiyle sınırlı bir Sheets dosyasında `deals` sekmesine içe aktarın; gerçek satırları bu repoya kaydetmeyin. Panel CRM'i kullanılıyorsa aynı fırsat için ikinci kayıt açmayın; tabloda `crm_kaydi` alanına özel deal bağlantısını yazın. Bu CSV panel içe aktarma formatı değildir.

- Her teklife tek `id`, bir sorumlu ve bir sonraki adım atayın. Aynı kampanya farklı kanallardan gelirse ilk alınma zamanını koruyarak birleştirin.
- `alinma_zamani`, `ilk_yanit_zamani`, `sonraki_adim_zamani`: saat dilimi içeren ISO 8601 metni kullanın (ör. `2026-10-26T12:00:00+03:00`). Alınma zamanı, ekibin mesajı gördüğü zaman değildir.
- `kanal`: `DM`, `e-posta` veya `yorum`. `durum`: `yeni`, `yanıtlandı`, `görüşme`, `anlaşma`, `ret`, `sahte`. `dogrulama_durumu`: `bekliyor`, `doğrulandı`, `şüpheli`. Şüphe tek başına sahte olduğunun kanıtı değildir.
- Bütçe bilinmiyorsa boş bırakın; sıfır yazmayın. `butce` sayısal değer, `para_birimi` ayrı alan olsun.
- `dogrulama_notu` yalnız sonuç ve tarihi içerir; parola, kod, kimlik belgesi veya şüpheli ek içermez. Mesaj metnini kopyalamak yerine kısa teklif özeti yazın. Dışarıdan gelen metni Sheets'e **düz metin** olarak yapıştırın; formül çalıştırmayın.
- Panel aşamaları ile takip durumlarını karıştırmayın: `yeni`/`yanıtlandı` → `lead`, `görüşme` → `negotiation`, `anlaşma` → yalnız imza sonrası `signed`, `ret`/kanıtlanmış `sahte` → `lost`. Şüpheli teklif doğrulanana kadar üretime geçmez. `delivered` ve `paid` sponsorlu akışta ilerler.

## Günlük kontrol

Sorumlu ve yedeği haftalık olarak belirlenir. Her gün 12:00 ve 21:00 (Europe/Istanbul), 15'er dakika:

1. DM gelen kutusu, istekler klasörü, iş birliği e-postası ve son üç videonun yorumlarını okuyun. DM erişimi API'de yoksa uygulamadan elle kontrol edin.
2. Yeni teklifi hemen kaydedin; en geç alınmasından 24 saat sonra kayıt ve ilk insan yanıtı tamamlanmış olmalı. Sonraki kontrol 24 saat sınırını aşacaksa yedeğe devredin.
3. Önce [`scam-signals.md`](scam-signals.md) doğrulamasını uygulayın. Şüpheli mesajlara yanıt vermeyin, link/ek açmayın. Şüpheli mesajı değerlendirme ve raporlama ayrı izlenir; yanıt süresi hedefi güvenlik kontrolünü geçersiz kılmaz.
4. Doğrulanmış teklif için [`brand-replies.md`](../templates/brand-replies.md) içindeki uygun şablonu elle düzenleyin. İlk temas, fiyat, ret, takip ve ücretsiz ürün için beş şablon hazırdır. Ürün karşılığı iş birliği kabul edilmez. Medya kiti hazır değilse “ekte paylaşıyoruz” cümlesini çıkarıp kitin hazırlanmakta olduğunu belirtin; olmayan dosyayı göndermiş gibi yazmayın. Fiyat ve teslim süresi ekip onayından alınır.
5. İnsan onayından sonra yanıtı gönderin; `ilk_yanit_zamani` alanına gerçek gönderim zamanını yazın. Taslak veya otomatik alındı yanıtı sayılmaz. Sonraki adımı ve tarihini kaydedin.

Yayın sonrası ilk saatte, sorumlu kişi gelen sorulara persona tonunda dürüst yanıt verir; yararlı bir yorum varsa elle sabitler. AI karakter gerçek kişi gibi sunulmaz. Otomatik/toplu yorum, beğeni, takip veya DM yapılmaz. Yanıtlanamayan sorular sonraki kontrolde ele alınır.

## Haftalık ve aylık kontrol

Her pazar tüm kanallar ile tablo/CRM karşılaştırılır; tabloda görünmeyen teklifler eklenir. Yanıtsız, 24 saati aşmış veya sonraki adımı gecikmiş her kayıt için sorumlu ve düzeltici adım yazılır. Doğrulanmış tekliflerde 3–5 gün yanıt yoksa tek bir takip mesajı değerlendirilir; ret veya iletişim istememe durumunda gönderilmez.

Özel haftalık kayıtta dönem, kanallar, toplam teklif, şüpheli teklif, zamanında kayıt+yanıt sayısı ve gecikme gerekçeleri tutulur. 24 saat hesabı takvim saatidir. Şüpheli mesajları normal yanıt oranından çıkarın ama adetlerini ve işlem sürelerini ayrıca gösterin. Gelen teklif yoksa “0 teklif — yanıt süresi ölçülemedi” yazın; yüzde 100 başarı yazmayın. #29 kapanışı için gerçek haftalık kayıt gerekir.

Aylık rapor: gelen doğrulanmış teklif sayısı, ilk yanıt süresi ortalaması (saat), henüz yanıtlanmayan adet ve aynı dönemde alınan teklifler içinden anlaşmaya dönüşenlerin oranı. Oranın paydası sıfırsa “ölçülemedi” yazın. Gerçek kişi, marka ve yazışma kanıtları özel alanda kalır.

Anlaşmaya geçen fırsat [`sponsored-workflow.md`](sponsored-workflow.md) ile ilerler. Hesap olayı varsa [`account-health.md`](account-health.md) ve [`incidents.md`](incidents.md) izlenir.
