# Blender ile 3D kesit anlatım (başsız)

Bu klasör, "toprağı yandan kesip içini gösteren" 3D anlatım videoları için küçük bir Blender kitidir:
mağara, tünel, kuyu, batık, maden gibi konularda kesit şeması + loş 3D sahneler + seslendirme.
Blender arayüzü açılmaz; her çekim bir Python betiğiyle kurulur ve komut satırından render edilir.

İlk kullanıldığı film: "Mağarada 17 Gün" (Tham Luang, 2018), 40 çekim. İki sürümü var: v1 (5:08, ilkel
figürler, ışıksız düz kesit) ve v2 (4:56, MPFB insan figürleri, derinlikli ve ışıklı kesit, ayrı yazı geçişi).
Filmin dosyaları depo dışında durur (`~/ai-influencer-films/`); buradaki kod yalnızca yeniden kullanılabilen
kısımdır. Çalışan örnekler: `../ornek/tham-luang-3d/` (v1) ve `../ornek/tham-luang-3d-v2/` (v2). v2'de
öğrenilenler bu dosyanın sonundaki "v2" bölümlerindedir.

## Dosyalar

| Dosya            | Ne işe yarar                                                                |
| ---------------- | --------------------------------------------------------------------------- |
| `kit.py`         | Yapı taşları: malzeme, etiket, kesit şeridi, rota çizgisi, figürler, kamera |
| `figures.py`     | MPFB insan figürleri: dalgıç, formalı çocuk, taşınan çocuk, kurtarıcı; poz  |
| `ornek_cekim.py` | En küçük çalışan çekim: tünelde dalgıç + tarih başlığı                      |

`kit.py` sahne kurmaz. Sahneyi (dağ kesiti, tünel, oda) filmin kendi betiği kurar; kit ona
`strip()`, `polyline()`, `diver()`, `sitter()`, `hud()` gibi parçaları verir.

## Gerekenler

- Blender 5.x: `/Applications/Blender.app/Contents/MacOS/Blender` (5.3 ile denendi)
- `ffmpeg-full` (altyazı yakmak için `subtitles` filtresi): `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`
- Seslendirme için `edge-tts` (hesap ya da anahtar istemez)

## İş akışı

Sıra önemli. Görüntü sese göre kesilir, tersi değil.

1. **Metin ve ses önce.** Metni bölümlere ayır (bölüm = bir ya da iki çekim), her bölümü edge-tts ile
   ayrı kaydet ve kelime zamanlarını (`WordBoundary`) sakla. Bölümleri aralarına kısa sessizlik
   koyarak birleştir. Toplam süreyi ancak şimdi bilirsin: 482 Türkçe kelime, `-2%` hızda 5:08 tuttu
   (saniyede yaklaşık 1,6 kelime; İngilizce için ezberlenen 2,5 burada yanlış çıkar).
2. **Çekim listesi zamanlardan.** Her çekimi bir bölümün başına ya da bölüm içindeki bir kelimeye
   çapala; süre bir sonraki çapaya kadar olan aralıktır. Süreleri 24 fps kare sınırına yuvarla.
   Çekim betiği süreyi bu listeden okur ve bütün hareketi oran (0..1) olarak tanımlar; metin
   değişince yalnızca liste yeniden üretilir.
3. **Önce durağan kare.** Her çekimden yarı çözünürlükte iki kare al, yan yana dizip bak. Kadraj,
   ışık ve yazı hataları burada saniyeler içinde görünür; tam render'da dakikalara mal olur.
4. **Render bütçesi.** Bir çekimi tam uzunlukta render edip kare başına süreyi ölç, toplam kareyle
   çarp. Sığmıyorsa önce çözünürlüğü ve örnek sayısını düşür, kare hızını en son.
