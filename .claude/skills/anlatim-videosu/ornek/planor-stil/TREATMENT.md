# Planör nasıl uçar? — Blueprint, 1080×1920, 48,8 sn

Stil: `film-styles/styles/07-line-diagrams/blueprint/STYLE.md`. Yöntem: `film-styles/references/directing.md`.

## Üç yapı adayı

1. **Parça parça çizim** (genel görünüş → kalkış → kanat kesiti → termik): stilin klişesi, kanca zayıf.
2. **Rekordan geriye** ("3.008 km, motorsuz" → nasıl?): sayı ilk üç saniyede, soru açık kalır. **Seçilen.**
3. **Reddedilen pafta** (önce damga, sonra neden): çarpıcı ama "motor yok" doğru bir eksiklik değil, yanıltır.

Seçilen yapı 2: kanca sayıyla açılır, 23. saniyede ikinci soru ("hep alçalıyorsa?") dalgayı yeniden
kurar, 37. saniyede üçüncü vuruş (22+ km) gelir, son kare ilk kareye döner (döngü).

## Logline

Motoru olmayan bir uçak, yükselen havayı bularak saatlerce ve binlerce kilometre uçar.

## Çekim listesi (sesin kelime zamanlarına bağlı; `assets/plan.js`)

| Şek. | Süre (sn) | Ne çizilir                                                                                       | Neden                                             |
| ---- | --------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 1    | 0–7,4     | Planör, hayalet pervaneye çarpı, MOTOR YOK / YAKIT YOK, canlı menzil ölçüsü 0 → 3.008 km, NASIL? | İlk karede konu ve iddia; sayı 5. saniyede oturur |
| 2    | 7,4–12,5  | Çekici uçak + halat + planör, vinç (kesik çizgi = seçenek), halat bırakılır                      | Tek hareketli olay: ayrılma                       |
| 3    | 12,5–15,9 | Süzülüş yolu, kısalan yükseklik ölçüsü, büyüyen hız oku                                          | Canlı ölçü = stilin kendi hamlesi                 |
| 4    | 15,9–19,0 | Taralı kanat kesiti, aşağı dönen akım çizgileri, KALDIRMA oku                                    | Mekanizmanın kalbi, yakın plan                    |
| 5    | 19,0–23,3 | Süzülme üçgeni, 1 km / 40–50 km ölçüleri, gerçek eğim şeridi                                     | Oran çizimle; "ölçeksiz" notu dürüstlük için      |
| 6    | 23,3–26,8 | Yere inen süzülüş yolu, dev soru işareti, revizyon bulutu                                        | İkinci kanca                                      |
| 7    | 26,8–37,6 | Güneş, ısınan tarla, sütun, kümülüs, TERMİK, sarmal tırmanış                                     | En uzun sahne; cevap                              |
| 8    | 37,6–44,3 | Dağ, dalga çizgileri, irtifa cetveli, 22+ km                                                     | Ölçek sürprizi                                    |
| 9    | 44,3–48,8 | Aynı planör, onay işaretleri, kırmızı SADECE HAVA damgası                                        | Stilin tek mavi olmayan rengi, bir kez            |

Altyazı: çizim notu kutusu (NOT / n), x=540 ortalı, en çok 720 px, alt kenar y=1236; aynı satırlar
GENEL NOTLAR sütununa da yazılır. Büyük yazının kendisi altyazıyken (MOTOR YOK, SADECE HAVA) ikinci
katman açılmaz.

## Ses tablosu

| Olay                            | Ses (edit-video paketi)     |
| ------------------------------- | --------------------------- |
| Çarpı, onay işareti             | `ui-click`                  |
| Sayaç (menzil, km, irtifa)      | `ratchet`, oturunca `thock` |
| Yeni şekil (kesme)              | `camera-shutter-light`      |
| Etiket, ölçü, tur               | `tick`                      |
| NASIL?, KALDIRMA, yükselen hava | `ui-pop`                    |
| Halat bırakılır, TERMİK         | `latch`                     |
| 22+ KM                          | `clean-ding` (bir kez)      |
| Damga                           | `thock`                     |

Müzik yok (paket müzik içermiyor). Kâğıt/kalem foley'i yok.

## Stilden bilinçli sapmalar

- WebGL bileşimi yerine Canvas 2D: kâğıt dokusu bir kez üretilir, gölge/ıslaklık kanalı yok.
- 24 yerine 30 fps; müzik ızgarası yerine kelime zamanları.
- Pafta mobilyası (başlık, notlar, antet) ekrana sabit; kamera yalnızca şekil alanında %3 yaklaşır.
