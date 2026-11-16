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

Henüz panelde olmayanlar: yapay zekâ ile öneri ve senaryo taslağı (#217, #218), video inceleme ekranı (#205), dışa aktarma ve yayın (#234).

## Panelden üretim: makine ne yapar

"Üretime gönder" bir `explainer.render` işi açar. Çevrimiçi bir üretim makinesi (`pnpm worker:start`; kurulum `docs/SETUP.md` → "Üretim makinesi programı") işi alır ve dört aşamayı **o bilgisayarda** yürütür. Makine senaryoyu işin dondurulduğu sürümden (`episode_script_versions`) okur; onaylı olmayan ya da işle aynı sürüm olmayan senaryoyu üretmez. Kod: `apps/worker/src/handlers/explainer/`.

| Aşama       | Ne yapar                                                                                                                                                                                                                                             | İşe bağlanan çıktı                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Seslendirme | Senaryoyu vuruşlara böler, her vuruşu `edge-tts` ile kaydeder (ses adı, hız ve dil işe dondurulan ayarlardan), kelime zamanlarını alır, kayıtları tek seste birleştirir                                                                              | `narration.m4a`, `timing.json` (her kelimenin başı ve sonu) |
| Altyazı     | Kelime zamanlarından altyazı parçaları: parça en çok iki satır; `satır` modunda parça parça, `kelime` modunda kelime kelime                                                                                                                          | `captions.srt`, `captions.ass`                              |
| Görseller   | Şablondan HyperFrames çalışma klasörünü kurar, denetler (`hyperframes lint`), birkaç andan durağan kare alır                                                                                                                                         | `onizleme-01.jpg` … (ilk kare, vuruş ortaları, kapanış)     |
| Render      | 1080×1920, 30 fps render; ses efektleri + ses miksi (−14 LUFS) + birleştirme; denetim (süre anlatımla aynı mı, görüntü ve ses akışı var mı, ses yüksekliği hedefte mi, siyah kare var mı); dosyayı yükleme sınırına sığdırır; **video onayı bekler** | `final.mp4`, `captions.srt`                                 |

Altyazı videonun içindedir (kompozisyonda çizilir); SRT ve ASS dosyaları yayın platformuna yüklemek ya da elle düzenlemek içindir. Makine bu yolda şu yetenekleri bildirmiş olmalıdır: `kind:explainer.render`, `voice.edge-tts`, `render.hyperframes` (`pnpm worker:doctor` gösterir). Bugün yalnız **"Stil paketi (HyperFrames)"** görsel yolu üretilir; diğer yollar seçiliyse panel "üretim aşaması henüz yok" der.

İş bittiğinde bölüm "Video inceleme bekliyor" olur; videoyu izleyip onaylarsınız. İptal edilen işte süren araç hemen durdurulur. İnternet kesilirse (ses servisi) iş kuyruğa döner ve yeniden denenir; girdiye bağlı hatalar (çok uzun senaryo, desteklenmeyen ses sağlayıcı, denetimden geçmeyen video) yeniden denenmez ve nedeni iş kartında yazar.

### Şablon: ne çizer, ne çizmez

`ornek/planor-stil` filmindeki sahneler o senaryo için elle (bir AI agent'ıyla) yazıldı. Makinede yapay zekâ yoktur; bu yüzden panel üretimi **veriye dayalı bir şablon** kullanır: aynı ozalit (Blueprint) görünümü ve aynı çizim motoru (`assets/bp.js`), ama sahneler senaryodan türetilen birkaç parametreli kart türüyle kurulur. Şablon olgu ya da çizim **uydurmaz**: ekrana yalnız onaylı senaryo paketindeki ve işe dondurulan ayarlardaki bilgi çıkar.

| Ekranda                 | Nereden gelir                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Başlık kartı (ilk kare) | Seri adı + "Bölüm N" + bölüm başlığı (tekil videoda tür etiketi)                                                 |
| Kinetik yazı            | Vuruşun cümlesi, sesle eşzamanlı yazılır (sayılar okunaklı olsun diye tek aralıklı yazı tipiyle)                 |
| İfade / sayı / akış     | Yalnız yapılandırılmış senaryo verdiyse (aşağıdaki şema); bu vuruşlarda anlatım alttaki not kutusunda altyazıdır |
| Kaynak kartı (kapanış)  | Kaynak notlarındaki kaynak adları (en çok 6) + "sentetik ses" ve "kodla üretildi" notu; 3,4 sn                   |
| Pafta mobilyası         | Tür etiketi, şekil numarası, ilerleme cetveli, antet (proje, seri, bölüm, ses: sentetik, kaynaklar)              |

Sınırları (dürüstçe): şablon, elle yazılmış örnek filmden **görsel olarak belirgin biçimde sadedir**. Konuya özgü çizim (planör, kanat kesiti, termik sütunu) yoktur; düz metinli bölüm bir "hareketli yazı + pafta" videosudur. Tek stil vardır (`blueprint`; seride başka bir stil anahtarı varsa yine bununla çizilir ve aşama çıktısında not düşülür), müzik yoktur, tek anlatıcı vardır. Süre sınırı yaklaşık 170 sn (400 kelime, 60 vuruş); yüklenebilen video 5 MB ile sınırlı olduğu için uzun videolar daha düşük bit hızıyla yeniden kodlanır (büyük dosya yüklemesi #215).

### Yapılandırılmış senaryo (isteğe bağlı)

Bölümün `script` alanı (panelde "yapılandırılmış senaryo") boşsa şablon düz metinle çalışır: boş satır vuruşu böler, kısa cümleler aynı vuruşta toplanır, cümle ortasından bölünmez. Aşağıdaki biçim verilirse vuruşları ve kartları siz belirlersiniz:

```json
{
  "version": 1,
  "beats": [
    {
      "text": "Planörün motoru yok. Yine de saatlerce havada kalır.",
      "card": {
        "type": "phrase",
        "text": "MOTOR YOK",
        "note": "yine de saatlerce havada"
      }
    },
    {
      "text": "Önce bir uçak ya da vinç, onu halatla havaya çeker.",
      "heading": "Kalkış",
      "card": {
        "type": "steps",
        "title": "Kalkış",
        "items": ["Uçak ya da vinç çeker", "Halat bırakılır"]
      }
    },
    {
      "text": "Modern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.",
      "card": {
        "type": "number",
        "value": "40-50",
        "unit": "km ileri",
        "label": "1.000 metre alçalırken"
      }
    }
  ],
  "spoken": { "NASA": "nasa" }
}
```

| Alan              | Kural                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `beats[].text`    | Anlatıcının söylediği metin (1–600 karakter). Hepsi birleşince **onaylı anlatıcı metniyle aynı** olmalı (boşluk farkı sayılmaz); 1–60 vuruş |
| `beats[].heading` | Şekil başlığı (en çok 40 karakter); yoksa bölüm başlığı                                                                                     |
| `card: phrase`    | `text` (60), isteğe bağlı `note` (80)                                                                                                       |
| `card: number`    | `value` (16), isteğe bağlı `unit` (24) ve `label` (60)                                                                                      |
| `card: steps`     | 2–4 `items` (her biri 40), isteğe bağlı `title` (40): oklarla bağlı numaralı kutular                                                        |
| `spoken`          | Yalnız sese giden okunuş (`kelime → okunuş`). Türkçe sayılar kendiliğinden okunuşa çevrilir ("3.000" → "üç bin", "%40" → "yüzde kırk")      |

Bilinmeyen alan ya da kart türü, biçimi geçersiz kılar. Biçim tanınmazsa ya da vuruş metinleri onaylı metinle uyuşmazsa **yapılandırma yok sayılır** ve video düz metinle üretilir (aşama çıktısında `structured: "ignored"` yazar): seslendirilen metin her zaman insanın okuyup onayladığı metindir. Film motorunun `script.json` biçimi (`takes[].lines[]`) de okunur: `text` vuruş, `typed` ifade kartı olur; `hero` (çizim tarifi) şablonda çizilemediği için kullanılmaz.

Genişletme noktası: kart türleri `apps/worker/src/handlers/explainer/script.ts` içindeki `cardSchema` ile `template/sablon.js` içindeki `CARDS` tablosudur. İleride bir yapay zekâ adımı (#204, MCP) bölüme özgü daha zengin sahne tarifleri üretirse aynı `script` alanından yeni kart türleri olarak girer; şablonun geri kalanı değişmez.

### Çalışma klasörü ve temizlik

Makine her iş için repo dışında geçici bir klasör açar: macOS `~/Library/Caches/ai-influencer-worker/<iş>/`, Windows `%LOCALAPPDATA%\ai-influencer-worker\work\<iş>\`, Linux `~/.cache/ai-influencer-worker/<iş>/` (`WORKER_WORK_DIR` ile değiştirilir). İş makineden ayrılınca (bitti, onay bekliyor, iptal, hata) klasör silinir. Hata olursa küçük tanılama dosyaları (plan, zamanlama, kompozisyon, altyazı; video ve ses hariç, en çok 20 MB) `_hatali/<iş>/` altında kalır; son beş iş tutulur. Senaryo metni bu klasörde durur, veritabanındaki hata mesajına ya da aşama çıktısına yazılmaz.

### Panelsiz deneme

```
pnpm worker:produce-local apps/worker/examples/planor.json --out ~/ai-influencer-films/panel-ornek/out
```

Aynı dört aşamayı kuyruk ve oturum olmadan çalıştırır (Supabase'e bağlanmaz; yalnız `edge-tts` için internet ister) ve çıktıları klasöre yazar. Girdi, panelin işe dondurduğu verinin aynısıdır: `{ "params": …, "script_version": … }`. `planor.json` düz metinli, `planor-kartli.json` kartlı ve kelime kelime altyazılı örnektir.

## İki çizim yolu

| Yol                                              | Görünüm                                                                     | Ne zaman                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Skia (`cinematic-film`)                          | Düz dolgulu renkli 2B şema                                                  | Renkle anlam taşıyan şemalar, fotoğraf ve haritalı olay filmleri           |
| Stil (`film-styles` + `edit-video`, HyperFrames) | 99 hazır görünümden biri: ozalit, beyaz tahta, kesit çizimi, eskiz defteri… | Belirgin görsel kimlik, seri formatı, kelimeye kilitli çizim ve ses efekti |

Stil yolu açık kaynak `alisadiq-ai/favstash-ai-video-editing-skills` paketinden alınan beş skill ile çalışır (Apache-2.0; ne alındı, ne değişti: `.claude/skills/edit-video/KAYNAK.md`). Paketin FavStash servisine bağlanan yayın ve analitik kısmı alınmadı; yayın panelden yapılır. Paketten gelen iki yöntem akışa işlendi: konu önerisinde "kanıtlı = örnek videonun izlenmesi kendi kanalının medyanının en az 3 katı" ölçüsü, senaryoda ilk beş saniyelik kanca ve ara kancalar. Türkçe ses yine `edge-tts` iledir. Komutlar ve tuzaklar skill'in 8. bölümünde.

Stil yolunun bir kez yapılan kurulumu: Node 22+ ve `node .claude/skills/edit-video/scripts/init-workspace.mjs --workspace ~/ai-influencer-films --install` (HyperFrames 0.8.32 + GSAP, ~410 MB, repo dışında; render için makinedeki Google Chrome kullanılır).

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

Panel üretimi (15 Kasım 2026): aynı planör senaryosu `pnpm worker:produce-local` ile şablondan üretildi (43 sn düz metin, 45 sn kartlı; 1080×1920, ~4,3 MB). Panelden gerçek bir işle (giriş yapılmış makine + üretime gönderilen bölüm) henüz denenmedi; aşama akışı CI'da yerel Supabase'e karşı sahte araçlarla doğrulanıyor.

Bilinen sınırlar: stil yolunda müzik ve kalem/kâğıt sesi yok, `animated-explainer` stili tam render ile denenmedi, yalnızca bir görünüm (Blueprint) üretildi; skia yolunda stil düz 2B şemadır (3B ya da gerçekçi görüntü yok); konu önerisi adımı henüz gerçek bir istekle denenmedi; fotoğraf ve haritalı bir olay filmi henüz üretilmedi; Windows'ta denenmedi.
