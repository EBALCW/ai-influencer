# Planör Nasıl Uçar? (3D, stüdyo kalıbı): çekim betiği.
#   FILM_LANG=tr|en Blender -b -P film.py -- <çekim-id> <still|anim|lab> [fps] [ölçek%]
# still: görüntü + yazılar birlikte (kadraj kontrolü). anim: görüntü geçişi (720x1280). lab: yazı geçişi (1080x1920, saydam).
# Süreler shots.<dil>.json'dan (seslendirme zamanlarından), ekran yazıları texts.<dil>.json'dan gelir:
# sahne kodunda dile bağlı tek kelime yoktur.
import json, math, os, sys
import bpy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "kit") if os.path.isdir(os.path.join(HERE, "kit")) else os.path.join(HERE, "..", "..", "blender"))
import kit as K
import studyo as S
from kit import R90
from mathutils import Vector

A = K.argv()
SHOT, MODE = A[0], A[1]
FPS = int(A[2]) if len(A) > 2 else 24
SCALE = int(A[3]) if len(A) > 3 else 100
LANG = os.environ.get("FILM_LANG", "tr")
SHOTS = {s["id"]: s for s in json.load(open(f"{HERE}/shots.{LANG}.json"))}
T = S.load_texts(HERE, LANG)
DUR = SHOTS[SHOT]["dur"]
N = max(2, round(DUR * FPS))
SAMPLES = 16
rad = math.radians
def F(t): return int(round(1 + t * (N - 1)))            # çekim içi oran (0..1) -> kare
def sm(x, a=0.0, b=1.0):                                  # yumuşak geçiş (0..1)
    x = min(1.0, max(0.0, (x - a) / (b - a))); return x * x * (3 - 2 * x)
TEAL, ORANGE, WARM, ICE = (0.22, 0.80, 0.92), (1.0, 0.47, 0.10), (1.0, 0.62, 0.25), (0.55, 0.75, 1.0)
G_TEAL = lambda s=1.5: S.glow(f"gT{s}", TEAL, s)
G_OR = lambda s=1.6: S.glow(f"gO{s}", ORANGE, s)

# ================================================================ modeller (sade, stilize)
def slab(mat, y0, y1, le0, c0, le1, c1, t0, t1, z0=0.0, z1=0.0, parent=None, name="kanat"):
    """Sivrilen düz kanat parçası: kök (y0) ve uç (y1) için hücum kenarı x'i, veter, kalınlık, z."""
    v = []
    for y, le, c, t, z in ((y0, le0, c0, t0, z0), (y1, le1, c1, t1, z1)):
        v += [(le, y, z + t / 2), (le - c * 0.3, y, z + t * 0.62), (le - c, y, z + t * 0.1), (le - c, y, z - t * 0.1), (le - c * 0.3, y, z - t * 0.5), (le, y, z - t / 2)]
    f = [(0, 1, 2, 3, 4, 5), (11, 10, 9, 8, 7, 6)] + [(i, (i + 1) % 6, 6 + (i + 1) % 6, 6 + i) for i in range(6)]
    return S.mesh_obj(name, v, f, mat, parent=parent, recalc=True)

def glider(name="planor", scale=1.0):
    """Stilize planör: burun +X, kanat açıklığı Y boyunca (5,2 birim), üst +Z. Kök nesneyi döndür/taşı."""
    root = K.empty(name)
    W = S.glossy("pl-beyaz", (0.80, 0.84, 0.90), rough=0.22, coat=0.6)
    Ac = S.glossy("pl-vurgu", (0.95, 0.30, 0.05), rough=0.3, emit=0.25)
    G = S.glossy("pl-cam", (0.015, 0.04, 0.09), rough=0.06, coat=1.0)
    K.ball(W, (0.35, 0, 0), 1, root, (0.62, 0.15, 0.19))
    S.cyl(W, (0.05, 0, 0.0), (-1.78, 0, 0.07), 0.125, r2=0.035, parent=root)
    K.ball(G, (0.52, 0, 0.085), 1, root, (0.33, 0.118, 0.125))
    for s in (1, -1):
        slab(W, 0.06 * s, 2.3 * s, 0.42, 0.36, 0.25, 0.17, 0.055, 0.024, 0.10, 0.24, root)
        slab(Ac, 2.3 * s, 2.6 * s, 0.25, 0.17, 0.16, 0.08, 0.024, 0.012, 0.24, 0.31, root)
        slab(W, 0.0, 0.42 * s, -1.50, 0.17, -1.57, 0.09, 0.022, 0.012, 0.50, 0.50, root)
    fin = slab(W, 0.04, 0.50, -1.42, 0.32, -1.53, 0.17, 0.035, 0.02, 0, 0, root)
    fin.rotation_euler = (R90, 0, 0)
    root.scale = (scale,) * 3
    return root

def airliner(name="yolcu", scale=1.0):
    """Stilize yolcu uçağı: burun +X, ok açılı kısa kanat, iki motor."""
    root = K.empty(name)
    W = S.glossy("yu-govde", (0.62, 0.66, 0.74), rough=0.25, coat=0.5)
    D = S.glossy("yu-koyu", (0.10, 0.13, 0.20), rough=0.3)
    S.cyl(W, (-0.85, 0, 0), (0.75, 0, 0), 0.17, parent=root)
    K.ball(W, (0.75, 0, 0), 1, root, (0.32, 0.17, 0.17))
    S.cyl(W, (-0.85, 0, 0), (-1.35, 0, 0.07), 0.17, r2=0.05, parent=root)
    for s in (1, -1):
        slab(W, 0.1 * s, 1.25 * s, 0.30, 0.55, -0.32, 0.18, 0.05, 0.02, -0.06, 0.02, root)
        slab(W, 0.0, 0.48 * s, -1.05, 0.30, -1.30, 0.13, 0.03, 0.015, 0.06, 0.08, root)
        S.cyl(D, (0.22, 0.48 * s, -0.17), (-0.12, 0.48 * s, -0.17), 0.085, parent=root)
    fin = slab(W, 0.1, 0.55, -0.95, 0.40, -1.25, 0.18, 0.035, 0.02, 0, 0, root)
    fin.rotation_euler = (R90, 0, 0)
    root.scale = (scale,) * 3
    return root

