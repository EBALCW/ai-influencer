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

İndirir, en güçlü anları bulur, her adayı kalite kontrolünden geçirir ve kalanları `~/ai-influencer-clips/<id>/clips/` altına keser. Dosyalar sinyal puanına göre sıralıdır (`01-…` en güçlü); `clips.json` her klibin aralığını, puanlarını, kalite raporunu ve neyin neden elendiğini tutar. Hepsini izleyip yayınlanacakları seçersin.

- **İki geçişte çalıştır.** Önce `--preview-only`: kesim yapılmaz; her aday için `clips/inceleme/<sıra>.md` (ölçümler + klibin zaman damgalı transkripti + 10 sn öncesi/sonrası) ve `clips/onizleme/` altında 6 karelik şerit yazılır. Adayları [rubriğe](#viral-klip-rubriği-ölçüme-dayalı) göre değerlendirip kararları `clips/kararlar.json` içine yaz, sonra komutu `--preview-only` olmadan çalıştır.
- **Kalite kontrolü.** `ele` kararı alan adaylar (akan jenerik, donuk/boş ekran, sessizlik, çalan şarkı) kesilmez ama listede gerekçesiyle görünür; `--keep-all` bunu kapatır. İstenen sayının iki katı aday çıkarılır; elenenlerin yerine sıradakiler kesilir. `--exclude 1,3` hâlâ çalışır. Yayının son %5'i (en çok 2 dakika) kendiliğinden atlanır; `clip:moments --skip-end` ile değiştirilebilir.
- **`kararlar.json`.** Aday başına: `decision` (`"keep"`, `"drop"` ya da `null` = kalite kararına bırak; `"keep"` `ele` kararını da aşar), `shiftStart` / `shiftEnd` (saniye; eksi geri, artı ileri), `caption` (klibin üstüne gömülen tek satır bağlam, en çok 60 karakter), `title` (yayın başlığı önerisi), `note`. `peak` alanı aday listesinin değişmediğini doğrular; dokunma.
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

`~/ai-influencer-clips/<id>/` klasörüne şunlar yazılır: video (`<id>.mp4`, en çok 1080p), altyazılar (`<id>.<dil>.vtt`), zaman damgalı transkript (`<id>.<dil>.transcript.txt`) ve `source.json` (başlık, kanal, süre, lisans). Varsa "en çok tekrar izlenen yerler" verisi de `heatmap.json` olarak kaydedilir. Seçenekler: `--chat` (canlı yayının sohbet tekrarını da indirir), `--lang tr,en` (altyazı dilleri), `--no-video` (yalnız transkript), `--out <klasör>` (repo dışında olmalı), `--max-height 360` (yalnız inceleme yapılacaksa: 1 saatlik yayın 360p'de yaklaşık 180 MB; yayınlanacak klip bu kopyadan kesilmez).

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

Eksik sinyal olursa komut kalanlarla devam eder. Seçenekler: `--top` (kaç an), `--length` (hedef klip süresi, sn), `--min-length` / `--max-length` (varsayılan 15 / 60), `--skip-start` (yayın girişinde atlanacak süre, varsayılan 60 sn), `--no-audio`. Komut kesim yapmaz ve izin seçeneği istemez: izni henüz gelmemiş bir yayında adayları, kalite raporunu, şeritleri ve inceleme dosyalarını bununla çıkarırsın.

**Klip sınırları sabit pencere değildir.** Başlangıç, zirveden önceki bir söz başına çekilir (elle yazılmış altyazıda cümle sonu, otomatik altyazıda sözcük zamanlarından bulunan duraklama, yoksa sesteki sessizlik). Bitiş, tepki söndükten (ses ve sohbet olağan düzeye dönünce) sonraki ilk durağa oturur; zirveden sonra en az hedef sürenin dörtte biri kalır (viral örneklerde vuruş klibin ortanca %63'ünde). Süre `--min-length` ile `--max-length` arasında kalır; durak bulunamazsa eski sabit pencere kullanılır ve rapor bunu yazar.

**Kalite raporu** her adaya 0-100 puan ve bir karar verir (`güçlü` ≥ 80, `orta` ≥ 60, `zayıf`, `ele`):

| Alt puan   | Ağırlık | Neyi ölçer                                                                           |
| ---------- | ------- | ------------------------------------------------------------------------------------ |
| `kanca`    | 0,20    | İlk 3 sn'deki sözcük sayısı ve ilk 2 sn'nin ses düzeyi                               |
| `tepki`    | 0,20    | Zirvede ses sıçraması (dB) ya da sohbet patlaması                                    |
| `konusma`  | 0,15    | Klibin ne kadarında konuşma var                                                      |
| `sinirlar` | 0,15    | Cümle ortasında başlıyor/bitiyor mu                                                  |
| `goruntu`  | 0,15    | Durağan kare, düz zemin, siyah ekran, dikey kayma (64×36 gri karelerden, saniyede 4) |
| `vurus`    | 0,10    | Zirve klibin neresinde (çok başta: kurulum yok; en sonda: tepki kesik)               |
| `akis`     | 0,05    | Sessizlik payı                                                                       |

`ele` sebepleri: görüntü sabit hızla kayıyor ve konuşma yok (akan jenerik), görüntü donuk ya da düz zeminli ve konuşma yok (bekleme/"bitti" kartı), yarıdan fazlası siyah, klibin %70'i sessiz, müzik baskın (ses etiketleyici kuruluysa). Ölçülemeyen parça (altyazı yoksa konuşma gibi) puana girmez. Ölçüm (CC BY lisanslı Big Buck Bunny): `--skip-end 0` ile sinyal puanı en yüksek iki aday jenerikti, ikisi de "akan jenerik" diye elendi (dikey kayma %61-%79; film sahnelerinde %0-%2) ve filmin içindeki 6 aday görüntüden elenmedi. Ses etiketleyici kuruluyken aynı filmde müzik kuralı üç sahneyi de eledi: film diyalogsuz ve müzikli. Müzik kaynağın kendisine aitse (kendi çekimin, açık lisanslı film) bu adayları `kararlar.json` içinde `"keep"` ile geri al.

**Puan anlamı ölçmez ve iyi adayları birbirinden ayırmaz.** Kesintisiz konuşulan bir sunumda her aday 85+ alır; 112 dakikalık gerçek bir yayında 16 adayın 14'ü `güçlü` çıktı, oysa elle değerlendirmede yalnız 6-7'si klip olmaya değerdi. Puan bozuk adayı yakalar; klibin komik, ilginç ya da tek başına anlaşılır olup olmadığına inceleme dosyasını okuyan kişi/agent karar verir. Gündem anlarında (ör. büyük bir oyunun çıkış günü) hız belirleyicidir: aynı anı birçok hesap keser, ilk çıkan kazanır. Arkada telifli müzik çalan bölümleri alma: yayıncı izin verse bile müziğin hakkı ona ait değildir.

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
| `--caption "<metin>"`   | Üstte, güvenli bölgede tek satır bağlam yazısı (en çok 60 karakter).      |

Çıktı 1080×1920, 30 fps, H.264 + AAC'dir ve repo dışına yazılır. Var olan dosyanın üzerine yazılmaz. Klibin yanına aynı adla bir `.json` dosyası (aralık, kaynak, izin referansı) bırakılır.

### 4. Panele kaydet ve yayınla

Panelde **Klipler** (`/clips`) sayfasına kaynağı ve klibi gir, "Backlog'a aktar" ile içerik kartına çevir. Kartta kaynak türü, sahibi ve izin referansı dolu gelir. Caption'da kaynağı belirt (`Kaynak: <kanal adı> (YouTube)`). Yayın öncesi kontrol listesi diğer içeriklerle aynıdır (`docs/publishing-rules.md`, `docs/qc-checklist.md`).

## Viral klip rubriği (ölçüme dayalı)

15 Kasım 2026'da beş büyük yayıncı kanalının Shorts sekmesi incelendi (yalnız üst veri: Kai Cenat Live, IShowSpeed, Jynxzi, CaseOh, Elraenn; 557 Shorts). Kanalın kendi ortancasının en az 3 katı izlenenler "kanıtlı" sayıldı (85 video). En güçlü 9 tanesi düşük çözünürlükte indirilip kare kare incelendi ve silindi. **Örnek küçük; yön gösterir, kural değildir.**

| Ölçüm                          | Sonuç                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Süre (süresi alınan 111 video) | Kanıtlı 43 videoda ortanca 35 sn, kalan 68'de 36 sn: süre ayırt etmiyor. Kanıtlıların %91'i ≤ 60 sn (kalanlarda %76).                                                             |
| Kanala göre süre               | Kai Cenat Live kanıtlıları 6-16 sn (ortanca 14); Elraenn 30, IShowSpeed 37, Jynxzi 46 sn. Uzunluk yayıncının tarzına bağlı.                                                       |
| İlk kare (9/9)                 | Konu ya da olay ilk karede ekranda. Giriş, logo, başlık kartı yok.                                                                                                                |
| İlk 2 sn'nin sesi              | 9 klibin 6'sında konuşma düzeyinde (klip ortancasının ≥ 0,86 katı); 2'sinde kısa sessiz bir kurulum var.                                                                          |
| En yüksek sesli an (vuruş)     | Ortanca: klibin %63'ü; 9 klibin 7'sinde %50-%77 arası. Vuruştan sonra tepki için süre kalıyor.                                                                                    |
| Gömülü altyazı (6/9)           | Kai Cenat 3/3: 1-2 sözcük, büyük, kalın, koyu kutulu, karenin üst-orta kısmında; ses efektleri de yazılı (`*DOOR OPENING*`).                                                      |
| Sabit bağlam yazısı (2/9)      | Jynxzi 2/2: yüz kamerası ile oyun arasında tek satır ("Jynxzi accidentally reacts to his own clip").                                                                              |
| Yerleşim                       | 4/9 üstte yüz kamerası + altta içerik; 3/9 konuya kırpılmış tam kare (yakınlaşmalı); 1 dikey telefon çekimi; 1 bulanık dolgu.                                                     |
| Vuruşta efekt                  | Elraenn 2/2: tepki anında yakınlaşma + siyah-beyaz dondurma.                                                                                                                      |
| Başlık                         | Ortanca 6-10 sözcük. Kai Cenat: %90 yayıncının adı + ne olduğu + emoji. Jynxzi: %93 emoji. Elraenn: BÜYÜK HARF, 3 sözcük, etiketli; kanıtlılarda soru/üç nokta %45 (genelde %18). |

Her aday için şu sorular yanıtlanır (agent akışı: `.claude/skills/yayinci-klip/SKILL.md`):

1. **Kanca:** ilk 2 sn'de ne görülüyor, ne duyuluyor? İlk karede konu yoksa ya da klip selamlaşma/boşlukla açılıyorsa başlangıcı kaydır.
2. **Anlaşılırlık:** yayını hiç izlemeyen biri kim, nerede, ne olduğunu anlar mı? Eksik bağlam tek satıra sığıyorsa üst yazı yaz; sığmıyorsa klip olmaz.
3. **Kurulum → sonuç:** vuruş klibin içinde mi ve kabaca %50-%80 arasında mı? Kurulum eksikse başı geri, tepki kesikse sonu ileri al.
4. **Tek başına duruyor mu:** tek olay, tek vuruş; cümle ortasında başlamıyor/bitmiyor.
5. **Başlık ve üst yazı:** Türkçe, bağlamı tek satırda veren, olanı söyleyen ama vuruşu satmayan.

Araç bugün sözcük sözcük altyazı, yüz kamerası + oyun bölmesi ve vuruşta yakınlaşma üretmiyor; altyazı satır satır, yerleşim `blur` ya da `crop`.

## Yerel transkript (isteğe bağlı)

YouTube altyazısı olmayan ya da altyazı isteği sınırlanan (HTTP 429) videoda `clip:moments`, yalnız aday pencerelerini (zirvenin yaklaşık 60 sn öncesi ve sonrası) whisper.cpp ile yazıya döker; yayının tamamını dökmez. Sonuç `whisper.json` içinde saklanır ve kesimde altyazı olarak kullanılır.

- Kurulum: `brew install whisper-cpp` ve bir ggml modeli. Varsayılan yol `~/.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin` (574 MB); başka model için `WHISPER_MODEL` ortam değişkeni. Kurulu değilse komut uyarır ve altyazısız sürer.
- Ölçüm (MacBook Air M4, large-v3-turbo-q5): 120 sn ses 22,6 sn'de (gerçek zamanın 5,3 katı hız). 1 saatlik yayında 10 aday için 18 dk ses yaklaşık 3,5 dk, 112 dk'lık yayında 16 aday için 27 dk ses yaklaşık 6 dk sürdü.
- Müzik, kalabalık gürültüsü ve sessizlikte model metin uydurabilir ya da aynı cümleyi döngüye sokabilir; birebir aynı satırın ikiden fazla tekrarı atılır ama döküme körü körüne güvenme, şeride de bak.

## Ses etiketleyici (isteğe bağlı)

Kuruluysa her adayın sesi AudioSet sınıflarıyla etiketlenir (sherpa-onnx + CED-tiny): müzik, konuşma, gülme, bağırma, kalabalık. Müzik baskın ve konuşma geri plandaysa aday elenir (çalan şarkı: Content ID riski); gülme/bağırma inceleme dosyasında bilgi olarak görünür.

```
mkdir -p ~/.local/share/ai-influencer-audio && cd ~/.local/share/ai-influencer-audio
echo '{"private":true,"dependencies":{"sherpa-onnx-node":"2.0.1"}}' > package.json && pnpm install
# Model: k2-fsa/sherpa-onnx → audio-tagging-models → sherpa-onnx-ced-tiny-audio-tagging-2024-04-19
#        ~/.local/share/sherpa-models/ altına aç
```

Repo bağımlılığı değildir (CI ve Windows etkilenmez); yollar `AUDIO_TAGGER_DIR` ve `AUDIO_TAG_MODEL_DIR` ile değişir. Kurulu değilse ölçüm sessizce atlanır.

- Ölçüm (M4): 112 dk'lık yayının tamamı 53 sn'de etiketlendi (gerçek zamanın ~125 katı).
- Müzik ayrımı net: şarkı çalan üç adayda müzik 0,84-0,88, konuşmalı adaylarda 0,02-0,15.
- **An bulma sinyali olarak kullanılmıyor.** Tek bir yayında sohbet patlamalarıyla karşılaştırıldı: gülme/bağırma olasılığının ilk 20 zirvesinden 10'u sohbetin en sıcak %10'una denk geldi (ses düzeyinde 4, rastgele beklenen ~7). Umut verici ama tek örnek; sıralamaya eklemek için yeterli kanıt değil.

## Karar günlüğü (ileride model için veri)

Kendi "viral olur mu" modelimizi eğitmiyoruz: etiketli verimiz yok. Bunun yerine her kesim çalıştırması, aday başına bir satırı `~/ai-influencer-clips/karar-gunlugu.jsonl` dosyasına ekler: ölçümler, alt puanlar, sinyaller ve karar (`cut`, `auto_rejected`, `excluded`, `not_needed`). Yayından sonra sonucu işle:

```
pnpm clip:mark ~/ai-influencer-clips/<id> --published 1,4 --rejected 2
```

Dosya repo dışındadır ve kişisel veri içermez (video kimliği + sayılar). Aynı aday birden çok satırda geçebilir; son satır geçerlidir. Yeterli satır biriktiğinde (yüzlerce yayınlanmış klip ve izlenme sonuçları) ağırlıklar bu veriyle ayarlanabilir.

## Sık sorunlar

- **"Bu ffmpeg altyazı gömemiyor":** libass'lı ffmpeg kur (yukarıdaki tablo) ya da `--subs` olmadan kes.
- **Altyazı bulunamadı:** videoda o dilde altyazı yok ya da YouTube isteği sınırladı (HTTP 429; birkaç dakika sonra yeniden dene). `--lang` ile başka dil dene; yerel transkript kuruluysa `clip:moments` aday pencerelerini kendisi yazıya döker.
- **"kararlar.json: … adayın zirvesi değişmiş":** aday listesi farklı seçeneklerle (`--count`, `--length`) yeniden üretilmiş. Kararları yeni listeye göre güncelle ya da dosyayı silip yeniden değerlendir.
- **İndirme başarısız:** `yt-dlp` eskidiyse güncelle (`brew upgrade yt-dlp` / `winget upgrade yt-dlp.yt-dlp`). Üyelere özel ve yaş kısıtlı videolar indirilemez; bunları aşmaya çalışma.
- **Şikâyet ya da ihtar geldi:** `docs/compliance.md` → "İhtar ve şikâyet prosedürü".