5. **Birleştir.** Kare klasörü → çekim başına mp4 (1080x1920'ye lanczos ile büyüt) → sırayla ekle →
   ses karışımı → altyazısız ana kopya.
6. **Altyazı.** Kelime zamanlarından kısa parçalar (en çok 6 kelime, 36 harf) üret, ASS olarak yak.
7. **Bitmiş dosyaya bak.** Filmin her yerinden kare çıkar ve gerçekten incele: Türkçe harfler,
   altyazı ile etiket çakışması, boş ya da kararmış çekim, anlatımla görüntünün uyumu.

## Komutlar

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender

# durağan kare (yarı çözünürlük, çıktı: /tmp/ornek-0064.png ve /tmp/ornek-0191.png)
$B -b -P ornek_cekim.py -- /tmp/ornek still

# animasyon: 8 saniye, 720x1280, 24 fps, kareler /tmp/ornek-kareler/f-0001.png…
$B -b -P ornek_cekim.py -- /tmp/ornek-kareler anim 8

# kareler -> 1080x1920 mp4
ffmpeg -framerate 24 -i /tmp/ornek-kareler/f-%04d.png \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" -c:v libx264 -crf 13 ornek.mp4
```

Birden çok çekimi yan yana render etmek için çekim kimliklerini `xargs -P 3` ile dağıt; her
çekim kendi klasörüne yazar. `kit.reset()` `use_overwrite=False` ayarlar: kesilen render aynı
komutla kaldığı yerden sürer.

## Sahne kurma kalıpları

- **Kesit şeması (ortografik).** Dağ, mağara boşluğu ve su, `strip()` ile aynı XZ düzleminde üst
  üste konan şeritlerdir; Y'de birkaç santim öne alınan öndekini örter. Malzemeler ışımalıdır
  (`emit=1.0`), sahnede ışık yoktur: renk her karede aynı çıkar ve render ucuzdur. Kamera
  `camera(ortho=…)`; yaklaşma `ortho_scale` ile yapılır.
- **Yükselen su.** Su şeridinin üst kenarı `min(tavan, seviye)` ile kesilir; `rise_key()` ikinci bir
  seviye için şekil anahtarı ekler ve değeri kareye bağlar.
- **Kendini çizen rota.** `polyline(draw=[(kare, 0), (kare, 1)])` eğrinin `bevel_factor_end`
  değerini anahtarlar.
- **Tünel ve oda (perspektif).** Arka duvar tek düzlem; tavan ve taban, farklı derinliklere
  konmuş birkaç `strip()` katmanıdır (kâğıt kesme gibi). Öndeki katman neredeyse siyah bir
  siluettir ve kadrajı çerçeveler. Araya birkaç `rock_blob()` konunca fener gerçek hacim aydınlatır.
- **Fener.** `diver()` ileri bakan bir spot ve yarı saydam koni kurar. Arka duvar kameraya dönük
  olduğu için ileri bakan spot onu aydınlatmaz; duvara dönük, konisi olmayan ikinci bir spot
  eklenir (örnekte var).
- **Figürler.** `limb()` iki eklem arasına silindir ve uçlarına küre koyar; poz, eklem noktalarını
  yazarak tanımlanır. Küçük ya da silüet görünecek figürler için yeterli, yakın plan için değil.
- **Ekran yazısı.** `hud()` yazıyı kameraya bağlar; konum ve boyut kare yüksekliğinin oranıdır
  (`y=+0.33` üstten %17). Dünya içi etiket için `text()`.

## Ölçülen hızlar

MacBook Air M4 (24 GB, fansız), EEVEE, 720x1280, 8 örnek, `Standard` görünüm dönüşümü.
Aynı anda başka render işleri de çalışıyordu.

| Durum                                             | Kare başına    |
| ------------------------------------------------- | -------------- |
| Tünel çekimi, tek süreç, 12 örnek                 | 0,83 sn        |
| Kesit çekimi (ışıksız), tek süreç, 8 örnek        | 0,30 sn        |
| Üç süreç yan yana, 8 örnek: süreç başına          | 0,7-1,2 sn     |
| Üç süreç yan yana, 8 örnek: toplam verim          | 0,33-0,39 sn   |
| Durağan kare, yarı çözünürlük (sahne kurma dahil) | 2-6 sn / çekim |

Filmin tamamı (40 çekim, 7.398 kare) üç süreçle yaklaşık 40 dakikada render edildi. GPU tek
süreçte de neredeyse dolu çalışıyor: üç süreç toplam verimi iki katına bile çıkarmıyor, ama sahne
kurma ve PNG yazma gibi CPU işleri üst üste bindiği için yine de kazandırıyor.

1080x1920'de 24 örnek kare başına yaklaşık 3 saniyeydi; 5 dakikalık film için 6 saat eder.
720x1280'de render edip lanczos ile büyütmek, loş ve yumuşak sahnelerde gözle ayırt edilmiyor;
ince yazılarda hafif yumuşama var.

## Düşülen tuzaklar

- **Motor adı** `BLENDER_EEVEE` (5.x'te `BLENDER_EEVEE_NEXT` değil). Saydamlık için
  `mat.surface_render_method = "BLENDED"`.
- **Görünüm dönüşümü.** Varsayılan AgX soluk çıkıyor; `Standard` kullan. `Standard`'da ışıma gücü
  1'in üstündeki renkli yazılar beyaza kırpılır: turuncu etiket için `emit=1.0` ve doygun bir renk.
- **Işıksız sahnede figür.** Kesit sahnesinde ışık olmadığından ışımasız malzemeli figürler simsiyah
  çıkar; malzemelerine kendi renklerinde ışıma ver.
- **Eski kareler.** `use_overwrite=False` yüzünden, süresi ya da içeriği değişen çekimin klasörü
  silinmeden yeniden render edilirse eski kareler sessizce kalır. Çekim değiştiyse klasörünü sil.
- **Doğrusal anahtar.** Varsayılan Bezier, her çekimin başında ve sonunda kamerayı durdurur; kesmeler
  takılır. `reset()` yeni anahtarları doğrusal yapar (`ease()` ile geri alınır).
- **Dikey karede sensör.** `sensor_fit=AUTO` iken 36 mm uzun kenara (yüksekliğe) uygulanır; `hud()`
  bunu hesaba katar. Ortografik kamerada `ortho_scale` de yüksekliktir.
- **Yağmur ve tortu.** Yüzlerce ayrı nesneyi `bpy.ops` ile eklemek yavaştır; yağmuru tek ağ olarak
  kur ve nesneyi kaydır.
- **Işık konisi.** Düz beyaz ve opak koni kaba görünür. `cone_mat()` uca doğru ve kenarlarda söner;
  tepe saydamlığı karanlık sahnede 0,04-0,08, aydınlık su içinde 0,10-0,16 iyi durdu.
- **Yumuşak gölge + az örnek** karıncalanır ve kareden kareye titrer. Nokta ışığın
  `shadow_soft_size` değerini küçült (0,08) ya da o çekimde örnek sayısını artır.
- **Parlak su.** Düşük pürüzlülükte nokta ışık suda çirkin bir disk olarak yansır; 0,45 civarı tut.
- **Altyazı bandı.** Altyazı karenin %70-78 yüksekliğinde durur. Kesit kamerasını mağara karenin
  üst-orta bölümüne gelecek şekilde kaydır, etiketleri mağaranın üstüne koy.
- **edge-tts** kayıt sonunda yaklaşık 0,8 sn sessizlik bırakır; bölümleri birleştirirken son kelimenin
  bitişinden 0,25 sn sonra kes, yoksa film uzar. Kelime zamanları sese göre 0,05 sn erkendir.
- **Şematik olduğunu söyle.** Kesit gerçek bir ölçüm değilse karede küçük bir "şematik gösterim"
  notu bulunsun.

## v2: insan figürleri (MPFB, başsız)

`figures.py`, MakeHuman tabanlı MPFB2 eklentisinin temel insan ağını kullanır (Blender Extensions'tan "MPFB";
modül `bl_ext.user_default.mpfb`, 2.0.18 ile denendi). Arayüz açılmaz, internetten varlık inmez; üretilen
karakterler CC0'dır.

```python
import kit as K, figures as Fg
K.reset(); Fg.forget()          # reset sahneyi ve eklentiyi sıfırlar; forget() yeniden açtırır
d = Fg.diver("d1")              # yatay yüzen mağara dalgıcı, kök çerçevesinde baş +X
Fg.kick(d, 1, 240, period=45)   # palet vuruşu (iskelet canlı kalır)
b = Fg.boy("c1", shirt=Fg.SHIRTS[0], pose_name="huddle", lod=0.45)   # oturan formalı çocuk (durağan ağ)
c = Fg.carried("t1")            # uyutulmuş, taşınan çocuk: neopren, tam yüz maskesi, göğüste tüp
r = Fg.rescuer("k1", pose_name="kneel", dark=True)                   # diz çökmüş kurtarıcı/doktor
```

Nasıl çalışıyor, nerede takılıyor:

- **Gövde.** `HumanService.create_human(scale=0.1, macro_detail_dict=…)` 19 bin köşeli, A pozunda çıplak bir
  manken verir (0,2 sn). Yaş `age` ile ayarlanır: 0,19 yaklaşık 10 yaş, 0,30 yaklaşık 14 yaş (1,37 m), 0,5
  yetişkin (1,66 m). `TargetService.bake_targets()` şekil anahtarlarını ağa işler,
  `HumanService.add_builtin_rig(h, "default_no_toes")` 137 kemikli iskeleti ağırlıklarıyla ekler (0,2 sn).
- **Yardımcı geometri.** Temel ağda giysi, saç ve göz yardımcıları da vardır ve bir Mask değiştiricisiyle
  gizlenir. `body()` değiştiriciyi kaldırır, `body` grubu dışındaki köşeleri siler; saç ve göz yardımcılarını
  bırakır. Saç yardımcısı uzun bir peruktur, göz hizasının altı kesilir. Saç ve göz köşeleri baş kemiğine bağlanır.
- **Giysi boyayarak.** Çevrimiçi giysi paketleri kurulu değil. `paint()` her yüzü, köşelerinin en ağır bastığı
  kemiğe ve dinlenme pozundaki yüksekliğine göre sınıflar (forma, şort, çorap, neopren…) ve malzeme atar. Bol
  giysi için yüzler kopyalanıp normal yönünde şişirilir (kabuk); kabuğun sınır köşeleri şişirilmez, yoksa etek
  ve kol ağzı püskül gibi durur. Alttaki yüz de aynı malzemeyi alır: hiçbir pozda ten sızmaz. Gövdeyi `paint()`
  ile giydirmeden sahneye koyma; yakın kareye bakarak kontrol et.
- **Önce boya, sonra azalt.** Decimate boyamadan önce uygulanırsa giysi sınırları tırtıklı çıkar. `lod=0.45`
  uzak figürler için yeter.
- **Ekipman.** Maske, kask, tüp, palet, ayakkabı basit ağlardır; `attach()` hepsini gövde ağına katar ve tek
  kemiğe ağırlık 1 ile bağlar. Figür tek nesnedir, poz verince ekipman da gelir.
- **Poz.** Kemik eksenlerini tahmin etmek yerine `pose(fig, [(kemik, (x, y, z)), …])` her kemiği iskelet
  uzayında verilen yöne çevirir (ayakta çerçeve: Z yukarı, yüz -Y, +X figürün solu). Sıra üstten alta olmalı.
  `".LR"` ile biten ad iki tarafa aynalanır. Poz verilirken iskelet değiştiricisi geçici kapatılır, yoksa her
  `view_layer.update()` ağı yeniden hesaplar.
- **Durağan figür.** `freeze()` pozu ağa işler ve iskeleti siler; `clone()` aynı ağı paylaşan kopya verir
  (kalabalık). Yalnızca yüzen dalgıcın iskeleti canlı kalır.
- **Palet vuruşu.** `kick()` uyluk ve baldır için iki uç poz hesaplar, arasını küresel ara değerle anahtarlar.
  İki uç dördeyin iç çarpımı negatifse biri ters çevrilmeli, yoksa bacak uzun yoldan döner.
- **Yatay gövde.** Yüzme pozunda sırt hafif kavisli olduğu için bacaklar yukarı kalkar; iskelet 13° burun
  yukarı döndürülerek düzeltildi.
- **Süre.** 13 çocuklu oda sahnesi yaklaşık 10 saniyede kurulur; dalgıç 0,5 sn.
- **Görünüş sınırı.** Figürler orta ve uzak planda insan gibi okunur. Çok yakın planda giysi boyalı gövde gibi
  durur, eller A pozundaki gibi açıktır, yüz genel bir mankendir. Yakın plan gerekiyorsa loş ışık ve arkadan
  ya da yandan açı seç.

## v2: derinlikli kesit

v1'in kesiti ışıksız, ortografik ve düzdü. v2'de (örnek: `../ornek/tham-luang-3d-v2/film.py`, `kesit()`):

- Kesit yüzü, mağaranın üstünde ve altında kalan ayrı şeritlerdir; boşluk gerçekten deliktir. Arkasında
  `ribbon()` ile tavan ve taban yüzeyleri, 3 birim geride bir arka duvar, tek ağ halinde sarkıtlar ve birkaç
  kaya vardır. Odalara loş nokta ışıklar konur.
- `strata_mat()` yatay tortul tabakalar verir: renk bandı, kabartma ve derine doğru kararma. Güneş ışığını
  yüze yatık düşür (X dönüşü 40° civarı), yoksa kabartma görünmez.
- Su iki parçadır: yarı saydam ön yüz (şekil anahtarıyla yükselir) ve boşluğun içinde ayrı bir su yüzeyi
  düzlemi. Düzlemi kesit yüzünden 5-10 cm geride başlat; aynı düzlemde olursa kayanın üstünde çizgi çıkar.
- Kamera perspektiftir (85 mm, 4° aşağı bakış): katmanlar arasında paralaks olur, su yüzeyi görünür.
  `ocam()` karenin ortasına gelecek noktayı ve görünen genişliği alır, uzaklığı kendisi hesaplar.
- Dikey kareyi doldurmak için bütün mağarayı tek geniş karede gösterme. Mağaranın düşey kabartmasını büyüt
  (şematik olduğu yazıyla belirtilir) ve 11-15 birim genişlikte, mağara boyunca kayan kamera kullan.
- Kutu nesnesine `strata_mat()` verme: malzeme nesne koordinatı kullanır, ölçeklenmiş kutuda tabakalar
  kaybolur. Öne taşan zemini de `strip()` ile kur.

## v2: yazıları ayrı geçişte render et

720x1280'den büyütülen yazı yumuşar. `text()` ve `hud()` nesneleri `etiket` olarak işaretlenir (`label(o)` ile
rota, halka, nokta da eklenir) ve `render()` üç kipte çalışır:

- `still`: görüntü ve yazı birlikte, kadraj kontrolü için.
- `anim`: 720x1280 kareler. `split_labels=True` verilirse yazılar gizlenir (varsayılan: yazılar karede kalır, v1 gibi).
- `lab`: yalnızca etiketli nesneler, saydam zemin, 1080x1920. Etiket yoksa klasöre `YOK` dosyası bırakır.

Birleştirirken görüntü büyütülür, vinyet eklenir, yazı geçişi üstüne bindirilir:

```bash
ffmpeg -framerate 24 -i frames/c1/f-%04d.png -framerate 24 -i labels/c1/l-%04d.png -filter_complex \
  "[0:v]scale=1080:1920:flags=lanczos,vignette=PI/5[p];[p][1:v]overlay=0:0:format=auto" -c:v libx264 -crf 13 c1.mp4
```

Yazı geçişi sahneyi yine kurar ama render ucuzdur: çekim başına 3-150 sn, 40 çekim için üç süreçle 13 dakika.
Görünürlüğü anahtarlanmış yazılar (sayaç) görüntü geçişinde animasyon verisi sökülerek gizlenir.

## v2: ölçülen hızlar ve öğrenilenler

MacBook Air M4 (24 GB, fansız), EEVEE, 720x1280, 16 örnek, üç süreç yan yana.

| Durum                                                      | Süre                   |
| ---------------------------------------------------------- | ---------------------- |
| Tünel çekimi (canlı iskeletli dalgıç), tek süreç, 12 örnek | 0,4-0,5 sn / kare      |
| Bütün film, görüntü geçişi: 7.110 kare, üç süreç           | 105 dakika             |
| Aynı ölçüm, süreç başına                                   | ortalama 2,6 sn / kare |
| Yazı geçişi (1080x1920), üç süreç                          | 13 dakika              |
| Durağan kare, yarı çözünürlük, 40 çekim, üç süreç          | yaklaşık 3 dakika      |

- **v2, v1'den 2,5 kat yavaş render oldu** (40 dakikaya karşı 105). Tek süreçte ölçülen hız (0,4-0,5 sn) üç
  süreçte tutmadı; en uzun süren çekimler ışıklı kesit çekimleriydi (çekim başına 10-14 dakika). v1'de kesit
  ışıksız ve ışımalıydı; v2'de güneş, gölge, kabartma ve iç ışıklar var. Bütçe darsa kesitte örnek sayısını
  8'e indir ya da güneşin gölgesini kapat, ve süreyi tek çekimle değil üç süreç çalışırken ölç.
- **Hacim saçılması denendi, bırakıldı.** Dünyaya Volume Scatter eklenince sahne sise boğuldu, fener huzmesi
  yine görünmedi. Huzme için `cone_mat()` yumuşatıldı (kenarda ve uçta üstel sönme, uzunlamasına gürültü) ve
  tortu ışımasız yapıldı: `silt()` tek ağdır, tanecikler yalnızca fener ışığına girince parlar.
- **Tortu boyutu.** 1-3 cm'lik tanecikler kameraya yakınken kar tanesi gibi durur; 0,4-1 cm kullan ve
  kameraya en yakın 1 birimi boş bırak.
- **Renk rampası.** `color_ramp.elements[1].position` değerini küçültmek öğeleri yeniden sıralar ve eldeki
  başvuru başka öğeyi gösterir. Önce iki ucu ayarla, aradakileri `elements.new()` ile ekle.
- **Altyazı kayması.** edge-tts kelime zamanları sesin gerçek başlangıcından 0,07-0,19 sn erken (dört bölümde
  `silencedetect` ile ölçüldü). `captions.py` bütün satırları 0,12 sn geciktirir.
- **Ses yatağı.** Mekâna göre değişir: her katman (mağara havası ve damla, su altı gürlemesi, yağmur) film
  boyunca üretilir, `volume=…:eval=frame` ile çekim aralıklarında açılıp 0,7 sn'de geçiş yapar
  (`assemble.py`, `env()`).