def place(o, pos, heading=0.0, pitch=0.0, bank=0.0):
    """Uçak yönü (derece): heading 0 = burun +X, + sola (yukarıdan saat yönü tersine); pitch + = burun aşağı; bank + = sağa yatış."""
    o.location = pos
    o.rotation_euler = (rad(bank), rad(pitch), rad(heading))

def hover(o, base, amp=0.05, period=4.0, heading=0.0, pitch=0.0, bank=0.0, sway=1.5):
    S.on_frame(lambda t, f: place(o, (base[0], base[1], base[2] + amp * math.sin(2 * math.pi * t / period)), heading, pitch,
                                  bank + sway * math.sin(2 * math.pi * t / (period * 1.3))))

def cloud(loc, s=1.0, n=7, seed=1, flat=1.0, emit=0.22):
    import random
    rnd = random.Random(seed)
    m = S.glossy("bulut", (0.72, 0.78, 0.90), rough=1.0, emit=emit)
    root = K.empty("bulut", loc)
    for k in range(n):
        a = 2 * math.pi * k / n
        r = rnd.uniform(0.3, 0.55) * s
        K.ball(m, (math.cos(a) * 0.55 * s * rnd.uniform(0.5, 1), math.sin(a) * 0.4 * s * rnd.uniform(0.5, 1), rnd.uniform(-0.08, 0.12) * s), r, root, (1, 1, 0.72 * flat))
    K.ball(m, (0, 0, 0.12 * s), 0.6 * s, root, (1, 1, 0.8 * flat))
    return root

# ================================================================ çekimler
def s_s01():                                              # kanca: küre üstünde rekorun yeri
    S.studio(floor=False, beam=False)
    c = S.cam(target=(0, 0, 2.0), dist=9.0, az=0, el=2, to=dict(dist=8.3), frames=N, wedge=0.32, shift=-0.10)
    g = S.globe(center=(0, 0, 2.15), radius=1.5)
    S.light("POINT", (3.5, -5, 5.5), (0, 0, 2), 900, color=ICE, soft=1.0)
    LAT, LON = -40.1, -71.3                               # Chapelco, San Martín de los Andes
    g["face"](LAT + 22, LON + 12)                         # son duruş: etiket buna göre kurulur
    p = g["ll"](LAT, LON, 0.012)
    S.marker(G_OR(1.8), p, r=0.04, parent=g["spin"], pulse=(1, N, 20))
    S.tag(c, T("s01_place"), p, (0.75, -0.3, 1.05), sub=T("s01_record"), parent=g["spin"], appear=F(0.42), accent=ORANGE, size=0.024)
    K.ease(True)
    g["face"](8, LON - 58, 1); g["face"](LAT + 22, LON + 12, F(0.40))
    K.ease(False)
    S.note(c, T("s01_note"))

def hero(az0, az1, el=8, dist=7.6, z=1.75, heading=-58, bank=7, wedge=0.5, sc=0.92, to_z=None, shift=-0.09):
    S.studio()
    c = S.cam(target=(0, 0, z - 0.1), dist=dist, az=az0, el=el, to=dict(az=az1, target=(0, 0, (to_z or z) - 0.1)), frames=N, wedge=wedge, shift=shift)
    g = glider(scale=sc)
    hover(g, (0, 0, z), heading=heading, bank=bank)
    return c, g

def s_s02():                                              # "motor yok, yakıt yok": planörün kendisi
    c, g = hero(-34, -14)
    S.tag(c, T("s02_glider"), (0.0, -0.1, 1.95), (-0.75, 0, 1.25), sub=T("s02_glider2"), appear=F(0.12))

