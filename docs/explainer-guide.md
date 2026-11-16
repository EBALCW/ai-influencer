# Anlatım videoları rehberi

Üçüncü içerik türümüz: bir olayı ya da "nasıl çalışır" konusunu hareketli çizimler, seslendirme ve altyazıyla anlatan kısa dikey videolar. Örnek: planörün motorsuz nasıl uçtuğunu kanat kesiti, akım çizgileri, süzülme üçgeni ve termik sütunuyla anlatan 66 saniyelik film. Yüz gösterilmez, AI influencer karakteri gerekmez; üretici görsel ya da video modeli de kullanılmaz, bütün görseller koddan çizilir.

İki tür var: **olay** (bir kurtarma, keşif, rekor; zaman sırasıyla anlatılır) ve **nasıl çalışır** (bir mekanizma ya da doğa olayı; şemayla anlatılır).

AI agent'ları için akış `.claude/skills/anlatim-videosu/SKILL.md` içinde. Film motoru `.claude/skills/cinematic-film/` (dışarıdan alındı: `Moh4696/cinematic-skill`, MIT; ayrıntı o klasördeki `KAYNAK.md`).

## Nasıl çalışır

1. **Kısa istek.** Bir alan ("havacılık", "ilginç mühendislik") ya da belirli bir soru yazarsın.
2. **Konu önerileri.** Agent 5-8 konu önerir. Her öneride çalışma başlığı, 2-3 cümlelik özet, kanca (neden izlenir), ekranda ne çizileceği ve iki kaynak adayı bulunur.
3. **Seçim.** Özetleri okuyup beğendiğin konuları seçersin. Seçilmeyenler için iş yapılmaz.
4. **Araştırma, senaryo ve onay.** Seçilen konu araştırılır, her olgu kaynağıyla not edilir. 45-90 saniyelik senaryo yazılır (110-230 kelime); ilk cümle kancadır. Senaryo ve olgular bir ekip üyesince onaylanır; onaysız üretime geçilmez.
5. **Seslendirme.** Ücretsiz `edge-tts` ile Türkçe ses (`tr-TR-AhmetNeural` ya da `tr-TR-EmelNeural`). Film sese göre zamanlanır.
6. **Görsel.** Her cümleyi bir hareketli çizim taşır: kesit, akım çizgisi, büyüyen ok, ölçekli üçgen, rota, karşılaştırma. Ekrandaki yazı kısa etiketlerden ibarettir. Tamamı kodla çizilir (Python + Skia), ücretli servis gerekmez. Olay videolarında lisanslı fotoğraf ve harita da kullanılabilir.
7. **Ses ve altyazı.** Ses efektleri kodla üretilir, altyazı videoya gömülür.
8. **Çıktı.** 1080×1920 MP4, yanında kaynak listesi ve görsel künyesi (`credits.md`).

Agent'tan istemek için: "Havacılıkla ilgili anlatım videosu fikirleri ver" ya da doğrudan "Planör nasıl uçar, 60 saniyelik anlatım videosu yap" demek yeterli. Konuyu doğrudan verirsen öneri adımı atlanır, senaryo onayı yine istenir.

Çizimle iyi anlatılan konular şemaya dökülebilenlerdir: mekanizma, akış, ölçek, rota, karşılaştırma. Yüz, kalabalık ya da gerçekçi görüntü gerektiren konular bu yöntemle zayıf kalır; agent öneri listesinde bunu belirtir.

## Panel modeli

