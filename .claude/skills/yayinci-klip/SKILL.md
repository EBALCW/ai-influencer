---
name: yayinci-klip
description: Bir yayıncının (streamer) YouTube videosundan Reels / Shorts / TikTok için kısa dikey klip çıkarır - indir, en çok izlenecek anları veriyle bul (tekrar izlenme, sohbet patlaması, ses), kes, altyazı göm, panele kaydet. "Şu yayından klip çıkar", "bu videodan shorts yap", "yayıncı klibi", "clip al", bir YouTube adresi ile birlikte "kes / klip / kısa video" dendiğinde kullan.
---

# Yayıncı klibi

Uzun bir YouTube yayınından en komik, en çok izlenecek anları bulup 15-60 saniyelik dikey
kliplere çevirir. Komutlar repoda hazır
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

- Büyük yayıncıların çoğunun **klip programı ya da yayımlanmış klip kuralları** vardır (resmî
  duyuru, Discord, klip kampanyası sayfası). Bu geçerli bir izindir: kuralları oku (kaynak
  belirtme, süre, gelir paylaşımı, yasak içerik), ekran görüntüsünü kısıtlı depoya koy ve
  referansı oradan ver. Kural bulamadıysan izin yok say.
- İzin yoksa **kesme**. İndirip transkript üzerinden klip adaylarını önermek serbest; kesim
  izin gelince yapılır. Kullanıcıya izin isteği için kısa bir mesaj taslağı önerebilirsin.
- "Adil kullanım", "nasılsa herkes yapıyor", "kaynak belirtirim" izin değildir.
- İzin referansı kısa bir addır (ör. `IZIN-2026-014`). Yazışma, e-posta adresi, kişi adı
  repoya, panele veya sohbete yazılmaz.
- `clip:fetch` çıktısındaki `source.json` → `license` alanı "Creative Commons" diyorsa açık
  lisans yolu kullanılabilir; "Standard YouTube License" ise izin gerekir.

## 1. İndir

```
pnpm clip:fetch "<youtube-adresi>" --chat     # video + altyazı + transkript + ısı haritası + sohbet tekrarı
pnpm clip:fetch "<youtube-adresi>" --no-video --chat   # hızlı ön inceleme (ses sinyali olmaz)
```

Çıktı `~/ai-influencer-clips/<video-id>/` altına yazılır (repo dışı; repoya video girmez):
`<id>.mp4`, `<id>.<dil>.vtt`, `<id>.<dil>.transcript.txt`, `source.json`, varsa `heatmap.json`
ve `<id>.live_chat.json`. İngilizce yayın için `--lang en`. Araç eksikse komut nasıl
kurulacağını söyler. "Bazı parçalar indirilemedi" uyarısı çıkarsa birkaç dakika sonra yeniden çalıştır.

## 2. En çok izlenecek anları bul (asıl iş)

Hedef komik, şaşırtıcı, paylaşılacak anlar. Saatlerce süren yayını baştan sona okumak yerine
önce izleyicinin gerçekten tepki verdiği yerleri veriyle bul:

```
pnpm clip:moments ~/ai-influencer-clips/<video-id> --top 15 --length 40
```

Üç sinyali birleştirip sıralar ve `moments.json` yazar:

| Sinyal ("Neden") | Ne anlama gelir                                                       | Güven                                            |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| `tekrar izlenme` | YouTube'un "most replayed" verisi: insanlar burayı geri sarıp izlemiş | En güçlü kanıt. Yeni videoda henüz olmayabilir   |
| `sohbet`         | Sohbette mesaj patlaması; LOL / LMAO / 💀 / "clip it" 3 kat sayılır   | Canlı tepki. Bağış ve anket anları da sıçratır   |
| `ses`            | Bağırma, kahkaha, ani ses artışı                                      | Tek başına zayıf: müzik ve oyun sesi de sıçratır |

Liste aday listesidir, karar değildir. Her aday için:

1. `moments.json` içindeki transkripti ve `*.transcript.txt` dosyasında o anın **30 sn öncesini**
   oku: olay nerede başlıyor, kurulum ne?
2. Emin değilsen kare çıkarıp bak:
   `ffmpeg -v error -ss <sn> -i <video> -frames:v 1 kare.png`.
3. Başlangıç ve bitişi cümle sınırına çek. Komut aralığı zirvenin önüne ağırlıklı verir, ama
   kurulumun tamamı ve tepkinin sonu sende.
4. İki sinyalin birden yüksek olduğu anlar önceliklidir (ör. sohbet + tekrar izlenme).

Sonra ele ve sırala. İzlenme getiren klip:

- **İlk 2 saniyede kanca.** Olayın kendisi ya da hemen öncesi. "Selam chat" ile başlayan klip kaydırılır.
  Gerekirse en vurucu 1-2 saniyeyi başa "önizleme" olarak koymayı öner.
- **Kendi başına anlaşılır.** Yayını izlemeyen biri 5 saniyede ne olduğunu anlar. Anlaşılmıyorsa
  üstüne tek satırlık bağlam yazısı öner (ör. "GTA 6'da ilk polis kovalamacası").
- **Tek olay, net vuruş.** Kurulum → olay → tepki. Tepkiden sonra 1-2 saniye bırak, uzatma.
- **Yüksek duygu.** Kahkaha, panik, öfke, şok, inanılmaz şans/şanssızlık, beklenmedik oyun hatası,
  rekor, yayıncılar arası atışma. Sakin sohbet klip olmaz.
- **Paylaşma sebebi.** "Bunu arkadaşıma atarım" dedirtir mi? Oyun çıkışı gibi gündem anlarında
  "ilk kez" olan her şey değerlidir (ilk görev, ilk ölüm, ilk bug, ilk tepki).
- **15-45 saniye** çoğu an için doğru; hikâyesi olan anlar 60 sn'ye kadar. Şüphedeysen kısa tut.
- **Hız.** Aynı anı onlarca hesap kesecek; yayından sonraki ilk saatlerde çıkan klip kazanır.

Alma: üçüncü kişilerin özel bilgileri, hakaret/nefret, reşit olmayanlar, arkada telifli müzik
çalan bölümler (Content ID), yayıncıyı bağlamından koparıp kötü gösteren kesitler.

Adayları tabloyla sun ve kullanıcıya seçtir:

| #   | Aralık | Süre | Sinyal | Kanca (ilk 2 sn) | Neden tutar | Başlık önerisi |
| --- | ------ | ---- | ------ | ---------------- | ----------- | -------------- |

Altyazı yoksa transkript de yoktur: sinyallere ve karelere dayan, kullanıcıya bunu söyle.
Hiç sinyal yoksa (ısı haritası, sohbet, video yok) transkriptin **tamamını** okuyup adayları
oradan çıkar.

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
