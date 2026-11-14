# Blender ile 3D kesit anlatım (başsız)

Bu klasör, "toprağı yandan kesip içini gösteren" 3D anlatım videoları için küçük bir Blender kitidir:
mağara, tünel, kuyu, batık, maden gibi konularda kesit şeması + loş 3D sahneler + seslendirme.
Blender arayüzü açılmaz; her çekim bir Python betiğiyle kurulur ve komut satırından render edilir.

İlk kullanıldığı film: "Mağarada 17 Gün" (Tham Luang, 2018), 5 dakika 8 saniye, 40 çekim. Filmin dosyaları
depo dışında durur (`~/ai-influencer-films/tham-luang-3d/`); buradaki kod yalnızca yeniden
kullanılabilen kısımdır.

## Dosyalar

| Dosya            | Ne işe yarar                                                                |
| ---------------- | --------------------------------------------------------------------------- |
| `kit.py`         | Yapı taşları: malzeme, etiket, kesit şeridi, rota çizgisi, figürler, kamera |
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
