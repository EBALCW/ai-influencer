"""Planör Nasıl Uçar?: çizim ağırlıklı dikey (9:16) anlatım videosu.

Kart ve sayı yerine her satırı kodla çizilmiş hareketli bir şema taşır. Yapı:
- Tek bir `Stage` öğesi bütün sahneleri çizer; her sahne (0, 0) merkezli 3840×6830'luk kareyi doldurur.
- Sahneler arası geçiş dikey kaydırmadır (kamera değil sahne kayar); kamera yalnızca hafifçe yaklaşır.
- Bütün zamanlar seslendirmeden gelir (L, E, W); sabit saniye yok.
- Güvenli alan: asıl çizim y = -3000…+1100 arasında. +1230…+2000 altyazı bandı, altı platform arayüzü;
  oraya yalnızca zemin, tepe ve akım çizgisi gibi dekor konur.
"""
import math

import skia
from engine import Film, Item, clamp, draw_text, ease_in_out, ease_out_back, ease_out_cubic, paint, partial_path, ramp, text_width

# ---------------------------------------------------------------- palet
NAVY = (16, 32, 60)
CREAM = (250, 244, 228)
WHITE = (252, 252, 248)
SHADE = (204, 216, 230)
YELLOW = (255, 204, 72)
ORANGE = (255, 140, 56)
CORAL = (238, 92, 80)
CYAN = (176, 228, 255)
GLASS = (70, 128, 172)
GREEN = (120, 200, 140)
HILL_FAR, HILL_MID, HILL_NEAR = (96, 138, 160), (56, 112, 108), (30, 80, 82)

HW, HH = 1920, 3415          # zoom 1'de karenin yarı genişliği ve yarı yüksekliği
SLIDE = 7400                 # sahne geçişinde kayma mesafesi (kare yüksekliğinden biraz fazla)
BG = skia.Rect.MakeLTRB(-2500, -SLIDE / 2, 2500, SLIDE / 2)


# ---------------------------------------------------------------- küçük yardımcılar
def lerp(a, b, u):
    return a + (b - a) * u


def mix(c1, c2, u):
    return tuple(lerp(a, b, u) for a, b in zip(c1, c2))


def col(rgb, a=1.0):
    return skia.Color(int(rgb[0]), int(rgb[1]), int(rgb[2]), int(255 * clamp(a)))


def poly(pts, close=True):
    p = skia.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    if close:
        p.close()
    return p


def curve(fn, x0, x1, step=60):
    """y = fn(x) eğrisini yol olarak verir (akım çizgileri, tepeler)."""
    p = skia.Path()
    x = x0
    p.moveTo(x, fn(x))
    while x < x1:
        x = min(x1, x + step)
        p.lineTo(x, fn(x))
    return p


def pop(t, t_in, dur=0.35):
    """Etiketlerin 'zıplayarak' belirmesi: 0 → 1 (hafif taşmalı)."""
    return ease_out_back(ramp(t, t_in, dur)) if t >= t_in else 0.0


def sky(c, stops):
    """Dikey gökyüzü geçişi. stops: [(konum 0..1, rgb)]."""
    sh = skia.GradientShader.MakeLinear([skia.Point(0, BG.top()), skia.Point(0, BG.bottom())], [col(s[1]) for s in stops], [s[0] for s in stops])
    p = skia.Paint(AntiAlias=True)
    p.setShader(sh)
    c.drawRect(BG, p)


def glow(c, x, y, r, rgb, a=0.6):
    sh = skia.GradientShader.MakeRadial(skia.Point(x, y), r, [col(rgb, a), col(rgb, 0)], [0.0, 1.0])
    p = skia.Paint(AntiAlias=True)
    p.setShader(sh)
    c.drawCircle(x, y, r, p)


def sun(c, x, y, r, t):
    glow(c, x, y, r * 4.2, (255, 232, 170), 0.5)
    for i in range(12):
        ang = i * math.pi / 6 + t * 0.12
        r0, r1 = r * 1.3, r * (1.75 + 0.12 * math.sin(t * 2 + i))
        c.drawLine(x + r0 * math.cos(ang), y + r0 * math.sin(ang), x + r1 * math.cos(ang), y + r1 * math.sin(ang), paint((255, 226, 130), 0.9, stroke=r * 0.11))
    c.drawCircle(x, y, r, paint((255, 222, 110)))
    c.drawCircle(x, y, r * 0.8, paint((255, 238, 160)))


CLOUD = [(-0.36, 0.0, 0.17), (-0.16, -0.1, 0.24), (0.08, -0.16, 0.28), (0.3, -0.04, 0.2), (0.44, 0.03, 0.12), (-0.5, 0.04, 0.1)]


def cloud(c, x, y, w, a=1.0, shade=SHADE, top=WHITE):
    """Düz tabanlı kümülüs: (x, y) tabanın ortası, w genişlik."""
    if a <= 0:
        return
    c.save()
    c.clipRect(skia.Rect.MakeLTRB(x - w, y - w, x + w, y + w * 0.05))
    for dy, rgb in ((0.0, shade), (-0.055, top)):
        for dx, cy, r in CLOUD:
            c.drawCircle(x + dx * w, y + (cy - 0.05 + dy) * w, r * w, paint(rgb, a))
        c.drawRoundRect(skia.Rect.MakeLTRB(x - 0.56 * w, y - 0.16 * w + dy * w, x + 0.52 * w, y + 0.05 * w + dy * w), 0.08 * w, 0.08 * w, paint(rgb, a))
    c.restore()


def hills(c, y, amp, wl, ph, rgb, a=1.0):
    def fn(x):
        return y - amp * (0.6 * math.sin(x / wl + ph) + 0.4 * math.sin(x / (wl * 0.37) + ph * 2.1))
    p = curve(fn, BG.left(), BG.right(), 90)
    p.lineTo(BG.right(), BG.bottom())
    p.lineTo(BG.left(), BG.bottom())
    p.close()
    c.drawPath(p, paint(rgb, a))


def land(c, y, scroll=0.0, far=True):
    """Üç katmanlı tepeler; scroll ileri hareket hissi verir (yakın katman daha hızlı)."""
    if far:
        hills(c, y, 210, 900, 0.4 + scroll * 0.25, HILL_FAR)
    hills(c, y + 420, 170, 700, 2.1 + scroll * 0.5, HILL_MID)
    hills(c, y + 900, 140, 560, 4.0 + scroll, HILL_NEAR)


def txt(c, res, text, x, y, size, rgb=CREAM, a=1.0, font="cond", align="center", shadow=True, track=0.03):
    if a <= 0:
        return
    if shadow:
        draw_text(c, res, text, x + size * 0.03, y + size * 0.05, size, font, NAVY, 0.55 * a, track, align)
    draw_text(c, res, text, x, y, size, font, rgb, a, track, align)


def tag(c, res, text, x, y, t, t_in, size=250, fg=CREAM, bg=NAVY, to=None, t_out=None):
    """Kısa etiket: koyu hap + açık yazı; to=(x, y) verilirse o noktaya ince bir çizgi ve nokta gider."""
    u = pop(t, t_in)
    if u <= 0:
        return
    a = clamp(u) * (1.0 if t_out is None else 1 - ramp(t, t_out, 0.3))
    if a <= 0:
        return
    w = text_width(res, text, size, "cond", 0.04) + size * 0.9
    h = size * 1.32
    if to is not None:
        pu = ease_out_cubic(ramp(t, t_in + 0.1, 0.35))
        ex, ey = lerp(x, to[0], pu), lerp(y, to[1], pu)
        c.drawLine(x, y, ex, ey, paint(CREAM, 0.9 * a, stroke=14))
        c.drawCircle(ex, ey, 30, paint(CREAM, a))
    c.save()
    c.translate(x, y)
    c.scale(u, u)
    r = skia.Rect.MakeLTRB(-w / 2, -h / 2, w / 2, h / 2)
    c.drawRoundRect(r, h / 2, h / 2, paint(bg, 0.9 * a))
    c.drawRoundRect(r, h / 2, h / 2, paint(fg, 0.55 * a, stroke=8))
    draw_text(c, res, text, 0, size * 0.33, size, "cond", fg, a, 0.04, "center")
    c.restore()


