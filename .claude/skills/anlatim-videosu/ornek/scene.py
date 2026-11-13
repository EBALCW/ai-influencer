"""Mağarada 17 Gün: dikey (9:16) anlatım videosu. Pano tek sütun; kamera yukarıdan aşağı iner.
1080 px genişlikte zoom 1 → 3840 dünya pikseli genişlik, ~6830 yükseklik görünür."""
from engine import BigText, Card, Counter, Film, PenMark, Route

ACCENT = (240, 196, 60)        # sarı: tarih ve sayı vurguları
WATER = (70, 160, 200)
PAPER = (246, 243, 236)
INK = (30, 30, 34)
W_CARD, H_CARD = 3200, 1900
Y = {1: 0, 2: 3600, 3: 7200, 4: 10700, 5: 14300, 6: 18500, 7: 21600, 8: 25200, 9: 28600}


def build_film(doc):
    L, E, W = doc.L, doc.E, doc.W
    film = Film(doc.duration, fps=30, look="night")

    def card(line, title, lines, **kw):
        film.add(Card(0, Y[line], W_CARD, H_CARD, L(line) + 0.05, title=title, lines=lines, rgb=PAPER, text_rgb=INK,
                      accent=kw.pop("accent", ACCENT), title_size=kw.pop("title_size", 310), body_size=210, **kw))

    # 1  kanca: sonucu baştan söyle
    film.add(BigText("17 GÜN", 0, Y[1], 1300, L(1) + 0.05, rgb=ACCENT, grunge=False, hit=0.7))
    film.add(BigText("SULAR ALTINDAKİ MAĞARADA", 0, Y[1] - 1150, 270, L(1) + 0.6, type_on=0.9, grunge=False))
    film.add(BigText("12 ÇOCUK + ANTRENÖR", 0, Y[1] + 1050, 270, L(1) + 1.4, type_on=0.8, grunge=False))

    # 2-3  giriş ve su
    card(2, "23 HAZİRAN 2018", ["12 çocuk ve antrenörleri", "Tham Luang, Tayland"], title_size=270)
    film.add(Route((0, Y[2] + H_CARD / 2 + 150), (0, Y[3] - H_CARD / 2 - 150), t_in=L(3) - 0.3, dur=0.6, bend=0.25, width=26, rgb=WATER))
    card(3, "SU YÜKSELDİ", ["Muson yağmuru", "Çıkış kapandı"], accent=WATER)

    # 4  dokuz gün sessizlik
    film.add(Counter(0, Y[4], 1000, 9, W(4, "Dokuz") - 0.1, dur=1.1, caption="GÜN HABER YOK", rgb=ACCENT))

    # 5  bulundular
    card(5, "2 TEMMUZ", ["İki İngiliz dalgıç buldu", "Hepsi hayatta"])
    film.add(Counter(0, Y[5] + 2300, 800, 4, W(5, "dört") - 0.1, dur=0.8, suffix=" KM", caption="GİRİŞTEN İÇERİDE", rgb=WATER))

    # 6  çıkış yolu
    film.add(Route((-900, Y[6] - 900), (900, Y[6] + 900), t_in=L(6), dur=1.6, bend=0.5, width=30, rgb=WATER))
    film.add(BigText("DAR", -900, Y[6] - 250, 330, W(6, "dar") - 0.05, grunge=False))
    film.add(BigText("KARANLIK", 300, Y[6] + 150, 330, W(6, "karanlık") - 0.05, grunge=False))
    film.add(BigText("SU DOLU", 700, Y[6] + 1250, 330, W(6, "su") - 0.05, rgb=WATER, grunge=False))

    # 7  Saman Kunan: sade, vurgu ya da efekt yok
    film.add(Card(0, Y[7], W_CARD, H_CARD, L(7) + 0.05, title="SAMAN KUNAN", lines=["Gönüllü dalgıç", "6 Temmuz 2018"],
                  rgb=(34, 38, 48), text_rgb=(240, 240, 240), title_size=310, body_size=210, sfx=False))

    # 8-9  kurtarma
    card(8, "8-10 TEMMUZ", ["Tahliye başladı", "Birer birer dışarı"])
    film.add(Counter(0, Y[9], 1000, 13, W(9, "üç", nth=1) - 0.1, dur=1.0, caption="KİŞİ KURTARILDI", rgb=ACCENT))
    film.add(PenMark("underline", 0, Y[9] + 1250, 2600, 60, t_in=E(9) - 0.5, dur=0.5, width=36, rgb=ACCENT))

    # kamera: her kahramana göründükten ~0.3 sn sonra kon, satır boyunca hafifçe sür
    film.shot(0.0, 0, Y[1] - 200, 0.95)
    film.shot(E(1), 0, Y[1] + 150, 1.05, rot=0.4)
    for line in (2, 3):
        film.shot(L(line) + 0.4, 0, Y[line], 1.02, rot=-0.4 if line % 2 else 0.4)
        film.shot(E(line) - 0.1, 0, Y[line] + 250, 1.08)
    film.shot(L(4) + 0.4, 0, Y[4] + 150, 1.1)
    film.shot(E(4), 0, Y[4] + 300, 1.18, rot=-0.5)
    film.shot(L(5) + 0.4, 0, Y[5], 1.02)
    film.shot(W(5, "dört") - 0.5, 0, Y[5] + 150, 1.06)
    film.shot(W(5, "dört") + 0.4, 0, Y[5] + 1300, 0.78, rot=0.4)
    film.shot(E(5), 0, Y[5] + 1400, 0.8)
    film.shot(L(6) + 0.5, -300, Y[6] - 300, 0.95, rot=-0.6)
    film.shot(E(6), 300, Y[6] + 500, 0.95, rot=0.5)
    film.shot(L(7) + 0.5, 0, Y[7], 1.0)
    film.shot(E(7) + 0.3, 0, Y[7] + 100, 1.06)
    film.shot(L(8) + 0.4, 0, Y[8], 1.02, rot=0.4)
    film.shot(E(8) - 0.1, 0, Y[8] + 250, 1.08)
    film.shot(L(9) + 0.4, 0, Y[9] + 150, 1.05)
    film.shot(film.duration, 0, Y[9] + 250, 0.9, radius=9000, strength=0.15)
    return film
