---
name: anlatim-videosu
description: Bir olayı ya da "nasıl çalışır" konusunu kodla çizilmiş hareketli şemalar, seslendirme ve altyazıyla anlatan kısa dikey video üretir (ör. planör nasıl uçar, bir mağara kurtarması, bir rekor). Kısa bir istekten konu önerileri, seçilen konu için kaynaklı senaryo, Türkçe seslendirme, koddan animasyon, altyazı, 1080×1920 çıktı. "Havacılıkla ilgili video fikri ver", "şu nasıl çalışır videosu", "şu olayı anlatan video yap", "anlatım videosu", "belgesel tarzı short", "faceless video", "explainer" dendiğinde kullan.
---

# Anlatım videosu

Yüz göstermeyen, tek anlatıcılı, görsel anlatımlı kısa film. Anlatımı yazı kartları değil
**hareketli çizimler** taşır: kesitler, akım çizgileri, büyüyen oklar, ölçekli üçgenler, rotalar;
her vurgu anlatıcının söylediği kelimeye oturur. Üretici görsel/video modeli kullanılmaz; her şey
koddan çizilir. Motor `.claude/skills/cinematic-film/` içindedir (dışarıdan alındı, bkz. `KAYNAK.md`).
**Önce o klasördeki `SKILL.md` dosyasını oku**: iş akışı, kurallar ve komutlar orada. Bu dosya
yalnızca projeye özgü farkları söyler. İnsanlar için rehber: `docs/explainer-guide.md`.

## Hangi motor?

İki çizim yolu var; ikisi de koddan çizer, ücretsizdir, aynı kaynak ve onay kurallarına uyar.

|               | Skia yolu (`cinematic-film`)                                                                    | Stil yolu (`film-styles` + `edit-video`, HyperFrames)                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Görünüm       | Düz dolgulu renkli 2B şema, sahneden sahneye kayma                                              | 99 hazır "film görünümü"nden biri (ozalit, beyaz tahta, kesit çizimi, eskiz defteri…); her birinin düzen, yazı, hareket ve ses kuralı yazılı |
| Ne zaman      | Renkle anlam taşıyan şemalar (sıcak/soğuk, kuvvet renkleri), fotoğraf ve haritalı olay filmleri | Kaydırmayı durduracak belirgin bir görsel kimlik, seri formatı ("Nasıl çalışır? · Pafta 01"), kelimeye kilitli çizim ve ses efekti           |
| Dil           | Python + Skia                                                                                   | HTML canvas / SVG + JS; tarayıcıda kare kare render                                                                                          |
| Kelime zamanı | Harf payından tahmin (±0,3 sn)                                                                  | edge-tts'in kendi kelime zamanları (ölçülen sapma ~0,05 sn)                                                                                  |
| Altyazı       | SRT + ffmpeg ile gömme                                                                          | Kompozisyonun içinde, stilin kendi "not kutusu" olarak                                                                                       |
| Render        | 66 sn film birkaç dakika                                                                        | 48,8 sn film 1 dk 18 sn (M4, 4 işçi)                                                                                                         |
| Kılavuz       | Bölüm 5-7                                                                                       | Bölüm 8                                                                                                                                      |

Kararsızsan: mekanik "nasıl çalışır" konusu ve seri düşünülüyorsa stil yolu; fotoğraf, harita ya da
çok renkli akış gerekiyorsa skia yolu. Aşağıdaki akış, doğruluk ve hassasiyet kuralları ikisinde aynıdır.

## Akış: istekten videoya

İki tür video var; ikisi de aynı akıştan geçer:

- **Olay:** gerçekten olmuş bir şey (kurtarma, kaza, keşif, rekor). Zaman sırası, yer, kişi var;
  aşağıdaki hassasiyet kuralları (bölüm 2) tam uygulanır.
- **Nasıl çalışır:** bir mekanizma ya da olgu ("planör nasıl uçar", "köprü neden çökmez").
  Kişi ve tarih azdır, çizim yükü fazladır. İçinde gerçek bir kaza ya da ölüm örneği geçiyorsa o
  kısım için de bölüm 2 geçerlidir.

Adımlar (✋ = kullanıcı onayı beklenir):

