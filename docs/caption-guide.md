# Caption, hashtag ve ses standardı

> **Durum:** İlk sürüm, 24 Ekim 2026 (#23). 2 haftada bir, performans karşılaştırmasından (#25) sonra revize edilir. Persona tonu `docs/persona.md`, uyum kuralları `docs/compliance.md`, AI ile caption üretimi `docs/caption-prompt.md`.

## Caption kuralları

| Kural            | Standart                                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dil              | Türkçe (persona kararı). İngilizce altyazı veriyle desteklenirse eklenir; çift dilli caption'da önce Türkçe, boş satır, sonra İngilizce.                                                                                          |
| İlk satır        | En önemli kısım. Akış ekranında kesilmeden görünmesi için kısa tutulur; hedef ≤ 80 karakter (varsayım; kesilme noktası cihaza göre değişir, yayın önizlemesinde kontrol edilir). Hashtag, link veya "reklam" dışında ön ek yok.   |
| Uzunluk          | Toplam ≤ 300 karakter (hashtag hariç). Panelin AI önerisi bu sınırı aşan caption için uyarı verir.                                                                                                                                |
| Emoji            | En fazla 2 (persona: 1–2). Emoji cümlenin yerine geçmez; sonda veya tek vurgu yerinde.                                                                                                                                            |
| Hashtag          | 3–5 alakalı hashtag, caption'ın sonunda, aşağıdaki setlerden biri. Panel 3'ten az öneride uyarır, 5'ten fazlasını keser.                                                                                                          |
| Soru / CTA       | Etkileşim için tek, doğal bir soru veya çağrı. "Beğen, takip et, kaydet" dizisi ve "yorumlara 1 yaz" gibi etkileşim yemi yok (`docs/compliance.md` → yasak davranışlar).                                                          |
| AI açıklaması    | Bio her zaman karakterin AI ile oluşturulduğunu söyler; platformun AI etiketi her paylaşımda açılır (`ai_disclosure`). Caption gerçek bir olay/kişi gibi algılanabilecek sahnede "AI ile üretilmiş kurgusal sahne" ibaresi ekler. |
| Reklam / tanıtım | Menfaat varsa caption **"Reklam"** veya **"Tanıtım"** ile başlar, platformun ücretli ortaklık aracı da açılır (`docs/compliance.md`).                                                                                             |
| Doğruluk         | Ürün denemiş gibi yazılmaz ("denedim", "kullanıyorum"); sağlık, finans, haber iddiası yok; emin olunmayan bilgi kesin gibi sunulmaz.                                                                                              |

### Yasaklı kalıplar

Bu kalıplar caption'da ve AI prompt'unda yasaklıdır: "AI her şeyi çözer", "hayatını değiştirecek", "kimse bunu bilmiyor", "%100 gerçek", "denedim ve bayıldım", "link bio'da" (bio'da link yokken), "beğen + takip et + kaydet" dizisi, "yorumlara X yaz", siyasi göndermeler, gerçek kişi/ünlü adı, rakip hesap etiketleme.

## Caption şablonları

Her şablon persona tonuna göre yazılır: günlük bir örnekle açılır, kısa ve esprili, kendine dönük mizah.

### 1. Soru soran

Yapı: `<kısa durum>. Sen olsan ne yapardın? 👇`

1. "Telefonum sabah 07.00'de 'Bugün yorgun görünüyorsun' dedi. Kamera açık bile değildi. Sen olsan ne yapardın? 👇"
2. "AI bana üç kafe önerdi, üçü de kapalıydı. Sen olsan dördüncüye güvenir miydin? ☕"
3. "Bir uygulama 'fotoğrafını daha güzel yapayım mı?' diye soruyor. Evet mi dersin, hayır mı?"

### 2. Hikâye anlatan

Yapı: 2–3 cümlelik mini hikâye, son cümlede twist.

1. "Saat 23.59'da şehirdeki bütün tabelalar aynı anda değişti. Herkes yeni yazıları okumaya çalıştı. Benimki sadece 'Şarjın %3' diyordu. 🌃"
2. "Asansörün yapay zekâsı her sabah bana hangi kata gittiğimi sordu. Bir gün sormadı. O gün yanlış kata çıktım."
3. "Müzik listemi otomatik karıştırmasını istedim. Üç gün sonra en çok dinlediğim şarkı çamaşır makinesinin bitiş sesi oldu. 🎧"

### 3. Punchline

Yapı: tek satır, esprili.

1. "Dosya adı: final_son_kesin_bu_v7."
2. "AI'ya 'kısa yaz' dedim, bana 400 kelimelik bir özür yazdı."
3. "14 açık sekme, 1 soğuk kahve, 0 bitmiş iş. ☕"

### 4. Seri

Yapı: `Bölüm n/N — <bölümün kancası>. Devamı için takip et.` Seri yalnız devamı gerçekten planlanmışsa kullanılır.

1. "Bölüm 1/5 — Şehirdeki ekranlar konuşmaya başladı. Devamı için takip et."
2. "Bölüm 2/5 — Toka neden hep mavi? Cevap ilk sahnede saklı. Devamı için takip et."
3. "Bölüm 3/3 — Final: Bütün tabelalar tek bir soru sordu. Cevabı sen seç. 👇"

## Hashtag setleri

Setler konu yerine **strateji** bakımından farklıdır ve sırayla denenir (A/B testi). Haftada her set eşit sayıda kullanılır ve her format her seti en az bir kez görür; aksi halde set etkisi format etkisinden ayrılamaz. İlk hafta dağılımı `docs/publishing-rules.md` planındadır (her set 5 kez). Kullanılan set içerik kartının **Notlar** alanına `Hashtag seti: A` biçiminde yazılır ve 5.4 tablosunda (#24) post satırına aktarılır.

Kademe (geniş/orta/dar) **varsayımdır, hacim ölçülmedi.** İlk kullanımdan önce her etiket Instagram aramada açılır; gönderi sayısı ve kontrol tarihi bu tabloya yazılır, kademe yanlışsa etiket değiştirilir. Hashtag sayfası açılmıyorsa, "gönderiler gizlendi" uyarısı veriyorsa veya ilgisiz/uygunsuz içerik doluysa etiket kullanılmaz.

| Set | Strateji            | Geniş (milyonlarca) | Orta (100K–1M)                | Dar / niş                                       | Toplam | Hacim kontrolü (tarih · gönderi sayısı) |
| --- | ------------------- | ------------------- | ----------------------------- | ----------------------------------------------- | -----: | --------------------------------------- |
| A   | Türkçe ağırlıklı    | `#yapayzeka`        | `#dijitalsanat` `#kısahikaye` | `#minaarven`                                    |      4 | _doldurulacak_                          |
| B   | İngilizce ağırlıklı | `#aiart`            | `#aivideo`                    | `#aiinfluencer` `#minaarven`                    |      4 | _doldurulacak_                          |
| C   | Karışık niş         | `#yapayzeka`        | `#aistory`                    | `#yapayzekasanatı` `#aiinfluencer` `#minaarven` |      5 | _doldurulacak_                          |

Notlar:

- `#minaarven` karakter etiketidir; karakter adı ve kullanıcı adı kesinleşince (persona açık işi) güncellenir. Etiketin başka bir kişi/markaya ait olmadığı kontrol edilir.
- Türkçe karakterli etiketlerin ASCII yazımı (`#kisahikaye`, `#yapayzekasanati`) ayrı etikettir; ikisinin hacmine bakılır, yüksek olan seçilir ve tablo güncellenir.
- İçeriğe özgü tek bir etiket (ör. `#istanbul`) setteki orta kademe etiketlerden birinin yerine geçebilir; toplam 5'i aşmaz ve not edilir. Bu değişiklik A/B karşılaştırmasında ayrıca işaretlenir.
- Alakasız popüler etiket (`#keşfet`, `#explore`, `#fyp`, `#viral` vb.) kullanılmaz.

## Ses ve müzik kuralları

Ses lisansı hesap türüne, kullanım amacına (organik / sponsorlu) ve platforma göre değişir. Bir platformda lisanslı olan ses başka platformda lisanslı değildir; cross-post öncesi yeniden kontrol edilir.

| Durum                                 | Kural                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trend ses (organik)                   | Reels'te yükselen ses (ok ikonu) varsa ve video ritmine uyuyorsa uygulamanın içinden eklenir. Şarkı indirilip düzenleme programında videoya gömülmez. Paylaşım uygulamadan **manuel** yapılır; panel ve planlayıcılar trend sesi ekleyemez (`docs/publishing-rules.md`). |
| Sponsorlu / ticari içerik             | Trend kütüphanesi kullanılmaz. Yalnız ticari kullanıma açık kaynaklar: Instagram/Facebook için Meta Sound Collection, TikTok için Commercial Music Library, YouTube için YouTube Audio Library / Shorts Audio Library, ya da ticari lisansı belgelenmiş müzik.           |
| Orijinal ses (kısa film, seslendirme) | Karakterin AI sesi gerçek bir kişiyi taklit etmez (`docs/compliance.md`). Ses üreten aracın ticari kullanım şartı kontrol edilir ve kaydedilir.                                                                                                                          |
| AI ile üretilmiş müzik                | Aracın lisansı ticari kullanıma ve sosyal medya yayınına izin veriyorsa kullanılır; lisans ekran görüntüsü/sürümü kaynak notuna yazılır. Tanınmış bir sanatçının tarzını veya sesini taklit etmesi istenmez.                                                             |
| Kayıt                                 | Her içerikte ses kaynağı (kütüphane adı, parça adı, lisans türü, kontrol tarihi) kaynak/lisans notuna yazılır ve `commercial_rights` maddesi ancak bundan sonra işaretlenir. Sesi sonradan susturulan videonun yedek, lisanslı sesli kopyası saklanır.                   |

Resmî kaynaklar (24 Ekim 2026'da erişildi; şartlar değişebilir, her kampanyada yeniden kontrol edilir):

- [Instagram Yardım — müzik kütüphanesi ve Sound Collection](https://help.instagram.com/402084904469945): lisanslı müzik kütüphanesi kişisel, ticari olmayan kullanım içindir; bazı işletme hesaplarında erişim kısıtlıdır ve bu hesaplar Meta Sound Collection'ı kullanabilir.
- [TikTok for Business — Commercial Music Library](https://ads.tiktok.com/business/en/blog/audio-library-royalty-free-music): işletmeler için önceden temizlenmiş ses kütüphanesi; işletme tanıtımında genel müzik kütüphanesini kullanmak telif riski taşır.
- [YouTube Yardım — Shorts için müzik uygunluğu](https://support.google.com/youtube/answer/13486873): telif hak talebinden kaçınmak için Shorts Audio Library'deki müzik kullanılır.

## Ölçüm

- Her paylaşımda caption şablonu (soru / hikâye / punchline / seri) ve hashtag seti içerik kartının notlarına yazılır.
- 2 hafta sonra (#25) şablon ve set bazında ortalama erişim, yorum ve paylaşım karşılaştırılır. Hesap küçükken farklar rastlantısal olabilir; her grupta en az 5 paylaşım olmadan sonuç çıkarılmaz.
- Panelde hashtag setinin post kaydında ayrı alan olarak tutulması segment analizi (#55) işidir; o zamana kadar not alanı kullanılır.
