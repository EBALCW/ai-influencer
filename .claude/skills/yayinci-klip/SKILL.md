---
name: yayinci-klip
description: Bir yayıncının (streamer) YouTube videosundan Reels / Shorts / TikTok için kısa dikey klip çıkarır - indir, en çok izlenecek anları veriyle bul (tekrar izlenme, sohbet patlaması, ses), kalite kontrolünden geçir, her adayı "kanca var mı, izleyen anlar mı" rubriğiyle değerlendir, kes, altyazı ve üst yazı göm, panele kaydet. "Şu yayından klip çıkar", "bu videodan shorts yap", "yayıncı klibi", "clip al", bir YouTube adresi ile birlikte "kes / klip / kısa video" dendiğinde kullan.
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

## Hızlı yol: tek komut

Kullanıcı yalnızca link verip "kliplerini çıkar" diyorsa ve izin durumu belliyse:

```bash
pnpm clip:auto "<youtube-adresi>" --permission "<izin referansı>"   # ya da --open-license "<lisans>" / --own
```

Bunu her zaman iki geçişte çalıştır; adayları değerlendirmeden kesme:

1. Komutun sonuna `--preview-only` ekle. İndirir, anları bulur, sınırları söz başına/tepkinin sonuna oturtur, kalite raporunu basar ve her aday için `clips/inceleme/<sıra>.md` + `clips/onizleme/<sıra>-<başlangıç>.jpg` yazıp durur.
2. **Her adayın** inceleme dosyasını ve şeridini Read ile aç, aşağıdaki "Anlam değerlendirmesi" rubriğini uygula ve kararını `clips/kararlar.json` içine yaz. `ele` kararı alan adaylara da bak: araç yanılıyorsa `"decision": "keep"` ile geri al.
3. Aynı komutu `--preview-only` olmadan çalıştır. `drop` dedikların ve aracın elediği adaylar kesilmez, yerlerine sıradakiler gelir; kaydırmalar ve üst yazılar uygulanır.

Kalite puanı yalnız ölçülebileni görür (söz var mı, cümle ortası mı, tepki var mı, görüntü jenerik mi). Klibin komik ya da anlaşılır olduğuna sen karar verirsin; puanı 90 olan bir aday da sıkıcı olabilir. Kullanıcıya klipleri sunarken neyi neden elediğini de yaz.

İzin henüz yoksa aynı incelemeyi kesmeden yap: `pnpm clip:fetch "<adres>" --chat --max-height 360`, sonra `pnpm clip:moments <klasör> --top 16`. `clip:moments` izin seçeneği istemez ve hiçbir şey kesmez.

## Anlam değerlendirmesi (her aday için zorunlu)

Dayanak: `docs/clip-guide.md` → "Viral klip rubriği" (5 kanal, 557 Shorts, 9 klip kare kare; küçük örnek). İnceleme dosyasında `>` satırları klibin içi, `·` satırları klibin 10 sn öncesi/sonrasıdır. Her aday için şu altı soruyu **yazılı** yanıtla:

1. **Kanca:** ilk 2 sn'de ne görülüyor, ne duyuluyor? İncelenen 9 viral klibin 9'unda konu ilk karede ekrandaydı; giriş, selam, boş ekran yoktu. İlk `>` satırı bir cümlenin devamıysa ya da "evet, neyse, şimdi" diye açılıyorsa başlangıcı kaydır.
2. **Anlaşılırlık:** yayını hiç izlemeyen biri kimin ne yaptığını ve neden tepki verildiğini anlar mı? Eksik bağlamı adlandır (oyun? kim konuşuyor? neye bakıyorlar?). Tek satıra sığıyorsa `caption` yaz; sığmıyorsa `drop`.
3. **Kurulum → sonuç:** vuruş (söz, olay, tepki) klibin içinde mi, nerede? Viral örneklerde en yüksek sesli an ortanca %63'te, çoğunda %50-%77 arasındaydı. `·` satırlarında kalan kurulum varsa `shiftStart` eksi; tepki ya da cümle kesiliyorsa `shiftEnd` artı; vuruştan sonra boş konuşma varsa `shiftEnd` eksi.
4. **Tek başına duruyor mu:** tek olay, tek vuruş. Başka bir ana gönderme ("demin dediğim gibi") ya da yarım kalan hikâye varsa düzelt ya da `drop`.
5. **Başlık ve üst yazı:** Türkçe. Üst yazı (`caption`, en çok 60 karakter) bağlamı verir ama vuruşu söylemez (ör. "Yayıncı ilk kez kendi klibini izliyor"). Başlık (`title`) kısa ve somut: ne oldu + gerekirse tek emoji.
6. **Karar:** `keep` / `drop` + tek cümle gerekçe (`note`). Şunlarda `drop`: çalan şarkı ya da arkada baskın müzik (telif), jenerik/bekleme ekranı, bağış/abone okuma, reklam, bağlamı tek satırla kurtarılamayan an, vuruşu olmayan düz sohbet, `docs/compliance.md` → kırmızı çizgiler.

Kararı dosyaya yaz (araç ilk çalıştırmada boş şablonu üretir; `peak` alanına dokunma):