1. **Kısa istek.** Kullanıcı bir alan ("havacılık", "ilginç mühendislik") ya da belirli bir soru
   yazar. İstek zaten tek bir konuysa ("planör nasıl uçar videosu yap") 2-3. adımı atla, yine de 4. adımdaki senaryo onayını al.
2. **Konu önerileri.** 5-8 öneri çıkar; olay ve nasıl-çalışır türlerini karıştır. Önermeden önce
   her konu için hızlı bir arama yap: iki güvenilir kaynak bulamadığın konuyu listeye koyma.
   Her öneri şu kalıpta, kullanıcının bir bakışta karar verebileceği kadar kısa:

   ```
   3. Planör motorsuz nasıl saatlerce uçar?  (nasıl çalışır)
      Özet: Planör bir uçak ya da vinçle havaya çekilir, sonra hep hafifçe alçalarak süzülür.
        Yükselmek için ısınan havanın (termik) içinde daire çizer. İyi bir planör 1 km
        alçalırken 40-50 km yol alır.
      Kanca: "Bu uçağın motoru yok, yine de yüzlerce kilometre uçuyor."
      Ekranda: çekici uçak + halat; kanat kesiti ve akım çizgileri; süzülme üçgeni;
        termik sütununda sarmal. Çizimle kolay: hepsi şema.
      Kaynak adayları: NASA Glenn "Gliders"; FAI rekor listesi
   ```

   - **Özet** 2-3 cümle, yalnızca aramada gördüğün olgularla (bu aşamada tam doğrulama yok;
     emin olmadığın sayıyı yazma).
   - **Kanca** neden izleneceğini söyler: şaşırtıcı sonuç, sezgiye aykırı olgu, büyük sayı.
   - **Ekranda** çizilecek 3-5 şeyi ve çizimle yapılabilirliği dürüstçe yazar: kesit, harita,
     grafik, mekanizma kolaydır; yüz, kalabalık, gerçekçi doku, belirli bir kişinin görüntüsü
     gerektiren konu bu yöntemle zayıf kalır. Öyleyse söyle ya da listeye koyma.
   - **Kaynak adayları** 2 tane; biri birincil olmaya aday (kurum, resmî rapor, hakemli yayın).
   - Gerçek olay önerisinde hassasiyet notunu ekle (ör. "can kaybı var; saygılı anlatım").
   - **Kanıt düzeyi** (`find-ideas` kuralı): konunun kısa videoda işlediğine dair bir örnek
     bulduysan yaz. Bir örnek ancak **kendi kanalının ölçüsüyle** kanıttır: izlenmesi, o kanalın
     yakın tarihli benzer videolarının medyanının **en az 3 katı** ise "kanıtlı" de ve izlenme,
     medyan, örnek sayısı, yayın ve bakış tarihini yaz. Kanal ortalamasını bilmiyorsan "format
     örneği" de (yapı için işe yarar, kancanın tuttuğunu kanıtlamaz). Örnek yoksa "özgün" yaz;
     uydurma izlenme sayısı yazma. Sırala: kanıtlı olanlar üstte. Alınan şey kanca kalıbı, yapı ve
     tempodur; görüntü, ses, çizim alınmaz. Kanıt düzeyi olguların doğruluğu hakkında hiçbir şey
     söylemez: iki kaynak kuralı ayrıca geçerlidir.

3. ✋ **Seçim.** Kullanıcı bir ya da birkaç konu seçer; seçilmeyenler için iş yapılmaz.
4. ✋ **Senaryo.** Seçilen konu için tam araştırma (bölüm 1), `script.json` ve `fact_notes`;
   kullanıcı senaryoyu ve olguları onaylar. Onaysız seslendirme ve çizime başlanmaz.
   Kancayı ve ara kancaları `write-script` yöntemiyle kur: ilk beş saniye tek birim (kanca +
   gerçek bir sayı + açık bırakılan soru), her iki-üç cümlede bir yeni soru ya da vuruş, sonda
   sorunun cevabı. O skill'in "abartı serbest" tavrı burada olgu kuralının altındadır.
5. **Üretim.** Seslendirme → zamanlama → `scene.py` (bölüm 5 ve 6) → kare kontrolü → render →
   altyazı. Bittiğinde dosya yolu, süre, sahne listesi ve kaynaklarla birlikte teslim et.