def car_scene(tilt):
    """Araba + camdan uzanan el. tilt(t) -> derece: avucun hücum kenarı ne kadar yukarı."""
    S.studio()
    body = S.glossy("ar-govde", (0.05, 0.16, 0.26), rough=0.3, coat=0.25)
    dark = S.glossy("ar-koyu", (0.012, 0.014, 0.02), rough=0.35)
    S.rbox(body, (0, 0, 0.55), (3.0, 1.25, 0.5), bevel=0.12)
    S.rbox(body, (-0.2, 0, 1.0), (1.55, 1.12, 0.48), bevel=0.14)
    K.box(S.glow("ar-cam", (0.05, 0.12, 0.22), 0.6), (-0.2, -0.565, 1.02), (1.25, 0.01, 0.30), shadow=False)
    K.box(S.glow("ar-cam", (0.05, 0.12, 0.22), 0.6), (0.585, 0, 1.02), (0.01, 0.9, 0.30), shadow=False)
    for x in (-0.95, 0.95):
        for y in (-0.66, 0.44):
            S.cyl(dark, (x, y, 0.3), (x, y + 0.22, 0.3), 0.3)
            S.cyl(S.glossy("ar-jant", (0.3, 0.33, 0.38), rough=0.2, metal=1.0), (x, y - 0.005 if y < 0 else y + 0.225, 0.3), (x, y + (0.0 if y < 0 else 0.22), 0.3), 0.16)
    K.box(S.glow("ar-far", (1.0, 0.9, 0.7), 1.6), (1.505, -0.42, 0.62), (0.01, 0.22, 0.08), shadow=False)
    K.box(S.glow("ar-far", (1.0, 0.9, 0.7), 1.6), (1.505, 0.42, 0.62), (0.01, 0.22, 0.08), shadow=False)
    skin = S.glossy("ten", (0.86, 0.60, 0.44), rough=0.5, emit=0.12)
    HX, HY, HZ = 0.05, -1.30, 1.06
    S.cyl(skin, (HX - 0.10, -0.56, HZ - 0.04), (HX, HY + 0.30, HZ), 0.05, r2=0.042)
    hand = K.empty("el", (HX, HY, HZ))                    # avuç + dört parmak + başparmak; parmaklar arabadan dışarı (-Y)
    S.rbox(skin, (0, 0.17, 0), (0.24, 0.26, 0.055), bevel=0.024, parent=hand)
    for k in range(4):
        S.rbox(skin, (-0.09 + k * 0.06, -0.07 - (0.02 if k in (0, 3) else 0), 0), (0.052, 0.26 - (0.04 if k in (0, 3) else 0), 0.045), bevel=0.02, parent=hand)
    S.rbox(skin, (0.155, 0.14, 0), (0.16, 0.06, 0.045), bevel=0.02, parent=hand, rot=(0, 0, rad(-35)))
    S.on_frame(lambda t, f: setattr(hand, "rotation_euler", (0, -rad(tilt(t)), 0)))
    def air(u, i, t):                                     # elin çevresinden geçen hava: eğim arttıkça arkada aşağı döner
        lane = (i % 6) - 2.5
        x = HX + 2.6 - 5.0 * u
        z = HZ + lane * 0.075 + (0.035 if lane > 0 else -0.035)
        k = tilt(t) / 18.0
        near = math.exp(-abs(lane) / 2.2)
        if x < HX + 0.15: z -= k * near * 0.30 * (1 - math.exp(-(HX + 0.15 - x) / 0.7))
        return (x, HY - 0.02 + ((i // 6) % 4 - 1.5) * 0.085, z)
    S.flow(air, n=168, size=0.011, material=S.glow("hava", ICE, 1.5), speed=0.42, seed=4)
    def road(u, i, t):                                    # yoldaki çizgiler: araba ilerliyor hissi
        return (5.0 - 10.0 * u, -2.6 + (i % 7) * 0.72 + (0.9 if (i % 7) > 2 else 0), 0.02)
    S.flow(road, n=42, size=0.022, material=S.glow("yol", (0.25, 0.4, 0.7), 0.8), speed=0.5, seed=9, fade=0.2)
    return (HX, HY, HZ)

def s_s03a():                                             # benzetme: arabanın camından çıkan el
    car_scene(lambda t: 0.0)
    c = S.cam(target=(0.1, -0.2, 1.0), dist=8.6, az=26, el=9, to=dict(az=34, dist=7.6), frames=N, shift=-0.12)
    S.tag(c, T("s03_air"), (1.2, -1.30, 1.1), (-0.5, 0, 1.25), appear=F(0.3))

def s_s03b():                                             # avuç yukarı eğilir, hava eli kaldırır
    tilt = lambda t: 18.0 * sm(t, 0.35, 1.25)
    H = car_scene(tilt)
    c = S.cam(target=(H[0] - 0.15, H[1], H[2] + 0.10), dist=3.3, az=22, el=24, to=dict(az=12, dist=3.0), frames=N, shift=-0.10, lens=50)
    S.arrow((H[0], H[1], H[2] + 0.07), (H[0] - 0.04, H[1], H[2] + 0.55), G_TEAL(1.6), r=0.016, grow=(int(1.2 * FPS), int(1.75 * FPS)))
    S.tag(c, T("s03_lift"), (H[0] - 0.04, H[1], H[2] + 0.56), (-0.32, 0, 0.16), appear=int(1.7 * FPS), accent=TEAL, size=0.024)
    S.tag(c, T("s03_down"), (H[0] - 0.62, H[1], H[2] - 0.16), (-0.05, 0, -0.34), appear=int(2.3 * FPS))

def naca(n=40, m=0.04, p=0.4, th=0.13):
    up, lo = [], []
    for i in range(n + 1):
        x = 0.5 * (1 - math.cos(math.pi * i / n))
        yt = 5 * th * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        yc = m / p ** 2 * (2 * p * x - x * x) if x < p else m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * x - x * x)
        up.append((x, yc + yt)); lo.append((x, yc - yt))
    return up, lo

def s_s04():                                              # kanat kesiti: hava aşağı çevrilir, kanat yukarı itilir
    S.studio(key=0.8)
    c = S.cam(target=(-0.5, -1.0, 2.2), dist=10.0, az=7, el=5, to=dict(az=1, dist=9.6), frames=N, shift=-0.10)
    CH, ZC, AOA, Y0, Y1 = 2.5, 2.25, rad(5), -3.4, 2.6
    up, lo = naca()
    prof = up[::-1] + lo[1:-1]                            # firar kenarından üstten hücuma, alttan geri
    def P(x, y):                                          # veter oranı -> dünya (hücum kenarı +X, 5° hücum açısı)
        px, pz = (0.5 - x) * CH, y * CH
        return (px * math.cos(AOA) - pz * math.sin(AOA), pz * math.cos(AOA) + px * math.sin(AOA) + ZC)
    pts = [P(x, y) for x, y in prof]
    n = len(pts)
    v = [(x, Y0, z) for x, z in pts] + [(x, Y1, z) for x, z in pts]
    f = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    wing = S.mesh_obj("kanat", v, f, S.glossy("kn", (0.78, 0.82, 0.90), rough=0.25, coat=0.5), smooth=True, recalc=True)
    wing.data.polygons[0].use_smooth = wing.data.polygons[1].use_smooth = False
    YC = -1.0
    cut = S.cutaway(wing, (0, YC, 0), (0, -1, 0), cap=S.glow("kesit", (0.10, 0.34, 0.60), 0.95))
    y_at = lambda fr: YC - 2.6 * (1 - sm(fr, 1, F(0.22)))
    for fr in range(1, F(0.22) + 2, 2):                   # kesit düzlemi öne doğru ilerler: kanat "kesilir"
        cut.location = (0, y_at(fr) - 20.0, 0); cut.keyframe_insert("location", frame=fr)
    def surf(xw):                                         # kanadın üst/alt yüzeyi (dünya z), veter dışında None
        x = 0.5 - xw / CH
        if not 0 <= x <= 1: return None
        i = min(len(up) - 2, max(0, int(math.acos(1 - 2 * x) / math.pi * (len(up) - 1))))
        return P(x, up[i][1])[1], P(x, lo[i][1])[1]
    LANES = (0.14, 0.34, 0.60, 0.92, -0.14, -0.34, -0.60, -0.92)
    def air(u, i, t):
        h = LANES[i % 8]
        x = 3.3 - 7.0 * u
        w = math.exp(-abs(h) / 0.75)
        z = ZC + h
        if x > CH / 2: z -= 0.10 * w * (x - CH / 2) * math.exp(-(x - CH / 2) / 1.5) * 2.0       # hücum kenarı önünde hafif yükselme
        s = surf(x)
        if s:
            k = math.sin(math.pi * (0.5 - x / CH)) ** 0.7
            z = (max(z, s[0] + 0.07 + 0.25 * abs(h)) if h > 0 else min(z, s[1] - 0.07 - 0.3 * abs(h))) * k + z * (1 - k)
        if x < -CH / 2: z += -0.26 * w * (1 - math.exp(-(-CH / 2 - x) / 1.1)) - math.sin(AOA) * CH / 2 * w
        elif s: z += -math.sin(AOA) * CH / 2 * w * sm(0.5 - x / CH, 0.5, 1.0)
        return (x, YC - 0.16, z)
    S.lanes(air, 8)
    S.flow(air, n=240, size=0.016, material=S.glow("hava", ICE, 1.5), speed=0.2, seed=2, fade=0.08)
    S.arrow((0.25, YC - 0.16, ZC + 0.42), (0.25, YC - 0.16, ZC + 1.45), G_TEAL(1.6), r=0.04, grow=(F(0.34), F(0.46)))
    S.tag(c, T("s04_lift"), (0.25, YC - 0.16, ZC + 1.47), (-0.75, 0, 0.15), appear=F(0.44), accent=TEAL, size=0.024)
    S.arrow((-1.75, YC - 0.16, ZC - 0.3), (-2.1, YC - 0.16, ZC - 1.0), G_OR(1.6), r=0.035, grow=(F(0.56), F(0.66)))
    S.tag(c, T("s04_down"), (-2.25, YC - 0.16, ZC - 0.66), (1.15, 0, -0.75), appear=F(0.64), accent=ORANGE)
    S.note(c, T("s04_note"))

def s_s05():                                              # hız yükseklikten: yokuş aşağı kayan kızak gibi
    S.studio()
    c = S.cam(target=(0, 0, 2.45), dist=8.6, az=-14, el=7, to=dict(az=-4), frames=N, shift=-0.10)
    P0, P1 = Vector((-1.55, 0, 3.4)), Vector((1.6, 0, 2.2))
    line = S.glow("yol", TEAL, 1.3)
    K.polyline("yol", [tuple(P0), tuple(P1)], 0.014, line)
    S.mesh_obj("rampa", [tuple(P0), tuple(P1), (P0.x, 0, P1.z)], [(0, 1, 2)], S.glow("rampa", (0.12, 0.35, 0.75), 0.9, alpha=0.10))
    K.polyline("taban", [(P0.x, 0, P1.z), tuple(P1)], 0.008, S.glow("ince", ICE, 0.8))
    S.arrow((P0.x, 0, P0.z - 0.06), (P0.x, 0, P1.z + 0.03), G_OR(1.5), r=0.028, grow=(F(0.08), F(0.3)))
    g = glider(scale=0.5)
    pitch = math.degrees(math.atan2(P0.z - P1.z, P1.x - P0.x))
    def fly(t, f):
        k = 0.06 + 0.66 * (t / DUR) ** 1.25               # giderek hızlanır
        place(g, tuple(P0.lerp(P1, k) + Vector((0, 0, 0.16))), 0, pitch, 0)
    S.on_frame(fly)
    S.arrow((0.9, 0, 0.0), (1.7, 0, 0.0), G_TEAL(1.6), r=0.045, parent=g, grow=(F(0.5), F(0.6)))
    S.tag(c, T("s05_height"), (P0.x, 0, (P0.z + P1.z) / 2), (0.75, 0, -1.25), sub=T("s05_height2"), appear=F(0.18), accent=ORANGE)
    S.tag(c, T("s05_speed"), tuple(P0.lerp(P1, 0.70) + Vector((0.3, 0, 0.25))), (0.1, 0, 1.0), sub=T("s05_speed2"), appear=F(0.62), accent=TEAL)

def glide_scene():
    """Süzülme karşılaştırması: aynı 1 km yükseklikten iki pist. 1 km = 0,16 birim ileri; yükseklik abartılı."""
    S.studio()
    KM = 0.16
    LA, LG, H = 16 * KM, 45 * KM, 1.0
    tr = S.tracks([LA, LG], lane=0.62, gap=0.55, tick=10 * KM)
    for t_, col in zip(tr, (ORANGE, TEAL)):
        x = t_["x"]
        S.cyl(S.glossy("direk", (0.2, 0.22, 0.27), rough=0.3, metal=0.8), (x, -0.02, 0), (x, -0.02, H), 0.022)
        K.polyline("egim", [(x, 0, H), (x, t_["end"][1], 0.06)], 0.009, S.glow(f"eg{col}", col, 1.2))
    return tr, H

def s_s06a():                                             # planör: 1 km alçalırken 40-50 km
    tr, H = glide_scene()
    c = S.cam(target=(0, 3.3, 0.5), dist=10.8, az=10, el=31, to=dict(el=25, az=4), frames=N, shift=-0.17)
    g = glider(scale=0.36); a = airliner(scale=0.3)
    place(a, (tr[0]["x"], 0, H + 0.1), 90, 0, 0)
    L = tr[1]["end"][1]
    def fly(t, f):
        k = sm(t, 1.0, DUR - 0.9)
        place(g, (tr[1]["x"], L * k, H * (1 - k) + 0.1), 90, 7 * (0 < k < 1), 0)
    S.on_frame(fly)
    S.tag(c, T("s06_start"), (0, -0.02, H), (0.0, 0, 0.95), appear=F(0.06))
    S.tag(c, T("s06_glider"), tr[1]["end"], (0.15, 0, 1.1), sub=T("s06_glider2"), appear=int((DUR - 1.2) * FPS), accent=TEAL, size=0.024)
    S.note(c, T("s06_note"), y=-0.505)                   # hud kamera kaydırmasını (shift) bilmez: -0,17 için aşağı al

def s_s06b():                                             # yolcu uçağı: yarısına bile ulaşamaz
    tr, H = glide_scene()
    c = S.cam(target=(-0.1, 2.9, 0.6), dist=9.6, az=-26, el=17, to=dict(az=-17, el=20), frames=N, shift=-0.11)
    g = glider(scale=0.36); a = airliner(scale=0.3)
    place(g, (tr[1]["x"], tr[1]["end"][1], 0.1), 90, 0, 0)
    L = tr[0]["end"][1]
    def fly(t, f):
        k = sm(t, 0.3, 2.4)
        place(a, (tr[0]["x"], L * k, H * (1 - k) + 0.1), 90, 18 * (0 < k < 1), 0)
    S.on_frame(fly)
    S.tag(c, T("s06_glider"), tr[1]["end"], (0.2, 0, 1.0), sub=T("s06_glider2"), accent=TEAL)
    S.tag(c, T("s06_airliner"), tr[0]["end"], (-0.75, 0, 1.25), sub=T("s06_airliner2"), appear=int(2.3 * FPS), accent=ORANGE, size=0.024)
    S.note(c, T("s06_note"))

def s_s07():                                              # "asıl motoru gökyüzüdür": alttan bakış, yükselen sıcak hava
    c, g = hero(30, 16, el=3, dist=7.4, z=2.2, heading=-128, bank=-6, wedge=0.75, sc=0.8, to_z=2.45, shift=-0.12)
    def rise(u, i, t):
        a = i * 2.399
        r = 0.25 + 1.5 * ((i * 0.618) % 1)
        return (r * math.cos(a), r * math.sin(a), 0.1 + 4.4 * u)
    S.flow(rise, n=44, size=0.015, material=S.glow("sicak", WARM, 1.6), speed=0.2, seed=5)

def thermal(parts=110):
    """Termik: ısınan zemin lekesi + yükselen sıcak hava sütunu + tepesinde kümülüs."""
    S.studio(key=0.75)
    S.spot_glow("isi", ORANGE, 1.9, peak=0.85)
    col = S.cyl(S.soft_glow("sutun", WARM, peak=0.30, power=1.3, strength=1.4, zfade=(0.4, 2.3)), (0, 0, 0), (0, 0, 4.4), 1.0, r2=0.8, verts=48, cap=False)
    col.visible_shadow = False
    def rise(u, i, t):
        a = i * 2.399 + u * 2.2
        r = 0.78 * math.sqrt((i * 0.618) % 1) * (1 - 0.15 * u)
        return (r * math.cos(a), r * math.sin(a), 0.05 + 3.9 * u)
    S.flow(rise, n=parts, size=0.026, material=S.glow("sicak", WARM, 1.7), speed=0.22, seed=5)
    cloud((0, 0.1, 4.25), s=1.25)
    S.light("SPOT", (-3.5, -2.5, 8), (0, 0, 0), 2600, color=(1.0, 0.72, 0.42), spread=30, blend=0.9, soft=0.5)

def s_s08():                                              # güneş yeri ısıtır, sıcak hava sütun gibi yükselir
    thermal()
    c = S.cam(target=(0, 0, 2.25), dist=12.4, az=-12, el=5, to=dict(az=0, dist=11.6), frames=N, shift=-0.135)
    S.tag(c, T("s08_ground"), (1.25, -0.9, 0.02), (0.15, 0, 1.0), appear=F(0.12), accent=ORANGE)
    S.tag(c, T("s08_thermal"), (-0.75, -0.5, 2.3), (-0.75, 0, 0.9), sub=T("s08_thermal2"), appear=F(0.50), accent=ORANGE, size=0.024)

def s_s09():                                              # pilot sütunun içinde daire çizerek tırmanır
    thermal(parts=80)
    c = S.cam(target=(0, 0, 1.7), dist=8.6, az=8, el=6, to=dict(az=20, target=(0, 0, 2.9)), frames=N, shift=-0.10)
    g = glider(scale=0.42)
    trail = S.glow("iz", TEAL, 1.4)
    def path(t):
        a = 2 * math.pi * t / 3.1 - 0.6
        return Vector((0.66 * math.cos(a), 0.66 * math.sin(a), 1.0 + 2.3 * t / DUR)), a
    S.on_frame(lambda t, f: place(g, tuple(path(t)[0]), math.degrees(path(t)[1]) + 90, -4, -32))
    def tr(u, i, t):                                      # arkasında bıraktığı sarmal iz
        return tuple(path(max(0.0, t - 2.6 * (1 - u)))[0])
    S.flow(tr, n=46, size=0.015, material=trail, speed=0.0, fade=0.3)

def s_s10():                                              # variometre: ibre yukarıdaysa tırmanıyor
    S.studio(key=0.7)
    c = S.cam(target=(0, 0, 2.35), dist=7.9, az=-9, el=1.5, to=dict(az=5, dist=7.4), frames=N, shift=-0.10)
    R = 1.25
    Z = 2.25
    g = S.gauge((0, 0, Z), radius=R, a0=-135, a1=135, ticks=11, zero=-90)
    S.cyl(S.glossy("ayak", (0.03, 0.035, 0.05), rough=0.3), (0, 0.1, 0), (0, 0.1, Z - R), 0.09)
    def needle(t, f):
        v = 0.36 + 0.42 * sm(t, 0.5, 2.0) + 0.018 * math.sin(t * 7.0) + 0.012 * math.sin(t * 13.0)
        g["needle"].rotation_euler = (0, g["angle"](v), 0)
    S.on_frame(needle)
    wm = K.mat("kadranY", (0.82, 0.88, 1.0), emit=1.0)
    for i in range(11):                                   # rakamlar veriden değil sayıdan: 5..0..5
        a = rad(-90 - 135 + 270 * i / 10)
        K.text(str(abs(i - 5)), (R * 0.66 * math.sin(a), -0.03, Z + R * 0.66 * math.cos(a) - R * 0.045), R * 0.13, wm)
    K.text(T("s10_up"), (R * 0.30, -0.03, Z + R * 0.30), R * 0.085, K.mat("kadranT", TEAL, emit=1.0), spacing=1.15)
    K.text(T("s10_down"), (R * 0.30, -0.03, Z - R * 0.38), R * 0.085, K.mat("kadranO", ORANGE, emit=1.0), spacing=1.15)
    K.text(T("s10_unit"), (R * 0.62, -0.03, Z - R * 0.035), R * 0.075, wm)
    S.tag(c, T("s10_vario"), (-R * 0.55, -0.06, Z + R * 0.92), (-0.1, 0, 0.72), sub=T("s10_vario2"), appear=F(0.15))

def hill(x0, h, wl, wr, y0=-2.6, y1=9.0, x_min=-9, x_max=9):
    f = lambda x: h * math.exp(-((x - x0) / (wl if x < x0 else wr)) ** 2)
    xs = [x_min + i * 0.15 for i in range(int((x_max - x_min) / 0.15) + 1)]
    rock = K.noise_mat("kaya", (0.018, 0.024, 0.036), (0.05, 0.065, 0.09), 2.2, bump=0.6, rough=0.6)
    K.ribbon("yamac", xs, f, y0, y1, rock, wobble=0.0, seed=3, ny=4)
    K.strip("yamac-kesit", xs, lambda x: 0.0, f, y0, S.glow("yk", (0.05, 0.13, 0.24), 0.9))
    return f

def s_s11():                                              # yamaç akımı: rüzgâr yamaca çarpıp yukarı döner
    S.studio(key=0.9)
    c = S.cam(target=(-0.6, -1.0, 1.9), dist=11.6, az=-12, el=8, to=dict(az=-4), frames=N, shift=-0.11)
    f = hill(1.1, 2.3, 2.0, 1.1)
    def wind(u, i, t):
        h = 0.14 + 0.30 * (i % 7)
        x = -4.6 + 8.6 * u
        return (x, -2.72 + 0.02 * (i % 3), f(x) * math.exp(-h / 2.6) + h)
    S.lanes(wind, 7)
    S.flow(wind, n=210, size=0.018, material=S.glow("ruzgar", ICE, 1.5), speed=0.17, seed=6)
    g = glider(scale=0.5)
    S.on_frame(lambda t, f_: place(g, (-0.35, -2.2 + 3.4 * t / DUR, 3.15 + 0.05 * math.sin(t * 1.7)), 90, -2, -10 + 3 * math.sin(t * 1.3)))
    S.arrow((-0.9, -2.72, 1.75), (-0.35, -2.72, 2.55), G_TEAL(1.6), r=0.035, grow=(F(0.34), F(0.46)))
    S.tag(c, T("s11_wind"), (-2.7, -2.72, 0.85), (0.55, -0.2, -0.5), appear=F(0.06))
    S.tag(c, T("s11_ridge"), (-0.35, -2.72, 2.6), (-1.15, 0, 1.3), sub=T("s11_ridge2"), appear=F(0.45), accent=TEAL, size=0.024)

def s_s12a():                                             # dağ dalgası: dağın ardında yükselen dev dalgalar
    S.studio(key=0.9)
    c = S.cam(target=(-0.1, -1.5, 2.3), dist=13.6, az=4, el=5, to=dict(target=(-0.1, -1.5, 3.0), az=7), frames=N, shift=-0.10)
    f = hill(-2.3, 2.0, 1.6, 1.0)
    WL = 3.3
    def wz(x, h):                                         # dağın ardındaki duran dalga
        if x < -2.3: return f(x) * math.exp(-h / 3.0)
        d = x + 2.3
        return f(x) * math.exp(-h / 3.0) + 0.62 * (1 - math.exp(-d / 0.8)) * math.sin(2 * math.pi * (d - 0.5) / WL) * math.exp(-d / 14)
    def wind(u, i, t):
        h = 0.5 + 0.62 * (i % 8)
        x = -4.4 + 8.2 * u
        return (x, -2.72 + 0.02 * (i % 3), wz(x, h) + h)
    S.lanes(wind, 8)
    S.flow(wind, n=240, size=0.019, material=S.glow("ruzgar", ICE, 1.5), speed=0.14, seed=6)
    for xc in (-2.3 + 0.5 + WL * 0.25 + WL, ):            # dalga tepesinde mercek bulutu
        cloud((xc, -1.6, 6.05), s=0.7, flat=0.4, seed=4)
    g = glider(scale=0.42)
    xg = -2.3 + 0.5 + WL * 1.0                            # dalganın yükselen yüzü
    S.on_frame(lambda t, f_: place(g, (xg, -2.3, 2.0 + 3.0 * sm(t, 0.3, DUR)), 180, -3, 3 * math.sin(t * 1.4)))
    S.arrow((xg + 0.35, -2.72, 2.3), (xg + 0.35, -2.72, 3.4), G_TEAL(1.6), r=0.035, grow=(F(0.2), F(0.34)))
    S.tag(c, T("s12_wave"), (-0.3, -2.72, 3.9), (-0.9, 0, 1.5), sub=T("s12_wave2"), appear=F(0.22), accent=TEAL, size=0.024)

def s_s12b():                                             # 22 km: yolcu uçaklarının yaklaşık iki katı
    S.studio()
    c = S.cam(target=(0, 0, 2.55), dist=12.0, az=-13, el=5, to=dict(az=-4, dist=11.4), frames=N, shift=-0.125)
    KM = 0.19
    cols = S.columns([11 * KM, 22.6 * KM], [S.glossy("s1", (0.10, 0.13, 0.19), rough=0.28, emit=0.0), S.glow("s2", (0.10, 0.36, 0.85), 0.9)],
                     width=0.85, gap=1.0, grow=(1, F(0.42)))
    a = airliner(scale=0.42); g = glider(scale=0.30)
    def ride(t, f):
        k = sm((f - 1) / max(1, F(0.42) - 1))
        place(a, (cols[0]["top"][0], 0, 11 * KM * k + 0.22), 20, 0, 0)
        place(g, (cols[1]["top"][0], 0, 22.6 * KM * k + 0.2), 20, 0, 0)
    S.on_frame(ride)
    S.tag(c, T("s12_airliner"), cols[0]["top"], (-0.35, 0, 1.2), sub=T("s12_airliner2"), appear=F(0.40))
    S.tag(c, T("s12_glider"), (cols[1]["top"][0] - 0.42, 0, cols[1]["top"][2] - 0.3), (-1.45, 0, 0.25), sub=T("s12_glider2"), appear=F(0.46), accent=TEAL, size=0.024)
    S.note(c, T("s12_note"))

def vortex(tip, radius, length, mat, n=70, turns=3.2, seed=1, back=(0, -1, 0)):
    """Kanat ucundan geriye uzanan sarmal girdap (şematik)."""
    tip, back = Vector(tip), Vector(back)
    def p(u, i, t):
        a = 2 * math.pi * (turns * u + (i % 2) * 0.5) - t * 2.4
        r = radius * (0.25 + 0.75 * u ** 0.6)
        return tuple(tip + back * (length * u) + Vector((r * math.cos(a), 0, r * math.sin(a))))
    return S.flow(p, n=n, size=0.012 + radius * 0.022, material=mat, speed=0.24, seed=seed, fade=0.1)

def s_s13a():                                             # kanat ucundaki girdap planörü yavaşlatır
    S.studio()
    g = glider(scale=1.0)
    place(g, (0, 0.6, 2.25), 90, 0, 0)                    # burun +Y: kameradan uzağa uçuyor, sağ kanat +X
    tip = (2.6, 0.75, 2.56)
    c = S.cam(target=(1.55, -0.5, 2.4), dist=6.6, az=24, el=10, to=dict(az=12, dist=5.9), frames=N, shift=-0.10)
    vortex(tip, 0.34, 3.6, G_OR(1.6), n=150, turns=4)
    S.tag(c, T("s13_vortex"), (2.6, -0.9, 2.56), (-0.9, 0, 1.05), sub=T("s13_vortex2"), appear=F(0.42), accent=ORANGE, size=0.024)

def s_s13b():                                             # kısa geniş kanat / uzun ince kanat (alanlar eşit)
    S.studio()
    c = S.cam(target=(0, -0.4, 2.35), dist=10.4, az=-6, el=17, to=dict(az=4), frames=N, shift=-0.105)
    W = S.glossy("kn", (0.78, 0.82, 0.90), rough=0.25, coat=0.5)
    for z, span, chord, r, mat, key in ((3.45, 2.0, 0.9, 0.36, G_OR(1.6), "short"), (1.55, 3.6, 0.5, 0.11, G_TEAL(1.6), "long")):
        w = K.empty("kanat", (0, 0.6, z))
        for s in (1, -1):
            slab(W, 0, span / 2 * s, chord / 2, chord, chord / 2, chord, 0.07, 0.05, 0, 0, w)
        w.rotation_euler = (0, 0, rad(90))                # açıklık X boyunca, hücum kenarı +Y
        for s in (1, -1):
            vortex((s * span / 2, 0.6 - chord / 2, z), r, 2.8, mat, n=84, seed=3 + s)
        S.tag(c, T(f"s13_{key}"), (0, 0.6, z + 0.05), (0.0, 0, 0.72), sub=T(f"s13_{key}2"), appear=F(0.1 if key == "short" else 0.35),
              accent=ORANGE if key == "short" else TEAL)
    S.note(c, T("s13_note"))

def s_s14a():                                             # yükselen hava yoksa: inersin
    S.studio(key=0.85)
    c = S.cam(target=(0, 0, 2.3), dist=10.0, az=-14, el=6, to=dict(az=-4, target=(0.2, 0, 1.9)), frames=N, shift=-0.10)
    col = S.cyl(S.soft_glow("sutun", (0.35, 0.45, 0.62), peak=0.10, power=1.3, strength=1.0, zfade=(0.4, 2.3)), (-0.3, 1.2, 0), (-0.3, 1.2, 4.4), 1.0, r2=0.8, verts=48, cap=False)
    col.visible_shadow = False
    S.spot_glow("soguk", (0.2, 0.3, 0.5), 1.8, loc=(-0.3, 1.2, 0.012), peak=0.35)
    g = glider(scale=0.44)
    P0, P1 = Vector((-2.2, -0.4, 3.5)), Vector((1.9, -0.4, 1.55))
    S.on_frame(lambda t, f: place(g, tuple(P0.lerp(P1, 0.1 + 0.8 * t / DUR)), 0, 20, 0))
    K.polyline("inis", [tuple(P0), tuple(P1)], 0.01, S.glow("ince", ORANGE, 1.0))
    S.arrow((0.0, 0, -0.25), (0.0, 0, -0.95), G_OR(1.6), r=0.03, parent=g, grow=(F(0.3), F(0.42)))
    S.tag(c, T("s14_none"), (-0.3, 0.3, 2.6), (1.25, 0, 1.2), appear=F(0.25), accent=ORANGE)

def s_s14b():                                             # ulaşabileceği iniş yerini hep aklında tutar
    S.studio()
    c = S.cam(target=(0.1, 3.0, 0.6), dist=13.5, az=-12, el=27, to=dict(az=-3, el=24), frames=N, shift=-0.11)
    S.spot_glow("erim", TEAL, 3.3, loc=(0, 3.4, 0.012), peak=0.05, power=0.6)
    S.ring(G_TEAL(1.3), (0, 3.4, 0.03), 3.3, tube=0.016)
    tr = S.tracks([2.6], lane=0.7, origin=(0.9, 4.2, 0), tick=0.65)
    g = glider(scale=0.5)
    G0, G1 = Vector((-0.9, -0.2, 2.5)), Vector((-0.5, 0.9, 2.2))
    hd = math.degrees(math.atan2(4.2 - G0.y, 0.9 - G0.x))
    S.on_frame(lambda t, f: place(g, tuple(G0.lerp(G1, t / DUR)), hd, 8, 4))
    K.polyline("suzul", [tuple(G1 + Vector((0.2, 0.5, -0.12))), (0.9, 4.2, 0.08)], 0.012, S.glow("ince2", TEAL, 1.3), draw=[(F(0.1), 0), (F(0.45), 1)])
    S.tag(c, T("s14_field"), (0.9, 5.5, 0.06), (0.6, 0, 1.25), appear=F(0.42), accent=TEAL, size=0.024)
    S.tag(c, T("s14_reach"), (1.2, 0.3, 0.03), (-1.1, 0, 0.9), appear=F(0.62))

def s_s15():                                              # kapanış: güneş, rüzgâr ve pilot
    c, g = hero(-44, -12, el=7, dist=8.8, z=1.9, heading=-55, bank=8, wedge=0.6)
    S.light("SPOT", (-6, -3, 6), (0, 0, 1.8), 2600, color=(1.0, 0.70, 0.40), spread=45, blend=0.9, soft=0.6)   # sıcak "güneş"
    def wind(u, i, t):
        return (-4.5 + 9.0 * u, -1.6 + (i % 9) * 0.42, 0.9 + ((i * 5) % 11) * 0.22 + 0.12 * math.sin(u * 9 + i))
    S.flow(wind, n=90, size=0.018, material=S.glow("ruzgar", ICE, 1.4), speed=0.16, seed=8)
    m = K.flat("baslik", (1, 1, 1), emit=1.0)
    K.fade(m, [(F(0.50), 0), (F(0.60), 1)])
    K.hud(c, T("title"), 0, 0.265, 0.04, m, spacing=1.08)
    S.note(c, T("s15_note"))

if SHOT not in SHOTS: raise SystemExit("bilinmeyen çekim")
globals()["s_" + SHOT]()
os.makedirs(f"{HERE}/stills", exist_ok=True)
if MODE == "still":
    K.render(f"{HERE}/stills/{SHOT}", MODE, N, scale=SCALE, stills=(max(1, int(N * 0.45)), N - 1))
else:
    K.render(f"{HERE}/frames/{SHOT}", MODE, N, label_dir=f"{HERE}/labels/{SHOT}", split_labels=True)
