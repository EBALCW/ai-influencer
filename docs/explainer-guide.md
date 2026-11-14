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

Bilinen sınırlar: stil yolunda müzik ve kalem/kâğıt sesi yok, `animated-explainer` stili tam render ile denenmedi, yalnızca bir görünüm (Blueprint) üretildi; skia yolunda stil düz 2B şemadır (3B ya da gerçekçi görüntü yok); konu önerisi adımı henüz gerçek bir istekle denenmedi; fotoğraf ve haritalı bir olay filmi henüz üretilmedi; Windows'ta denenmedi.
