# Anlatım videoları rehberi

Üçüncü içerik türümüz: bir olayı ya da konuyu görselleştirip seslendirme ve altyazıyla anlatan kısa dikey videolar. Örnek: bir mağara dalışı kazasının nasıl geliştiğini harita, kesit çizimi, zaman çizelgesi ve sayılarla anlatan 60 saniyelik film. Yüz gösterilmez, AI influencer karakteri gerekmez.

AI agent'ları için akış `.claude/skills/anlatim-videosu/SKILL.md` içinde. Film motoru `.claude/skills/cinematic-film/` (dışarıdan alındı: `Moh4696/cinematic-skill`, MIT; ayrıntı o klasördeki `KAYNAK.md`).

## Nasıl çalışır

1. **Araştırma ve senaryo.** Konu araştırılır, her olgu kaynağıyla not edilir. 45-90 saniyelik senaryo yazılır (110-230 kelime). İlk cümle kancadır.
2. **Onay.** Senaryo ve olgular bir ekip üyesince onaylanır. Onaysız üretime geçilmez.
3. **Seslendirme.** Ücretsiz `edge-tts` ile Türkçe ses (`tr-TR-AhmetNeural` ya da `tr-TR-EmelNeural`). Film sese göre zamanlanır.
4. **Görsel.** Fotoğraflar, belgeler, haritalar, kartlar ve sayılar tek bir pano üzerine dizilir; kamera anlatıcıyla birlikte aralarında gezer. Tamamı kodla çizilir (Python + Skia), ücretli servis gerekmez.
5. **Ses ve altyazı.** Ses efektleri kodla üretilir, altyazı videoya gömülür.
6. **Çıktı.** 1080×1920 MP4, yanında kaynak listesi ve görsel künyesi (`credits.md`).

Agent'tan istemek için: "Şu olayı anlatan 60 saniyelik anlatım videosu yap: …" demek yeterli.

## Kurallar

| Kural                  | Açıklama                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| İki kaynak             | Her olgu en az iki bağımsız kaynaktan doğrulanır, biri birincil (resmî rapor, kurum açıklaması, hakemli yayın).                   |
| Uydurma yok            | Kaynaklar çelişiyorsa çelişki anlatılır ya da ayrıntı çıkarılır. Emin olunmayan şey "rapora göre" diye söylenir.                  |
| Hassas konular         | Kaza, ölüm, suç: saygılı dil, yakınların mahremiyeti, sömürü başlığı yok, yaralanma/ceset görüntüsü yok.                          |
| Lisanslı görsel        | Gerçek fotoğraf yalnız lisansı uygun kaynaktan (Wikimedia Commons, kamu malı arşivler). Haber sitesi ve sosyal medya görseli yok. |
| AI görseli kanıt değil | AI ile üretilen görsel gerçek olayın ya da kişinin görüntüsüymüş gibi sunulmaz; illüstrasyon olarak etiketlenir.                  |
| AI etiketi             | Yayında platformun AI içerik etiketi `docs/compliance.md` kurallarına göre işaretlenir.                                           |

## Gereksinimler

| Araç                             | Kurulum                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| Python 3.9+                      | macOS: `brew install python` · Windows: `winget install Python.Python.3.12` |
| `ffmpeg` + `ffprobe`             | macOS: `brew install ffmpeg` · Windows: `winget install Gyan.FFmpeg`        |
| Python paketleri (sanal ortamda) | `pip install -r .claude/skills/cinematic-film/requirements.txt edge-tts`    |

Proje dosyaları (ses, görsel, video) repo dışında `~/ai-influencer-films/<ad>/` altında tutulur.

## Durum

Akış bu projede uçtan uca denendi (13 Kasım 2026, macOS): "Mağarada 17 Gün" (2018 Tham Luang mağara kurtarması), 46 saniye, 1080×1920, `edge-tts` ile Türkçe ses, kodla üretilen ses efektleri, gömülü Türkçe altyazı. Senaryo ve sahne dosyası örnek olarak `.claude/skills/anlatim-videosu/ornek/` içinde.

Denemede çıkanlar skill'e işlendi: motorun kendi altyazı gömme adımı dikey videoda çok küçük kalıyor, bu yüzden altyazı SRT olarak alınıp ffmpeg ile gömülüyor; dikey karede genişlik dar olduğu için pano tek sütun kuruluyor. Windows'ta henüz denenmedi. İlk örnek yalnızca kart ve sayılardan oluşuyor; fotoğraf ve haritalı bir film henüz üretilmedi.
