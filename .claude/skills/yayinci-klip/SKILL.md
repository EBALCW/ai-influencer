---
name: yayinci-klip
description: Bir yayıncının (streamer) YouTube videosundan Reels / Shorts / TikTok için kısa dikey klip çıkarır - indir, transkripti oku, öne çıkan anları öner, kes, altyazı göm, panele kaydet. "Şu yayından klip çıkar", "bu videodan shorts yap", "yayıncı klibi", "clip al", bir YouTube adresi ile birlikte "kes / klip / kısa video" dendiğinde kullan.
---

# Yayıncı klibi

Uzun bir YouTube videosundan 15-60 saniyelik dikey klipler üretir. Komutlar repoda hazır
(`scripts/clip/`); senin işin doğru anları seçmek ve kuralları uygulatmak. İnsanlar için
rehber: `docs/clip-guide.md`.

## 0. Önce izin (atlanamaz)

`docs/compliance.md` → "Kaynak içerik": başkasının videosu **yalnızca hak sahibinin yazılı
izniyle** kullanılır. Kesmeden önce kullanıcıya sor ve üç durumdan birini netleştir:

| Durum                                     | `clip:cut` seçeneği                               |
| ----------------------------------------- | ------------------------------------------------- |
| Yayıncıdan yazılı izin var                | `--permission "<kısıtlı depodaki kısa referans>"` |
| Video açık lisanslı (ör. CC BY)           | `--open-license "<lisans adı>"`                   |
| Video bizim (kendi kanalımız / çekimimiz) | `--own`                                           |

- İzin yoksa **kesme**. İndirip transkript üzerinden klip adaylarını önermek serbest; kesim
  izin gelince yapılır. Kullanıcıya izin isteği için kısa bir mesaj taslağı önerebilirsin.
- "Adil kullanım", "nasılsa herkes yapıyor", "kaynak belirtirim" izin değildir.
- İzin referansı kısa bir addır (ör. `IZIN-2026-014`). Yazışma, e-posta adresi, kişi adı
  repoya, panele veya sohbete yazılmaz.
- `clip:fetch` çıktısındaki `source.json` → `license` alanı "Creative Commons" diyorsa açık
  lisans yolu kullanılabilir; "Standard YouTube License" ise izin gerekir.

## 1. İndir

```
pnpm clip:fetch "<youtube-adresi>"            # video + altyazı + transkript
pnpm clip:fetch "<youtube-adresi>" --no-video # sadece transkript (hızlı ön inceleme)
```

Çıktı `~/ai-influencer-clips/<video-id>/` altına yazılır (repo dışı; repoya video girmez):
`<id>.mp4`, `<id>.<dil>.vtt`, `<id>.<dil>.transcript.txt`, `source.json`.
Varsayılan diller `tr,en`; başka dil için `--lang de,en`. Araç eksikse komut nasıl kurulacağını söyler.

## 2. Klip anlarını seç

`*.transcript.txt` dosyasının **tamamını** oku (satır başları `[dk:sn]`). 3-8 aday çıkar.

İyi klip:

- **İlk 2 saniyede kanca:** soru, iddia, şaşırma, kahkaha, "dur bir dakika" anı. Girişi
  olmayan cümlenin ortasından başlama.
- **Kendi başına anlaşılır:** öncesini izlemeyen biri de anlar. "Az önce dediğim gibi"
  ile başlayan yerleri alma.
- **Tek fikir, net son:** espri vuruşu, cevap ya da tepki ile biter; cümle yarım kalmaz.
- **15-60 saniye** (araç sınırı 5-180). Şüphedeysen kısa tut.
- Başlangıcı konuşmanın başladığı satırdan 0,5 sn önce, bitişi son kelimeden 0,5 sn sonra al.

Alma: üçüncü kişilerin özel bilgileri, hakaret/nefret, reşit olmayanlar, arkada telifli
müzik çalan bölümler (Content ID), yayıncıyı bağlamından koparıp kötü gösteren kesitler.

Adayları tabloyla sun ve kullanıcıya seçtir:

| #   | Aralık | Süre | Kanca (ilk cümle) | Neden tutar |
| --- | ------ | ---- | ----------------- | ----------- |

Altyazı yoksa transkript de yoktur: kullanıcıdan zaman aralıklarını iste ya da videodan
kareler çıkarıp (`ffmpeg -ss <sn> -i <video> -frames:v 1 kare.png`) bölümleri tanı.

## 3. Kes

```
pnpm clip:cut "<video.mp4>" --start 12:30 --end 13:05 \
  --out ~/ai-influencer-clips/<video-id>/klip-01.mp4 \
  --permission "<izin referansı>" \
  --subs "<video-id>.tr.vtt"
```

- `--layout blur` (varsayılan): videonun tamamı ortada, arkası bulanık. Oyun/ekran yayını
  ve birden çok kişi için güvenli seçim.
- `--layout crop`: ekranı dolduran 9:16 kırpma. Tek kişi kadrajdaysa kullan;
  kişi ortada değilse `--x-offset -1..1` ile kaydır (‑1 sol, 1 sağ).
- `--subs`: o aralığın altyazısını gömer. libass'lı ffmpeg ister; komut yoksa söyler
  (macOS: `brew install ffmpeg-full`, komut onu kendisi bulur).
- Çıktı: 1080×1920, 30 fps, H.264 + AAC. Var olan dosyanın üzerine yazılmaz; yeni sürüm
  için yeni ad ver (`klip-01-v2.mp4`).
- Her klibin yanına `klip-01.json` yazılır (aralık, kaynak, izin referansı).

## 4. Kontrol et

Göstermeden önce kendin bak:

```
ffmpeg -v error -ss 1 -i klip-01.mp4 -frames:v 1 kare.png   # sonra kare.png'yi oku
ffprobe -v error -show_entries format=duration -of csv=p=0 klip-01.mp4
```

Yüz/ana konu kadrajda mı, altyazı okunuyor ve taşmıyor mu, ilk saniye boş mu, ses var mı.
Otomatik altyazıda yanlış yazılmış kelime varsa VTT'yi düzeltip yeniden kes.

## 5. Kaydet ve yayına hazırla

- Panel → **Klipler** (`/clips`): kaynağı (video, kanal, izin durumu + referans) ve klibi
  (aralık, başlık, kanca) gir; "Backlog'a aktar" ile içerik kartı oluşur. İzin "verildi"
  değilse panel aktarmaz.
- Caption'da kaynağı belirt: `Kaynak: <kanal adı> (YouTube)`. Caption ve hashtag kuralları:
  `docs/caption-guide.md`. Yayın öncesi kontrol: `docs/publishing-rules.md`.
- Video dosyasını repoya, issue'ya veya PR'a ekleme.

## Kaynak

Akış `op7418/Youtube-clipper-skill` (MIT, commit `f31f077`) üzerinden uyarlandı: proje
kurallarına göre Türkçeleştirildi, dikey çıktı ve izin adımı eklendi, Python script'leri
yerine repodaki Node komutları kullanılıyor. Kesim kuralları (ses geçişi, altyazının filtre
zincirinin sonunda olması) `browser-use/video-use` (MIT) notlarından.
