# Marka brief şablonu

Sponsorlu içerik akışının ilk adımıdır (#30, akış: [`docs/sponsored-workflow.md`](../docs/sponsored-workflow.md)). Panelde deal detayındaki **Brief** formu bu şablonun alanlarını kullanır. Alan anahtarları `brand_deals.brief` jsonb'sindeki anahtarlarla aynıdır (`apps/panel/src/lib/brands/schemas.ts` → `briefFields`). Şablonu markaya gönderin veya görüşmede birlikte doldurun, yanıtları panele aynı başlıklarla girin.

> Bu dosya public repodadır. Gerçek marka adı, kişi, fiyat veya sözleşme bilgisi buraya yazılmaz. Doldurulmuş brief panelde (deal detayı) veya deal dosyalarında (private `contracts` bucket) tutulur.

## Deal kaydındaki alanlar (brief dışında)

Bu bilgiler brief formunda değil, deal'in kendi alanlarındadır:

| Bilgi                     | Panel alanı                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| Marka, iletişim kişisi    | `brands` (marka kaydı)                                                        |
| Karakter                  | `brand_deals.influencer_id`                                                   |
| Ücret ve para birimi      | `brand_deals.fee`, `currency`                                                 |
| Teslim son tarihi         | `brand_deals.due_date`                                                        |
| Teslimat listesi          | `brand_deals.deliverables` (madde + tamamlandı)                               |
| Sözleşme, ürün görselleri | Deal dosyaları (`brand_deal_files`)                                           |
| Aşama                     | `brand_deals.stage` (Lead → Görüşme → Anlaşma → Teslim → Ödendi / Kaybedildi) |

## Brief alanları

### `product` — Ürün / hizmet

- Ürün/hizmet adı, kategorisi, ürün sayfası bağlantısı:
- Gösterilecek ürün özellikleri (yalnızca markanın doğrulanmış bilgileri):
- Ürün fotoğrafları / logo dosyaları (yüksek çözünürlük, şeffaf arka plan tercih) deal dosyalarına yüklendi mi? Evet / Hayır

### `goal` — Kampanya hedefi

- Bilinirlik / satış / indirme / diğer:
- Başarı ölçütü (ör. erişim, link tıklaması, indirim kodu kullanımı):

### `keyMessage` — Ana mesaj

- İzleyicinin aklında kalması gereken tek cümle:

### `mustSay` — Söylenmesi zorunlu ifadeler

- Ürün adı yazımı, slogan, indirim kodu, link, hashtag:
- Not: Her sponsorlu içerikte “Reklam” ibaresi ve AI karakter açıklaması bizim tarafımızdan zorunlu olarak eklenir; marka bunları kaldırmayı isteyemez ([`docs/compliance.md`](../docs/compliance.md)).

### `mustNotSay` — Yasak ifadeler

- Rakip markalar, kullanılmaması gereken iddialar, hassas konular:
- Bizim kırmızı çizgilerimiz (markaya bildirilir): karakterin ürünü bizzat kullandığı izlenimi, kanıtsız sağlık/finans iddiası, abartılı sonuç gösterimi (ör. kozmetikte), gerçek kişi benzerliği.

### `format` — Teslim formatı

- Format: Reels / Story / carousel / Shorts / TikTok:
- Adet:
- Süre (sn):
- En-boy oranı (varsayılan 9:16):
- Platform(lar) ve hesap:

### `schedule` — Yayın tarihi, saat aralığı ve kalıcılık

- Yayın tarihi ve saat aralığı:
- Kalıcılık süresi (video ne kadar yayında kalacak; ör. en az 30 gün / süresiz):
- Story ise kaç kare, hangi gün:

### `revisions` — Revizyon hakkı ve onay süresi

- Konsept aşamasında: 2 seçenekten 1'i seçilir
- Taslak video revizyon turu (ör. 2 tur):
- Markanın onay/geri bildirim süresi (ör. 2 iş günü). Süre içinde dönüş olmazsa ne olur?:
- Onay verecek tek yetkili (rol):

### `usageRights` — Kullanım hakları

- Marka videoyu kendi hesabında paylaşabilir mi? Evet / Hayır
- Reklamda (boost, branded content ad, ücretli reklam) kullanabilir mi? Evet / Hayır
- Süre ve bölge (ör. 3 ay, Türkiye):
- Düzenleme hakkı (kesme, yeniden kurgulama) var mı?
- Not: Reklam kullanımında sesin lisansı da bu kullanımı kapsamalı ([`docs/compliance.md`](../docs/compliance.md) → Müzik ve ses).

### `payment` — Ödeme vadesi ve fatura bilgileri

- Ödeme vadesi (ör. yayından sonra 30 gün) ve peşinat:
- Fatura türü (mali müşavirle belirlenir) ve fatura bilgilerinin nerede olduğu (kısıtlı depo referansı):
- Ücret deal kaydında (`fee`, `currency`) tutulur, buraya yazılmaz.

### `reporting` — Raporlama

- Hangi metrikler (görüntülenme, erişim, beğeni, yorum, paylaşım, kaydetme, link tıklaması):
- Ne zaman (varsayılan: yayından 24 saat ve 7 gün sonra):
- Format (varsayılan: [`templates/brand-report.md`](brand-report.md) + ekran görüntüsü):

## Panel dışı ek bilgiler (deal notlarına)

Brief formunda ayrı alanı olmayan ama sorulması gereken konular. Yanıtları deal'in **notlar** alanına yazın:

- Marka, karakterin AI ile oluşturulmuş kurgusal bir karakter olduğunu ve her paylaşımda AI etiketi kullanılacağını kabul ediyor mu? (Zorunlu: Evet)
- Marka Instagram'da ücretli ortaklık etiketinde ortak olarak eklenecek hesap:
- Ses/müzik tercihi: marka kendi lisanslı müziğini mi sağlayacak, platformun ticari kütüphanesi mi kullanılacak?
- Ürün gönderimi gerekiyor mu (yalnızca referans çekimi için)?