def arrow(c, x0, y0, x1, y1, w, rgb, p=1.0, a=1.0, outline=True):
    """Büyüyen ok: p 0 → 1 arasında (x0, y0) noktasından (x1, y1) noktasına uzar."""
    if p <= 0.02 or a <= 0:
        return
    ex, ey = lerp(x0, x1, p), lerp(y0, y1, p)
    L = math.hypot(ex - x0, ey - y0)
    if L < 1:
        return
    ux, uy = (ex - x0) / L, (ey - y0) / L
    nx, ny = -uy, ux
    hl = min(w * 2.0, L * 0.7)
    bx, by = ex - ux * hl, ey - uy * hl
    path = poly([(x0 + nx * w / 2, y0 + ny * w / 2), (bx + nx * w / 2, by + ny * w / 2), (bx + nx * w * 1.25, by + ny * w * 1.25), (ex, ey),
                 (bx - nx * w * 1.25, by - ny * w * 1.25), (bx - nx * w / 2, by - ny * w / 2), (x0 - nx * w / 2, y0 - ny * w / 2)])
    if outline:
        c.drawPath(path, paint(NAVY, 0.85 * a, stroke=w * 0.22))
    c.drawPath(path, paint(rgb, a))


def flow(c, path, rgb, a, width, phase, dash=(150, 170)):
    """Akan kesik çizgi: phase zamanla artarsa çizgiler yol boyunca ilerler."""
    if a <= 0:
        return
    p = paint(rgb, a, stroke=width)
    p.setPathEffect(skia.DashPathEffect.Make([dash[0], dash[1]], -phase))
    c.drawPath(path, p)


def dashed(c, path, rgb, a, width, dash=(60, 60)):
    flow(c, path, rgb, a, width, 0.0, dash)


def streaks(c, t, speed, n=9, y0=-3000, y1=1100, a=0.35, angle=0.0, seed=0):
    """Yanından geçen hava çizgileri: hız hissi."""
    for i in range(n):
        h = math.sin((i + 1 + seed) * 12.9898) * 43758.5453
        fr = h - math.floor(h)
        y = lerp(y0, y1, (i + 0.5) / n) + 120 * (fr - 0.5)
        ln = 380 + 500 * fr
        x = 2500 - ((t * speed * (0.7 + 0.6 * fr) + fr * 5000) % 5600)
        c.drawLine(x, y, x + ln, y + ln * math.tan(math.radians(angle)), paint(WHITE, a * (0.5 + 0.5 * fr), stroke=12))


# ---------------------------------------------------------------- uçak çizimleri
def _stroke(c, path, w=7.0, a=1.0):
    c.drawPath(path, paint(NAVY, a, stroke=w))


def glider_side(c, x, y, s=1.0, rot=0.0, flip=False, a=1.0):
    """Yandan planör (hafif perspektifli): burun +x yönünde, gövde ~1150 birim uzun, merkez kanat kökü."""
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.scale(-s if flip else s, s)
    far = poly([(60, -20), (-40, -262), (-92, -262), (-80, -16)])            # uzak kanat
    c.drawPath(far, paint(SHADE, a))
    _stroke(c, far, 6, a)
    tail = poly([(-766, -214), (-590, -214), (-580, -198), (-776, -198)])    # T kuyruk
    f = skia.Path()
    f.moveTo(448, 18)
    f.cubicTo(430, -42, 310, -84, 184, -82)
    f.cubicTo(70, -80, -60, -52, -170, -36)
    f.lineTo(-560, -24)
    f.lineTo(-648, -200)
    f.lineTo(-716, -200)
    f.lineTo(-672, 0)
    f.lineTo(-560, 8)
    f.cubicTo(-300, 30, -100, 62, 60, 76)
    f.cubicTo(230, 86, 410, 72, 448, 18)
    f.close()
    c.drawPath(f, paint(WHITE, a))
    c.save()                                                                  # gövdenin alt yarısına gölge
    c.clipPath(f, doAntiAlias=True)
    c.drawRect(skia.Rect.MakeLTRB(-800, 26, 500, 120), paint(SHADE, a))
    c.drawRect(skia.Rect.MakeLTRB(-730, -205, -640, -150), paint(ORANGE, a))  # dikey kuyruk ucu
    c.drawRect(skia.Rect.MakeLTRB(400, -60, 470, 100), paint(ORANGE, a))      # burun ucu
    c.restore()
    _stroke(c, f, 7, a)
    can = skia.Path()                                                         # kabin camı
    can.moveTo(396, -14)
    can.cubicTo(360, -52, 290, -72, 190, -70)
    can.cubicTo(110, -68, 40, -52, 4, -36)
    can.lineTo(70, -12)
    can.close()
    c.drawPath(can, paint(GLASS, a))
    c.drawLine(120, -56, 250, -58, paint(WHITE, 0.6 * a, stroke=7))
    _stroke(c, can, 6, a)
    c.drawPath(tail, paint(WHITE, a))
    _stroke(c, tail, 6, a)
    near = poly([(140, 0), (-70, 14), (-246, 316), (-196, 316)])              # yakın kanat
    c.drawPath(near, paint(WHITE, a))
    c.drawPath(poly([(-150.6, 259.1), (-220.5, 271.7), (-246, 316), (-196, 316)]), paint(ORANGE, a))
    _stroke(c, near, 7, a)
    c.restore()


def glider_front(c, x, y, s=1.0, rot=0.0, a=1.0):
    """Önden planör: kanat açıklığı ~2100 birim."""
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.scale(s, s)
    for sg in (-1, 1):
        w = poly([(sg * 30, -14), (sg * 1050, -92), (sg * 1050, -80), (sg * 30, 16)])
        c.drawPath(w, paint(WHITE, a))
        c.drawPath(poly([(sg * 900, -80.5), (sg * 1050, -92), (sg * 1050, -80), (sg * 900, -65.9)]), paint(ORANGE, a))
        _stroke(c, w, 7, a)
        c.drawLine(sg * 1050, -86, sg * 1066, -150, paint(NAVY, a, stroke=12))
    fin = poly([(-9, -270), (9, -270), (12, -30), (-12, -30)])
    c.drawPath(fin, paint(SHADE, a))
    _stroke(c, fin, 6, a)
    tp = skia.Rect.MakeLTRB(-190, -278, 190, -262)
    c.drawRoundRect(tp, 8, 8, paint(WHITE, a))
    c.drawRoundRect(tp, 8, 8, paint(NAVY, a, stroke=6))
    body = skia.Rect.MakeLTRB(-52, -62, 52, 74)
    c.drawOval(body, paint(WHITE, a))
    c.drawOval(skia.Rect.MakeLTRB(-36, -50, 36, 14), paint(GLASS, a))
    c.drawOval(body, paint(NAVY, a, stroke=7))
    c.restore()


def plane_top(c, x, y, s=1.0, rot=0.0, span=2000.0, chord=130.0, fus=760.0, a=1.0, squash=1.0, tip=ORANGE, body=WHITE):
    """Üstten uçak: burun -y yönünde. span/chord oranı planörü ya da kısa kanatlı uçağı verir.
    squash < 1 daireyi yandan görülen elipse çevirir (termikte dönen planör)."""
    c.save()
    c.translate(x, y)
    c.scale(s, s * squash)
    c.rotate(rot)
    h = span / 2
    for sg in (-1, 1):
        w = poly([(0, -0.38 * chord), (sg * h, -0.12 * chord), (sg * h, 0.3 * chord), (0, 0.62 * chord)])
        c.drawPath(w, paint(body, a))
        k = 0.86
        c.drawPath(poly([(sg * h * k, lerp(-0.38, -0.12, k) * chord), (sg * h, -0.12 * chord), (sg * h, 0.3 * chord), (sg * h * k, lerp(0.62, 0.3, k) * chord)]), paint(tip, a))
        _stroke(c, w, 7, a)
    tw, tc, ty = fus * 0.17, fus * 0.075, fus * 0.6
    tp = poly([(-tw, ty), (tw, ty), (tw * 0.9, ty + tc), (-tw * 0.9, ty + tc)])
    c.drawPath(tp, paint(body, a))
    _stroke(c, tp, 6, a)
    bw = fus * 0.05
    f = skia.Path()
    f.moveTo(0, -0.38 * fus)
    f.cubicTo(bw * 1.5, -0.34 * fus, bw * 1.4, -0.05 * fus, bw * 0.5, 0.2 * fus)
    f.lineTo(bw * 0.3, 0.68 * fus)
    f.lineTo(-bw * 0.3, 0.68 * fus)
    f.lineTo(-bw * 0.5, 0.2 * fus)
    f.cubicTo(-bw * 1.4, -0.05 * fus, -bw * 1.5, -0.34 * fus, 0, -0.38 * fus)
    f.close()
    c.drawPath(f, paint(body, a))
    _stroke(c, f, 7, a)
    c.drawOval(skia.Rect.MakeLTRB(-bw * 0.62, -0.31 * fus, bw * 0.62, -0.1 * fus), paint(GLASS, a))
    c.restore()


