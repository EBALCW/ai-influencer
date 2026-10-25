# Platform AI içeriği, telif ve yayın uyumu

> **Son kontrol:** 24 Ekim 2026 (önceki: 20 Ekim 2026)  
> **Kapsam:** Instagram, TikTok, YouTube ve Türkiye'de yayınlanan ticari tanıtımlar; video-to-video kaynak içerik, müzik ve telif şikâyetleri. Bu belge ekip için operasyonel kontrol listesidir, hukuki görüş değildir. Bir içerik veya kampanya hakkında tereddüt varsa yayından önce yetkin bir hukuk danışmanına sorun. Platform kuralları ve yürürlük tarihleri değişebilir. Bu yüzden belgeyi üç ayda bir ve her yayından önce kontrol edin. **Bir sonraki planlı kontrol: 24 Ocak 2027.**
>
> İlgili belgeler: sponsorlu içerik akışı [`docs/sponsored-workflow.md`](sponsored-workflow.md) (#30), olay şablonları [`docs/incidents.md`](incidents.md), hesap durumu [`docs/account-health.md`](account-health.md), persona sınırları [`docs/persona.md`](persona.md).

## Yayın öncesi temel kural

Mina ve bu projedeki diğer karakterler tamamen kurgusal, yapay zekâ ile üretilmiş karakterlerdir. Hesap, bio ve içerik onları gerçek bir insan gibi göstermemelidir. AI üretimini gizlemeyin. Platformun yükleme ekranındaki AI/altered-content açıklamasını ve profil düzeyindeki AI etiketini kullanın.

Her yayın için:

1. **AI açıklaması:** Gerçekçi görsel, ses veya video içeren AI üretimi içerikte platformun ilgili AI açıklama aracını açın. Bu projedeki karakter içerikleri AI ile üretildiği için, platform zorunlu saymasa bile etiket seçeneği varsa kullanmak iç kuralımızdır. Şüphedeyseniz açın. Platformun otomatik tespitinin etiketi ekleyeceğini varsaymayın. Etiketin erişimi düşürdüğü düşüncesiyle etiket atlanmaz; bu kural tartışmaya açık değildir.
2. **Profil açıklaması:** Bio'da hesabın AI ile oluşturulmuş kurgusal bir karakter olduğu açıkça yazılır (#7). Instagram'da profil düzenleme ekranındaki **“AI-generated profile”** anahtarı açılır (ayrıntı aşağıda).
3. **Ticari tanıtım:** Türkiye hedefli bir paylaşımda ücret, ücretsiz/indirimli ürün veya hizmet, etkinlik daveti gibi bir menfaat varsa içeriğe **“Reklam”** (veya “Tanıtım”) ibaresi eklenir. Platformun ücretli ortaklık aracı da açılır, ama bu araç yerel ibarenin yerine geçmez. Ayrıntılar aşağıda ve [`docs/sponsored-workflow.md`](sponsored-workflow.md) içinde.
4. **Doğruluk ve güvenlik:** Gerçek kişiyi taklit etmeyin. Sağlık, finans, haber veya ürün deneyimi hakkında uydurma iddia kullanmayın. Karakterin ürünü bizzat kullandığı izlenimini vermeyin. Ürün özelliklerini ve sponsor iddialarını doğrulanabilir bir kaynakla kontrol edin.
5. **Etkileşim:** Takipçi, beğeni, yorum veya görüntülenme satın almayın. Bot, engagement pod, takip-takip, toplu/otomatik etkileşim kullanmayın; platform kısıtlamasını ek hesapla aşmayın.
6. **Yaş ve hassas içerik:** Karakter 25 yaşında, yetişkin olarak tasarlanır ve yetişkin görünür. Reşit olmayan veya çocuk gibi görünen bir karakteri cinselleştiren içerik üretilmez. Müstehcenlik, gerçekçi şiddet, yanıltıcı siyasi içerik, siyasi/dinî kışkırtma ve kanıtsız sağlık iddiası kırmızı çizgidir.
7. **Kaynak ve ses:** Video-to-video kaynağı ve ses/müzik bu belgedeki [Kaynak içerik](#kaynak-içerik-video-to-video-ve-referanslar) ve [Müzik ve ses](#müzik-ve-ses) kurallarına uyar. Kaynak bilgisi içerik kartına kaydedilmeden içerik yayına hazır sayılmaz.

## Panelde zorunlu adım: AI etiketi (#57, #58)

AI etiketi panelde atlanamayan bir yayın adımıdır:

- **Check-list maddesi:** İçerik kartındaki yayın öncesi check-list'te (`apps/panel/src/lib/content/checklist-schema.ts`, şablon: [`templates/pre-publish-checklist.md`](../templates/pre-publish-checklist.md)) `ai_disclosure` maddesi bulunur: “Gerçekçi AI üretimi ise platformun AI / altered-content açıklaması açıldı.” Tüm maddeler işaretlenmeden ve iki puan en az 3 olmadan kart `Planlandı` veya `Yayında` aşamasına geçemez. Bu kural veritabanında da uygulanır (`content_checklist_ready`, migration `20261022130000_content_pipeline.sql`). Elle yayınlanıp eşleştirilen postlar da bu kuraldan geçer.
- **Yayın işi engeli:** Panelden yayın işi açılırken `publish_jobs_prepare` trigger'ı önce `ai_disclosure` maddesinin işaretli olup olmadığına bakar. Madde işaretli değilse iş açılmaz (`23514`, HINT `ai_label_missing`, mesaj: “Yayın öncesi ‘AI etiketi’ maddesi işaretlenmeli.”). Bu kontrol, RPC'yi atlayan doğrudan INSERT'te de çalışır (migration `20261023100000_publishing.sql`).
- **Yayın anında tekrar kontrol:** `publish-scheduled` worker'ı istemcinin “tamam” bilgisine güvenmez. Yayın anında check-list'i ve AI maddesini yeniden kontrol eder; biri eksikse içerik otomatik yayınlanmaz, iş `manual_required` olur.
- **API'ye giden AI etiketi:** Etiketsiz yayın seçeneği yoktur. YouTube yüklemesi her zaman `status.containsSyntheticMedia = true` gönderir. Instagram Reels container'ı her zaman `is_ai_generated = true` ile oluşturulur (`supabase/functions/_shared/publishers/`). AI etiketini API ile veremeyen bir platformun işi `manual_required` olur.
- **TikTok:** Panelden otomatik TikTok yayını yoktur (`unsupported_platform`). TikTok'a uygulamadan elle yüklenir ve yükleme ekranındaki AI-generated content anahtarı açılır. Post sonra içerik kartıyla eşleştirilir.
- **Ücretli ortaklık:** İçerik bir marka anlaşmasına bağlıysa (`brand_deal_content_items`) trigger `paid_partnership = true` hesaplar. YouTube'da bu bilgi `paidProductPlacementDetails.hasPaidProductPlacement` olarak gönderilir. Instagram Login API'si ücretli ortaklık etiketini desteklemediği için Instagram işi `manual_required` olur. Akış için bkz. [`docs/sponsored-workflow.md`](sponsored-workflow.md#instagramda-elle-yayın).

Bu kontroller platform ekranındaki işlemin yerine geçmez. Elle yayında anahtarı açmak yayını yapan kişinin sorumluluğundadır. Check-list maddesi ancak anahtar gerçekten açıldıktan sonra işaretlenir.

## Platform bazında uygulama

| Platform         | Resmî kural / araç (24 Ekim 2026'da okundu)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Bu projedeki uygulama                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instagram / Meta | Meta, fotogerçekçi video veya gerçekçi ses içeren, dijital olarak üretilmiş/değiştirilmiş organik içerikte açıklama ve etiket aracının kullanılmasını zorunlu tutuyor; açıklama yapılmazsa yaptırım uygulanabileceğini belirtiyor. Etiket “AI info” olarak gösteriliyor. Yalnızca AI ile düzenlenmiş içerikte etiket gönderi menüsüne taşınıyor. 31 Ağustos 2026'dan beri AI ile oluşturulmuş bir kişiyi öne çıkaran profiller için **“AI-generated profile”** etiketi var. Etiketsiz AI persona profillerinin erişimi sınırlandırılıyor (önerilmeme). | Gerçekçi AI içerikte yükleme akışındaki AI etiketi açılır; panelden yayında `is_ai_generated=true` otomatik gönderilir. Profil düzenleme ekranında **AI-generated profile** anahtarı açılır ve bio'da AI karakter olduğu yazılır. Account Status ekranında “önerilmeye uygun değil” uyarısı aylık kontrol edilir. |
| TikTok           | Topluluk kuralları (25 Ağustos 2026'da yayımlandı, 24 Eylül 2026'da yürürlüğe girdi), gerçekçi sahne veya kişi gösteren AI üretimi ya da belirgin biçimde düzenlenmiş içeriğin etiketlenmesini şart koşuyor. Etiketsiz içerik zararına göre kaldırılabilir, kısıtlanabilir veya TikTok tarafından etiketlenebilir.                                                                                                                                                                                                                                     | Karakterli AI içerikte yükleme ekranındaki AI-generated content anahtarı açılır. Yalnızca otomatik etikete veya caption'daki #ai etiketine güvenilmez. TikTok yayını elle yapılır.                                                                                                                                |
| YouTube          | Gerçekçi görünen ve anlamlı ölçüde sentetik üretilmiş/değiştirilmiş içerik (kısmen AI dahil) açıklanmalıdır. Açıklama YouTube Studio > Attributes > **AI use** sorusuna “Yes” yanıtıyla yapılır. Fotogerçekçi içerikte etiket oynatıcıda görünebilir. Açıklama erişimi veya para kazanmayı tek başına kısıtlamaz. Sürekli açıklama yapmayanlara etiket elle eklenebilir, içerik kaldırılabilir veya YPP askıya alınabilir.                                                                                                                             | Panelden yüklemede `containsSyntheticMedia=true` otomatik gönderilir. Elle yüklemede AI use = **Yes** seçilir. YouTube'un otomatik etiketi olsa bile yükleyici açıklaması yapılır.                                                                                                                                |

### Türkiye: ticari reklam ve AI açıklaması

“Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliğinde Değişiklik Yapılmasına Dair Yönetmelik” 1 Temmuz 2026 tarihli ve 33297 sayılı Resmî Gazete'de yayımlandı, **1 Ağustos 2026'da** yürürlüğe girdi. Ticaret Bakanlığı bunu 28 Temmuz 2026'da duyurdu. Yönetmelik metninden (24 Ekim 2026'da okundu) operasyonu ilgilendiren noktalar şunlar:

- **Etkileyici reklamı (yeni 23/A maddesi):** Etkileyici aracılığıyla yapılan reklam açık, anlaşılır ve ayırt edilebilir olmalı. Reklam verenin ürününü tanıtmak, para ya da ücretsiz/indirimli ürün veya hizmet almak, reklam verenin yarışma/kampanya/çekilişini paylaşmak veya reklam verenin etkinliğinden menfaat sağlamak gibi durumlarda içeriğin reklam olduğu belirtilir. Paylaşımda **“Reklam” ya da “Tanıtım”** ifadesine yer verilmesi zorunludur.
- **Yerleşim:** İbare paylaşımdaki renklerden ve arka plandan ayırt edilebilir olmalı, kaydırmadan görülebilmeli, diğer etiket ve açıklamalardan önce gelmeli ve hiçbir yazı veya simgeyle örtüşmemeli. İçerik birden fazla paylaşıma bölünüyorsa veya başka formatlarda yeniden paylaşılıyorsa ibare her paylaşımda yer almalı. Yalnızca sesli paylaşımda ibare reklamın başında sözlü olarak söylenmelidir.
- **AI ve dijital karakter (18. madde, yeni 8. fıkra):** Reklamda tüketicinin ekonomik davranışını önemli ölçüde etkileyecek şekilde AI veya başka bir yazılım kullanılıyorsa ya da **insandan ayırt edilemeyen dijital karakterlere** yer veriliyorsa bu durum açık, anlaşılır ve ayırt edilebilir biçimde belirtilmelidir. Mina'nın yer aldığı her reklam bu kapsamda değerlendirilir.
- **Gerçek kişinin dijital kopyası (27. madde, yeni fıkra):** Gerçek bir kişinin AI ile oluşturulmuş dijital kopyasının bir ürünü gerçeğe aykırı biçimde deneyimlediği veya tavsiye ettiği izlenimini veren reklam yapılamaz. Bu projede gerçek kişinin yüzü, sesi veya benzerliği zaten kullanılmaz (aşağıdaki kaynak kuralları).

**Operasyonel kural:**

- Menfaat varsa caption'ın **ilk kelimesi “Reklam”** olur; tüm hashtag ve etiketlerden önce gelir, kaydırmadan görünür. Videoda da ilk saniyeden itibaren okunaklı, kontrastlı ve hiçbir yazının örtmediği bir **“Reklam”** yazısı bulunur. Story'lerde her karede, carousel'de kapakta yer alır.
- Aynı satırda AI açıklaması da bulunur. Örnek: `Reklam · [Marka] iş birliği. Bu videodaki karakter yapay zekâ ile oluşturulmuştur.` Bakanlık duyurusu “iş birliği” veya “sponsorlu içerik” gibi ifadeleri de örnek olarak sayıyor, ama yönetmelik metni “Reklam” ya da “Tanıtım” istiyor. Bu yüzden yalnızca “iş birliği”, “#ad” veya “#sp” yazmak yeterli sayılmaz.
- Platformun ücretli ortaklık/branded-content aracı ayrıca açılır.
- Kampanyaya özel yerleşimi, ifadeleri veya ek yükümlülükleri marka ekibi ve gerekirse hukuk danışmanı yayından önce teyit eder.
- Reklam Kurulunun 2021 tarihli “Sosyal Medya Etkileyicileri Tarafından Yapılan Ticari Reklam ve Haksız Ticari Uygulamalar Hakkında Kılavuz”u hâlâ duyuru sayfasında duruyor ve 2026 değişikliğinden önce yazıldı. Kılavuz ile yönetmelik çelişirse yürürlükteki yönetmelik metni esas alınır.

## Yasak davranışlar

- Takipçi, beğeni, yorum veya görüntülenme satın almak ya da bunu vaat eden servisleri kullanmak.
- Bot veya script ile hesap açmak, takip/beğeni/yorum yapmak, toplu mesaj göndermek (#8, #12).
- Engagement pod, “like-for-like”, “follow-for-follow” veya benzer yapay etkileşim düzeni.
- Aynı içeriği birden fazla hesapla spam'lemek.
- Kısıtlama/askıya alma kararını yeni veya alternatif bir hesapla aşmak.
- Gerçek bir kişi, marka veya kurumun adını, görselini, sesini ya da kimliğini izinsiz taklit etmek.
- Sahte haber, sahte ürün testi/deneyimi, kanıtsız sağlık/finans iddiası veya yanıltıcı sponsor beyanı yayınlamak.

## İzleyici sorularına yanıt

**“Gerçek misin?”**  
“Ben Mina, yapay zekâ ile oluşturulmuş kurgusal bir karakterim. İçeriklerim de AI araçlarıyla hazırlanıyor. ✨”

**“Bu ürünü gerçekten kullandın mı?”**  
“Ben kurgusal bir AI karakteriyim; ürünü kişisel olarak kullanamam. Paylaşım, marka tarafından sağlanan doğrulanmış bilgilere dayanıyor.”

## Kaynak içerik (video-to-video ve referanslar)

Video-to-video (#15, panelde `generations.mode = video_to_video`, Higgsfield motion transfer, [ADR 0002](adr/0002-generation-provider.md)), başka birinin videosundaki hareketi ve kamerayı alıp kişiyi Mina ile değiştirir. Telif ve kişilik hakkı riski en yüksek üretim yöntemi budur. Birikmiş telif ihtarları hesabı kapatabilir.

### Temel kurallar

- **Birebir kopya yok:** Viral videonun konsepti, koreografisi veya formatı alınabilir. Sahne, arka plan, metin ve kurgu yeniden üretilir. Kaynak videonun görüntüsü, sesi, müziği, altyazısı veya filigranı final videoda kalmaz.
- **Gerçek kişi yok:** Ünlü veya tanınabilir kişilerin yüzü, sesi, imza görünümü (karakteristik kıyafet, dövme, jest) kullanılmaz. Final videoda kaynak kişiden ayırt edilebilir bir iz kalmamalıdır.
- **Logo ve telifli karakter yok:** Marka logoları, ürün ambalajları (sponsor ürünü hariç) ve telifli karakterler (çizgi film, oyun, film karakteri) arka planda bile görünmez.
- **Araç kuralları:** Higgsfield yardım merkezine göre, kullanıcı yüklediği içeriğin üçüncü kişilerin telif, marka ve kişilik haklarını ihlal etmemesinden sorumludur ve başka bir kişinin görüntüsünü o kişinin izni olmadan yükleyemez. Üçüncü kişi videosu (aşağıdaki 4. sıra) bu nedenle araç şartları açısından da izin gerektirir.

### Kaynak tercih sırası

| Sıra | Kaynak türü (kayıt kodu)                     | Kullanım koşulu                                                                                                                                                                                              |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Kendi çektiğimiz hareket referansı (`kendi`) | Varsayılan tercih. Ekipten biri hareketi telefonla çeker. Çekilen kişinin yazılı onayı ekip içinde saklanır.                                                                                                 |
| 2    | Lisanslı/stok video (`stok`)                 | Lisans ticari kullanıma ve AI ile dönüştürmeye izin vermeli. Sponsorlu içerikte reklam kullanımı da kapsanmalı. Lisans belgesi kısıtlı depoda saklanır.                                                      |
| 3    | Açık izinli içerik (`acik-lisans`)           | Lisans türü (ör. CC BY) ticari kullanıma ve türev esere izin vermeli. Atıf gerekiyorsa caption'a eklenir.                                                                                                    |
| 4    | Üçüncü kişi videosu (`ucuncu-kisi`)          | Yalnızca hak sahibinden yazılı izin varsa, kısa ve dönüştürücü kullanımda, risk notuyla. İzin yoksa kullanılmaz. “Dönüştürücü kullanım” ülkeden ülkeye farklıdır; emin değilseniz kendi referansınızı çekin. |

### #15 akışına eklenen “kaynak uygunluğu” adımı

Video-to-video üretiminde, **kaynak seçildikten sonra ve Higgsfield'e yüklemeden önce** aşağıdaki adım tamamlanır. Bir madde “hayır” ise kaynak kullanılmaz, kendi referansınızı çekin.

1. Kaynak türü tercih sırasındaki hangi sıraya giriyor? Kullanım koşulu sağlanıyor mu?
2. Videoda tanınabilir bir gerçek kişi var mı? (Kendi referansımız dışında varsa kaynak elenir.)
3. Arka planda logo, telifli karakter, tanınabilir mekân tabelası veya ekran içeriği var mı? Varsa final sahnede yeniden üretilecek mi?
4. Final videoda kaynaktan yalnızca hareket/kamera/konsept kalacak mı? Ses, müzik, metin ve filigran atılacak mı?
5. Kaynak bilgisi içerik kartına kaydedildi mi (aşağıdaki blok)?
6. Sponsorlu içerikte kaynağın lisansı reklam kullanımını kapsıyor mu?

Bu adım tamamlanınca check-list'teki `commercial_rights` (“Kaynak ve kullanım izni kaydedildi…”) ve `ai_consent` maddeleri işaretlenebilir. Kaynak bilgisi eksikse bu maddeler işaretlenmez, dolayısıyla içerik planlanamaz.

### Her v2v içerikte kaydedilecek kaynak bilgisi

Yayınlanan video-to-video içeriklerin **%100'ünde** kaynak bilgisi içerik kartında (#57) bulunur. Panel bunu zorunlu tutar ([#145](https://github.com/EBALCW/ai-influencer/issues/145), migration `20261024100000_content_source_fields.sql`): içeriğe video-to-video üretimi bağlıysa kaynak türü kaydedilmeden kart planlanamaz ve yayın işi açılamaz. İçerik listesindeki **"Kaynak bilgisi eksik v2v"** filtresi (`/content?source=missing`) aylık kontrolde kullanılır.

Kartın "Kaynak bilgisi (video-to-video)" bölümündeki yapılandırılmış alanlar:

| Alan                           | Ne yazılır                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `source_type` (Kaynak türü)    | `own` (kendi) · `stock` (stok) · `open_license` (acik-lisans) · `third_party` (ucuncu-kisi). Tercih sırası yukarıdaki tablodadır.  |
| `source_owner` (Kaynak sahibi) | Herkese açık hesap/kanal adı, stok sağlayıcı veya "ekip". `own` dışında zorunlu.                                                   |
| `source_license` (Lisans/izin) | Lisans adı ve no, ya da "yazılı izin – kısıtlı depoda: <referans>". `own` dışında zorunlu.                                         |
| `source_checked_at` / `_by`    | Kaynak alanlarını son kaydeden ve zaman. Panel kendisi yazar (elle girilmez).                                                      |
| `source_url`                   | Kaynak videonun bağlantısı. Kendi referansımızsa asset kütüphanesindeki (#45) referans dosyasının panel bağlantısı veya kayıt adı. |

Yapılandırılmış alanlarda olmayan ayrıntılar (alınan unsur, yeniden üretilen kısım, ses) **`content_items.notes`** içine aşağıdaki blokla yazılır. Tür, sahip, lisans ve kontrol eden/tarih artık yukarıdaki alanlarda tutulur; migration sırasında notlarda geçerli bir blok bulunan kartlarda bu üç satır alanlara taşındı.

```text
[Kaynak]
Alınan unsur: <konsept / koreografi / kamera hareketi / format>
Yeniden üretilen: <sahne, arka plan, ses, metin>
Ses: <platform kütüphanesi (elle ekleniyor) | kendi/AI üretimi | lisanslı: <kaynak>>
```

Lisans belgeleri, izin yazışmaları ve kişisel bilgiler (izin verenin adı, e-posta) panele veya repoya yazılmaz. Bunlar ekibin erişimi kısıtlı deposunda tutulur; `source_license` alanına ve nota yalnızca kısa bir referans yazılır.

### Hareket referansları

- Ekip içinden biri basit dans/hareket referanslarını telefonla dikey (9:16), tek kişi, sabit kamera ve sade arka planla çeker. Kendi içeriğimiz olduğu için telif riski yoktur.
- **Referanslar public repoya konmaz.** Bu videolar ekip üyesinin yüzünü ve bedenini içeren kişisel veridir. Issue'da önerilen `assets/motion-refs/` klasörü yerine panelin asset kütüphanesine (#45, private Storage) `reference` türüyle ve `motion-ref` etiketiyle yüklenir. Panel dışında tutulacaksa ekibin erişimi kısıtlı bulut alanında `influencer/<slug>/reference/motion-refs/` altında saklanır.
- Hedef: arşivde en az 5 kendi hareket referansı.

## Müzik ve ses

- **Platform kütüphanesi:** Organik içerikte müzik, yayın sırasında platformun kendi ses kütüphanesinden eklenir. Telifli müzik videoya dışarıdan gömülmez.
- **Panelden yayın sınırı:** Trend ve lisanslı platform sesleri API ile eklenemez; panelden yayında ses videoya gömülü gider (`supabase/functions/_shared/publishers/config.ts`). Bu yüzden panelden yayınlanan videoda yalnızca kendi ürettiğimiz, AI aracının ticari kullanıma izin verdiği veya lisansı o platformu kapsayan ses bulunur. Platform kütüphanesinden ses kullanılacaksa içerik uygulamadan elle yayınlanır.
- **Cross-post:** Aynı video YouTube/TikTok/Instagram'a gidiyorsa ses her platformda o platformun kütüphanesinden yeniden eklenir. Platform içi ticari kütüphanelerdeki parçalar genellikle yalnızca o platformda kullanılabilir. Bir platformun kütüphanesinden indirilen ses başka platforma taşınmaz.
- **Sponsorlu içerik:** Meta'nın Müzik Yönergeleri, gerekli lisanslar alınmadıkça müziğin ticari veya kişisel olmayan amaçlarla kullanılmasını yasaklıyor. Ücretli ortaklık, boost ve marka reklamı ticari kullanım sayılır. Sponsorlu içerikte yalnızca ticari kullanım için lisanslı ses kullanılır: platformun ticari kütüphanesi (ör. Meta Sound Collection, TikTok Commercial Music Library) veya lisansı reklam/ücretli ortaklık kullanımını açıkça kapsayan bir parça. Marka içeriği kendi reklamında kullanacaksa (`usageRights`) lisans bu kullanımı da kapsamalıdır.
- **AI ile üretilmiş müzik:** Videonun ana unsuru AI müzikse YouTube bunu açıklama kapsamında sayıyor. AI müzik aracının ticari kullanım şartı ayrıca kontrol edilir.

## Araç lisansları

| Araç       | Özet (24 Ekim 2026'da okundu)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Kalan kontrol                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Higgsfield | Kullanım şartları 27 Ağustos 2026'da güncellendi. Higgsfield girdi ve çıktıların sahipliğini talep etmiyor ve çıktıların ticari kullanımını kısıtlamıyor. Bu tüm planlar için geçerli; ayrı ticari lisans yok. Ücretli planlarda filigransız indirme var. Üçüncü taraf fikri mülkiyet taleplerine karşı tazminat yalnızca Enterprise planında. Yüklenen içeriğin hakları kullanıcının sorumluluğunda. Başka bir kişinin görüntüsü izinsiz yüklenemez. Higgsfield içerikleri model eğitimi için kullanabilir. | Tam Terms of Use metni (§4.3–4.4) bu turda okunmadı. Sponsorlu içerik öncesi okunmalı. |
| Diğerleri  | Edit aracı (#18), ses/müzik ve görsel araçları seçildikçe bu tabloya eklenir: çıktı sahipliği, ticari kullanım, plan seviyesi, filigran.                                                                                                                                                                                                                                                                                                                                                                     | Araç seçilince doldurulacak.                                                           |

Filigranlı ücretsiz plan çıktısı yayınlanmaz.

## İhtar ve şikâyet prosedürü

Telif ihtarı, Content ID talebi, kişilik hakkı veya marka şikâyeti geldiğinde:

1. **Hemen kaldır veya gizle:** Şikâyet konusu içeriği tüm platformlardan kaldırın. Aynı kaynaktan üretilmiş diğer içerikleri de kontrol edin. Panelde ilgili karta not düşün; açık yayın işi varsa iptal edin.
2. **Kanıtı sakla:** Bildirimin ekran görüntüsünü, bildirim metnini, içerik kartındaki `[Kaynak]` bloğunu, kaynak dosyasını ve lisans/izin belgesini ekibin erişimi kısıtlı deposunda saklayın.
3. **Olay kaydı aç:** [`docs/incidents.md`](incidents.md) içindeki **Telif / içerik şikâyeti kaydı** şablonunu kullanın: tarih, içerik, şikâyet eden, gerekçe, aksiyon. Kayıt repoya veya issue'ya yazılmaz.
4. **Hesap durumunu kontrol et:** Instagram Account Status, TikTok hesap durumu/ihlal bildirimleri ve YouTube Studio'daki telif ihtarlarını kontrol edin ([`docs/account-health.md`](account-health.md)). YouTube'da 90 gün içinde 3 telif ihtarı kanalın kapatılmasına yol açabilir. İhtarın süresinin dolması için Copyright School tamamlanmalıdır.
5. **İtiraz yalnızca kendi kaynağımızsa:** İtiraz (counter notification, Content ID itirazı) yalnızca kaynak kendi referansımızsa veya lisans/izin belgesi varsa platformun resmi kanalından yapılır. YouTube'da geçerli bir neden olmadan Content ID talebine itiraz etmek, hak sahibinin kaldırma talebi göndermesine ve ihtara yol açabilir. TikTok itirazdaki iletişim bilgilerini şikâyet edene iletebilir. Bu yüzden itiraz öncesi ekip içinde karar verilir.
6. **Kök neden:** Kaynak uygunluğu adımının neden kaçırdığını olay kaydına yazın. Gerekirse bu belgeyi veya check-list'i güncelleyin.

## Yayın öncesi uyum adımı ve doğrulama

- Her içerikte panel check-list'i (#57) doldurulur. Panel dışı çalışmada [`templates/pre-publish-checklist.md`](../templates/pre-publish-checklist.md) kopyalanır. AI açıklaması, reklam ibaresi (varsa), kaynak/hak kontrolü ve doğruluk kontrolü tamamlanmadan içerik yayına hazır sayılmaz.
- **Haftalık:** Yayınlanmış postlardan rastgele 3'ünü açın. AI etiketi görünüyor mu, sponsorluysa “Reklam” ibaresi ve ücretli ortaklık etiketi var mı, bio ve AI-generated profile etiketi güncel mi?
- **Aylık:** Account Status / hesap durumu ekranlarında ihlal olmadığını, v2v içerik kartlarında `[Kaynak]` bloğunun eksik olmadığını kontrol edin.
- **Üç ayda bir:** Bu belgedeki kaynakları yeniden okuyun, okuma tarihlerini ve “Bir sonraki planlı kontrol” tarihini güncelleyin. Takvim hatırlatıcısı ekip takviminde tutulur.

## Kaynaklar

“Durum” sütunu: **Okundu** = sayfa 24 Ekim 2026'da açılıp okundu. **Doğrulanamadı** = sayfa otomatik araçla okunamadı (JavaScript ile yükleniyor); bilgi aynı kurumun başka resmî sayfasından alındı, insan tarafından tarayıcıda kontrol edilmeli. **20 Ekim** = bu turda tekrar okunmadı, 20 Ekim 2026 kontrolü geçerli.

| Politika                                     | Kaynak                                                                                                                                                                                                 | Okuma tarihi | Durum                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------- |
| Meta AI içerik etiketleri                    | [Meta Transparency Center — Labeling AI Content](https://transparency.meta.com/governance/tracking-impact/labeling-ai-content/) (sayfa güncellemesi: 19 Şubat 2025)                                    | 24 Ekim 2026 | Okundu                                                              |
| Meta açıklama zorunluluğu (video/ses)        | [Meta Newsroom — Labeling AI-Generated Images (Şubat 2024)](https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/)                                         | 24 Ekim 2026 | Okundu                                                              |
| Meta “AI info” etiketi ve güncellemeler      | [Meta Newsroom — Approach to Labeling AI-Generated Content](https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/)                                  | 24 Ekim 2026 | Okundu                                                              |
| Instagram “AI-generated profile” etiketi     | [Instagram Creators — AI-generated profile label (31 Ağustos 2026)](https://creators.instagram.com/blog/ai-generated-profile-label)                                                                    | 24 Ekim 2026 | Okundu                                                              |
| Instagram AI etiketi ekleme (yardım)         | [Instagram Yardım — AI etiketi](https://help.instagram.com/761121959519495)                                                                                                                            | 24 Ekim 2026 | Doğrulanamadı                                                       |
| Instagram ücretli ortaklık etiketi           | [Instagram Yardım — Branded content](https://help.instagram.com/1109894795810258)                                                                                                                      | 24 Ekim 2026 | Doğrulanamadı                                                       |
| Meta Müzik Yönergeleri                       | [Meta — Music Guidelines](https://www.facebook.com/legal/music_guidelines) (yürürlük: 26 Mart 2024)                                                                                                    | 24 Ekim 2026 | Okundu                                                              |
| Meta topluluk standartları                   | [Meta — Community Standards](https://transparency.meta.com/policies/community-standards/)                                                                                                              | 20 Ekim 2026 | 20 Ekim                                                             |
| TikTok AI etiketi (yardım)                   | [TikTok Destek — AI-generated content](https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content) (şu adrese yönleniyor: `tiktok.com/support/faq_detail?id=7636670084747893268`) | 24 Ekim 2026 | Doğrulanamadı (kural aşağıdaki topluluk kurallarından okundu)       |
| TikTok AI içerik, sahte etkileşim, kimlik    | [TikTok Community Guidelines — Integrity and Authenticity](https://www.tiktok.com/community-guidelines/en/integrity-authenticity/) (yürürlük: 24 Eylül 2026)                                           | 24 Ekim 2026 | Okundu                                                              |
| TikTok ticari içerik açıklaması              | [TikTok — About the content disclosure setting](https://ads.tiktok.com/help/article/about-the-content-disclosure-setting-for-creators)                                                                 | 24 Ekim 2026 | Okundu (anahtar adları sayfada yok; uygulamada kontrol edilmeli)    |
| TikTok telif politikası                      | [TikTok — Intellectual Property Policy](https://www.tiktok.com/legal/page/global/copyright-policy/en) (yürürlük: 26 Nisan 2025)                                                                        | 24 Ekim 2026 | Okundu                                                              |
| TikTok Commercial Music Library              | TikTok Creative Center / uygulama içi “Add sound” (resmî yardım sayfası bulunamadı)                                                                                                                    | 24 Ekim 2026 | Doğrulanamadı (yalnızca üçüncü taraf kaynak)                        |
| YouTube altered/synthetic content açıklaması | [YouTube Yardım — Disclosing use of altered or synthetic content](https://support.google.com/youtube/answer/14328491)                                                                                  | 24 Ekim 2026 | Okundu                                                              |
| YouTube ücretli tanıtım açıklaması           | [YouTube Yardım — Add paid product placements](https://support.google.com/youtube/answer/154235)                                                                                                       | 24 Ekim 2026 | Okundu                                                              |
| YouTube telif ihtarı                         | [YouTube Yardım — Copyright strike basics](https://support.google.com/youtube/answer/2814000)                                                                                                          | 24 Ekim 2026 | Okundu                                                              |
| YouTube spam ve sahte etkileşim              | [YouTube — Spam, deceptive practices & scams policies](https://support.google.com/youtube/answer/2801973)                                                                                              | 20 Ekim 2026 | 20 Ekim                                                             |
| YouTube kimliğe bürünme                      | [YouTube — Impersonation policy](https://support.google.com/youtube/answer/2801947)                                                                                                                    | 20 Ekim 2026 | 20 Ekim                                                             |
| Türkiye: yönetmelik metni                    | [Resmî Gazete 1 Temmuz 2026, sayı 33297 — Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliğinde Değişiklik](https://www.resmigazete.gov.tr/eskiler/2026/07/20260701-9.htm)                         | 24 Ekim 2026 | Okundu                                                              |
| Türkiye: Bakanlık duyurusu                   | [T.C. Ticaret Bakanlığı — Sosyal Medyada Şeffaf Reklam Dönemi (28 Temmuz 2026)](https://ticaret.gov.tr/haberler/ticaret-bakanligindan-sosyal-medyada-seffaf-reklam-donemi)                             | 24 Ekim 2026 | Okundu                                                              |
| Türkiye: etkileyici kılavuzu (2021)          | [T.C. Ticaret Bakanlığı — Kılavuz duyurusu](https://tuketici.ticaret.gov.tr/duyurular/sosyal-medya-etkileyicileri-tarafindan-yapilan-ticari-reklam-ve-haksiz-ticari-uyg)                               | 24 Ekim 2026 | Okundu (duyuru sayfası; ekli .docx kılavuz metni bu turda açılmadı) |
| Higgsfield sahiplik ve ticari kullanım       | [Higgsfield Yardım — Who owns my generations](https://higgsfield.ai/creator-hub/help-center/account-and-privacy/who-owns-my-generations-and-can-i-use-them-commercially)                               | 24 Ekim 2026 | Okundu                                                              |
| Higgsfield kullanım şartları güncellemesi    | [Higgsfield — Terms of Use update (25 Temmuz 2026)](https://higgsfield.ai/blog/terms-of-use-privacy-policy-update) · [Terms of Use](https://higgsfield.ai/terms-of-use-agreement)                      | 24 Ekim 2026 | Duyuru okundu; tam metin okunmadı                                   |
