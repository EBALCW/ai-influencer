# Monetizasyon: eşik, profil, hizmetler ve fiyat aralıkları

> **Son kontrol:** 27 Ekim 2026 · **Issue:** #28 (6.2) · **Bağımlılıklar:** #24 (metrikler), #7 (profil), #32 (AI açıklama politikası)
>
> Bu belge marka iş birliğine hazırlık için karar ve kontrol listesidir. Fiyatlar **tahmindir**, teklif değildir. Gerçek takipçi ve performans rakamları yalnız Insights/panel ölçümlerinden gelir; bu belgeye ya da medya kitine elle sayı yazılmaz.
>
> İlgili belgeler: hedef marka listesi ve rakip iş birlikleri [`docs/target-brands.md`](target-brands.md), sponsorlu içerik akışı [`docs/sponsored-workflow.md`](sponsored-workflow.md), AI ve reklam açıklaması [`docs/compliance.md`](compliance.md), marka yazışmaları [`docs/brand-communication.md`](brand-communication.md) ve [`templates/brand-replies.md`](../templates/brand-replies.md).

## 1. Monetizasyon eşiği

### Öneri

| Aşama               | Koşul                                                                                                                                                                                                                                                                                  | Ne yapılır                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hazırlık**        | Instagram'da **5.000** takipçi                                                                                                                                                                                                                                                         | Profil güncellemesi (bölüm 2), medya kiti panelden ilk kez üretilir ve ekip dışı 1 kişiye okutulur. **Aktif outreach yok.** Gelen talepler şablonla yanıtlanır. |
| **Eşik (outreach)** | Aşağıdakilerden **biri**, ek koşullarla birlikte: **(A)** Instagram'da **≥ 10.000** takipçi **ve** son 30 günde video başına izlenmeye göre ağırlıklı etkileşim oranı **≥ %3** · **(B)** son 30 günde en az 8 videoda video başına ortalama **≥ 50.000** izlenme (takipçiden bağımsız) | Hedef marka listesindeki (`docs/target-brands.md`) 4–5 puanlı markalara ilk temas. Medya kiti ayda bir yenilenir.                                               |
| **Ek koşullar**     | Son 30 günde hesap sağlığı temiz ([`account-health.md`](account-health.md): ihlal, kısıtlama, telif ihtarı yok) · yayınlanan içeriklerin %100'ünde AI etiketi · son 30 günde en az 8 yayın                                                                                             | Biri bozulursa outreach durur, önce sorun çözülür.                                                                                                              |