def towplane(c, x, y, s=1.0, rot=0.0, t=0.0):
    """Yandan çekici uçak: burun +x yönünde, ~760 birim uzun."""
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.scale(s, s)
    for wx, wy, r in ((150, 128, 34), (-330, 46, 18)):
        c.drawLine(wx - 12, wy - 70 if r > 20 else wy - 30, wx, wy, paint(NAVY, 1, stroke=12))
        c.drawCircle(wx, wy, r, paint(NAVY))
    f = skia.Path()
    f.moveTo(330, 4)
    f.cubicTo(320, -50, 260, -70, 190, -80)
    f.cubicTo(120, -100, 40, -96, -20, -70)
    f.lineTo(-330, -34)
    f.lineTo(-392, -160)
    f.lineTo(-436, -160)
    f.lineTo(-410, 12)
    f.cubicTo(-200, 50, 0, 78, 120, 76)
    f.cubicTo(240, 76, 322, 60, 330, 4)
    f.close()
    c.drawPath(f, paint(ORANGE))
    c.save()
    c.clipPath(f, doAntiAlias=True)
    c.drawRect(skia.Rect.MakeLTRB(-500, 20, 400, 100), paint((226, 108, 40)))
    c.drawRect(skia.Rect.MakeLTRB(-500, -8, 400, 8), paint(WHITE))
    c.restore()
    _stroke(c, f, 7)
    win = poly([(200, -62), (60, -78), (-10, -54), (30, -30), (210, -30)])
    c.drawPath(win, paint(GLASS))
    _stroke(c, win, 6)
    wing = skia.Rect.MakeLTRB(-60, -118, 210, -92)
    c.drawRoundRect(wing, 13, 13, paint(WHITE))
    c.drawRoundRect(wing, 13, 13, paint(NAVY, 1, stroke=7))
    c.drawLine(40, -92, 90, -20, paint(NAVY, 1, stroke=9))
    c.drawCircle(338, 0, 20, paint(NAVY))
    ph = abs(math.sin(t * 38))
    c.drawOval(skia.Rect.MakeLTRB(332, -150, 352, 150), paint(NAVY, 0.16))
    c.drawOval(skia.Rect.MakeLTRB(334, -150 * (0.35 + 0.65 * ph), 350, 150 * (0.35 + 0.65 * ph)), paint(NAVY, 0.75))
    c.restore()


def airfoil(chord=2500.0, m=0.05, pc=0.4, th=0.14, n=60):
    """Kambur kanat kesiti (NACA 4 haneli formülü); hücum kenarı (0, 0), veter +x boyunca."""
    up, lo = [], []
    for i in range(n + 1):
        s = (1 - math.cos(math.pi * i / n)) / 2
        yt = 5 * th * (0.2969 * math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4)
        yc = m / pc ** 2 * (2 * pc * s - s * s) if s < pc else m / (1 - pc) ** 2 * ((1 - 2 * pc) + 2 * pc * s - s * s)
        up.append((s * chord, -(yc + yt) * chord))
        lo.append((s * chord, -(yc - yt) * chord))
    return poly(up + lo[::-1])


def vortex(c, x, y, r, t, a=1.0, sg=1, rgb=CYAN):
    """Kanat ucu girdabı: dönen sarmal ve arkaya (aşağı) uzayan iz."""
    if a <= 0:
        return
    for k in range(3):
        yy = y + r * (1.2 + 2.0 * k)
        rr = r * (1 + 0.35 * k)
        p = skia.Path()
        for i in range(40):
            u = i / 39
            ang = sg * (u * 4.2 * math.pi + t * 5.0) + k * 1.3
            px, py = x + rr * u * math.cos(ang), yy + rr * u * math.sin(ang) * 0.75
            p.moveTo(px, py) if i == 0 else p.lineTo(px, py)
        c.drawPath(p, paint(rgb, a * (0.95 - 0.25 * k), stroke=max(9, r * 0.11)))


# ---------------------------------------------------------------- sahne yöneticisi
class Stage(Item):
    """Sahneleri sırayla çizer; bir sonrakine geçerken eskisi yukarı kayar, yenisi alttan gelir."""
    z = 0

    def __init__(self, scenes, trans=0.6):
        super().__init__(-1)
        self.scenes, self.trans = scenes, trans          # [(başlangıç zamanı, çizim işlevi)]

    def one(self, c, res, t, fn, dy):
        c.save()
        c.translate(0, dy)
        c.clipRect(BG)
        fn(c, res, t)
        c.restore()

    def draw(self, c, res, t):
        i = max(k for k, s in enumerate(self.scenes) if s[0] <= t or k == 0)
        t0, fn = self.scenes[i]
        u = ease_in_out(ramp(t, t0, self.trans)) if i > 0 else 1.0
        if u < 1:
            self.one(c, res, t, self.scenes[i - 1][1], -u * SLIDE)
        self.one(c, res, t, fn, (1 - u) * SLIDE)


# ---------------------------------------------------------------- film
DAY = [(0.0, (28, 70, 126)), (0.5, (104, 168, 212)), (0.75, (236, 222, 196)), (1.0, (236, 222, 196))]


