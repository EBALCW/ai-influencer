# Panel v1 kapsamı: modüler üretim paneli

> Karar tarihi: 15 Kasım 2026. Bu belge v1 için tek kapsam kaynağıdır; issue'lar buna göre açıldı (milestone: "Panel v1: modüler üretim paneli"). Kapsam değişirse önce bu belge güncellenir.

## İlkeler

1. **Tek panel, tek giriş.** Kullanıcı giriş yapınca bütün modülleri kullanır ve daha önce ürettiklerini görür.
2. **Modüller bağımsızdır.** Her modül yalnız kendi ihtiyacı olan alanları ister. Karakter ve referans görsel yalnız AI influencer modülünde zorunludur.
3. **Seri isteğe bağlıdır.** Anlatım videosu bir serinin bölümü (Bölüm 1, 2, 3…) ya da tekil olabilir.
4. **Her şey Supabase'de, çalışma alanına özel.** Geçmiş, taslaklar, ayarlar, kararlar.
5. **Sağlayıcılar değiştirilebilir.** Görsel, ses, metin ve yayın için ayrı ayrı; bir sağlayıcı yerine başkası takılabilir.
6. **Panel karar vermeye yardım eder.** Kullanıcının bağladığı yapay zekâ konu, senaryo, başlık ve açıklama önerir; araştırma ve üretim adımlarını yöneten orkestratör odur.
7. **Onaysız yayın yoktur.** Senaryo, video ve paylaşım ayrı ayrı onaylanır.

## Modüller

| Modül             | Durum                    | Girdi                         | Çıktı                                |
| ----------------- | ------------------------ | ----------------------------- | ------------------------------------ |
| Anlatım videoları | v1 önceliği              | Kısa istek ya da konu         | Seslendirmeli, altyazılı dikey video |
| Yayıncı klipleri  | v1 önceliği              | Video adresi + hak durumu     | Seçilebilir dikey klipler            |
| AI influencer     | Park (altyapısı duruyor) | Karakter + referans + senaryo | Karakterli içerik                    |
| Ortak çekirdek    | v1                       |                               | İş takibi, geçmiş, sağlayıcılar, AI  |
| Üretim makinesi   | v1                       | Kuyruktaki iş                 | Render edilmiş dosya                 |
| Yayın ve hesaplar | v1                       | Onaylı video                  | Paylaşım ya da dışa aktarma paketi   |

## Kapsamdaki özellikler

### Ortak çekirdek

- Modül seçimi olan ana ekran; her modülün kendi iş akışı.
- Üretim işi: sırada, üretiliyor, onay bekliyor, hazır, hata; aşama ve yüzde; hatanın aşaması.
- Üretim geçmişi ve arşiv; arama; "bu konuyu daha önce yaptık mı" kontrolü.
- Sağlayıcı ayarları: hangi iş için hangi sağlayıcı; anahtarlar güvenli saklanır.
- Panel içi yapay zekâ yardımcısı ve orkestratör; sağlayıcıdan bağımsız.
- İnceleme ve onay ekranları; senaryo ve video sürümleri, geri dönüş.
- Başlık, açıklama ve etiket önerisi (platforma göre); AI etiketi ve kaynak künyesi otomatik.
- Varlık kütüphanesi: figürler, sahne kalıpları, sesler, fontlar, arka plan görüntüleri (lisans kaydıyla).
- Karar kaydı (seçilen, elenen, yayınlanan) ve performans geri bildirimi.
- Maliyet takibi ve bütçe tavanı (ücretli sağlayıcılar için).
- Çok dil altyapısı: v1 Türkçe; aynı videonun başka dilde yeniden üretimi yapıya baştan konur.
- Ekip ve roller (mevcut): taslak hazırlayan, onaylayan.

### Anlatım videoları

- Kısa istek → konu önerileri → her biri için özet → seçim.
- Senaryo taslağı, kaynak notları, doğruluk kapısı (iddia başına iki kaynak), düzenleme ve onay.
- Seri: ad, tema, görsel stil, ses, altyazı stili, bölüm numarası. Tekil video da üretilebilir.
- Görsel yollar: Skia 2D çizim, HyperFrames stil paketi, Blender 3D kesit, stok görüntülü, arka plan görüntülü meme formatı (ör. oyun görüntüsü üstünde içerik).
- Aynı senaryodan birkaç görsel sürüm; seri şablonları.

### Yayıncı klipleri

- Adres ver → adaylar önizleme, kalite raporu ve "tek başına anlaşılıyor mu" değerlendirmesiyle gelir.
- Aday seç ve ele; başlangıç ve bitişi kaydır; Türkçe altyazı; üst bağlam yazısı.
- Hak durumu kaydı girilmeden kesim yapılmaz (mevcut kural).
- Kelime kelime altyazı; yüze göre kadraj; Twitch ve Kick; kanal takibi.

### Üretim makinesi

- Kullanıcının kendi bilgisayarında çalışan program: kuyruktan iş çeker, üretir, sonucu yükler. **macOS ve Windows** desteklenir. v1'de kiralık makine yok.
- Kurulum ve yetenek denetimi: makine hangi yolları üretebiliyor (Blender, HyperFrames, ffmpeg, konuşma tanıma).
- Panelde makine durumu ve iş sırası. Makine kapalıyken işler bekler.

### Yayın ve hesaplar

- Panelden sosyal hesap girişi: YouTube, Instagram, TikTok.
- Otomatik ve zamanlanmış paylaşım; modüller arası tek takvim.
- Dışa aktarma paketi (video + başlık + açıklama + etiketler): otomatik paylaşım mümkün olmadığında elle paylaşım için. Platform onayı gecikirse v1 bu yolla çıkar.
- Hangi modül ya da seri hangi sosyal hesaptan çıkacak: eşleme.

## Sınırlar

- Render sunucuda çalışmaz; açık bir üretim makinesi gerekir.
- Viral olma garanti edilmez; yalnız olasılığı artıran kontroller vardır. Kendi modelimizi eğitmek için önce karar ve performans verisi birikmelidir.
- Başkasının videosu hak sahibinin yazılı izni olmadan kesilmez ve yayınlanmaz ([compliance.md](compliance.md)).
- Arka plan ve stok görüntüleri yalnız lisansı uygun kaynaklardan alınır; oyun görüntüsü için kendi kaydımız ya da açık lisanslı kayıt kullanılır.
- Otomatik paylaşım platformların geliştirici onayına bağlıdır (TikTok'ta denetimden geçmemiş uygulama yalnız gizli paylaşım yapabilir).
- Trend sesler panelden eklenemez; uygulamanın içinden eklenir.
- Ücretli sağlayıcılar kullanıcının kendi anahtarıyla çalışır.

## Sıra

1. **Temel:** mimari kararı, iş modeli, üretim makinesi iskeleti (macOS + Windows), ana ekran.
2. **Anlatım modülü uçtan uca:** istek → öneri → senaryo onayı → ses ve altyazı → ilk görsel yol → inceleme → dışa aktarma.
3. **Klip modülü uçtan uca:** adres → adaylar ve kalite raporu → seçim → kesim → dışa aktarma.
4. **Yayın:** hesap girişi, otomatik ve zamanlanmış paylaşım, takvim.
5. **Genişletme:** kalan görsel yollar, stok ve meme formatı, kelime kelime altyazı, yüz kadrajı, performans geri bildirimi, maliyet, çok dil.
6. **AI influencer modülü:** persona, hesaplar ve ücretli üretici hazır olduğunda parktan çıkar.
