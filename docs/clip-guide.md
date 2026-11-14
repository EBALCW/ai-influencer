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

Büyük yayıncıların çoğunun klip programı ya da yayımlanmış klip kuralları vardır (resmî duyuru, Discord, klip kampanyası sayfası). Bu geçerli bir izindir: kuralları oku, ekran görüntüsünü kısıtlı depoya koy, referansı oradan ver. Yayımlanmış bir kural yoksa doğrudan izin iste.

İzin isterken netleştirilecekler: hangi videolar/kanal, hangi platformlarda yayın, gelir paylaşımı ya da sponsorlu kullanım var mı, kaynak nasıl belirtilecek, izin ne zamana kadar geçerli ve nasıl geri alınır.

## Gereksinimler

| Araç                 | Ne için                  | macOS                      | Windows                        |
| -------------------- | ------------------------ | -------------------------- | ------------------------------ |
| `yt-dlp`             | Video ve altyazı indirme | `brew install yt-dlp`      | `winget install yt-dlp.yt-dlp` |
| `ffmpeg` + `ffprobe` | Kesme, dikeye çevirme    | `brew install ffmpeg`      | `winget install Gyan.FFmpeg`   |
| libass'lı `ffmpeg`   | Altyazı gömme (`--subs`) | `brew install ffmpeg-full` | Gyan.FFmpeg "full" sürümü      |

Komutlar bu araçları kendisi kurmaz; eksikse ne kurulacağını söyler. macOS'ta `ffmpeg-full` kuruluysa komut onu kendiliğinden bulur. Başka bir kurulum için `FFMPEG_PATH` ortam değişkenine ffmpeg yolunu yaz.

## Akış

### Tek adım (önerilen başlangıç)

```
pnpm clip:auto "https://www.youtube.com/watch?v=<id>" --permission "<izin referansı>"
```

İndirir, en güçlü anları bulur ve hepsini `~/ai-influencer-clips/<id>/clips/` altına keser. Dosyalar puana göre sıralıdır (`01-…` en güçlü); `clips.json` her klibin aralığını, puanını ve transkriptini tutar. Hepsini izleyip yayınlanacakları seçersin.

- Klip sayısı yayın süresine göre seçilir: 10 dakikaya bir klip, en az 3, en çok 15. Elle vermek için `--count 8`.
- Kaynakta altyazı varsa kliplere gömülür; istemiyorsan `--no-subs`.
- **Türkçe altyazı:** kaynak başka dildeyse `--translate tr` ekle. İlk çalıştırmada klipler kesilmez; her klibin metni `clips/altyazi/<ad>.srt` olarak ayrılır. Çevirisini aynı klasöre `<ad>.tr.srt` adıyla koyup aynı komutu yeniden çalıştırınca klipler Türkçe altyazıyla kesilir. Çeviride satır numaraları ve zamanlar aynı kalır, yalnız metin değişir. YouTube'un otomatik Türkçe çevirisi çoğu zaman istek sınırına takıldığı için kullanılmıyor.
- `--permission` yerine açık lisanslı kaynakta `--open-license "<lisans>"`, kendi çekiminde `--own`. Biri verilmeden indirme de başlamaz.
- Yarıda kesilirse aynı komut kaldığı yerden sürer: inen video yeniden inmez, kesilmiş klip atlanır.
- Ölçüm (MacBook Air M4): 36 dakikalık videodan 4 altyazılı klip, indirme dahil yaklaşık 2,5 dakika.

Aralığı, kadrajı ya da tek tek klipleri elle yönetmek için aşağıdaki adımları ayrı ayrı kullan.

### 1. İndir

```
pnpm clip:fetch "https://www.youtube.com/watch?v=<id>"
```

`~/ai-influencer-clips/<id>/` klasörüne şunlar yazılır: video (`<id>.mp4`, en çok 1080p), altyazılar (`<id>.<dil>.vtt`), zaman damgalı transkript (`<id>.<dil>.transcript.txt`) ve `source.json` (başlık, kanal, süre, lisans). Varsa "en çok tekrar izlenen yerler" verisi de `heatmap.json` olarak kaydedilir. Seçenekler: `--chat` (canlı yayının sohbet tekrarını da indirir), `--lang tr,en` (altyazı dilleri), `--no-video` (yalnız transkript), `--out <klasör>` (repo dışında olmalı).

### 2. En çok izlenecek anları bul

```
pnpm clip:moments ~/ai-influencer-clips/<id> --top 15 --length 40
```

Komut üç sinyali birleştirip yayının en güçlü anlarını sıralar ve `moments.json` yazar:

| Sinyal         | Kaynak                                                              | Not                                                                       |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Tekrar izlenme | YouTube "most replayed" ısı haritası                                | En güçlü kanıt. Yeni ya da az izlenmiş videoda bulunmaz.                  |
| Sohbet         | Sohbet tekrarında mesaj hızı; gülme/şaşırma tepkileri 3 kat sayılır | `clip:fetch … --chat` ile indirilir. Yalnız canlı yayın kayıtlarında var. |
| Ses            | Saniyelik ses düzeyi (bağırma, kahkaha)                             | Tek başına zayıf: müzik ve oyun sesi de sıçratır.                         |

Eksik sinyal olursa komut kalanlarla devam eder. Seçenekler: `--top` (kaç an), `--length` (önerilen klip süresi, sn), `--skip-start` (yayın girişinde atlanacak süre, varsayılan 60 sn), `--no-audio`.

Liste aday listesidir. Son kararı transkripti okuyup anı izleyerek ver. İzlenme getiren klip: ilk 2 saniyede kanca verir, yayını izlemeyen biri için de anlaşılırdır, tek olay ve net bir vuruş taşır, yüksek duygu içerir (kahkaha, panik, şok, beklenmedik hata) ve 15-45 saniyedir. Gündem anlarında (ör. büyük bir oyunun çıkış günü) hız belirleyicidir: aynı anı birçok hesap keser, ilk çıkan kazanır. Kanca ölçütleri için `docs/publishing-rules.md`. Arkada telifli müzik çalan bölümleri alma: yayıncı izin verse bile müziğin hakkı ona ait değildir.

Şimdilik yalnız YouTube destekleniyor. Twitch ve Kick kayıtları için yayıncının YouTube'a yüklediği kaydı kullan.

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
