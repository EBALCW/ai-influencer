# İçerik üretim akışı (pipeline) ve backlog

> Durum: ilk sürüm, 24 Ekim 2026 (#19). Günde 2–4 paylaşımı sürdürmek için fikirden yayına akışı, aşama kriterlerini, ilk backlog'u ve haftalık kredi ihtiyacını tanımlar. **Kredi birim fiyatları örnektir, doğrulanmadı** (bkz. [Kredi hesabı](#kredi-hesabı)). İlk haftanın gerçek verisiyle (2. hafta) güncellenecek.

İlgili belgeler: persona [`persona.md`](persona.md) · uyum [`compliance.md`](compliance.md) · hesap sağlığı [`account-health.md`](account-health.md) · üretim sağlayıcısı [ADR 0002](adr/0002-generation-provider.md) · panel AI asistanı [`AI.md`](AI.md) · veri modeli [`data-model.md`](data-model.md) · senaryo şablonu [`templates/short-film-script.md`](../templates/short-film-script.md) · yayın öncesi kontrol [`templates/pre-publish-checklist.md`](../templates/pre-publish-checklist.md).

## Board

Geçici GitHub Projects/Sheets board'una gerek kalmadı: panelin içerik kanban'ı (`/content`, #57) ve takvimi (`/calendar`) çalışıyor. Bütün içerikler kart olarak orada ilerletilir. Kart alanları issue'daki listeyle eşleşir: başlık, format, kanca türü, trend linki (`source_url`), sorumlu (`assignee_id`), hedef hesap, yayın zamanı (`scheduled_at`), bağlı üretimler/asset'ler (kredi bunlardan gelir), aşama (`stage`).

## Aşamalar

Kanban sütunları `content_items.stage` enum'uyla birebir aynıdır: `idea` → `script` → `production` → `qc` → `edit` → `scheduled` → `published`. Issue'daki **Caption** adımı Edit aşamasının içinde, **Analiz** adımı Yayında aşamasından sonra yapılır (ayrı sütun yok).

Roller: panelde `owner` / `editor` / `viewer` vardır. Aşağıdaki "sorumlu" iş rolüdür; hepsi panelde en az `editor` olmalıdır. QC'yi içeriği üreten kişi dışında biri yapar (2. göz kuralı, #22).

| #   | Aşama (`stage`)         | Giriş kriteri                                                                               | Çıkış kriteri                                                                                                                                                                                                                                                                                                                | Sorumlu                    | Panel ekranı / araç                                                                                                                                          | Tahmini süre                      | Tahmini kredi                                                    |
| --- | ----------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------- |
| 1   | Fikir (`idea`)          | Trend linki (#10) veya orijinal fikir var                                                   | Kartta başlık, format, kanca türü, hedef hesap ve sorumlu dolu; trendden geliyorsa izlenme, "neden viral" ve uyarlama puanı (≥3) girildi; persona tonuna ve `compliance.md` yasaklarına (gerçek kişi, telif, sağlık/finans iddiası) aykırı değil                                                                             | İçerik sorumlusu           | `/content` → Fikir sütunu (trend alanları); haftalık fikir için `/` üzerindeki AI haftalık özet                                                              | 5–10 dk                           | 0                                                                |
| 2   | Senaryo (`script`)      | Fikir çıkışı tamam                                                                          | **Kısa film:** `templates/short-film-script.md` dolduruldu (≤6 sahne, toplam 30–60 sn, her sahnede süre + görsel prompt, kredi tahmini). **Video-to-video:** kaynak video seçildi, kullanım izni/kaynağı kaydedildi (#33), karakter referans görselleri belirlendi. Her ikisinde #22'nin iki sorusu taslak olarak yanıtlandı | İçerik sorumlusu           | `/content` kartı → AI asistanı "senaryo" görevi; talimat `/prompts` → `short_film` / `ai-script`; görsel prompt'lar `/prompts` (`character`, `short_film`)   | Kısa film 20–40 dk · v2v 10 dk    | 0 (Claude token maliyeti `/costs`'a `ai_api` olarak USD yazılır) |
| 3   | Üretim (`production`)   | Senaryo onaylandı; `/costs` bütçe oranı < %100 (aşılmışsa owner onayı)                      | Bütün sahnelerin üretimi `succeeded`, çıktılar asset olarak karta bağlı. Önce test modu (480p, ≤5 sn) ile denendi, onaylanan sahneler final render'a alındı. Sahne başına en çok 3 deneme; 3'te olmazsa prompt/referans gözden geçirilir (#27)                                                                               | Üretici                    | `/prompts/[id]` üretim formu (mod, referans, çözünürlük, süre, test modu) · `/production` kuyruk (durum, iptal, yeniden dene) · `/influencers/[slug]/assets` | Kısa film 60–90 dk · v2v 20–30 dk | Kısa film ≈ 200 · v2v ≈ 76 · deneysel ≈ 35 (örnek birim)         |
| 4   | QC (`qc`)               | Bütün asset'ler üretildi                                                                    | Her asset için QC check-list'i (#3: eller, yüz, saç/toka tutarlılığı, metin/logo bozulması, video titremesi) dolduruldu, asset `qc_status = passed`. Kritik hatalı asset varsa kart Üretim'e döner                                                                                                                           | QC (üreten dışındaki kişi) | `/influencers/[slug]/assets` (QC durumu + check-list) · `/content` kartı                                                                                     | 10–15 dk                          | 0 (yeniden üretim varsa Üretim'e yazılır)                        |
| 5   | Edit (`edit`)           | QC geçti                                                                                    | Kurgu bitti: ekran metni, altyazı (sessizde anlaşılır), VO, müzik (orijinal/lisanslı), 9:16 1080×1920 export, kapak karesi. **Caption:** persona tonunda caption + 3–5 hashtag + soru (#23). Yayın öncesi check-list'in 5 bölümü işaretlendi, kanca ve yorum puanları ≥3 (puan <3 ise kart Edit'te kalır)                    | Editör                     | Kurgu aracı (panel dışı) · `/content` kartı: AI caption görevi + yayın öncesi check-list                                                                     | 30–60 dk                          | 0                                                                |
| 6   | Planlandı (`scheduled`) | Check-list tamam ve "Yayına hazır" kararı verildi (sunucu zorlar: eksikse geçiş reddedilir) | Yayın zamanı slotta; aynı hesapta 5 saatten yakın veya günde 4'ten fazla paylaşım uyarısı yok (#21). Yayın ayarlarında platform AI etiketi ve (varsa) "reklam"/"tanıtım" ibaresi + ücretli ortaklık aracı hazır                                                                                                              | Yayın sorumlusu            | `/calendar` (hafta/ay, slotlar) · `/content` kartı yayın paneli                                                                                              | 5 dk                              | 0                                                                |
| 7   | Yayında (`published`)   | Platformda yayınlandı                                                                       | Post kaydı karta eşlendi; ilk saat içinde yorumlara yanıt verildi (`/inbox`, şablon `templates/comment-replies.md`)                                                                                                                                                                                                          | Yayın sorumlusu            | `/content` yayın paneli · `/inbox`                                                                                                                           | 10–20 dk                          | 0                                                                |
| —   | Analiz (aşama sonrası)  | Yayından 24 saat ve 7 gün geçti                                                             | 1s/5s/24s metrikleri okundu (#53); video başına maliyet ve 1000 izlenme başına maliyet not edildi; öğrenim notu (ne çalıştı / ne çalışmadı) karta yazıldı; haftalık raporda yer aldı                                                                                                                                         | İçerik sorumlusu           | `/analytics`, `/analytics/posts/[postId]`, `/analytics/compare`, `/analytics/reports` · `/costs`                                                             | Haftada 30 dk                     | 0                                                                |

## Kapasite planı

- **Hedef:** günde 2–4 paylaşım → haftada **14–28 video**. İlk hafta alt sınır (14) ile başlanır.
- **Format karışımı (başlangıç hedefi):** %60 video-to-video, %25 kısa film, %15 deneysel. 2. haftada izlenme/tamamlanma ve video başına maliyete göre güncellenir.
- **Yedek:** her zaman en az 3 video Planlandı'da hazır bekler (üretim/QC darboğazına karşı).
- **Batch ritmi (öneri):** Pazartesi–Salı üretim (+QC), Çarşamba edit + caption, Perşembe–Cuma ikinci üretim/edit turu; yayın her gün. Senaryolar bir önceki haftanın Cuma günü hazır olur.

| Haftalık hedef | Video-to-video | Kısa film | Deneysel | Toplam |
| -------------- | -------------: | --------: | -------: | -----: |
| 14 (günde 2)   |              8 |         4 |        2 |     14 |
| 21 (günde 3)   |             13 |         5 |        3 |     21 |
| 28 (günde 4)   |             17 |         7 |        4 |     28 |

## Kredi hesabı

Higgsfield Cloud API kredi değil USD bakiyeden düşüyor ve fiyat hesaba/modele göre değişiyor; status yanıtında tutar alanı yok. Worker her gönderimden önce `POST /estimate/<model>` ile USD tahminini alıp üretime yazıyor (#150, ADR 0002 → Doğrulama notları 2). Planlama için aşağıda **formül + örnek birimler** var. Gerçek değerler #13 ölçümünden ve Higgsfield konsolundan gelince bu tablo güncellenir; panelde gerçek harcama `/costs` (`budget_status`, video başına maliyet) üzerinden izlenir.

### Formül

Sahne başına:

```text
kredi_sahne = görsel_aday × K_img + test_klip × K_test + final_birim × K_final × r
final_birim = ⌈sahne_süresi / 5⌉        (5 sn'lik klipler, edit'te birleştirilir — #27 kuralı)
```

Haftalık:

```text
kredi_hafta = (n_v2v × C_v2v + n_film × C_film + n_den × C_den) × (1 + t)
para_hafta  = kredi_hafta × rate_per_credit        (panel: credit_rates)
B_hafta     = B_ay × 12 / 52                        (aylık bütçe → haftalık)
```

### Örnek birimler (doğrulanmadı, örnek)

| Değişken  | Anlam                                               | Örnek değer |
| --------- | --------------------------------------------------- | ----------: |
| `K_img`   | 1 keyframe görseli (`text_to_image`)                |           2 |
| `K_test`  | 5 sn image-to-video test klibi (480p, test modu)    |           5 |
| `K_final` | 5 sn image-to-video final klip (720p)               |          12 |
| `K_v2v_t` | 5 sn motion transfer testi (480p)                   |           8 |
| `K_v2v_f` | 5 sn motion transfer final (720p)                   |          15 |
| `r`       | Ortalama yeniden deneme çarpanı (en çok 3 deneme)   |         1,5 |
| `t`       | Test/deneme payı (#13: aylık kredinin en çok %10'u) |         %10 |

### İçerik başına tahmin

| Format         | Varsayım                                                                                                                                                                          | Kredi (örnek) |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------: |
| Kısa film      | İlk 3 senaryonun ortalaması: [01](short-films/01-gece-yarisi-tabelalar.md) 189 · [02](short-films/02-on-dort-sekme.md) 203 · [03](short-films/03-pov-ai-oldugunu-ogrendin.md) 207 |     **≈ 200** |
| Video-to-video | 15 sn, referans görseller hazır (0), 1 test (8) + 3 final birim × 15 × 1,5 (67,5)                                                                                                 |      **≈ 76** |
| Deneysel       | 6 görsel aday (12) + 1 kısa klip: test 5 + final 18                                                                                                                               |      **≈ 35** |

### Haftalık ihtiyaç ve bütçe karşılaştırması

Aylık bütçe tavanı henüz belirlenmedi (#27 açık). Karşılaştırma için **örnek bütçe `B_ay = 6.000 kredi`** alındı → `B_hafta ≈ 1.385 kredi`.

| Haftalık hedef | v2v (×76) | Kısa film (×200) | Deneysel (×35) | Ara toplam | +%10 test | Örnek bütçeye oran |
| -------------- | --------: | ---------------: | -------------: | ---------: | --------: | -----------------: |
| 14 (8/4/2)     |       608 |              800 |             70 |      1.478 | **1.626** |           **%117** |
| 21 (13/5/3)    |       988 |            1.000 |            105 |      2.093 | **2.302** |           **%166** |
| 28 (17/7/4)    |     1.292 |            1.400 |            140 |      2.832 | **3.115** |           **%225** |

Sonuç (örnek birimlerle):

- Örnek bütçe haftada 14 videoyu bile karşılamıyor (%117). Başlangıç karışımıyla bütçeye sığan üst sınır ≈ **11 video/hafta** (ortalama ≈ 116 kredi/video).
- **14 videoyu sığdırmak için:** kısa filmi haftada 2'ye indir, v2v'yi 10'a çıkar → (10×76 + 2×200 + 2×35) × 1,1 = **1.353 kredi** (%98). Kısa film en pahalı format; payı %25 yerine ilk haftalarda ~%15 tutulabilir.
- **Günde 4 paylaşım (28/hafta)** için aylık bütçe en az ≈ 13.500 kredi olmalı (3.115 × 52 / 12).
- Maliyeti düşürenler: keyframe'i tekrar kullanmak (loop sahnesi), `still` sahne (sadece görsel + edit hareketi), test modunda onay almadan final render yapmamak, çalışan prompt'u kütüphanede şablonlaştırmak.

Gerçek bütçe #27'de belirlenince: `B_ay`'ı ve ölçülen `K_*` değerlerini bu tabloya yaz, oranı yeniden hesapla. Panelde `/costs` bütçe çubuğu %80'de uyarı verir, %100'de yeni üretim owner onayı ister.

## Backlog (ilk 16 fikir)

10 kısa film fikri kanca türlerine göre dağıtıldı (#16: 3 merak, 3 absürt/komik, 2 duygusal, 2 POV); üçü üretime hazır senaryo olarak yazıldı. Video-to-video kaynakları **yalnızca ekibin kendi çektiği veya kullanım izni olan** videolardır (#33); başka üreticinin videosu izinsiz kullanılmaz. Kartlar `/content` Fikir sütununa girilecek.

| #   | Başlık                      | Format         | Kanca türü   | Kanca (ilk 3 sn)                                                                                    |       Tahmini sahne | Tahmini kredi | Durum                                                           |
| --- | --------------------------- | -------------- | ------------ | --------------------------------------------------------------------------------------------------- | ------------------: | ------------: | --------------------------------------------------------------- |
| 1   | Gece Yarısı Tabelaları      | Kısa film      | Merak        | "Saat 23.59. Şehirdeki bütün tabelalar değişti."                                                    |                   6 |           189 | Senaryo hazır: [01](short-films/01-gece-yarisi-tabelalar.md)    |
| 2   | Banyodan Yarın Çıktı        | Kısa film      | Merak        | Mina analog filmi banyodan çıkarıyor: "36 karenin hepsinde yarın vardı."                            |                   5 |           170 | Fikir                                                           |
| 3   | Haritada Olmayan Durak      | Kısa film      | Merak        | Navigasyon "Hedefinize vardınız" diyor; Mina boş bir sokakta, karşısında olmayan bir durak tabelası |                   5 |           175 | Fikir                                                           |
| 4   | On Dört Sekme               | Kısa film      | Absürt/komik | Laptop ekranından ışıklı bir kart fırlayıp kahve kupasının önüne konuyor                            |                   5 |           203 | Senaryo hazır: [02](short-films/02-on-dort-sekme.md)            |
| 5   | Otomatik Tamamlama          | Kısa film      | Absürt/komik | Mina "Geliyorum" yazıyor, klavye önerisi "…ama önce 3 kahve" diye tamamlıyor                        |                   4 |           120 | Fikir (çoğu `still` + edit)                                     |
| 6   | Arka Planı Sildim           | Kısa film      | Absürt/komik | Mina fotoğraftaki arka planı siliyor, arkasındaki gerçek sokak da kayboluyor                        |                   5 |           180 | Fikir (AI'ın boşluğu nasıl "tahmin ettiği" açıklaması)          |
| 7   | Üç Yıl Önceki Çalma Listem  | Kısa film      | Duygusal     | Kulaklık takılıyor, şehir üç yıl önceki renklerine dönüyor                                          |                   5 |           170 | Fikir (şarkı adı/telifli müzik yok, orijinal enstrümantal)      |
| 8   | Son Vapurdaki Boş Koltuk    | Kısa film      | Duygusal     | Son vapurda Mina'nın yanındaki boş koltukta bir not: bir takipçi cümlesi                            |                   5 |           180 | Fikir (takipçi cümlesi izinle/anonim)                           |
| 9   | POV: AI Olduğunu Öğrendin   | Kısa film      | POV          | "POV: Takip ettiğin kızın AI olduğunu öğrendin." Mina kameraya bakıyor                              |                   6 |           207 | Senaryo hazır: [03](short-films/03-pov-ai-oldugunu-ogrendin.md) |
| 10  | POV: Gününü AI'a Planlattın | Kısa film      | POV          | Ekranda takvim: "07.00–07.05 Uyan. 07.05–07.06 Nefes al."                                           |                   5 |           160 | Fikir                                                           |
| 11  | Kahve Siparişi Yürüyüşü     | Video-to-video | Merak        | Kalabalık sokakta tek bir kişi ritimle yürüyor, kadraj ona kilitleniyor                             |      1 (15 sn klip) |            76 | Fikir (kaynak: ekip kaydı)                                      |
| 12  | Analog Makineyle 3 Poz      | Video-to-video | Absürt/komik | Makine kaldırılıyor, her deklanşörde Mina'nın pozu absürtleşiyor                                    |      1 (15 sn klip) |            76 | Fikir (kaynak: ekip kaydı)                                      |
| 13  | Masa Düzeni 10 Saniyede     | Video-to-video | Absürt/komik | Dağınık masa, el hareketiyle 10 saniyede toparlanıyor                                               |      1 (15 sn klip) |            76 | Fikir (kaynak: ekip kaydı)                                      |
| 14  | Ceket Geçişi                | Video-to-video | Merak        | Kamera önünden ceket geçiyor, arkada kıyafet ve mekân değişmiş                                      |      1 (15 sn klip) |            76 | Fikir (kaynak: ekip kaydı; ses platform kütüphanesinden)        |
| 15  | Aynı Prompt, Üç Sahne       | Deneysel       | Merak        | "Aynı karakteri üç sahnede aynı kişi gibi göstermek neden zor?" + üç kare                           | 4 (görsel + 1 klip) |            35 | Fikir (üretim süreci sütunu)                                    |
| 16  | Takipçinin Seçtiği Nesne    | Deneysel       | Topluluk/POV | "Yorumlarda en çok sizin seçtiğiniz nesne: …" Mina nesneyi eline alıyor                             | 3 (görsel + 1 klip) |            35 | Fikir (#1 senaryosunun CTA'sından beslenir)                     |

Backlog toplamı (örnek birim): 10 kısa film ≈ 1.754, 4 v2v ≈ 304, 2 deneysel ≈ 70 → **≈ 2.128 kredi**.

## Otomasyon fırsatları

| Adım              | Bugün panelde                                                                  | İlgili issue |
| ----------------- | ------------------------------------------------------------------------------ | ------------ |
| Trend araştırması | AI haftalık özet (son 7 gün analizi), fikirler elle Fikir sütununa             | #12, #48     |
| Senaryo taslağı   | İçerik kartında AI senaryo görevi (`short_film` / `ai-script`)                 | #16, #48     |
| Caption üretimi   | İçerik kartında AI caption görevi                                              | #23, #48     |
| Metrik toplama    | Zamanlanmış senkronizasyon, 1s/5s/24s snapshot                                 | #53          |
| Yayın zamanlama   | Panelden yayınlama ve zamanlanmış paylaşım                                     | #58          |
| Maliyet kaydı     | Biten üretim kredisi `costs`'a otomatik; Claude token maliyeti `ai_api` olarak | #59          |

## Açık işler

- 1 hafta boyunca bütün içerikleri `/content` üzerinden ilerlet; hafta sonunda en uzun bekleyen aşamayı (darboğaz) bu belgeye yaz.
- Gerçek aylık bütçeyi (#27) ve ölçülen kredi değerlerini (#13) [Kredi hesabı](#kredi-hesabı) tablosuna işle.
- Format karışımını 2. hafta verisiyle güncelle.
- Backlog kartlarını `/content` Fikir sütununa gir.