## Projeye özgü kurallar

### 1. Doğruluk (atlanamaz)

- Her olgu (tarih, yer, sayı, isim, sıra) **en az iki bağımsız kaynaktan** doğrulanır; biri
  birincil olmalı (resmî rapor, mahkeme kaydı, kurumun kendi açıklaması, hakemli yayın).
  Kaynaklar `script.json` → `fact_notes` içine iddia başına bir satır yazılır.
- Kaynaklar çelişiyorsa çelişkiyi anlat ya da o ayrıntıyı çıkar. Boşluğu tahminle doldurma.
- Emin olunmayan şey "iddia ediliyor", "rapora göre" diye söylenir.
- Senaryo ve olgular kullanıcı onayından geçmeden seslendirme ve görsel işine başlanmaz
  (motorun birinci onay kapısı).
- "Nasıl çalışır" videosunda da aynı kural: sayı (oran, yükseklik, rekor), mekanizma açıklaması
  ve "en/ilk" iddiaları iki kaynaktan. Yaygın ama yanlış açıklamaları (ör. kaldırma kuvveti için
  "üstteki hava daha uzun yol gider") kaynakta kontrol etmeden tekrarlama. Kaynaklar sayıda
  ayrışıyorsa güvenli ifadeyi seç ("22 kilometrenin üzerine") ve farkı `fact_notes`'a yaz.
- Sadeleştirme yaptıysan (abartılı ölçek, şematik akış) bunu kaynak notuna yaz; ölçeksiz çizimin
  yanına mümkünse gerçek ölçeği de koy.

### 2. Gerçek olaylarda hassasiyet

Kaza, ölüm, suç gibi konularda:

- Saygılı ve sakin anlatım. Abartılı başlık, geri sayım, "korkunç son" türü sömürü dili yok.
- Hayatını kaybedenlerin ve yakınlarının mahremiyeti: kamuya açık olmayan ayrıntı, ceset ya
  da yaralanma görüntüsü, aileyi hedef gösteren bilgi kullanılmaz. Reşit olmayanların adı verilmez.
- Suçlama yalnızca resmî bulguya dayanır; soruşturma sürüyorsa bunu söyle.
- Sonunda olaydan çıkan dersi ya da değişen kuralı ver; video yalnızca şok için yapılmaz.

### 3. Görseller

- Gerçek fotoğraf ve belgeler yalnızca lisansı uygun kaynaktan (`fetch_commons.py` lisansı
  denetler ve `credits.md` yazar). Haber sitesinden, sosyal medyadan görsel alınmaz.
- Kodla çizilen belge "canlandırma" diye etiketlenir. **AI görseli gerçek olayın ya da gerçek
  bir kişinin kanıtıymış gibi sunulmaz**; kullanılıyorsa açıkça illüstrasyon olarak.
- Yayında AI etiketi ve kaynak kuralları: `docs/compliance.md`.

### 4. Türkçe seslendirme (ücretsiz)

Motor seslendirme için herhangi bir komutu kabul eder. Türkçe için `edge-tts` kullan:

```
python3 scripts/tts_say.py --project <proje> \
  --cmd 'edge-tts --voice tr-TR-AhmetNeural --rate=+8% --file {txt} --write-media {out}'
```

- Sesler: `tr-TR-AhmetNeural` (erkek), `tr-TR-EmelNeural` (kadın). İngilizce video için
  `en-US-GuyNeural`, `en-US-AriaNeural`.
- `script.json` içinde `spoken` alanına sayıları ve kısaltmaları **okunduğu gibi** yaz
  ("1996" → "bin dokuz yüz doksan altı", "80 m" → "seksen metre").
- `split_takes.py` hangi satırları işaretlerse dinle; yanlış okunan kelimeyi yeniden yaz.
- `edge-tts` yoksa: `pip install edge-tts` (proje sanal ortamına).

### 5. Dikey çıktı (denendi: `ornek/`)

Motorun kendi örnekleri yatay (16:9). Dikey düzen bu projede uçtan uca denendi. İki çalışan örnek:

- `ornek/planor/` ("Planör Nasıl Uçar?", 66 sn): **çizim ağırlıklı**, on sahne, hepsi koddan
  şema; `script.json`, `scene.py` ve iddia başına kaynak tablosu `sources.md`. Yeni filme
  buradan başla (bölüm 6).