Eşik ölçümleri panelden okunur: takipçi `account_snapshots`, izlenme ve etkileşim `metric_snapshots` (medya kiti `/brands/media-kit` aynı hesabı yapar, #24 takip tablosuyla karşılaştırılır).

### Gerekçe

- **10.000 takipçi piyasanın ortak kademe sınırı.** İncelenen fiyat rehberlerinin hepsi nano (1–10 B) ve mikro (10–100 B) ayrımını 10 B'de yapıyor ([Awisee](https://awisee.com/blog/instagram-reels-pricing/), [Later](https://later.com/blog/influencer-pricing-benchmarks-the-complete-2026-guide/), [Kolsquare](https://kolsquare.com/en/blog/prices-influencers)). Markaların ve ajansların arama filtreleri de genelde bu sınırdan başlar. 10 B'nin altında ücretli teklif almak mümkün ama pazarlık gücü düşük ve ret olasılığı yüksek; issue'daki “erken pazarlama, küçük hesapla ret” riskini bu eşik karşılar.
- **Takipçi tek başına yetmez.** Later'ın 2026 rehberi etkileşim oranı, kullanım hakkı ve münhasırlığın fiyatı takipçi sayısından daha çok etkilediğini söylüyor. %3, mikro hesaplar için bildirilen Instagram ortalamasının biraz üstü ([Bravery Technology'nin Türkiye derlemesi](https://braverytechnology.com/tr/influencer-pazarlama-istatistikleri/) mikro hesaplarda ~%2,8 veriyor; metodoloji açıklanmamış, yön gösterici).
- **(B) yolu Reels gerçeği için.** Kısa videoda takipçi dışı erişim büyük; 50 B ortalama izlenme, takipçisi az ama içeriği yayılan bir hesabın da markaya somut erişim sunabildiğini gösterir. 8 video koşulu tek bir viral videonun ortalamayı şişirmesini önler.
- **AI karakter için güven eşiği daha önemli.** AI influencer'lara yönelik olumsuz tutumların başında “gerçek dışılık” ve “reklam unsuru olma” geliyor ([“Sanal Etkileyicilerin Yükselişi: Tüketici Tutumları Üzerine Keşfedici Bir Araştırma”](https://acikerisim.alanya.edu.tr/items/9b260fa3-71ea-4c23-8f4b-60e7d25f189b)). Sağlıklı etkileşim ve temiz hesap geçmişi markaya sunulacak ilk kanıttır.
- **Instagram'ın kendi monetizasyon araçları** (abonelik vb.) için üçüncü taraf kaynaklar 10.000 takipçi şartı bildiriyor ([Metricool](https://metricool.com/how-to-monetize-instagram/)). Resmî şart hesaba göre değişebilir; güncel durum Professional Dashboard → Monetizasyon ekranından okunur. Ücretli ortaklık (branded content) etiketi için yayımlanmış bir takipçi alt sınırı bulunamadı ([Instagram Yardım](https://help.instagram.com/ipad-app/1123581461537025)).

### İstisna: AI araç programları

Karakteri ürettiğimiz AI araçlarının creator/affiliate programları takipçi eşiği aramıyor (ör. Higgsfield Earn ve Creator Partnership başvuruları takipçi sayısına göre elenmiyor, bkz. `target-brands.md`). Bu programlara **hazırlık aşamasında** başvurulabilir. Koşul: affiliate linkli veya ücretsiz kredi karşılığı her paylaşım da reklamdır, “Reklam” ibaresi ve AI etiketi kuralları aynen uygulanır ([`compliance.md`](compliance.md) → Türkiye).

## 2. Profil güncellemesi (eşik öncesi, 5 B'de)

Hesap açılışındaki profil kuralları (#7) ve AI açıklaması ([`compliance.md`](compliance.md) → Yayın öncesi temel kural) geçerli kalır; aşağıdakiler eklenir. Gerçek e-posta adresi bu repoya yazılmaz.

- [ ] **Bio'ya iş birliği satırı:** `📩 Collab: <iş birliği e-postası>`. AI açıklama satırı bio'da kalır ve iş birliği satırından önce gelir. Örnek düzen (150 karakter sınırı):
  ```text
  AI ile oluşturulmuş kurgusal karakter 🤖
  Teknoloji, şehir ve küçük hikâyeler · İstanbul
  📩 Collab: <iş birliği e-postası>
  ```
- [ ] **Instagram iletişim butonu:** Profesyonel hesap (Creator) → Profili düzenle → İletişim seçenekleri → **E-posta**. Adres bio'dakiyle aynı olmalı. Telefon eklenmez. Menü adları uygulama sürümüne göre değişebilir; ekranda doğrulanır.
- [ ] **“AI-generated profile” anahtarı** açık ([`compliance.md`](compliance.md)). Profil düzenlemesinden sonra tekrar kontrol edilir.
- [ ] **Öne çıkan hikâye: “Collab / Brands”.** İçerik: (1) “Marka iş birlikleri için e-posta” karesi, (2) varsa yayınlanmış iş birliklerinden kareler (her karede “Reklam” ibaresi ve AI notu korunur), (3) “Bu karakter yapay zekâ ile oluşturulmuştur; reklamlarda Reklam ibaresi kullanılır” karesi. Henüz iş birliği yoksa örnek iş **uydurulmaz**; yalnız (1) ve (3) konur.
- [ ] **Panel ayarı:** Sunucu ortamında `MEDIA_KIT_CONTACT_EMAIL` tanımlanır (`.env.example`). Medya kiti PDF'inin “İletişim” bölümü bu değeri yazar; tanımlı değilse “veri yok” görünür.
- [ ] Değişiklik sonrası profilin ekran görüntüsü kısıtlı ekip deposuna konur (repoya değil).

## 3. Medya kiti

Kit panelden üretilir: önizleme `/brands/media-kit?inf=<slug>`, PDF `GET /api/media-kit/<slug>` (#60). Elle Canva/PDF hazırlanmaz; rakamlar her indirmede son 30 günün ölçümlerinden hesaplanır, ayda bir indirilip gönderilecek sürüm kontrol edilir.

| Issue maddesi                                               | Kitteki karşılığı                                                                              | Durum                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Karakter tanıtımı (kim, hikâye, ton)                        | Ad, niş ve güncel persona bio'su                                                               | Var. 3 temsilî görsel PDF'te yok (aşağıda açık iş)          |
| Kitle: takipçi, platform dağılımı                           | Toplam ve hesap bazında takipçi, 30 günlük değişim                                             | Var                                                         |
| Kitle: yaş/cinsiyet/ülke                                    | “veri yok”                                                                                     | Şemada yok, #50/#51 toplayıcılarını bekliyor; elle yazılmaz |
| Performans: 30 gün ort. izlenme, etkileşim, en iyi 3 içerik | Ortalama izlenme, etkileşim oranı, izlenme süresi, en iyi 3 içerik ve linkleri                 | Var                                                         |
| Hizmetler                                                   | Sponsorlu Reels, ürün yerleştirme, seri içerik (3 video), hikâye paylaşımı                     | Bu PR ile eklendi                                           |
| Fiyat aralıkları                                            | Takipçi kademesine göre aralık (bölüm 4), “tahmin” notu ile                                    | Bu PR ile eklendi                                           |
| AI notu ve etiketleme politikası (#32)                      | `AI_DISCLOSURE` metni: kurgusal AI karakter, platform AI etiketi, sponsorluda “Reklam” ibaresi | Var                                                         |
| İletişim                                                    | `MEDIA_KIT_CONTACT_EMAIL`                                                                      | Bu PR ile eklendi                                           |

Açık işler (kod dışı): 3 temsilî görselin seçimi (PDF'e görsel ekleme ayrı bir iş, asset seçimi ekip kararı), kitin ekip dışı 1 kişiye okutulup geri bildirim alınması, rakamların #24 takip tablosuyla karşılaştırılması.

## 4. Fiyat aralıkları

### Araştırma yöntemi

1. **Kaynak türleri:** (a) yayımlanmış fiyat rehberleri ve platform raporları, (b) Türkiye'ye özgü ajans/araştırma verisi, (c) AI influencer'lar için basında geçen ücretler. Her kaynak için yayın/güncelleme tarihi ve okunma tarihi yazılır.
2. **Normalize etme:** Fiyatlar tek bir teslimat birimine indirgenir: **1 sponsorlu Reels, organik yayın, 30 gün kullanım hakkı yok, münhasırlık yok, 2 revizyon**. Kullanım hakkı ve münhasırlık ayrıca fiyatlanır ([quasa.io](https://quasa.io/tr/media/influencer-ucretinde-takipci-sayisi-yetmez-kullanim-hakki-faturayi-degistirir)).
3. **Düzeltmeler:** ABD ağırlıklı rehberlerden aşağı doğru düzeltme yapılır, çünkü (a) Türkiye pazarı ve TL bütçeler, (b) yeni ve geçmiş iş birliği olmayan hesap, (c) AI karakterlere karşı güven açığı. Kademe içinde rehberlerin **alt yarısı** seçilir.
4. **Benzer hesap kontrolü:** Eşiğe gelindiğinde aynı takipçi aralığındaki 5 Türk hesabın (insan veya AI) halka açık fiyat kartı veya ajans teklifi, bulunabildiği kadarıyla, kısıtlı depodaki tabloya eklenir. Gerçek teklifler ve marka adları public repoya yazılmaz.
5. **Güncelleme:** Üç ayda bir ve ilk 3 gerçek teklif/anlaşmadan sonra. Gerçek kapanış fiyatları rehberlerden önce gelir.

### Piyasa verisi (27 Ekim 2026'da okundu)

| Kaynak                                                                                                                                        | Tarih       | Kapsam              | Nano (1–10 B) | Mikro (10–100 B)                     | Makro (100 B–1 M)                | Not                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------- | ------------- | ------------------------------------ | -------------------------------- | ------------------------------------------------------------- |
| [Awisee — Instagram Reels pricing](https://awisee.com/blog/instagram-reels-pricing/)                                                          | 30 Ara 2025 | Reels başına        | $50–200       | $200–1.000                           | $1.000–3.000                     | Solowise ve Shorts Generator AI verisine dayandırılmış        |
| [Later — Influencer pricing benchmarks 2026](https://later.com/blog/influencer-pricing-benchmarks-the-complete-2026-guide/)                   | 7 Tem 2026  | Reels/TikTok başına | $200–500      | $800–2.500                           | $2.500–10.000+                   | Reels feed'den %20–30 pahalı, hikâye ~%50 ucuz; ABD ağırlıklı |
| [Kolsquare — Influencer prices](https://kolsquare.com/en/blog/prices-influencers)                                                             | 25 Kas 2024 | Instagram post      | £50–200       | £200–1.000                           | £1.000–10.000                    | Sayfanın farklı bölümlerinde çelişen aralıklar var            |
| [quasa.io — ANRED Konya araştırması](https://quasa.io/tr/media/influencer-ucretinde-takipci-sayisi-yetmez-kullanim-hakki-faturayi-degistirir) | 11 Eyl 2026 | Mikro iş birliği    | —             | 10.000–20.000 TL (en sık 15–20 B TL) | —                                | Yalnız 3 ajans yanıtı, yerel ve bağlayıcı değil               |
| [Euronews — Aitana López](https://www.euronews.com/next/2024/03/22/meet-the-first-spanish-ai-model-earning-up-to-10000-per-month)             | 22 Mar 2024 | AI influencer       | —             | —                                    | “€1.000'in biraz üzeri / reklam” | ~343 B takipçide; ajansın beyanı, doğrulanmamış               |

Türkiye geneli için güvenilir, Reels'e özgü bir TL fiyat listesi bulunamadı. Statista Türkiye influencer reklam harcamasını 2025 için 61,7 milyon $ öngörüyor ([Statista](https://statista.com/outlook/amo/advertising/influencer-advertising/turkey)); bu pazar büyüklüğüdür, fiyat değildir.

### Başlangıç aralığı (tahmin)

Kodda `apps/panel/src/lib/media-kit/build.ts` → `MEDIA_KIT_PRICE_TIERS` ve `MEDIA_KIT_SERVICES`. Medya kiti yalnız hesabın güncel kademesini gösterir. Para birimi USD; TL teklifte günün kuru kullanılır. 10–50 B kademesi, günün kuruyla çevrildiğinde ANRED'in 10–20 B TL mikro aralığıyla kabaca örtüşmeli; örtüşmüyorsa aralık gözden geçirilir.

| Toplam takipçi | Sponsorlu Reels | Ürün yerleştirme (×0,6–0,8) | Seri içerik, 3 video (×2,4–2,7) | Hikâye paylaşımı (×0,3–0,4) |
| -------------- | --------------- | --------------------------- | ------------------------------- | --------------------------- |
| 0–10 B         | $50–150         | $30–120                     | $120–410                        | $15–60                      |
| 10–50 B        | $150–500        | $90–400                     | $360–1.350                      | $45–200                     |
| 50–100 B       | $500–1.000      | $300–800                    | $1.200–2.700                    | $150–400                    |
| 100–500 B      | $1.000–3.000    | $600–2.400                  | $2.400–8.100                    | $300–1.200                  |
| 500 B+         | teklif üzerine  | teklif üzerine              | teklif üzerine                  | teklif üzerine              |

Çarpanların gerekçesi:

- **Sponsorlu Reels** tabandır; aralıklar Awisee'nin Reels kademelerinin alt yarısı, mikro kademe 10–50 B ve 50–100 B olarak ikiye bölündü.
- **Hikâye ×0,3–0,4:** Later hikâyenin feed'den ~%50 ucuz, Reels'in feed'den %20–30 pahalı olduğunu söylüyor; bu Reels'in ~%40'ına denk geliyor. Hikâye 24 saatte kaybolduğu için alt sınır biraz daha düşük tutuldu.
- **Ürün yerleştirme ×0,6–0,8:** Ürün videonun ana konusu değil, kısa bir sahne. Bu ekip varsayımıdır, kaynakla doğrulanmadı.
- **Seri ×2,4–2,7:** 3 Reels'in %10–20 paket indirimli hâli. Ekip varsayımıdır.
- **Ek kalemler** (aralığa dahil değil): ücretli reklamda kullanım hakkı / whitelisting (Later'a göre +%30–50), münhasırlık, ekstra revizyon, acil teslim. Bunlar brief'e göre ayrı yazılır ([`templates/brand-brief.md`](../templates/brand-brief.md) → kullanım hakkı alanları).

## 5. AI açıklaması

Medya kitinde ve her teklifte karakterin AI ile üretilmiş kurgusal bir karakter olduğu açıkça yazar (`AI_DISCLOSURE`). Etiketleme politikası #32 kapsamında [`docs/compliance.md`](compliance.md)'de tanımlıdır: platform AI etiketi her paylaşımda açılır, Türkiye'de reklam içeren her paylaşımda caption'ın ilk kelimesi “Reklam” olur ve aynı satırda AI açıklaması bulunur (Ticari Reklam Yönetmeliği değişikliği, 1 Ağustos 2026'dan beri yürürlükte). Sponsorlu içerikteki uygulanışı [`docs/sponsored-workflow.md`](sponsored-workflow.md) → Açıklama gereksinimleri. Marka bu etiketlerin kaldırılmasını isterse iş alınmaz.