```json
{
  "candidates": {
    "2": {
      "peak": "12:50",
      "decision": "keep",
      "shiftStart": -4,
      "shiftEnd": 3,
      "caption": "Yayıncı ilk kez kendi klibini izliyor",
      "title": "Kendi klibine tepki verdi 💀",
      "note": "Kurulum 4 sn önce başlıyor; kahkaha klibin sonunda kesiliyordu"
    },
    "3": { "peak": "40:05", "decision": "drop", "note": "arkada şarkı çalıyor" }
  }
}
```

Kaydırmadan sonra aynı komutu yeniden `--preview-only` ile çalıştırırsan rapor ve inceleme dosyası yeni aralığa göre güncellenir; emin olana kadar tekrarla. Yalnız transkripte güvenme: yerel dökümde (YouTube altyazısı yokken) müzik ve gürültü yanlış yazıya dökülebilir; şeride ve gerekirse tek kareye bak.

**Videolar Türkçe yayınlanır.** Kaynak Türkçe değilse komuta `--translate tr` ekle. İlk çalıştırma `clips/altyazi/<ad>.srt` dosyalarını bırakır ve durur. Her birini kendin Türkçeye çevirip `<ad>.tr.srt` olarak yaz, sonra aynı komutu yeniden çalıştır.

- Satır numaralarına ve zamanlara dokunma; yalnız metni çevir.
- Otomatik altyazıda cümleler satır ortasında bölünür ve yanlış duyulmuş sözcükler olur. Önce tüm metni okuyup anlamı çıkar, sonra satırlara dağıt; kelime kelime çevirme.
- Satır başına en çok 40-45 karakter; konuşma dili kullan, argo ve küfrü yumuşatmadan ama platform kurallarını aşmadan aktar.
- Emin olmadığın özel adı ya da oyun terimini çevirmeden bırak.

## 1. İndir

```
pnpm clip:fetch "<youtube-adresi>" --chat     # video + altyazı + transkript + ısı haritası + sohbet tekrarı
pnpm clip:fetch "<youtube-adresi>" --no-video --chat   # hızlı ön inceleme (ses sinyali olmaz)
pnpm clip:fetch "<youtube-adresi>" --chat --max-height 360   # yalnız inceleme: küçük dosya, klip bundan kesilmez
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

Komut ayrıca her adayın sınırlarını söz başına ve tepkinin sonuna oturtur, kalite raporunu
(`güçlü` / `orta` / `zayıf` / `ele` + gerekçe) basar ve `clips/inceleme/`, `clips/onizleme/`
dosyalarını yazar. Liste aday listesidir, karar değildir: her adaya yukarıdaki "Anlam
değerlendirmesi" rubriğini uygula. İki sinyalin birden yüksek olduğu anlar önceliklidir
(ör. sohbet + tekrar izlenme). Emin değilsen kare çıkarıp bak:
`ffmpeg -v error -ss <sn> -i <video> -frames:v 1 kare.png`.

Gündem anlarında hız belirleyicidir: aynı anı onlarca hesap keser; yayından sonraki ilk
saatlerde çıkan klip kazanır.

Alma: üçüncü kişilerin özel bilgileri, hakaret/nefret, reşit olmayanlar, arkada telifli müzik
çalan bölümler (Content ID), yayıncıyı bağlamından koparıp kötü gösteren kesitler.

Adayları tabloyla sun ve kullanıcıya seçtir:

| #   | Aralık | Süre | Sinyal | Kalite | Kanca (ilk 2 sn) | Anlaşılırlık / eksik bağlam | Vuruş nerede | Karar ve değişiklik | Başlık / üst yazı |
| --- | ------ | ---- | ------ | ------ | ---------------- | --------------------------- | ------------ | ------------------- | ----------------- |

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
- `--caption "<metin>"`: üstte tek satır bağlam yazısı (en çok 60 karakter, güvenli bölgede).
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

Yüz/ana konu kadrajda mı, altyazı ve üst yazı okunuyor, taşmıyor ve birbirine değmiyor mu,
Türkçe harfler doğru mu, ilk saniye boş mu, ses var mı.
Otomatik altyazıda yanlış yazılmış kelime varsa VTT'yi düzeltip yeniden kes.

## 5. Kaydet ve yayına hazırla

- Panel → **Klipler** (`/clips`): kaynağı (video, kanal, izin durumu + referans) ve klibi
  (aralık, başlık, kanca) gir; "Backlog'a aktar" ile içerik kartı oluşur. İzin "verildi"
  değilse panel aktarmaz.
- Caption'da kaynağı belirt: `Kaynak: <kanal adı> (YouTube)`. Caption ve hashtag kuralları:
  `docs/caption-guide.md`. Yayın öncesi kontrol: `docs/publishing-rules.md`.
- Video dosyasını repoya, issue'ya veya PR'a ekleme.
- Kullanıcı hangilerini yayınladığını söyleyince işle:
  `pnpm clip:mark <klasör> --published 1,4 --rejected 2` (karar günlüğü; ileride puanlamayı
  bu veriyle ayarlayacağız).

## Kaynak

Akış `op7418/Youtube-clipper-skill` (MIT, commit `f31f077`) üzerinden uyarlandı: proje
kurallarına göre Türkçeleştirildi, dikey çıktı ve izin adımı eklendi, Python script'leri
yerine repodaki Node komutları kullanılıyor. Kesim kuralları (ses geçişi, altyazının filtre
zincirinin sonunda olması) `browser-use/video-use` (MIT) notlarından.