- `ornek/script.json` + `ornek/scene.py` ("Mağarada 17 Gün", 46 sn): yalnızca motorun hazır
  kart, sayı ve rota öğeleri; kamera tek sütunda aşağı iner. Hızlıdır ama kare boş kalır.

Aşağıdaki ölçü ve altyazı kuralları ikisi için de geçerli; "pano tek sütun" maddesi yalnızca
hazır öğelerle kurulan filme aittir.

- **Ölçü:** zoom 1'de kare her zaman **3840 dünya pikseli genişliğindedir**; 9:16'da yükseklik
  ~6830 olur. Yani dikeyde genişlik dardır: kart en fazla ~3200 genişlikte, büyük yazı
  (`BigText`) 1300 boyutta ~6 karakter sığar.
- **Pano tek sütun:** kümeleri alt alta diz (aralık ~3500), kamera yukarıdan aşağı insin. Her
  karede tek kahraman öğe; kamerayı zoom 0,9-1,1 arasında tut.
- **Kanca ilk karede:** en çarpıcı sayı ya da sonuç `L(1)` anında ekranda olsun (kelimeyi
  bekleme); ilk saniyede boş kare kaydırılır.
- `prep_assets.py` fotoğraf olmasa da **ilk kareden önce bir kez** çalışmalı (pano dokularını üretir).
- Taslak ve kontrol: `render.py --probe <satır ortaları> --size 540x960`; son render
  `--size 1080x1920` (46 saniyelik film M4'te ~2 dakika).
- **Altyazıyı motorla gömme.** `burn_captions.py` yazıyı yatay videoya göre boyutlar: dikeyde
  okunmayacak kadar küçük kalır ve platform arayüzünün kapattığı en alt banda düşer. Bunun yerine
  SRT al ve ffmpeg ile göm (libass'lı ffmpeg gerekir; macOS: `brew install ffmpeg-full`):

  ```
  python3 scripts/burn_captions.py --project <proje> --srt-only --out out/captions.srt
  cd <proje>/out
  ffmpeg -i final.mp4 -vf "subtitles=filename=captions.srt:force_style='FontName=Arial,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60,MarginL=20,MarginR=20'" \
    -c:v libx264 -preset medium -crf 23 -maxrate 8M -bufsize 16M -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart <ad>.mp4
  ```

  Bu adım dosyayı da küçültür (motorun ham çıktısı 46 saniye için ~100 MB, bu adımdan sonra ~50 MB).
  Altyazı kareyi alttan ~%22 yukarıda tutar; büyük sayı ve kartları bu bandın üstünde bırak.

  Motorun SRT'si parça başına 9 kelimeye çıkar; dikeyde üç satıra sarıp çizimin üstüne taşar.
  Çizim ağırlıklı filmde SRT'yi bu skill'in betiğiyle al (parça başına en çok 6 kelime, en çok
  iki satır; zamanlama aynı kaynaktan):

  ```
  python .claude/skills/anlatim-videosu/scripts/kisa_srt.py --project <proje>
  ```

- Süre 45-90 saniye (yaklaşık 110-230 kelime). İlk cümle kanca: sonucu ya da en çarpıcı
  olguyu baştan söyle, sonra "nasıl oldu"ya dön.
- Yalnız kart ve sayılarla kare boş kalabiliyor. Lisanslı fotoğraf, harita ya da kesit çizimi
  ekleyerek doldur (`fetch_commons.py`, `make_map.py`); göstermeden önce her satırdan bir kareye bak.

### 6. Çizimle anlatım (denendi: `ornek/planor/`)

Kart ve sayı yerine her satırı bir çizim taşır. Motorun dosyalarına dokunmadan, `scene.py`
içinde kendi `Item` alt sınıfınla yapılır; `ornek/planor/scene.py` kopyalanıp uyarlanacak
iskelettir (yardımcılar + on sahne).

**Yapı**

- Tek bir `Stage(Item)` bütün sahneleri çizer. Her sahne `draw(c, res, t)` imzalı bir işlevdir
  ve (0, 0) merkezli 3840×6830'luk kareyi kendi gökyüzü/zeminiyle doldurur. Motorun pano dokusu
  kaldırılır (`film.items.remove(film.board)`), spot ışığı kullanılmaz (`film.cam`, `film.shot`
  değil), `look` olarak düşük gren ve parlamalı özel bir sözlük verilir.
- Sahne geçişi kamerayla değil sahnenin kendisiyle yapılır: eskisi yukarı kayar, yenisi alttan
  gelir (0,6 sn). Kamera sahne boyunca yalnızca 1,0 → 1,045 yaklaşır. **Zoom 1'in altına inme**:
  sahne arka planının kenarı görünür.
- Bir sahne = bir ya da iki anlatım satırı. Sahne, satır başlamadan 0,3 sn önce girer.
- Bütün zamanlar `L(satır)`, `E(satır)`, `W(satır, "kelime")` ile seslendirmeden alınır; sahne
  içi hareket `ramp(t, t_kelime, süre)` ile kurulur. Ses değişirse film kendini yeniden zamanlar.

**Güvenli alan (zoom 1, dünya koordinatı, y aşağı doğru artar)**

| Bant          | y aralığı   | Ne konur                                                |
| ------------- | ----------- | ------------------------------------------------------- |
| Üst kenar     | -3415…-3000 | Boş bırak (platform arayüzü, kamera yaklaşınca kesilir) |
| Asıl çizim    | -3000…+1100 | Kahraman çizim, etiketler, büyük sayılar                |
| Altyazı bandı | +1100…+2000 | Yalnız dekor: zemin, tepe, akım çizgisi. Etiket koyma   |
| Alt kenar     | +2000…+3415 | Yalnız dekor (platform arayüzü kapatır)                 |

Yatayda etiketleri x = ±1750 içinde tut. Kareyi doldurmanın yolu boşluğa yazı eklemek değil,
çizimi büyütmek ve zemini (tepe, tarla, dağ) alt bantlara yaymaktır.

**Yeniden kullanılabilir çizim kalıpları** (hepsi `ornek/planor/scene.py` içinde)

| Kalıp                     | İşlev                            | Ne anlatır                                              |
| ------------------------- | -------------------------------- | ------------------------------------------------------- |
| Akan kesik çizgi          | `flow(path, …, phase)`           | Hava/su akımı, rüzgâr, ışın; `phase` zamanla artar      |
| Eğri üretici              | `curve(fn, x0, x1)`              | Engelin çevresinde bükülen akım çizgisi, tepe, dalga    |
| Büyüyen ok                | `arrow(…, p)`                    | Kuvvet, yön; `p` 0 → 1 kelimeyle büyür                  |
| Hap etiket + kılavuz      | `tag(…, to=(x, y))`              | 1-3 kelimelik ad; çizgiyle nesneye bağlanır             |
| Gösterge çubuğu           | sahne içinde `drawRoundRect`     | Yükseklik, sürükleme gibi azalan/artan nicelik          |
| Ölçek üçgeni + sayaç      | `s_glide`                        | Oran; abartılı çizim + yanında gerçek ölçek şeridi      |
| Sütun + yükselen çizgiler | `s_thermal`                      | Yükselen/alçalan akışkan, ısı                           |
| Sarmal/testere rota       | `spiral(u)`, `route(u)`          | Nesnenin izlediği yol; iz arkasında kesik çizgi kalır   |
| Büyüteç bağlantısı        | `s_lift`                         | "Bu büyük şekil şu küçük nesnenin kesiti"               |
| Yan yana karşılaştırma    | `s_wings`                        | İki tasarım; aynı ölçü çubuğu, zıt renk                 |
| Nesne çizimleri           | `glider_side/front`, `plane_top` | Yol + dolgu + lacivert kontur; `scale(-s, s)` ile çevir |
| Dekor                     | `sky`, `cloud`, `hills`, `sun`   | Katmanlı tepe kaydırması ileri hareket hissi verir      |

Stil: düz dolgu, tek kalınlıkta lacivert kontur, sınırlı palet (krem, sarı = vurgu/kaldırma,
mercan = ağırlık/kayıp, camgöbeği = hava). Bir rengin anlamı film boyunca değişmez.

**Tuzaklar (hepsi bu filmde yaşandı)**

- İlk taslakta çizim karenin üst %55'inde toplandı, altı boş tepe kaldı. Nesneleri büyüt,
  zemin çizgisini +900 civarına çek.
- Nesneyi kareye sığdırmadan ölçekleme: 2,75 ölçekli planörün kuyruğu sol kenardan taştı.
  Uç noktaları (burun, kuyruk, kanat ucu) × ölçek hesabını yap, sonra kareye bak.
- Etiket çakışmaları: solan etiketle yeni beliren etiket aynı yerde üst üste bindi; hareketli
  nesne (tırmanan planör) sabit etiketin ve bulutun üstünden geçti. Hareketin **başını, ortasını
  ve sonunu** ayrı ayrı karede kontrol et.
- Açık renk yazı beyaz bulutun üstünde okunmaz; bulut yolunu ya da etiketi kaydır.
- Kısa satır (2 sn) kendi sahnesini taşıyamaz: olay satırın son kelimesine bağlanınca sahne
  bitmeden görülmedi (halat bırakma). Olayı satırın ilk kelimesine bağla ya da iki satırı tek
  sahnede topla.
- Sahne sonundan sonraya taşan hareket yarıda kesilir (sarmal bulut tabanına varmadan sahne
  kaydı). Hareketin bitişini bir sonraki sahnenin başlangıcına (`t_sonraki - 0.4`) bağla.
- `W()` kelime zamanını harf payından tahmin eder, Türkçe harfleri saymaz ve cümle içi
  duraklamayı bilmez; ±0,3 sn kayabilir. Kritik vuruşu satır başına ya da sonuna yakın kur.
- Sahne sayısı fazlaysa (10 sahne / 66 sn) her şemaya 4-6 sn kalır; karmaşık şemayı iki satıra
  yay (termik sahnesi 11 sn ve en iyi okunan sahne).

**Kareye bakma döngüsü**

1. Taslak: `render.py --probe <zamanlar> --size 540x960`. Zamanları satır ortalarından değil,
   her sahnenin **dolduğu andan** (son etiket belirdikten sonra) ve hareketli nesnenin uç
   konumlarından seç. 15-17 kare yeter; hepsini tek kontak tabakasına dizip bak.
2. Geçiş ve hareket: `render.py --strip t0:t1:8` (sahne geçişi, sarmal, bırakma anı).
3. Son render + altyazıdan sonra `ffmpeg -ss <t> -i <ad>.mp4 -frames:v 1` ile **altyazılı**
   kareleri çıkar: altyazının etikete binmediğini ve en çok iki satır olduğunu gör.
4. Satır sınırlarını doğrula: her satırı tek başına seslendirip süresini `timing.json`'daki
   süreyle karşılaştır (fark 0,05 sn'yi geçiyorsa `split_takes.py` yanlış yerden kesmiştir).

Süre: 66 saniyelik filmin 1080×1920 render'ı birkaç dakika sürer; 540×960 tek kare ~0,1 sn, yani taslak döngüsü hızlıdır.

### 7. Dosyalar (skia yolu)

- Proje klasörü repo dışında: `~/ai-influencer-films/<kısa-ad>/`. Video, ses ve indirilen
  görseller repoya girmez.
- Python ortamı (bir kez):

  ```
  python3 -m venv ~/.local/share/ai-influencer-film-venv
  ~/.local/share/ai-influencer-film-venv/bin/pip install -r .claude/skills/cinematic-film/requirements.txt edge-tts
  ```

  Windows: `py -m venv %USERPROFILE%\ai-influencer-film-venv` ve aynı `pip install`.
  Komutları bu ortamın `python`'ıyla çalıştır. Önce `scripts/check_setup.py`.

- Bittiğinde: `out/final.mp4`, `credits.md` ve kaynak listesi (`fact_notes`) birlikte teslim
  edilir. Panelde içerik kartı açarken kaynak türü ve notlara bunları yaz.

### 8. Stil yolu: `film-styles` + `edit-video` (denendi: `ornek/planor-stil/`)

Dışarıdan alınan beş skill (`find-ideas`, `write-script`, `edit-video`, `film-styles`,
`animated-explainer`; kaynak ve değişiklikler `.claude/skills/edit-video/KAYNAK.md`) bu yolun
parçasıdır. Önce `film-styles/SKILL.md`, seçtiğin stilin `STYLE.md` dosyası,
`film-styles/references/directing.md` ve `building.md` okunur. Bu bölüm yalnızca projeye özgü
farkları ve çalıştığı görülen komutları verir. FavStash servisi, CLI'ı ve `publish-and-analyze`
kullanılmaz; yayın panelden yapılır.

Çalışan örnek: `ornek/planor-stil/` ("Planör nasıl uçar?", Blueprint/ozalit stili, 48,8 sn, dokuz
şekil). `assets/bp.js` yeniden kullanılabilir çizim motorudur (kâğıt dokusu, uçta kalemle çizilen
yol, tarama, ölçü çizgisi, balon, soldan sağa yazılan yazı, etiket); `assets/film.js` sahneler,
`assets/plan.js` sahne başlangıçları ve ses işaretleridir. Yeni film = bu klasörü kopyala,
`spec.py`, `plan.js` ve `film.js` içindeki sahneleri değiştir.

**Bir kez kurulum** (repo dışında; ~410 MB, Chrome olarak makinedeki Google Chrome kullanılır):

```
node .claude/skills/edit-video/scripts/init-workspace.mjs --workspace ~/ai-influencer-films --install
node .claude/skills/edit-video/scripts/doctor.mjs --workspace ~/ai-influencer-films
```

HyperFrames 0.8.32, GSAP 3.14.2 ve three 0.168.0 `~/ai-influencer-films/.favstash-studio/runtime/`
altına kurulur. Python tarafı skia yoluyla aynı sanal ortamdır (`numpy`, `edge-tts`).

**Her film için** (`R=~/ai-influencer-films/<ad>`, `PY=~/.local/share/ai-influencer-film-venv/bin/python`,
`S=.claude/skills`, `HF=~/ai-influencer-films/.favstash-studio/runtime/node_modules/.bin/hyperframes`):

```
cp -R $S/anlatim-videosu/ornek/planor-stil $R          # iskelet; sonra spec.py, plan.js, film.js yazılır
$PY $S/anlatim-videosu/scripts/edge_takes.py $R        # satır başına edge-tts kaydı + kelime zamanları
$PY $S/edit-video/scripts/voice.py $R --engine files   # sesi kilitler: voice/vo.wav, voice/timing.json
$PY $S/anlatim-videosu/scripts/zaman_js.py $R          # assets/timing.js + out/captions.srt
node $R/tools/cues.mjs                                 # plan.js -> cues.json
export HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1
$HF lint $R < /dev/null
$R/tools/shots.sh a 0,0.5,3,7.5,12.6                   # kareler: snapshots/a/sheet-N.jpg (3'lü tabaka), bak
$HF render $R --fps 30 --quality high --workers 4 --output $R/previews/<ad>-v01.mp4 < /dev/null
node $S/edit-video/scripts/sfx-sync.mjs mix $R/cues.json --voice $R/voice/vo.wav \
  --out $R/out/mix-v01.wav --video $R/previews/<ad>-v01.mp4 --mux $R/out/<ad>-tr.mp4
node $S/edit-video/scripts/sfx-sync.mjs check $R/out/<ad>-tr.mp4 --mix $R/out/mix-v01.wav \
  --cues $R/cues.json --strips $R/reports/sync-v01 --min-gain 0
```

`spec.py` içinde `LINES` ekranda görünecek haliyle yazılır ("3.000 kilometre"), okunuş `SPOKEN`
sözlüğüne (`{'3.000': 'üç bin'}`); `" | "` altyazı parçasını böler, sesi etkilemez. Ses ve hız:
`VOICE = 'tr-TR-AhmetNeural'`, `RATE = '+8%'`. Paketin Kokoro ve ElevenLabs seçenekleri kullanılmaz
(Kokoro'da Türkçe ses yok, ElevenLabs ücretli); `hyperframes tts` ve `hyperframes transcribe`
çalıştırma, model indirirler.

**Düzen (1080×1920, paketin güvenli alanı).** Okunması gereken her şey x 72-900, y 269-1248
içinde: başlık y 280-360, şekil y 390-1050, altyazı kutusu alt kenarı y 1236 ve en çok 720 px
genişlik, x=540 ortalı. y 1248'in altı ve üstteki 269 px platform arayüzünün altında kalır: oraya
yalnızca dekor (örnekte GENEL NOTLAR sütunu, antet, seri adı). Bu, skia yolundaki altyazı bandından
(alttan %22) daha yukarıdadır; iki yolun ölçülerini karıştırma.

**Tuzaklar (hepsi bu filmde yaşandı)**

- Paketin belgelerindeki `--quality delivery` sabitlenen sürümde yok ("Invalid quality"); `high` kullan.
- `hyperframes render` ve `snapshot` iş bitince girdi bekleyip dakikalarca asılı kalabiliyor
  (2 saniyelik render 3 dakika sürdü). Her komuta `< /dev/null` ekle.
- Yazı tipi: stil rehberinin önerdiği B612 Mono'da ve `animated-explainer` paketindeki üç yazı
  tipinde İ ı Ş ş Ğ ğ yoktu (eksik harf başka yazı tipiyle çizilir, kimse hata vermez). Seçmeden
  önce harfleri denetle; örnekte Architects Daughter + IBM Plex Mono var, ikisi de tam.
- Architects Daughter'da "1" büyük "I" gibi görünür; sayıları mono yazı tipiyle yaz. Ok (→)
  karakteri yok; oku çiz.
- edge-tts kelime zamanları sese göre ~0,05 sn erken; `edge_takes.py` bunu düzeltir. `voice.py`
  satırlar arasına yalnızca 0,14 sn koyar; duraklama istiyorsan cümleyi aynı satırda noktayla böl
  (edge-tts noktada ~1 sn bekler).
- Sahne kesmesinde boş kare: yeni sahnenin ilk çizgileri kesmeden **önce** başlamalı
  (`ramp(t, a - 0.5, …)`), yoksa ilk kareler yalnız zemin çizgisidir (termik sahnesinde oldu).
- Kelimeye bağlı öğe, kelime gelene kadar görünmez: `eback(0)` gibi sıfıra çok yakın değerler
  başıboş bir ok ucu çizdi. Koşulu ilerleme değerine değil zamana bağla (`t > t_kelime`).
- Solan etiketle yeni büyük yazı aynı yere düştü ("ÇEKİCİ UÇAK" / "HALAT BIRAKILDI"). Her
  sahnenin başını, ortasını ve sonunu ayrı karelerde gör.
- Büyük yazı zaten cümleyi söylüyorsa (MOTOR YOK) altyazı kutusunu o parça için kapat; iki
  transkript katmanı üst üste biner (`HIDE_CAPTION`).
- Ses işaretini olayın ilk göründüğü kareye koy; `check --strips` tabakasında kırmızı kare olayın
  ilk karesi değilse `plan.js`'teki zamanı düzelt (damga bir kare geç kalmıştı).
- Çalışma klasörünü repo içinde açma: `init-workspace.mjs` bulunduğu yere `.favstash-studio/`
  kurar (`.gitignore`'da, ama 400 MB).

Bilinen eksikler: müzik yok (paket müzik içermez; kendi lisanslı parçan olursa `cues.json`'a
`"bed": true` ile eklenir), kalem/kâğıt sesi yok, stilin WebGL kâğıt bileşimi yerine Canvas 2D
kullanıldı. `animated-explainer` örneği derleniyor ve lint'ten geçiyor, ancak denemede anlık
görüntülerde üstteki konuşma satırı görünmedi ve tam render alınmadı; o stili kullanmadan önce
kısa bir render ile doğrula.

## Teslimden önce

- [ ] Her olgunun kaynağı `fact_notes` içinde, kullanıcı senaryoyu onayladı
- [ ] İlk 2 saniye kanca; süre 45-90 sn (stil yolunda ilk karede konu ve iddia yazılı)
- [ ] 1080×1920, altyazı gömülü ve güvenli alanda, Türkçe karakterler doğru
- [ ] Her sahnede anlatımı taşıyan hareketli bir çizim var; ekrandaki yazı kısa etiket
- [ ] Her satırdan bir kareye baktın; karanlık, taşan, üst üste binen öğe yok
- [ ] Altyazılı karelere baktın: altyazı en çok iki satır, etiketin üstüne binmiyor
- [ ] Ses: yanlış okunan kelime yok, müzik sesi bastırmıyor
- [ ] `credits.md` var; AI görseli varsa illüstrasyon olarak etiketli