def build_film(doc):
    L, E, W = doc.L, doc.E, doc.W
    look = dict(board="night.png", bg=(28, 70, 126), grade=(1.0, 1.0, 1.0), grain=0.012, glow=0.07, vignette=0.34, curve=0.14, dim=(8, 16, 34))
    film = Film(doc.duration, fps=30, look=look)
    film.items.remove(film.board)        # pano dokusu yok: her sahne kendi gökyüzünü çizer
    film.fade_in, film.auto_whoosh = 0.35, False

    # ---- 1  kanca: motoru yok, yine de uçuyor
    t_motor, t_saat, t_km = W(1, "motoru"), W(1, "saatlerce"), W(1, "yüzlerce")

    def s_hook(c, res, t):
        sky(c, DAY)
        sun(c, 1280, -1420, 230, t)
        cloud(c, -1900 + (t * 60) % 5200 - 600, -1250, 1300, 0.95)
        cloud(c, 2600 - (t * 90 + 900) % 5600, 780, 1700, 0.9)
        land(c, 1750, t * 0.5)
        streaks(c, t, 2600, n=8, y0=-1500, y1=900, a=0.3)
        txt(c, res, "PLANÖR", 0, -2330, 900, CREAM, ramp(t, 0.0, 0.3))
        txt(c, res, "NASIL UÇAR?", 0, -1830, 430, YELLOW, ramp(t, 0.15, 0.3))
        gx, gy = 330, -330 + 70 * math.sin(t * 1.3)
        rot = -3 + 1.6 * math.sin(t * 0.9)
        glider_side(c, gx, gy, 2.2, rot)
        nx, ny = gx + 448 * 2.2, gy + 18 * 2.2 - 448 * 2.2 * math.sin(math.radians(3))
        u = ramp(t, t_motor - 0.15, 0.3)                       # olmayan pervane: kesik çember, üstü çizili
        if u > 0:
            dashed(c, skia.Path().addCircle(nx + 40, ny, 330), CREAM, 0.85 * u, 14, (70, 60))
            for sg in (-1, 1):
                c.drawOval(skia.Rect.MakeLTRB(nx + 10, ny + (0 if sg > 0 else -300), nx + 70, ny + (300 if sg > 0 else 0)), paint(CREAM, 0.35 * u))
            x = poly([(nx - 220, ny - 260), (nx + 300, ny + 260)], False)
            x.moveTo(nx + 300, ny - 260)
            x.lineTo(nx - 220, ny + 260)
            c.drawPath(partial_path(x, ramp(t, t_motor + 0.05, 0.35)), paint(CORAL, 1, stroke=46))
        tag(c, res, "MOTOR YOK", 900, -1080, t, t_motor + 0.1, 290, to=(nx + 20, ny - 330))
        tag(c, res, "SAATLERCE HAVADA", -760, 640, t, t_saat, 250)
        tag(c, res, "YÜZLERCE KM", 900, 900, t, t_km, 250, fg=NAVY, bg=YELLOW)

    # ---- 2  kalkış: çekici uçak ya da vinç; halat bırakılır
    t2, t_ucak, t_vinc, t_halat, t_rel = L(2), W(2, "motorlu"), W(2, "yerdeki"), W(2, "halatla"), W(3, "halat")

    def s_tow(c, res, t):
        sky(c, DAY)
        k = t - t2
        climb = ease_in_out(ramp(t, t2 - 0.3, t_rel - t2 + 0.3))
        for i, (cx, cy, w) in enumerate(((-700, -2500, 1100), (1500, -1000, 900), (700, -3900, 1200))):
            cloud(c, cx - 200 * k + i * 30, cy + 170 * k, w, 0.9)
        land(c, 1500 + 900 * climb, k * 0.25)
        rel = ramp(t, t_rel, 1.5)
        e = ease_in_out(rel)
        bob = 26 * math.sin(t * 2.1)
        gx, gy, gr, gs = lerp(-560, -150, e), lerp(-1000, -1450, e) + bob, lerp(-11, 2, e), lerp(1.5, 2.0, e)
        px, py, pr = 1180 + 2900 * e * e, -1900 - bob * 0.6 + 500 * e * e, -11 + 34 * e
        # yükseklik göstergesi (sol kenar)
        bx, b0, b1 = -1740, -250, -2700
        c.drawLine(bx, b0, bx, b1, paint(CREAM, 0.55, stroke=16))
        for i in range(7):
            yy = lerp(b0, b1, i / 6)
            c.drawLine(bx - 50, yy, bx + 50, yy, paint(CREAM, 0.55, stroke=12))
        my = lerp(b0, b1, 0.08 + 0.84 * climb)
        c.drawLine(bx, b0, bx, my, paint(YELLOW, 1, stroke=30))
        c.drawPath(poly([(bx + 60, my), (bx + 190, my - 70), (bx + 190, my + 70)]), paint(YELLOW))
        txt(c, res, "YÜKSEKLİK", bx + 90, b1 - 90, 210, YELLOW, 1, align="left")
        # halat
        nose = (gx + 448 * gs * math.cos(math.radians(gr)), gy + 448 * gs * math.sin(math.radians(gr)) + 18 * gs)
        tail = (px - 410 * 1.4, py + 100)
        if rel <= 0:
            rope = skia.Path()
            rope.moveTo(*tail)
            rope.quadTo((tail[0] + nose[0]) / 2, (tail[1] + nose[1]) / 2 + 90, *nose)
            c.drawPath(rope, paint(CREAM, 1, stroke=13))
        else:
            ln = 1 - ease_out_cubic(ramp(t, t_rel, 0.9)) * 0.75           # halat çekiciye doğru toplanır
            rope = skia.Path()
            rope.moveTo(*tail)
            ex, ey = tail[0] - 900 * ln, tail[1] + 420 * ln
            rope.quadTo(tail[0] - 450 * ln, tail[1] + 120 * ln + 60 * math.sin(t * 9), ex, ey)
            c.drawPath(rope, paint(CREAM, 1, stroke=13))
            c.drawCircle(ex, ey, 26, paint(YELLOW))
            ru = ramp(t, t_rel, 0.5)
            if ru < 1:
                c.drawCircle(nose[0], nose[1], 60 + 260 * ru, paint(YELLOW, 1 - ru, stroke=22))
        towplane(c, px, py, 1.4, pr, t)
        glider_side(c, gx, gy, gs, gr)
        tag(c, res, "ÇEKİCİ UÇAK", 950, -2640, t, t_ucak, 250, to=(px, py - 210), t_out=t_rel - 0.3)
        tag(c, res, "HALAT", 560, -900, t, t_halat, 230, to=((tail[0] + nose[0]) / 2, (tail[1] + nose[1]) / 2 + 30), t_out=t_rel - 0.1)
        tag(c, res, "HALAT BIRAKILDI", 250, -2500, t, t_rel + 0.3, 300, fg=NAVY, bg=YELLOW)
        # vinç kutusu
        u = pop(t, t_vinc - 0.1, 0.45)
        if u > 0:
            c.save()
            c.translate(0, 620)
            c.scale(u, u)
            box = skia.Rect.MakeLTRB(-1700, -520, 1700, 520)
            c.drawRoundRect(box, 110, 110, paint(NAVY, 0.93))
            c.drawRoundRect(box, 110, 110, paint(CREAM, 0.7, stroke=12))
            c.save()
            c.clipRect(skia.Rect.MakeLTRB(-1690, -510, 1690, 510))
            c.drawRect(skia.Rect.MakeLTRB(-1700, 360, 1700, 520), paint(HILL_MID))
            cyc = ((t - t_vinc) % 3.0) / 3.0
            cu = ease_in_out(clamp(cyc / 0.8))
            ang = cu * math.radians(78)                                    # vinç planörü yay çizerek yükselir
            wx, wy = 1280, 330
            R = 2250
            sx, sy = wx - R * math.cos(ang * 0.33) + 0, wy - 30 - 760 * math.sin(ang)
            sx = lerp(-1250, 150, cu)
            fade = 1 - ramp(cyc, 0.82, 0.15)
            c.drawLine(wx - 60, wy - 40, sx + 250, sy + 12, paint(CREAM, 0.9 * fade, stroke=9))
            glider_side(c, sx, sy, 0.6, -38 * math.sin(cu * math.pi) ** 0.7 if cu > 0 else 0, a=fade)
            body = skia.Rect.MakeLTRB(wx - 150, wy - 150, wx + 230, wy + 30)
            c.drawRoundRect(body, 30, 30, paint(ORANGE))
            c.drawRoundRect(body, 30, 30, paint(NAVY, 1, stroke=8))
            c.drawCircle(wx - 60, wy - 50, 82, paint(CREAM))
            c.drawCircle(wx - 60, wy - 50, 82, paint(NAVY, 1, stroke=8))
            for i in range(3):
                a2 = -t * 9 + i * 2.094
                c.drawLine(wx - 60, wy - 50, wx - 60 + 74 * math.cos(a2), wy - 50 + 74 * math.sin(a2), paint(NAVY, 1, stroke=10))
            for dx in (-80, 150):
                c.drawCircle(wx + dx, wy + 30, 46, paint(NAVY))
            c.restore()
            txt(c, res, "YA DA VİNÇ", -1480, -250, 270, YELLOW, 1, align="left", shadow=False)
            c.restore()

    # ---- 3  hep alçalır, hızını alçalıştan alır
    t4, t_alc, t_hiz = L(4), W(4, "alçalır"), W(4, "Hızını")

    def s_descent(c, res, t):
        sky(c, DAY)
        k = t - t4
        cloud(c, 2300 - 520 * k, -2500 - 110 * k, 1300, 0.9)
        cloud(c, 3300 - 700 * k, 150 - 150 * k, 1500, 0.9)
        land(c, 2050 - 120 * k, k * 0.6)
        streaks(c, t, 2400, n=9, y0=-2600, y1=1000, a=0.3, angle=-7)
        slope = poly([(-2500, -1170), (2500, -1170 + 5000 * math.tan(math.radians(9)))], False)
        flow(c, slope, CREAM, 0.75, 16, k * 500, (110, 110))
        gx, gy = -150, -780 + 40 * math.sin(t * 1.4)
        glider_side(c, gx, gy, 1.85, 9)
        # yükseklik göstergesi: yavaşça boşalır
        bx, b0, b1 = -1690, 600, -2600
        lvl = 0.86 - 0.3 * ease_in_out(ramp(t, t4, E(4) - t4 + 0.6))
        c.drawRoundRect(skia.Rect.MakeLTRB(bx - 90, b1, bx + 90, b0), 90, 90, paint(NAVY, 0.7))
        c.drawRoundRect(skia.Rect.MakeLTRB(bx - 60, lerp(b0, b1, lvl), bx + 60, b0 - 30), 60, 60, paint(YELLOW))
        txt(c, res, "YÜKSEKLİK", bx - 100, b1 - 110, 230, CREAM, 1, align="left")
        u = ease_out_cubic(ramp(t, t_alc - 0.1, 0.5))
        arrow(c, -900, -2250, -900, -1550, 120, CORAL, u)
        ang = math.radians(9)
        sx, sy = gx + 950 * math.cos(ang), gy + 950 * math.sin(ang) + 40
        u = ease_out_cubic(ramp(t, t_hiz - 0.05, 0.55))
        arrow(c, sx, sy, sx + 800 * math.cos(ang), sy + 800 * math.sin(ang), 130, YELLOW, u)
        tag(c, res, "ALÇALIŞ", -250, -2050, t, t_alc, 260, fg=WHITE, bg=CORAL)
        tag(c, res, "HIZ", 1250, 330, t, t_hiz + 0.1, 320, fg=NAVY, bg=YELLOW)

    # ---- 4  kaldırma: hava aşağı çevrilir, kanat yukarı itilir
    t5, t_asagi, t_yukari, t_kald, t_agir = L(5), W(5, "aşağı"), W(5, "yukarı"), W(6, "kaldırma"), W(6, "ağırlığı")
    foil = airfoil()
    AOA, FX, FY = 8.0, -1250, -560            # hücum açısı, hücum kenarının konumu
    foil_m = skia.Matrix()
    foil_m.setRotate(AOA, 0, 0)
    foil_m.postTranslate(FX, FY)
    foil_w = skia.Path()
    foil.transform(foil_m, foil_w)

    def stream(y0):
        """Kanat çevresinde bükülen akım çizgisi: önünde hafif yukarı, üstünde kabarık, arkasında aşağı."""
        above = y0 < -480
        d = abs(y0 + 480)
        fall = math.exp(-d / 900)

        def fn(x):
            bump = math.exp(-((x + 250) / 1050) ** 2)
            up = math.exp(-((x + 1750) / 520) ** 2)
            sm = clamp((x + 400) / 2300)
            down = sm * sm * (3 - 2 * sm)
            y = y0 - 70 * up * fall + 560 * down * math.exp(-d / 1700)
            return y - (300 if above else -210) * bump * fall
        return curve(fn, -2500, 2500, 50)

    seeds = [-2650, -2250, -1850, -1450, -1080, -800, -160, 160, 520, 920, 1350, 1800, 2280, 2760]
    streams = [(y0, stream(y0)) for y0 in seeds]

    def s_lift(c, res, t):
        sky(c, [(0.0, (14, 38, 78)), (0.6, (38, 92, 146)), (1.0, (70, 130, 176))])
        k = t - t5
        for y0, p in streams:
            near = math.exp(-abs(y0 + 480) / 1300)
            hot = ramp(t, t_asagi - 0.2, 0.5) * near
            flow(c, p, mix(CYAN, WHITE, hot), 0.3 + 0.55 * near, 13 + 7 * near, k * (1250 if y0 < -480 else 900) + y0, (170, 150))
        c.drawPath(foil_w, paint(NAVY, 0.35, stroke=60))
        sh = skia.GradientShader.MakeLinear([skia.Point(0, FY - 420), skia.Point(0, FY + 420)], [col(WHITE), col(SHADE)], [0.0, 1.0])
        fp = skia.Paint(AntiAlias=True)
        fp.setShader(sh)
        c.drawPath(foil_w, fp)
        c.drawPath(foil_w, paint(NAVY, 1, stroke=18))
        # küçük planör + büyüteç: bu şeklin kanat kesiti olduğunu söyler
        glider_side(c, -1080, -2720, 0.82, -2)
        c.drawCircle(-1010, -2640, 120, paint(YELLOW, 1, stroke=16))
        for ex, ey in ((-1150, -830), (150, -1010)):
            dashed(c, poly([(-1010, -2520), (ex, ey)], False), YELLOW, 0.6, 10, (50, 60))
        tag(c, res, "KANAT KESİTİ", 620, -2700, t, t5 + 0.15, 250)
        # aşağı çevrilen hava
        u = ease_out_cubic(ramp(t, t_asagi - 0.1, 0.6))
        arrow(c, 1150, -330, 1560, 330, 120, CYAN, u)
        tag(c, res, "HAVA AŞAĞI", 1060, 740, t, t_asagi + 0.15, 250)
        # kaldırma ve ağırlık okları
        lu = ease_out_back(ramp(t, t_yukari - 0.1, 0.7)) if t > t_yukari - 0.1 else 0
        pulse = 1 + 0.03 * math.sin(t * 5)
        arrow(c, -330, -900, -330, -900 - 1250 * pulse, 190, YELLOW, clamp(lu, 0, 1.1))
        wu = ease_out_back(ramp(t, t_agir - 0.1, 0.7)) if t > t_agir - 0.1 else 0
        arrow(c, -330, -330, -330, -330 + 1250, 190, CORAL, clamp(wu, 0, 1.1))
        tag(c, res, "KALDIRMA", -1300, -1750, t, min(t_kald, t_yukari + 0.6), 280, fg=NAVY, bg=YELLOW)
        tag(c, res, "AĞIRLIK", -1130, 560, t, t_agir + 0.15, 280, fg=WHITE, bg=CORAL)

    # ---- 5  süzülme oranı: 1 km aşağı, 40-50 km ileri
    t7, t_bin, t_kirk = L(7), W(7, "bin"), W(7, "kırk")
    AX, AY, GY, CX = -1480, -560, 880, 1560           # üçgen: A tepe, zemin y, C varış

    def s_glide(c, res, t):
        sky(c, DAY)
        hills(c, GY - 60, 120, 800, 1.0, HILL_FAR)
        c.drawRect(skia.Rect.MakeLTRB(BG.left(), GY, BG.right(), BG.bottom()), paint(HILL_MID))
        for fx, fy, fw in ((-1200, 700, 1000), (900, 1150, 1300), (-500, 1650, 900)):
            c.drawPath(poly([(fx - fw / 2, GY + fy), (fx + fw / 2, GY + fy), (fx + fw / 2 + 240, GY + fy + 300), (fx - fw / 2 - 240, GY + fy + 300)]), paint((48, 100, 100)))
        hills(c, GY + 2100, 130, 600, 3.0, HILL_NEAR)
        cloud(c, 1150, -330, 800, 0.85)
        fly = ease_in_out(ramp(t, t7 + 0.2, E(7) - t7 + 0.2))
        # üst başlık
        txt(c, res, "1 KM ALÇALIRKEN", 0, -2760, 300, CREAM, ramp(t, t7, 0.3))
        ku = pop(t, t_kirk - 0.1, 0.4)
        if ku > 0:
            c.save()
            c.translate(0, -1930)
            c.scale(ku, ku)
            txt(c, res, "40-50 KM", 0, 0, 980, YELLOW, 1)
            c.restore()
        txt(c, res, "İLERİ", 0, -1560, 300, CREAM, ramp(t, t_kirk + 0.3, 0.3))
        # gerçek ölçek şeridi: 1 km'ye 45 km
        su = ramp(t, t_kirk + 0.5, 0.5)
        if su > 0:
            wy, wl, wr = -1050, -1650, 1650
            c.drawPath(poly([(wl, wy - 3300 / 45), (wl, wy), (lerp(wl, wr, ease_out_cubic(su)), wy)]), paint(YELLOW, 0.95))
            c.drawLine(wl, wy + 22, lerp(wl, wr, ease_out_cubic(su)), wy + 22, paint(CREAM, 0.9, stroke=10))
            txt(c, res, "GERÇEK ÖLÇEK", 0, wy - 150, 200, CREAM, su)
        # abartılı üçgen
        c.drawLine(AX, AY, AX, GY, paint(CREAM, 0.9, stroke=18))
        for yy in (AY, GY):
            c.drawLine(AX - 70, yy, AX + 70, yy, paint(CREAM, 0.9, stroke=18))
        c.drawLine(AX, GY, CX + 250, GY, paint(CREAM, 0.9, stroke=18))
        for i in range(1, 5):
            xx = lerp(AX, CX, i * 10 / 45)
            on = ramp(fly, i * 10 / 45 - 0.04, 0.05)
            c.drawLine(xx, GY - 55, xx, GY + 55, paint(mix(CREAM, YELLOW, on), 0.95, stroke=16))
            txt(c, res, str(i * 10), xx, GY + 270, 210 + 40 * on, mix(CREAM, YELLOW, on), 0.6 + 0.4 * on)
        px, py = lerp(AX, CX, fly), lerp(AY, GY, fly)
        tri = poly([(AX, AY), (AX, GY), (px, GY), (px, py)])
        c.drawPath(tri, paint(YELLOW, 0.16))
        dashed(c, poly([(AX, AY), (px, py)], False), YELLOW, 1, 20, (80, 60))
        c.drawLine(px, py + 60, px, GY, paint(CREAM, 0.45, stroke=8))
        ang = math.degrees(math.atan2(GY - AY, CX - AX))
        glider_side(c, px, py - 90, 0.8, ang * 0.55)
        tag(c, res, "1 KM", AX + 60, (AY + GY) / 2, t, t_bin - 0.1, 250, fg=WHITE, bg=CORAL)
        d = int(round(45 * fly))
        if 0.02 < fly:
            txt(c, res, f"{d} KM", clamp(px, AX + 500, CX - 150) - 60, py - 420, 280, WHITE, 1)

    # ---- 6  termik: güneş yeri ısıtır, hava sütunu yükselir, planör daire çizerek tırmanır
    t8, t_gun, t_isit, t_isin, t_sut = L(8), W(8, "Güneş"), W(8, "ısıtır"), W(8, "ısınan"), W(8, "sütun")
    t9, t_term, t_daire = L(9), W(9, "termik"), W(9, "daireler")
    TX, GND, CB = 180, 950, -2080                       # sütun ekseni, zemin, bulut tabanı
    t_top = t_isin + 2.0                                # sütun bulut tabanına varır

    def spiral(u):
        th = -2.2 + u * 2 * math.pi * 3.1
        return TX + 520 * math.sin(th), lerp(620, -1640, u) + 150 * math.cos(th), th

    def s_thermal(c, res, t):
        sky(c, DAY)
        sun(c, -1230, -2560, 250, t)
        cloud(c, -1500, -1150, 800, 0.55)
        hills(c, GND + 40, 150, 820, 0.7, HILL_FAR)
        c.drawRect(skia.Rect.MakeLTRB(BG.left(), GND + 150, BG.right(), BG.bottom()), paint(HILL_MID))
        for i, (fx, fw, rgb) in enumerate(((-1500, 900, (72, 128, 112)), (1500, 800, (48, 100, 100)), (-900, 1200, (44, 96, 96)))):
            yy = GND + 330 + i * 420
            c.drawPath(poly([(fx - fw / 2, yy), (fx + fw / 2, yy), (fx + fw / 2 + 240, yy + 300), (fx - fw / 2 - 240, yy + 300)]), paint(rgb))
        heat = ramp(t, t_isit - 0.2, 0.9)
        field = poly([(TX - 800, GND + 170), (TX + 800, GND + 170), (TX + 1080, GND + 520), (TX - 1080, GND + 520)])
        c.drawPath(field, paint(mix((112, 84, 62), (236, 128, 60), heat)))
        for i in range(1, 7):
            u = i / 7
            c.drawLine(lerp(TX - 800, TX + 800, u), GND + 170, lerp(TX - 1080, TX + 1080, u), GND + 520, paint(NAVY, 0.22, stroke=8))
        hills(c, GND + 1900, 130, 600, 3.3, HILL_NEAR)
        # güneş ışınları
        ru = ramp(t, t_gun - 0.1, 0.7)
        if ru > 0:
            fade = 1 - 0.55 * ramp(t, t_isin + 0.5, 1.0)
            for i in range(5):
                ex = TX - 700 + 350 * i
                ray = poly([(-1130 + 30 * i, -2330), (ex, GND + 250)], False)
                flow(c, partial_path(ray, ru), (255, 226, 130), 0.75 * fade, 16, (t - t8) * 1100, (130, 120))
        if heat > 0:
            glow(c, TX, GND + 330, 1300, ORANGE, 0.5 * heat)
        # yükselen sıcak hava sütunu
        cu = ease_out_cubic(ramp(t, t_isin - 0.1, t_top - t_isin))
        if cu > 0:
            ytop = lerp(GND + 250, CB, cu)
            c.save()
            c.clipRect(skia.Rect.MakeLTRB(-2500, ytop, 2500, GND + 300))
            col_p = poly([(TX - 560, GND + 300), (TX + 560, GND + 300), (TX + 760, CB), (TX - 760, CB)])
            sh = skia.GradientShader.MakeLinear([skia.Point(TX - 760, 0), skia.Point(TX + 760, 0)],
                                                [col(ORANGE, 0), col(ORANGE, 0.42), col((255, 190, 90), 0.5), col(ORANGE, 0.42), col(ORANGE, 0)], [0.0, 0.25, 0.5, 0.75, 1.0])
            p = skia.Paint(AntiAlias=True)
            p.setShader(sh)
            c.drawPath(col_p, p)
            for i in range(5):
                x0 = TX - 440 + 220 * i
                wav = curve(lambda yy, x0=x0, i=i: x0 + 55 * math.sin(yy / 260 + i * 1.7 + t * 1.5), CB - 100, GND + 300, 60)
                m = skia.Matrix()
                m.setAll(0, 1, 0, 1, 0, 0, 0, 0, 1)             # y = f(x) eğrisini x = f(y) yap
                wv = skia.Path()
                wav.transform(m, wv)
                flow(c, wv, (255, 236, 190), 0.85, 16, (t - t8) * 900 + i * 90, (150, 190))
            c.restore()
            if cu < 1:
                for i in range(3):
                    arrow(c, TX - 380 + 380 * i, ytop + 330, TX - 380 + 380 * i, ytop + 30, 90, (255, 222, 150), 1, 0.9)
        cl = pop(t, t_top - 0.35, 0.8)
        if cl > 0:
            cloud(c, TX, CB + 40, 2050 * cl, 1)
        tag(c, res, "ISINAN HAVA", 1210, 300, t, t_isin + 0.2, 240, fg=NAVY, bg=ORANGE, to=(TX + 420, 120), t_out=t9 + 0.2)
        tag(c, res, "TERMİK", -1180, -560, t, t_term - 0.05, 330, fg=NAVY, bg=YELLOW, to=(TX - 560, -420))
        # planör: önce soldan yaklaşır, sonra sarmal
        t_in0, t_sp0, t_sp1 = t9 - 0.1, t9 + 0.7, t10 - 0.4
        if t >= t_in0:
            su = ramp(t, t_sp0, t_sp1 - t_sp0)
            sp = ease_in_out(su) * 0.85 + su * 0.15
            if t < t_sp0:
                a_u = ease_out_cubic(ramp(t, t_in0, t_sp0 - t_in0))
                x1, y1, th1 = spiral(0)
                gx, gy, th = lerp(-2300, x1, a_u), lerp(y1 - 140, y1, a_u), th1
            else:
                gx, gy, th = spiral(sp)
                n = 70
                trail = skia.Path()
                for i in range(n + 1):
                    qx, qy, _ = spiral(sp * i / n)
                    trail.moveTo(qx, qy) if i == 0 else trail.lineTo(qx, qy)
                dashed(c, trail, WHITE, 0.8, 14, (70, 60))
            depth = math.cos(th)                               # +1 önde, -1 arkada
            head = 90 + math.degrees(math.atan2(150 * -math.sin(th) / 0.32, 520 * math.cos(th)))
            plane_top(c, gx, gy, 0.66 + 0.09 * depth, head, span=2000, chord=210, fus=820, squash=0.5)
            if t > t_daire and su < 1:
                arrow(c, TX + 1120, gy + 260, TX + 1120, gy - 260, 80, WHITE, 1, 0.9)

    # ---- 7  yamaç akımı
    t10, t_carp, t_yon, t_pl = L(10), W(10, "çarpınca"), W(10, "yukarı"), W(10, "planör")
    CRX, CRY = 760, -520                               # sırtın tepesi

    def ridge_y(x):
        if x <= CRX:
            u = clamp((x + 2500) / (CRX + 2500))
            return lerp(1500, CRY, u * u * (3 - 2 * u))
        u = clamp((x - CRX) / 1900)
        return lerp(CRY, 700, u * u * (3 - 2 * u))

    def wind_line(y0, off):
        def fn(x):
            b = ridge_y(x) - off
            k = 170.0
            return -k * math.log(math.exp(-y0 / k) + math.exp(-b / k))      # yumuşak min: yamaca yaklaşınca üstünden aşar
        return curve(fn, -2500, 2500, 50)

    winds = [wind_line(y0, off) for y0, off in ((-2150, 1500), (-1500, 1150), (-900, 820), (-300, 520), (300, 260), (860, 110))]

    def s_ridge(c, res, t):
        sky(c, DAY)
        cloud(c, -1250, -2350, 1200, 0.9)
        cloud(c, 1500, -1500, 800, 0.6)
        hills(c, 900, 240, 1000, 0.2, HILL_FAR)
        m = curve(ridge_y, -2500, 2500, 60)
        m.lineTo(2500, BG.bottom())
        m.lineTo(-2500, BG.bottom())
        m.close()
        c.drawPath(m, paint(HILL_MID))
        c.save()
        c.clipPath(m, doAntiAlias=True)
        c.drawPath(poly([(CRX, CRY - 50), (2600, CRY - 50), (2600, 4000), (CRX + 260, 4000)]), paint(mix(HILL_MID, HILL_NEAR, 0.45)))      # rüzgâr altı yüz gölgede
        for i in range(26):
            h = math.sin((i + 3) * 78.233) * 43758.5453
            fr = h - math.floor(h)
            x = -2300 + i * 120 + 60 * fr
            y = ridge_y(x) + 150 + 900 * fr
            c.drawPath(poly([(x, y - 150), (x + 55, y), (x - 55, y)]), paint(HILL_NEAR, 0.9))
        c.restore()
        k = t - t10
        up = ramp(t, t_yon - 0.3, 0.6)
        for i, p in enumerate(winds):
            flow(c, p, mix(CYAN, (255, 226, 150), up * (0.4 + 0.12 * i)), 0.85, 16, k * 1300 + i * 130, (190, 170))
        arrow(c, -1750, -650, -1050, -650, 130, CYAN, ease_out_cubic(ramp(t, t10 + 0.1, 0.5)))
        tag(c, res, "RÜZGÂR", -1330, -1010, t, t10 + 0.15, 270)
        for i, (ax, ay) in enumerate(((-480, -420), (20, -960), (-900, 250))):
            u = ease_out_cubic(ramp(t, t_yon - 0.15 + 0.1 * i, 0.5))
            arrow(c, ax, ay, ax + 230, ay - 330, 100, YELLOW, u)
        tag(c, res, "YAMAÇ AKIMI", -700, -2700, t, t_yon + 0.1, 290, fg=NAVY, bg=YELLOW)
        g = ease_out_cubic(ramp(t, t10 - 0.2, 2.4))
        glider_front(c, lerp(-500, 330, g), lerp(-1500, -1700, g) + 50 * math.sin(t * 1.7), lerp(0.6, 1.05, g), -7 + 4 * math.sin(t * 1.1))

    # ---- 8  dalga akımı: dağların ardında, 22 km'nin üzerine
    t11, t_dalga, t_22 = L(11), W(11, "dalgalar"), W(11, "yirmi")
    MPX = -1250                                          # dağ doruğunun x'i
    WL = 2100.0                                          # dalga boyu

    def wave_line(y0, amp):
        def fn(x):
            if x < MPX:
                return y0 - amp * math.exp(-((x - MPX) / 620) ** 2)
            return y0 - amp * math.cos((x - MPX) / WL * 2 * math.pi) * math.exp(-(x - MPX) / 9000)
        return curve(fn, -2500, 2500, 50)

    waves = [wave_line(y0, a) for y0, a in ((560, 330), (-40, 300), (-640, 270), (-1240, 240), (-1840, 200))]
    AL0, AL1 = 1250, -1500                               # cetvel: 0 km ve 22 km

    def s_wave(c, res, t):
        sky(c, [(0.0, (8, 12, 38)), (0.3, (22, 44, 98)), (0.62, (84, 140, 192)), (0.82, (190, 208, 216)), (1.0, (190, 208, 216))])
        for i in range(46):
            h = math.sin((i + 1) * 91.17) * 43758.5453
            fr = h - math.floor(h)
            h2 = math.sin((i + 1) * 17.31) * 24634.6345
            f2 = h2 - math.floor(h2)
            c.drawCircle(-2000 + 4000 * fr, -3500 + 1900 * f2, 7 + 9 * f2, paint(WHITE, (0.35 + 0.5 * fr) * (1 - f2 * 0.8)))
        hills(c, 1500, 260, 1000, 2.2, HILL_FAR)
        mt = poly([(-2500, 1900), (-2100, 1250), (-1720, 1420), (MPX, 760), (-900, 1300), (-560, 1180), (-100, 1750), (700, 1900), (2500, 2000), (2500, 3800), (-2500, 3800)])
        c.drawPath(mt, paint(HILL_MID))
        c.drawPath(poly([(MPX, 760), (-900, 1300), (-560, 1180), (-100, 1750), (700, 1900), (-1100, 1900)]), paint(HILL_NEAR))
        c.drawPath(poly([(MPX, 760), (MPX - 190, 1025), (MPX - 60, 990), (MPX + 30, 1090), (MPX + 150, 980)]), paint(WHITE, 0.95))
        hills(c, 2700, 140, 600, 3.0, HILL_NEAR)
        k = t - t11
        hi = ramp(t, t_dalga - 0.3, 0.6)
        for i, p in enumerate(waves):
            flow(c, p, mix(CYAN, WHITE, hi * 0.5), 0.5 + 0.35 * hi, 15, k * 1250 + i * 170, (190, 170))
        for i, (lx, ly, lw) in enumerate(((MPX + WL, 150, 900), (MPX + WL + 480, -420, 620))):       # mercek bulutları dalga tepelerinde
            la = ramp(t, t_dalga + 0.1 * i, 0.6)
            c.drawOval(skia.Rect.MakeLTRB(lx - lw / 2, ly - 70, lx + lw / 2, ly + 70), paint(WHITE, 0.9 * la))
            c.drawOval(skia.Rect.MakeLTRB(lx - lw * 0.36, ly + 10, lx + lw * 0.36, ly + 80), paint(SHADE, 0.9 * la))
        tag(c, res, "DALGA AKIMI", 1130, 780, t, t_dalga, 260)
        # cetvel
        rx = -1700
        c.drawLine(rx, AL0, rx, AL1, paint(CREAM, 0.8, stroke=16))
        for km in (0, 5, 10, 15, 20):
            yy = lerp(AL0, AL1, km / 22)
            c.drawLine(rx - 40, yy, rx + 70, yy, paint(CREAM, 0.8, stroke=14))
            txt(c, res, str(km), rx + 110, yy + 70, 200, CREAM, 0.9, align="left")
        cl = ease_in_out(ramp(t, t11 + 0.3, E(11) - t11 + 0.4))
        gx = MPX + WL * 0.74
        gy = lerp(520, AL1, cl)
        dashed(c, poly([(gx - 40, 560), (gx - 40, gy + 120)], False), YELLOW, 0.9, 16, (70, 60))
        c.drawLine(rx, AL0, rx, gy, paint(YELLOW, 1, stroke=30))
        c.drawPath(poly([(rx + 50, gy), (rx + 190, gy - 75), (rx + 190, gy + 75)]), paint(YELLOW))
        glider_side(c, gx, gy, 0.95, 6, flip=True)
        nu = pop(t, t_22 - 0.1, 0.4)
        if nu > 0:
            c.save()
            c.translate(0, -2330)
            c.scale(nu, nu)
            txt(c, res, "22+ KM", 0, 0, 820, YELLOW, 1)
            c.restore()
        tag(c, res, "STRATOSFER", -150, -2010, t, t_22 + 0.5, 240)

    # ---- 9  uzun ince kanat: uç girdapları zayıf, sürükleme az
    t12, t_uc, t_sur = L(12), W(12, "uçlardaki"), W(12, "sürükleme")

    def s_wings(c, res, t):
        sky(c, [(0.0, (16, 44, 88)), (0.6, (44, 100, 154)), (1.0, (84, 146, 190))])
        k = t - t12
        for i in range(16):                                      # hava akımı: yukarıdan aşağı
            h = math.sin((i + 1) * 12.9898) * 43758.5453
            fr = h - math.floor(h)
            x = -2300 + i * 300 + 120 * fr
            y = -3900 + ((k * 1500 * (0.7 + 0.5 * fr) + fr * 7000) % 8000)
            c.drawLine(x, y, x, y + 420 + 300 * fr, paint(WHITE, 0.16, stroke=12))
        vu = ramp(t, t_uc - 0.2, 0.5)
        bu = ease_out_cubic(ramp(t, t_sur - 0.7, 0.7))
        # uzun ince kanat
        y1 = -1750 + 30 * math.sin(t * 1.2)
        for sg in (-1, 1):
            vortex(c, sg * 1640, y1 + 20, 95, t, vu, sg)
        plane_top(c, 0, y1, 1.0, 0, span=3300, chord=210, fus=1080)
        txt(c, res, "UZUN İNCE KANAT", 0, -2780, 330, YELLOW, ramp(t, t12, 0.3))
        # kısa geniş kanat
        su = ease_out_cubic(ramp(t, t12 + 0.9, 0.6))
        if su > 0:
            y2 = lerp(950, 250, su) + 30 * math.sin(t * 1.2 + 1)
            for sg in (-1, 1):
                vortex(c, sg * 760, y2 + 120, 230, t, vu, sg, CORAL)
            plane_top(c, 0, y2, 1.0, 0, span=1500, chord=460, fus=1050, a=su, tip=CORAL, body=SHADE)
            txt(c, res, "KISA GENİŞ KANAT", 0, -640, 330, CREAM, su)
        tag(c, res, "ZAYIF GİRDAP", 1050, -1130, t, t_uc + 0.1, 230, to=(1640, -1480))
        tag(c, res, "GÜÇLÜ GİRDAP", -1060, 800, t, t_uc + 0.45, 230, fg=WHITE, bg=CORAL)
        if bu > 0:                                                # sürükleme çubukları
            for yy, wd, rgb in ((-2480, 620, GREEN), (-360, 2300, CORAL)):
                txt(c, res, "SÜRÜKLEME", -1700, yy + 60, 210, CREAM, bu, align="left")
                c.drawRoundRect(skia.Rect.MakeLTRB(-740, yy - 70, -740 + 2440, yy + 70), 70, 70, paint(NAVY, 0.6 * bu))
                c.drawRoundRect(skia.Rect.MakeLTRB(-740, yy - 70, -740 + max(140, wd * bu), yy + 70), 70, 70, paint(rgb))

    # ---- 10  kapanış: termikten termiğe; rekor
    t13, t_uc3, t_mot = L(13), W(13, "üç"), W(13, "Motor")
    hops = [(-2100, -320), (-1250, 0), (-1250, -880), (60, -420), (60, -950), (1370, -500), (1370, -980), (2500, -600)]

    def route(u):
        """Testere dişi rota: süzül, termikte sarmalla tırman, yine süzül."""
        segs = len(hops) - 1
        f = clamp(u) * segs
        i = min(segs - 1, int(f))
        v = f - i
        (x0, y0), (x1, y1) = hops[i], hops[i + 1]
        if x0 == x1:
            return x0 + 150 * math.sin(v * 2 * math.pi * 3), lerp(y0, y1, v), True
        return lerp(x0, x1, v), lerp(y0, y1, v), False

    def s_end(c, res, t):
        sky(c, [(0.0, (28, 66, 120)), (0.45, (116, 170, 206)), (0.7, (250, 214, 170)), (1.0, (250, 214, 170))])
        sun(c, 1180, 560, 210, t)
        land(c, 1050, (t - t13) * 0.08)
        prog = 0.93 * ease_in_out(ramp(t, t13 - 0.2, doc.duration - t13 - 1.2))
        for i, cx in enumerate((-1250, 60, 1370)):
            ca = ramp(prog, 0.02 + 0.2 * i, 0.1)
            sh = skia.GradientShader.MakeLinear([skia.Point(cx - 330, 0), skia.Point(cx + 330, 0)], [col(ORANGE, 0), col(ORANGE, 0.34 * ca), col(ORANGE, 0)], [0.0, 0.5, 1.0])
            p = skia.Paint(AntiAlias=True)
            p.setShader(sh)
            c.drawRect(skia.Rect.MakeLTRB(cx - 330, -1100, cx + 330, 1100), p)
            cloud(c, cx, -1100, 1050 - 60 * i, 0.95)
        n = 220
        tr = skia.Path()
        for i in range(n + 1):
            qx, qy, _ = route(prog * i / n)
            tr.moveTo(qx, qy) if i == 0 else tr.lineTo(qx, qy)
        c.drawPath(tr, paint(WHITE, 0.95, stroke=16))
        gx, gy, climbing = route(prog)
        if climbing:
            plane_top(c, gx, gy, 0.3, 90 + 400 * (t - t13), span=2000, chord=150, fus=820, squash=0.5)
        else:
            glider_side(c, gx, gy - 30, 0.62, 12)
        nu = pop(t, t_uc3 - 0.1, 0.4)
        if nu > 0:
            c.save()
            c.translate(0, -2050)
            c.scale(nu, nu)
            txt(c, res, "3.008 KM", 0, 0, 820, YELLOW, 1)
            c.restore()
        txt(c, res, "TEK UÇUŞTA DÜNYA REKORU", 0, -2860, 250, CREAM, ramp(t, t13 + 0.3, 0.3))
        txt(c, res, "KLAUS OHLMANN · 2003 · ARJANTİN", 0, -1780, 180, CREAM, 0.9 * ramp(t, t_uc3 + 0.5, 0.4))
        tag(c, res, "MOTOR YOK", -1050, 330, t, t_mot, 250)
        tag(c, res, "YAKIT YOK", 0, 620, t, W(13, "yakıt"), 250)
        tag(c, res, "SADECE HAVA", 1000, 910, t, W(13, "sadece"), 250, fg=NAVY, bg=YELLOW)

    lead = 0.3
    scenes = [(0.0, s_hook), (t2 - lead, s_tow), (t4 - lead, s_descent), (t5 - lead, s_lift), (t7 - lead, s_glide),
              (t8 - lead, s_thermal), (t10 - lead, s_ridge), (t11 - lead, s_wave), (t12 - lead, s_wings), (t13 - lead, s_end)]
    film.add(Stage(scenes))

    # kamera: sahne kayarken sabit; her sahnede hafifçe yaklaşır (zoom 1'in altına inme: kenar görünür)
    film.cam(0.0, 0, 0, 1.0)
    for i, (ts, _) in enumerate(scenes):
        te = scenes[i + 1][0] if i + 1 < len(scenes) else doc.duration
        film.cam(ts + 0.65, 0, 0, 1.0)
        film.cam(te, 0, -40, 1.045, rot=0.25 if i % 2 else -0.25)

    # ses efektleri: geçişlerde hışırtı, etiketlerde tık, büyük sayılarda vuruş
    for ts, _ in scenes[1:]:
        film.cue("whoosh", ts, 0.45)
    for tt in (t_motor + 0.1, t_saat, t_km, t_ucak, t_vinc, t_halat, t_alc, t_hiz, t5 + 0.15, t_asagi + 0.15, t_agir + 0.15, t_isin + 0.2,
               t_term, t10 + 0.15, t_yon + 0.1, t_dalga, t_22 + 0.5, t_uc + 0.1, t_uc + 0.45, t_mot, W(13, "yakıt"), W(13, "sadece")):
        film.cue("pop", tt, 0.5)
    for tt in (t_kirk, t_22, t_uc3):
        film.cue("impact", tt, 0.6)
    film.cue("snip", t_rel, 0.9)
    film.cue("riser", t_isin, 0.4, dur=1.8)
    film.cue("riser", t11 + 0.3, 0.35, dur=E(11) - t11)
    return film
