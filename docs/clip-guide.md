# Yayıncı klipleri rehberi

Panel yalnızca AI influencer içeriği için değil: yayıncıların (streamer) YouTube videolarından Reels, Shorts ve TikTok için kısa dikey klip de çıkarabiliyoruz. Bu rehber akışı, komutları ve kuralları anlatır. AI agent'ları için aynı akış `.claude/skills/yayinci-klip/SKILL.md` içinde.

## Önce izin

`docs/compliance.md` → "Kaynak içerik" geçerlidir. Başkasının videosundan klip, **yalnızca hak sahibinin yazılı izniyle** yayınlanır. Üç geçerli durum var:

| Durum                             | Kaynak türü    | Kesim seçeneği                               |
| --------------------------------- | -------------- | -------------------------------------------- |
| Yayıncıdan yazılı izin            | `third_party`  | `--permission "<kısıtlı depodaki referans>"` |
| Açık lisans (ör. CC BY)           | `open_license` | `--open-license "<lisans adı>"`              |
| Kendi kanalımız / kendi çekimimiz | `own`          | `--own`                                      |

İzin yazışması, e-posta ve kişi adı repoya ya da panele yazılmaz. Bunlar ekibin erişimi kısıtlı deposunda durur; komuta ve panele yalnızca kısa referans (ör. `IZIN-2026-014`) girilir. Komut, bu üç seçenekten biri verilmeden kesim yapmaz.

İzin isterken netleştirilecekler: hangi videolar/kanal, hangi platformlarda yayın, gelir paylaşımı ya da sponsorlu kullanım var mı, kaynak nasıl belirtilecek, izin ne zamana kadar geçerli ve nasıl geri alınır.

## Gereksinimler

| Araç                 | Ne için                  | macOS                      | Windows                        |
| -------------------- | ------------------------ | -------------------------- | ------------------------------ |
| `yt-dlp`             | Video ve altyazı indirme | `brew install yt-dlp`      | `winget install yt-dlp.yt-dlp` |
| `ffmpeg` + `ffprobe` | Kesme, dikeye çevirme    | `brew install ffmpeg`      | `winget install Gyan.FFmpeg`   |
| libass'lı `ffmpeg`   | Altyazı gömme (`--subs`) | `brew install ffmpeg-full` | Gyan.FFmpeg "full" sürümü      |

Komutlar bu araçları kendisi kurmaz; eksikse ne kurulacağını söyler. macOS'ta `ffmpeg-full` kuruluysa komut onu kendiliğinden bulur. Başka bir kurulum için `FFMPEG_PATH` ortam değişkenine ffmpeg yolunu yaz.

## Akış

### 1. İndir

```
pnpm clip:fetch "https://www.youtube.com/watch?v=<id>"
```

`~/ai-influencer-clips/<id>/` klasörüne şunlar yazılır: video (`<id>.mp4`, en çok 1080p), altyazılar (`<id>.<dil>.vtt`), zaman damgalı transkript (`<id>.<dil>.transcript.txt`) ve `source.json` (başlık, kanal, süre, lisans). Seçenekler: `--lang tr,en` (altyazı dilleri), `--no-video` (yalnız transkript), `--out <klasör>` (repo dışında olmalı).

### 2. Klip anlarını seç

Transkripti okuyup 15-60 saniyelik anları işaretle. İyi klip ilk 2 saniyede kanca verir, kendi başına anlaşılır, tek fikir taşır ve net biter. Kanca ölçütleri için `docs/publishing-rules.md`. Arkada telifli müzik çalan bölümleri alma: yayıncı izin verse bile müziğin hakkı ona ait değildir.

### 3. Kes

```
pnpm clip:cut "<video.mp4>" --start 12:30 --end 13:05 --out "<klip.mp4>" --permission "IZIN-2026-014" --subs "<id>.tr.vtt"
```

| Seçenek                 | Açıklama                                                                  |
| ----------------------- | ------------------------------------------------------------------------- |
| `--start`, `--end`      | `75`, `1:15` ya da `1:02:03`. Klip 5-180 saniye olmalı.                   |
| `--layout blur`         | Varsayılan. Videonun tamamı ortada, arkası bulanık.                       |
| `--layout crop`         | 9:16 kırpıp ekranı doldurur. `--x-offset -1..1` ile sola/sağa kaydırılır. |
| `--subs <vtt veya srt>` | O aralığın altyazısını gömer.                                             |

Çıktı 1080×1920, 30 fps, H.264 + AAC'dir ve repo dışına yazılır. Var olan dosyanın üzerine yazılmaz. Klibin yanına aynı adla bir `.json` dosyası (aralık, kaynak, izin referansı) bırakılır.

### 4. Panele kaydet ve yayınla

Panelde **Klipler** (`/clips`) sayfasına kaynağı ve klibi gir, "Backlog'a aktar" ile içerik kartına çevir. Kartta kaynak türü, sahibi ve izin referansı dolu gelir. Caption'da kaynağı belirt (`Kaynak: <kanal adı> (YouTube)`). Yayın öncesi kontrol listesi diğer içeriklerle aynıdır (`docs/publishing-rules.md`, `docs/qc-checklist.md`).

## Sık sorunlar

- **"Bu ffmpeg altyazı gömemiyor":** libass'lı ffmpeg kur (yukarıdaki tablo) ya da `--subs` olmadan kes.
- **Altyazı bulunamadı:** videoda o dilde altyazı yok. `--lang` ile başka dil dene; yoksa aralıkları videoyu izleyerek belirle.
- **İndirme başarısız:** `yt-dlp` eskidiyse güncelle (`brew upgrade yt-dlp` / `winget upgrade yt-dlp.yt-dlp`). Üyelere özel ve yaş kısıtlı videolar indirilemez; bunları aşmaya çalışma.
- **Şikâyet ya da ihtar geldi:** `docs/compliance.md` → "İhtar ve şikâyet prosedürü".