Aynı akışın panel veritabanındaki karşılığı (#216; ayrıntı `docs/data-model.md` → "Anlatım modülü"). Seri isteğe bağlıdır: tekil video seri olmadan açılır.

| Adım                   | Tablo / alan                                                                     | RPC                                                |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| Kısa istek             | `topic_requests.prompt`                                                          | `create_topic_request`                             |
| Konu önerileri         | `topic_suggestions`: özet, kanca, `visual_idea`, tür, kanıt düzeyi, kaynak adayı | `create_topic_request`, `add_topic_suggestions`    |
| Seçim                  | `topic_suggestions.status` → `episodes` (seride sıradaki numara)                 | `pick_topic_suggestion`, `reject_topic_suggestion` |
| Konu doğrudan verildi  | `episodes` (önerisiz)                                                            | `create_episode`                                   |
| Senaryo ve kaynak notu | `episodes.script_text`, `script` (`script.json`), `fact_notes`, hassasiyet       | `save_episode_script`                              |
| Senaryo onayı          | `episodes.script_approved_*` (insan oturumu; değişiklikte silinir)               | `approve_episode_script`                           |
| Üretim                 | `jobs.episode_id` + dondurulmuş `params` (seri varsayılanı → bölüm)              | `enqueue_episode_job`                              |
| Video onayı            | işin son aşaması (`job_stages.approved_at`) → bölüm `approved`                   | `approve_job_stage`                                |

Onaysız senaryoyla üretim işi açılamaz ve iki kaynaktan azı olan iddia `unsourced_claim_count` ile işaretlenir; ikisi de veritabanında zorlanır.

## Panelde kullanım

Panelde **Anlatım videoları** (`/explainers`) aynı akışı ekranlarla yürütür. Karakter seçilmez; seri isteğe bağlıdır. Owner ve editör yazar, izleyici her şeyi salt okunur görür.

| Ne yapmak istiyorsunuz?              | Nereden                                              | Ne olur                                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konu belli, tek video                | **Tekil video**                                      | Başlık ve tür yeter; numarasız bir video açılır                                                                                                                             |
| Aynı formatta devam (Bölüm 1, 2, 3…) | **Yeni seri** → seri sayfasında **Bölüm ekle**       | Tema, görsel yol, stil, ses, altyazı ve dil bir kez seçilir; her bölüm devralır, bölümde değiştirilebilir                                                                   |
| Fikir arıyorum                       | **Konu önerisi iste**                                | Kısa bir istek açılır; öneriler kart olarak yan yana durur. Bugün önerileri elle eklersiniz (tek tek ya da her satıra bir başlık); yapay zekâ önerileri aynı ekrana gelecek |
| Öneriyi videoya çevirmek             | Öneri kartında **Bu konuyu seç**                     | Öneri bölüme dönüşür (serideyse sıradaki numarayla). **Ele** ile elenen öneri silinmez, sonradan **Yine de seç** ile seçilebilir                                            |
| Bölümü başka seriye almak            | Seri sayfasındaki ya da bölüm ayarlarındaki **Taşı** | Yalnız üretim başlamadan; yeni serinin sıradaki numarasını alır, eski numara boş kalır                                                                                      |

Başlık yazarken ya da öneri seçerken panel **benzer eski konuları** gösterir. Uyarı engellemez; aynı videoyu iki kez yapmamak içindir.

**Bölüm sayfası** üstteki şeritte akışta nerede olduğunuzu ve sıradaki adımı söyler:

1. **Senaryo ve kaynak notları.** Anlatıcı metnini yazın. Her olgu için "İddia ekle" ile iddiayı ve kaynaklarını girin. İki kaynaktan azı olan iddia anında işaretlenir; kaynaklar ayrışıyorsa "temkinli ifade" alanına senaryoda kullanılacak ifadeyi yazın. Gerçek olaylarda hassasiyet kutularını işaretleyin; kurallar o anda ekranda görünür.
2. **Kaydet.** Her değişiklik yeni bir **sürüm** açar; eskisi "Sürüm geçmişi"nde kalır, güncel sürümle karşılaştırılabilir ve "bu sürümü geri yükle" ile yeni sürüm olarak geri getirilebilir. Siz yazarken başka biri kaydettiyse kaydınız reddedilir, yazdıklarınız silinmez: iki sürüm arasındaki farkı görür, güncel sürümü yükler ya da kendi metninizi bilerek yeni sürüm olarak kaydedersiniz.
3. **Senaryo onayı.** Owner ya da editör, okuduğu sürümü onaylar; kim ve ne zaman onayladı kaydedilir. Kaynak eksiği varsa "Kaynak eksiğini biliyorum" kutusu işaretlenmeden onay verilemez. Senaryo, kaynak notu, hassasiyet ya da tür sonradan değişirse **onay silinir** ve yeniden onay gerekir.
4. **Üretime gönder.** Onaylı senaryo ve seçili bir görsel yol ister. O anda stil, ses ve altyazı ayarları iş için dondurulur. Bağlı ve çevrimiçi bir üretim makinesi yoksa iş sırada bekler; panel bunu açıkça söyler. Aşamalar (seslendirme → altyazı → görseller → render ve video onayı) aynı sayfada izlenir. Üretim sürerken senaryo kilitlidir; değiştirmek için önce işi iptal edin.

Henüz panelde olmayanlar: yapay zekâ ile öneri ve senaryo taslağı (#217, #218), aşamaları çalıştıran makine programı ve video onayı (#211, #219, #205), dışa aktarma ve yayın (#234).

## İki çizim yolu

| Yol                                              | Görünüm                                                                     | Ne zaman                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Skia (`cinematic-film`)                          | Düz dolgulu renkli 2B şema                                                  | Renkle anlam taşıyan şemalar, fotoğraf ve haritalı olay filmleri           |
| Stil (`film-styles` + `edit-video`, HyperFrames) | 99 hazır görünümden biri: ozalit, beyaz tahta, kesit çizimi, eskiz defteri… | Belirgin görsel kimlik, seri formatı, kelimeye kilitli çizim ve ses efekti |

Stil yolu açık kaynak `alisadiq-ai/favstash-ai-video-editing-skills` paketinden alınan beş skill ile çalışır (Apache-2.0; ne alındı, ne değişti: `.claude/skills/edit-video/KAYNAK.md`). Paketin FavStash servisine bağlanan yayın ve analitik kısmı alınmadı; yayın panelden yapılır. Paketten gelen iki yöntem akışa işlendi: konu önerisinde "kanıtlı = örnek videonun izlenmesi kendi kanalının medyanının en az 3 katı" ölçüsü, senaryoda ilk beş saniyelik kanca ve ara kancalar. Türkçe ses yine `edge-tts` iledir. Komutlar ve tuzaklar skill'in 8. bölümünde.

Stil yolunun bir kez yapılan kurulumu: Node 22+ ve `node .claude/skills/edit-video/scripts/init-workspace.mjs --workspace ~/ai-influencer-films --install` (HyperFrames 0.8.32 + GSAP, ~410 MB, repo dışında; render için makinedeki Google Chrome kullanılır).

Üçüncü bir yol da Blender ile 3D'dir (`.claude/skills/anlatim-videosu/blender/README.md`): olay hikâyeleri için kesit kalıbı, "nasıl çalışır" konuları için karanlık stüdyo kalıbı (ışıyan parçacıklar, etiket kutuları, karşılaştırma sahneleri, büyük altyazı). Stüdyo kalıbında ekran yazıları dile göre veri dosyasından gelir; 1:45'lik örnek film MacBook Air M4'te yaklaşık 57 dakikada render edildi (`ornek/planor-3d-studyo/`).

## Kurallar

| Kural                  | Açıklama                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| İki kaynak             | Her olgu en az iki bağımsız kaynaktan doğrulanır, biri birincil (resmî rapor, kurum açıklaması, hakemli yayın).                   |
| Şema dürüstlüğü        | Abartılı ölçek ya da sadeleştirilmiş çizim kaynak notunda belirtilir; mümkünse yanında gerçek ölçek gösterilir.                   |
| Uydurma yok            | Kaynaklar çelişiyorsa çelişki anlatılır ya da ayrıntı çıkarılır. Emin olunmayan şey "rapora göre" diye söylenir.                  |
| Hassas konular         | Kaza, ölüm, suç: saygılı dil, yakınların mahremiyeti, sömürü başlığı yok, yaralanma/ceset görüntüsü yok.                          |
| Lisanslı görsel        | Gerçek fotoğraf yalnız lisansı uygun kaynaktan (Wikimedia Commons, kamu malı arşivler). Haber sitesi ve sosyal medya görseli yok. |
| AI görseli kanıt değil | AI ile üretilen görsel gerçek olayın ya da kişinin görüntüsüymüş gibi sunulmaz; illüstrasyon olarak etiketlenir.                  |
| AI etiketi             | Yayında platformun AI içerik etiketi `docs/compliance.md` kurallarına göre işaretlenir.                                           |

## Gereksinimler

| Araç                             | Kurulum                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| Python 3.9+                      | macOS: `brew install python` · Windows: `winget install Python.Python.3.12` |
| `ffmpeg` + `ffprobe` (libass'lı) | macOS: `brew install ffmpeg-full` · Windows: `winget install Gyan.FFmpeg`   |
| Python paketleri (sanal ortamda) | `pip install -r .claude/skills/cinematic-film/requirements.txt edge-tts`    |

Proje dosyaları (ses, görsel, video) repo dışında `~/ai-influencer-films/<ad>/` altında tutulur.

## Durum

Akış bu projede iki filmle uçtan uca denendi (macOS):

| Film                                 | Tür           | Süre  | Görsel                                                           | Örnek dosyalar                                 |
| ------------------------------------ | ------------- | ----- | ---------------------------------------------------------------- | ---------------------------------------------- |
| "Mağarada 17 Gün" (13 Kasım 2026)    | Olay          | 46 sn | Yalnızca kart ve sayılar; kare çoğu yerde boş kalıyor            | `.claude/skills/anlatim-videosu/ornek/`        |
| "Planör Nasıl Uçar?" (14 Kasım 2026) | Nasıl çalışır | 66 sn | On sahne, hepsi hareketli çizim; yazı yalnızca etiket ve üç sayı | `.claude/skills/anlatim-videosu/ornek/planor/` |

| "Planör Nasıl Uçar?" ozalit sürümü (14 Kasım 2026) | Nasıl çalışır | 49 sn | Stil yolu, Blueprint görünümü: dokuz şekil, canlı ölçüler, not kutusu altyazı | `.claude/skills/anlatim-videosu/ornek/planor-stil/` |

Üçü de 1080×1920, `edge-tts` ile Türkçe ses, kodla üretilen ses efektleri ve gömülü Türkçe altyazı. Skia yolunda yeni filme ikinci örnekten, stil yolunda üçüncü örnekten başlanır.

Denemelerde çıkanlar skill'e işlendi: motorun kendi altyazı gömme adımı dikey videoda çok küçük kalıyor, bu yüzden altyazı SRT olarak alınıp ffmpeg ile gömülüyor; uzun altyazı parçaları çizimin üstüne taştığı için SRT kısa parçalarla üretiliyor (`scripts/kisa_srt.py`); çizimler karenin üst üçte ikisinde, altyazı bandının üstünde tutuluyor. Çizim kalıpları, güvenli alan ölçüleri ve yaşanan hatalar skill'in "Çizimle anlatım" bölümünde.

Bilinen sınırlar: stil yolunda müzik ve kalem/kâğıt sesi yok, `animated-explainer` stili tam render ile denenmedi, yalnızca bir görünüm (Blueprint) üretildi; skia yolunda stil düz 2B şemadır (3B ya da gerçekçi görüntü yok); konu önerisi adımı henüz gerçek bir istekle denenmedi; fotoğraf ve haritalı bir olay filmi henüz üretilmedi; Windows'ta denenmedi.
