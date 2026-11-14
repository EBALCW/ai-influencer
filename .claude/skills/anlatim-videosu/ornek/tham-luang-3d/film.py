# Mağarada 17 Gün (3D): çekim betiği.
#   Blender -b -P film.py -- <çekim-id> <still|anim> [fps] [ölçek%]
# Süreler shots.json'dan (seslendirme zamanlarından üretilir) gelir.
import json, math, os, random, sys
import bpy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.expanduser("~/Projects/ai-influencer/.claude/skills/anlatim-videosu/blender"))
import kit as K
from kit import R90
from mathutils import Vector

A = K.argv()
SHOT, MODE = A[0], A[1]
FPS = int(A[2]) if len(A) > 2 else 12
SCALE = int(A[3]) if len(A) > 3 else 100
SHOTS = {s["id"]: s for s in json.load(open(f"{HERE}/shots.json"))}
DUR = SHOTS[SHOT]["dur"]
N = max(2, round(DUR * FPS))
def F(t): return int(round(1 + t * (N - 1)))
def S(sec): return int(round(1 + sec * FPS))          # çekim içi saniye -> kare
rad = math.radians

# ================================================================ KESİT (şematik dağ kesiti)
ZS = 1.8
PTS = [(-0.4, 0.3, 0.95), (2.5, 0.1, 0.9), (5, -0.6, 0.8), (7.5, -2.5, 0.42), (10, -1.0, 0.7), (12, 0.25, 1.1),
       (14, -0.8, 0.6), (16, -2.9, 0.36), (18.5, -1.2, 0.6), (21.5, -0.9, 0.85), (24, -1.6, 0.6), (26.5, -3.1, 0.42),
       (28.5, -1.0, 0.7), (30.5, 0.35, 1.15), (32.3, -1.2, 0.55), (33.8, -2.7, 0.4), (35.3, -0.6, 0.7),
       (37.2, 1.0, 1.25), (39.2, 0.2, 0.7), (40.6, -0.6, 0.12)]
def _interp(x, k):
    if x <= PTS[0][0]: return PTS[0][k]
    for a, b in zip(PTS, PTS[1:]):
        if x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0]); t = t * t * (3 - 2 * t)
            return a[k] + (b[k] - a[k]) * t
    return PTS[-1][k]
def cz(x): return _interp(x, 1) * ZS
def hh(x): return _interp(x, 2) * ZS * (1 + 0.10 * math.sin(x * 5.1) + 0.06 * math.sin(x * 11.3))
def floor(x): return cz(x) - hh(x)
def ceil(x): return cz(x) + hh(x)
def surf(x):
    if x < -0.4: return floor(-0.4) + 0.05 * math.sin(x * 2)
    return 2.6 * ZS + 34 * math.sin(math.pi * min(max(x + 0.4, 0), 50) / 56) ** 0.75 + 0.5 * math.sin(x * 1.3) + 0.3 * math.sin(x * 3.7)
X_ENT, X_C3, X_PB, X_C9 = 0.0, 12.0, 30.5, 37.2
L0, L1, L2 = -2.6 * ZS, -1.35 * ZS, -0.55 * ZS        # kuru mevsim, sel, tehdit seviyesi
LBL = lambda: K.mat("etiket", (1, 1, 1), emit=1.0)
AMB = lambda: K.mat("amber", (0.95, 0.50, 0.04), emit=1.0)
RED = lambda: K.mat("kirmizi", (1.0, 0.16, 0.10), emit=1.0)

def kesit(level=L1, rise=None, to=None, sky=(0.05, 0.07, 0.10), dim=1.0):
    """rise=[(kare,0..1)]: su level'dan L2'ye yükselir. Dönen: su nesnesi."""
    K.reset(world=(0.0, 0.0, 0.0), strength=0.0)
    xs = [-14 + i * 0.25 for i in range(int(62 / 0.25) + 1)]
    cx = [-0.4 + i * 0.1 for i in range(int(41 / 0.1) + 1)]
    K.box(K.flat("gok", sky, emit=1.0), (16, 3, 20), (120, 0.1, 160))
    earth = K.noise_mat("toprak", (0.045 * dim, 0.030 * dim, 0.020 * dim), (0.125 * dim, 0.082 * dim, 0.05 * dim), 0.45, bump=0, emit=1.0,
                        stretch=(0.3, 1, 1.6), bands=0.22)
    K.strip("dag", xs, lambda x: -90, surf, 0.5, earth)
    K.polyline("orman", [(x, 0.45, surf(x) + 0.12) for x in xs], 0.22, K.flat("orm", (0.04, 0.11 * dim + 0.02, 0.04), emit=1.0))
    K.strip("bosluk", cx, floor, ceil, 0.2, K.flat("karanlik", (0.012, 0.016, 0.022), emit=1.0))
    rim = K.flat("kenar", (0.42 * dim, 0.33 * dim, 0.24 * dim), emit=1.0)
    K.polyline("tavan", [(x, 0.1, ceil(x)) for x in cx], 0.045, rim)
    K.polyline("taban", [(x, 0.1, floor(x)) for x in cx], 0.045, rim)
    wm = K.flat("su", (0.06, 0.30, 0.42), emit=1.0, alpha=0.92)
    top = lambda L: (lambda x: max(floor(x), min(ceil(x), L)) if x > 0.6 else floor(x))
    water = K.strip("su", cx, floor, top(level), 0.0, wm)
    if rise:
        K.rise_key(water, floor, top(L2 if to is None else to), rise)
    return water

def klabel(body, x, z, size=0.42, m=None, tick=None, align="CENTER", y=-0.5):
    """Kesit üstünde etiket; tick=(x,z) verilirse o noktaya ince çizgi çeker."""
    m = m or LBL()
    t = K.text(body, (x, y, z), size, m, align=align, spacing=1.15)
    if tick:
        K.polyline("cizgi", [(x if align == "CENTER" else tick[0], y, z - 0.15 if tick[1] < z else z + size), (tick[0], y, tick[1])], 0.02, m)
    return t

def route(x0, x1, draw=None, m=None, r=0.07, y=-0.3):
    step = 0.15 if x1 > x0 else -0.15
    n = int(abs(x1 - x0) / 0.15)
    return K.polyline("rota", [(x0 + i * step, y, cz(x0 + i * step) - 0.25 * hh(x0 + i * step)) for i in range(n + 1)], r, m or AMB(), draw=draw)

def dot(x_keys, m=None, r=0.14, off=-0.25, y=-0.4, glow=True):
    """Mağara içinde yol alan nokta: x_keys=[(kare,x),…]. Ara kareler tabanı izlesin diye sık anahtarlanır."""
    m = m or LBL()
    o = K.ball(m, (0, 0, 0), r, None); o.visible_shadow = False
    f0, f1 = x_keys[0][0], x_keys[-1][0]
    def xat(f):
        for (fa, xa), (fb, xb) in zip(x_keys, x_keys[1:]):
            if f <= fb: return xa + (xb - xa) * (f - fa) / max(1, fb - fa)
        return x_keys[-1][1]
    for f in sorted(set(list(range(f0, f1 + 1, 2)) + [f1])):
        x = xat(f); o.location = (x, y, cz(x) + off * hh(x)); o.keyframe_insert("location", frame=f)
    return o

def ocam(keys):
    """keys=[(t0..1, x, z, genişlik), …]  genişlik: karede görünen yatay birim."""
    c = K.camera("K", ortho=10)
    K.cam_move(c, [(F(t), (x, -40, z), w * 16 / 9) for t, x, z, w in keys])
    return c

def title(cam, big, small=None, y=0.30, t=(0.0, 1.0), size=0.034, fade_out=True):
    m = K.flat("baslik", (1, 1, 1), emit=1.4)
    f0, f1 = F(t[0]), F(t[1])
    ks = [(f0, 0.0), (f0 + S(0.5), 1.0)] + ([(f1 - S(0.5), 1.0), (f1, 0.0)] if fade_out else [])
    K.fade(m, ks)
    K.hud(cam, big, 0, y, size, m, spacing=1.35, line=1.25)
    if small:
        m2 = K.flat("alt", (0.95, 0.50, 0.04), emit=1.0); K.fade(m2, ks)
        K.hud(cam, small, 0, y - size * 1.5 - (size * 1.25 if "\n" in big else 0), size * 0.55, m2, spacing=1.4)

def rain(cx, cz_, w=14, h=26, density=9, speed=24, seed=5, y=-0.8, alpha=0.4):
    """Tek ağ halinde yağmur perdesi: aşağı kayar (nesne başına anahtar yok, hızlı)."""
    import bmesh
    rnd = random.Random(seed)
    fall = speed * DUR
    me = bpy.data.meshes.new("yagmur"); bm = bmesh.new()
    for i in range(int(density * w * (h + fall) / 10)):
        x, z = rnd.uniform(-w / 2, w / 2), rnd.uniform(-h / 2, h / 2 + fall)
        l = rnd.uniform(0.35, 0.8); t = 0.014
        vs = [bm.verts.new(v) for v in ((x, 0, z), (x + t, 0, z), (x + t + l * 0.14, 0, z + l), (x + l * 0.14, 0, z + l))]
        bm.faces.new(vs)
    bm.to_mesh(me); bm.free()
    o = K.link(bpy.data.objects.new("yagmur", me)); me.materials.append(K.flat("yagmurM", (0.55, 0.62, 0.70), emit=1.0, alpha=alpha))
    K.move(o, [(1, (cx, y, cz_)), (N, (cx - fall * 0.14, y, cz_ - fall))])
    return o

# ================================================================ TÜNEL (su altı geçit, perspektif)
def tunel(murky=False, gap=None, length=60, seed=1, front=True):
    """Katmanlı kaya tüneli. gap=(x, yarı-açıklık): o noktada dar boğaz. Dönen: tavan(x), taban(x)."""
    wcol = (0.030, 0.022, 0.010) if murky else (0.004, 0.014, 0.020)
    K.reset(world=wcol, strength=1.0)
    c1, c2 = ((0.10, 0.075, 0.04), (0.34, 0.27, 0.16)) if murky else ((0.05, 0.085, 0.10), (0.30, 0.38, 0.40))
    rock = K.noise_mat("kaya", c1, c2, 1.3, bump=1.0, emit=0.02, detail=10)
    rock2 = K.noise_mat("kaya2", [c * 0.8 for c in c1], [c * 0.8 for c in c2], 2.2, bump=1.0, emit=0.015)
    dark = K.flat("on", [c * 0.25 for c in wcol], rough=1.0)
    K.box(rock, (0, 3.2, 0), (length * 2, 0.1, 40))
    rnd = random.Random(seed); ph = [rnd.uniform(0, 6) for _ in range(6)]
    def squeeze(x):
        if not gap: return 0
        return max(0.0, 1 - abs(x - gap[0]) / 3.2) ** 1.5
    def ce(x, k=0): return 2.1 + 0.5 * math.sin(x * 0.45 + ph[k]) + 0.25 * math.sin(x * 1.3 + ph[k + 1]) - squeeze(x) * (2.1 - (gap[1] if gap else 0))
    def fl(x, k=0): return -2.2 + 0.5 * math.sin(x * 0.38 + ph[k + 2]) + 0.22 * math.sin(x * 1.1 + ph[k + 3]) + squeeze(x) * (2.2 - (gap[1] if gap else 0))
    xs = [-length + i * 0.3 for i in range(int(2 * length / 0.3) + 1)]
    for y, k, m, w in ((2.2, 0, rock2, 0.10), (1.1, 1, rock, 0.06)):
        K.strip("tav", xs, lambda x, k=k: ce(x, k) + (2.2 - y) * 0.0, lambda x: 25, y, m, wobble=w, seed=k)
        K.strip("tab", xs, lambda x: -25, lambda x, k=k: fl(x, k), y, m, wobble=w, seed=k + 5)
    if front:
        K.strip("ontav", xs, lambda x: ce(x, 2) + 1.3 + squeeze(x) * 1.5, lambda x: 25, -2.4, dark, wobble=0.1, seed=9)
        K.strip("ontab", xs, lambda x: -25, lambda x: fl(x, 2) - 1.2 - squeeze(x) * 1.5, -2.4, dark, wobble=0.1, seed=10)
    for i in range(int(length / 2.2)):                    # hacimli kaya parçaları (gerçek gölge/ışık için)
        x = -length / 2 + i * 2.2 * 2 + rnd.uniform(-1, 1)
        if gap and abs(x - gap[0]) < 3: continue
        up = i % 2 == 0
        K.rock_blob(rock, (x, rnd.uniform(0.6, 2.4), (ce(x) + 0.5) if up else (fl(x) - 0.4)), (rnd.uniform(1.2, 2.4), 1.2, rnd.uniform(0.7, 1.2)), seed=i)
    bpy.ops.object.light_add(type="AREA", location=(0, -8, 3), rotation=(rad(70), 0, 0)); fl_ = bpy.context.active_object
    fl_.data.energy = 380 if not murky else 1500; fl_.data.size = 14; fl_.data.color = (0.45, 0.75, 0.9) if not murky else (0.9, 0.7, 0.4)
    if gap:
        for sgn, f in ((1, ce), (-1, fl)):
            K.rock_blob(rock, (gap[0], 1.2, f(gap[0]) + sgn * 1.5), (3.0, 1.6, 1.6), seed=40 + sgn, strength=0.25)
    return ce, fl

def rope(x0, x1, z=lambda x: -0.9 + 0.12 * math.sin(x * 0.6), y=0.35, draw=None):
    n = int((x1 - x0) / 0.4)
    return K.polyline("ip", [(x0 + i * 0.4, y, z(x0 + i * 0.4)) for i in range(n + 1)], 0.012, K.mat("ipM", (0.9, 0.9, 0.85), emit=0.5), draw=draw)

def wash(fig, energy=260, color=(1.0, 0.93, 0.78), reach=3.0, spread=70):
    """Fenerin arka duvara düşen ışığı: dalgıca bağlı, duvara dönük ikinci spot (koni görünmez)."""
    sp = K.light_cone(fig["root"], (reach * 0.4, -1.0, 0.2), (rad(90), 0, rad(-28)), energy=energy, spread=spread, cone=False, color=color)
    return sp

def swim(fig, keys, bob=0.06, rot=0.0, flip=False):
    """keys=[(kare,(x,y,z)),…]: yüzdür + hafif salınım + palet. flip: -X yönüne yüzer."""
    r = fig["root"]
    f0, f1 = keys[0][0], keys[-1][0]
    for f in sorted(set(list(range(f0, f1 + 1, 3)) + [f1])):
        for (fa, pa), (fb, pb) in zip(keys, keys[1:]):
            if f <= fb:
                t = (f - fa) / max(1, fb - fa); p = [a + (b - a) * t for a, b in zip(pa, pb)]; break
        else: p = keys[-1][1]
        r.location = (p[0], p[1], p[2] + bob * math.sin(f * 0.09 * 24 / FPS))
        r.rotation_euler = (0, rot + 0.04 * math.sin(f * 0.07 * 24 / FPS), math.pi if flip else 0)
        r.keyframe_insert("location", frame=f); r.keyframe_insert("rotation_euler", frame=f)
    if "hips" in fig: K.kick(fig, f0, f1, speed=0.30 * 24 / FPS, step=2)

def pcam(keys, lens=35):
    """keys=[(t, (x,y,z)), …]"""
    c = K.camera("P", lens=lens)
    K.cam_move(c, [(F(t), p) for t, p in keys])
    return c

# ================================================================ ODA (çocukların sığındığı çıkıntı, perspektif)
SHIRTS = [(0.42, 0.07, 0.07), (0.08, 0.16, 0.38), (0.45, 0.30, 0.05), (0.10, 0.30, 0.16), (0.35, 0.35, 0.38), (0.30, 0.10, 0.30)]
def bank(x): return 0.25 + 0.42 * max(0, x + 3.2) ** 0.9 if x > -3.2 else 0.25 - 0.5 * (-3.2 - x)
def oda(water=[(1, 0.0)], torch=40, kids=True, cool=6):
    K.reset(world=(0.004, 0.006, 0.009), strength=1.0)
    rock = K.noise_mat("okaya", (0.07, 0.06, 0.05), (0.30, 0.25, 0.20), 0.9, bump=1.0, emit=0.006, detail=10)
    mud = K.noise_mat("camur", (0.10, 0.07, 0.045), (0.26, 0.19, 0.12), 2.0, bump=0.6, emit=0.006)
    K.box(rock, (0, 4.2, 4), (60, 0.1, 30))
    xs = [-16 + i * 0.3 for i in range(110)]
    for y, dz, sd in ((2.4, 0.5, 1), (1.2, 0.25, 2), (0.0, 0.0, 3), (-1.2, -0.3, 4)):
        K.strip("set", xs, lambda x: -8, lambda x, dz=dz, sd=sd: bank(x) + dz + 0.10 * math.sin(x * 1.7 + sd), y, mud, wobble=0.04, seed=sd)
    K.strip("otavan", xs, lambda x: 5.6 + 0.6 * math.sin(x * 0.5) + 0.3 * math.sin(x * 1.9) - 0.16 * x, lambda x: 30, 1.8, rock, wobble=0.08)
    K.strip("otavan2", xs, lambda x: 6.6 + 0.5 * math.sin(x * 0.7 + 2) - 0.2 * x, lambda x: 30, -1.6, K.flat("osil", (0.004, 0.004, 0.005)), wobble=0.1)
    for i, (x, z, sc) in enumerate(((7.5, 6.2, 2.2), (-6, 7.5, 2.6), (1, 7.3, 2.0), (11, 2.5, 2.4))):
        K.rock_blob(rock, (x, 2.0, z), (sc * 1.5, 1.5, sc), seed=i + 7)
    w = K.box(K.flat("osu", (0.012, 0.045, 0.055), rough=0.45, emit=0.02), (0, -4, -1.0), (80, 20, 2.0))
    K.move(w, [(f, (0, -4, -1.0 + lv)) for f, lv in water])
    figs = []
    if kids:
        rnd = random.Random(4)
        spots = [(0.2, 0.0), (0.95, 0.0), (1.7, 0.0), (2.5, 0.0), (3.3, 0.0), (0.6, 1.2), (1.4, 1.2), (2.1, 1.2), (2.9, 1.2), (3.7, 1.2), (1.1, 2.4), (2.0, 2.4), (3.0, 2.4)]
        dzs = {0.0: 0.0, 1.2: 0.25, 2.4: 0.5}
        for i, (x, y) in enumerate(spots):
            big = i == 12                                   # antrenör: biraz daha iri
            s = K.sitter(f"c{i}", SHIRTS[i % len(SHIRTS)], scale=1.0 if big else rnd.uniform(0.74, 0.86))
            s["root"].location = (x, y - 0.15, bank(x) + dzs[y] + 0.04)
            s["root"].rotation_euler = (0, 0, math.pi + rnd.uniform(-0.5, 0.5))
            figs.append(s)
    if torch:
        bpy.ops.object.light_add(type="POINT", location=(1.6, -0.9, 1.9)); L = bpy.context.active_object
        L.data.energy = torch * 4; L.data.color = (1.0, 0.78, 0.5); L.data.shadow_soft_size = 0.08
    if cool:
        bpy.ops.object.light_add(type="AREA", location=(-6, -6, 5), rotation=(rad(60), 0, rad(-40))); L2 = bpy.context.active_object
        L2.data.energy = cool * 40; L2.data.size = 8; L2.data.color = (0.5, 0.7, 1.0)
    return figs, w

# ================================================================ ÇEKİMLER
def s_t_tunel():
    tunel()
    rope(-30, 30)
    d = K.diver("d1"); wash(d)
    swim(d, [(1, (-3, 0, 0.1)), (N, (0, 0, 0.0))])
    d2 = K.diver("d2", accent=(0.6, 0.1, 0.08)); wash(d2)
    swim(d2, [(1, (-7.5, 0.5, 0.9)), (N, (-4.8, 0.5, 0.8))])
    K.bubbles(14, lambda f: (-3 + 3 * (f - 1) / N + 0.9, 0.3), 1, N)
    K.motes(120, (-8, -1.5, -3), (8, 2.5, 3), frames=N)
    pcam([(0, (-1.5, -9, 0.2)), (1, (-0.5, -8.4, 0.2))])
def s_t_oda():
    oda()
    pcam([(0, (1.5, -10, 2.3)), (1, (1.7, -9, 2.2))], lens=32)
def s_t_sq():
    tunel(gap=(0, 0.42))
    rope(-30, 30, z=lambda x: -0.25)
    d = K.diver("d1"); wash(d)
    swim(d, [(1, (-4.2, 0, 0.0)), (N, (-2.5, 0, 0.0))])
    c = K.carried(); swim(c, [(1, (-2.9, 0, -0.05)), (N, (-1.2, 0, -0.05))], bob=0.02)
    pcam([(0, (-1.0, -7.5, 0.0)), (1, (-0.6, -7.0, 0.0))])

def kcam(keys, zc=-1.0):
    """Kesit kamerası: mağara karenin üst-orta bölümünde kalsın (altyazı bandı boş). keys=[(t, x, genişlik[, zc])]"""
    return ocam([(k[0], k[1], (k[3] if len(k) > 3 else zc) - 0.05 * k[2] * 16 / 9, k[2]) for k in keys])
def marker(x, m=None, r=0.9, pulse=True):
    """Kesitte yeri gösteren halka."""
    m = m or AMB()
    o = K.prim(bpy.ops.mesh.primitive_torus_add, m, major_radius=r, minor_radius=r * 0.06, location=(x, -0.45, cz(x) - 0.3 * hh(x)), rotation=(R90, 0, 0))
    o.visible_shadow = False
    if pulse:
        for f in range(1, N + 1, max(1, FPS // 2)):
            sc = 1.0 + 0.18 * math.sin(f / FPS * 3.0); o.scale = (sc, sc, sc); o.keyframe_insert("scale", frame=f)
    return o
def overview_labels(size=1.0, c9=True):
    klabel("GİRİŞ", 2.2, 9.0, size, tick=(0.6, ceil(0.6) + 0.2))
    klabel("3. ODA", 12, 11.5, size, tick=(12, ceil(12) + 0.2))
    if c9: klabel("9. ODA", 36.5, 11.5, size, AMB(), tick=(37.2, ceil(37.2) + 0.2))
def counter(cam, items, y=0.30, size=0.05, m=None, sub=None):
    """items=[(t0, yazı), …]: sırayla görünen yazılar (gün sayacı, gösterge)."""
    m = m or K.flat("sayac", (1, 1, 1), emit=1.0)
    for i, (t0, body) in enumerate(items):
        o = K.hud(cam, body, 0, y, size, m[i] if isinstance(m, list) else m, spacing=1.2)
        t1 = items[i + 1][0] if i + 1 < len(items) else None
        ks = [(1, t0 <= 0)] + ([(F(t0), True)] if t0 > 0 else []) + ([(F(t1), False)] if t1 is not None else [])
        K.show(o, ks)
    if sub: K.hud(cam, sub, 0, y + size * 1.5, size * 0.42, AMB(), spacing=1.4)
def glow(root, k=0.85):
    """Işıksız kesit sahnesinde figür görünsün: malzemeleri kendi renginde ışıt."""
    for o in root.children_recursive:
        if o.type == "MESH":
            for m in o.data.materials:
                b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Emission Color"].default_value = b.inputs["Base Color"].default_value; b.inputs["Emission Strength"].default_value = k
def people(xs, z=None, colors=((0.75, 0.35, 0.05), (0.15, 0.25, 0.45), (0.5, 0.5, 0.2)), scale=0.42, y=-0.6):
    for i, x in enumerate(xs):
        p = K.stander(f"p{i}", colors[i % len(colors)], scale=scale)
        p["root"].location = (x, y, (floor(max(x, -0.4)) if z is None else z)); p["root"].rotation_euler = (0, 0, 0 if i % 3 else math.pi); glow(p["root"])
def bike(x, z, sc=0.33):
    m = K.mat("bisiklet", (0.55, 0.57, 0.6), emit=0.8)
    for dx in (-0.55, 0.55):
        w = K.prim(bpy.ops.mesh.primitive_torus_add, m, major_radius=0.36 * sc / 0.33, minor_radius=0.03, location=(x + dx * sc / 0.33, -0.6, z + 0.38), rotation=(R90, 0, 0)); w.visible_shadow = False
    q = sc / 0.33
    K.polyline("kadro", [(x - 0.55 * q, -0.6, z + 0.38), (x - 0.1 * q, -0.6, z + 0.38), (x + 0.3 * q, -0.6, z + 0.85), (x - 0.3 * q, -0.6, z + 0.85), (x - 0.55 * q, -0.6, z + 0.38)], 0.025, m)
    K.polyline("gidon", [(x - 0.1 * q, -0.6, z + 0.38), (x - 0.3 * q, -0.6, z + 0.95), (x + 0.3 * q, -0.6, z + 0.85), (x + 0.55 * q, -0.6, z + 0.38), (x + 0.42 * q, -0.6, z + 1.0)], 0.025, m)
GZ = floor(-0.4)
def dis(sky=(0.05, 0.07, 0.10), level=L1, dim=1.0, rise=None, to=None):
    w = kesit(level=level, sky=sky, dim=dim, rise=rise, to=to); return w

# ---------- kanca
def s_h1():
    oda(torch=22)
    pcam([(0, (1.9, -12.5, 2.6)), (1, (1.9, -8.8, 2.3))], lens=32)
def s_h2():
    figs, w = oda(water=[(1, 0.0), (N, 0.55)], torch=22)
    pcam([(0, (-1.5, -7.5, 1.0)), (1, (-0.8, -7.0, 1.25))], lens=28)
def s_h3():
    kesit()
    c = kcam([(0, 19.6, 44), (1, 19.6, 47)], zc=3)
    overview_labels(c9=False)
    marker(X_C9)
    klabel("13 KİŞİ", 36.5, 11.5, 1.0, AMB(), tick=(37.2, ceil(37.2) + 0.2))
    route(37.2, 0.3, draw=[(F(0.08), 0), (F(0.8), 1)])
    dm = K.flat("olcu", (1, 1, 1), emit=1.0); K.fade(dm, [(F(0.45), 0), (F(0.6), 1)])
    K.polyline("olcu", [(0.3, -0.5, -10.4), (0.3, -0.5, -9.6), (0.3, -0.5, -10), (37.2, -0.5, -10), (37.2, -0.5, -9.6), (37.2, -0.5, -10.4)], 0.05, dm)
    K.text("YAKLAŞIK 4 KM", (18.7, -0.5, -12.4), 1.3, dm, spacing=1.2)
    K.hud(c, "ŞEMATİK GÖSTERİM", 0, -0.40, 0.011, K.flat("sem", (0.6, 0.6, 0.6), emit=1.0), spacing=1.5)
# ---------- 23 Haziran
def s_a1():
    kesit(level=L0, sky=(0.20, 0.27, 0.36))
    c = kcam([(0, 14, 42), (1, 17, 40)], zc=4)
    title(c, "23 HAZİRAN 2018", "THAM LUANG  ·  KUZEY TAYLAND", y=0.335, t=(0.03, 1.0), fade_out=False)
def s_a2():
    kesit(level=L0, sky=(0.20, 0.27, 0.36))
    kcam([(0, 2.5, 13), (1, 5.0, 13)], zc=0)
    klabel("GİRİŞ", 0.6, 4.4, 0.42, tick=(0.3, ceil(0.3) + 0.1))
    cols = [K.mat(f"n{i}", c, emit=1.0) for i, c in enumerate(((0.9, 0.3, 0.25), (0.95, 0.8, 0.5), (0.5, 0.7, 0.95)))]
    for i in range(13):
        dot([(1, -5.5 - i * 0.42), (N, 6.0 - i * 0.42)], m=cols[i % 3], r=0.10 if i else 0.13, off=-0.85)
    for i in range(4): bike(-9.0 + i * 0.5, GZ, 0.2)
def s_a3():
    kesit(level=L0, sky=(0.20, 0.27, 0.36))
    kcam([(0, 13, 15), (1, 19, 15)], zc=-1.5)
    cols = [K.mat(f"n{i}", c, emit=1.0) for i, c in enumerate(((0.9, 0.3, 0.25), (0.95, 0.8, 0.5), (0.5, 0.7, 0.95)))]
    for i in range(13):
        dot([(1, 11.0 - i * 0.36), (N, 20.5 - i * 0.36)], m=cols[i % 3], r=0.11, off=-0.85)
    klabel("3. ODA", 12, 5.3, 0.45, tick=(12, ceil(12) + 0.1))
def s_a4():
    kesit(level=L0, sky=(0.07, 0.09, 0.13), dim=0.8)
    c = kcam([(0, 9, 30), (1, 11, 28)], zc=4)
    rain(10, 14, w=40, h=60, density=7)
    title(c, "MUSON", None, y=0.33, t=(0.1, 1.0), fade_out=False)
def s_a5():
    kesit(level=L0, rise=[(F(0.0), 0), (F(0.85), 1)], to=L1, dim=0.9)
    kcam([(0, 22, 26), (1, 27, 24)], zc=-1)
    cols = [K.mat(f"n{i}", c, emit=1.0) for i, c in enumerate(((0.9, 0.3, 0.25), (0.95, 0.8, 0.5), (0.5, 0.7, 0.95)))]
    for i in range(13):
        dot([(1, 27.5 - i * 0.3), (F(0.8), 37.9 - i * 0.12), (N, 37.9 - i * 0.12)], m=cols[i % 3], r=0.13, off=-0.85)
    lm = K.flat("sul", (0.45, 0.80, 0.95), emit=1.0); K.fade(lm, [(F(0.25), 0), (F(0.4), 1)])
    K.text("SU YÜKSELİYOR", (22, -0.5, -9.2), 0.75, lm, spacing=1.2)
    klabel("9. ODA", 37.2, 6.6, 0.7, AMB(), tick=(37.2, ceil(37.2) + 0.1))
def s_a6():
    kesit(level=L1, sky=(0.035, 0.045, 0.07), dim=0.75)
    kcam([(0, -3.2, 9.5), (1, -2.6, 8.5)], zc=1.0)
    for i in range(5): bike(-7.0 + i * 1.05 + (0.1 if i % 2 else 0), GZ, 0.27)
    for i, x in enumerate((-1.9, -1.5, -1.25)):
        K.box(K.mat(f"canta{i}", ((0.5, 0.12, 0.1), (0.1, 0.2, 0.45), (0.2, 0.2, 0.2))[i], emit=0.8), (x, -0.6, GZ + 0.13), (0.26, 0.2, 0.26), shadow=False)
    rain(-3, 2, w=16, h=22, density=7)
# ---------- arama
def s_b1():
    tunel(murky=True, seed=3)
    rope(-30, 30)
    d = K.diver("d1", energy=500, peak=0.10, cone_len=3.0); wash(d, 120, color=(1.0, 0.85, 0.55))
    swim(d, [(1, (-2.2, 0, 0.1)), (N, (-1.0, 0, 0.2))], bob=0.12, rot=-0.12)
    d2 = K.diver("d2", accent=(0.1, 0.25, 0.5), energy=400, peak=0.08, cone_len=3.0); wash(d2, 100, color=(1.0, 0.85, 0.55))
    swim(d2, [(1, (-4.9, 0.9, 1.6)), (N, (-3.9, 0.9, 1.4))], bob=0.12, rot=0.1)
    K.motes(420, (-9, -2.2, -4), (12, 2.5, 4), drift=(-1.6, 0, 0.1), frames=N, size=(0.012, 0.035), seed=8)
    K.bubbles(12, lambda f: (-1.4, 0.4), 1, N, y=0.0)
    pcam([(0, (-1.8, -8.6, 0.3)), (1, (-1.2, -8.2, 0.3))])
def s_b2():
    kesit(level=L1, sky=(0.04, 0.05, 0.08), dim=0.75)
    c = kcam([(0, -3.6, 12), (1, -3.0, 11)], zc=2.0)
    people([-8.5, -7.9, -7.1, -6.2, -5.6, -4.4, -3.5, -2.9, -1.2, -0.3, 0.8, 1.6], scale=0.42)
    for i, x in enumerate((-7.4, -4.9)):                      # çadırlar
        K.polyline("cadir", [(x - 0.9, -0.3, GZ), (x, -0.3, GZ + 1.1), (x + 0.9, -0.3, GZ)], 0.05, K.mat("cadir", (0.75, 0.72, 0.6), emit=0.8))
    pm = K.mat("pompa", (0.75, 0.55, 0.08), emit=0.8)
    for x in (-2.2, -1.9): K.box(pm, (x - 0.1, -0.5, GZ + 0.22), (0.5, 0.3, 0.44), shadow=False)
    K.polyline("boru", [(3.5, -0.5, floor(3.5) + 0.12), (1.5, -0.5, floor(1.5) + 0.12), (-0.4, -0.5, GZ + 0.15), (-2.2, -0.5, GZ + 0.15), (-6, -0.5, GZ + 0.15), (-9.5, -0.5, GZ + 0.15), (-12.5, -0.5, GZ + 0.15)], 0.07, K.mat("boruM", (0.25, 0.4, 0.55), emit=0.8))
    rain(-3, 3, w=20, h=26, density=5)
    m = K.flat("gun", (1, 1, 1), emit=1.0)
    counter(c, [(i / 9 * 0.92, f"GÜN {i + 1}") for i in range(9)], y=0.33, size=0.05, m=m)
# ---------- bulunuş
def s_c1():
    tunel(seed=2)
    rope(-30, 30, draw=[(1, 0.52), (N, 0.58)])
    d = K.diver("d1"); wash(d)
    swim(d, [(1, (-3.6, 0, 0.1)), (N, (-0.6, 0, 0.0))])
    d2 = K.diver("d2", accent=(0.55, 0.1, 0.08)); wash(d2, 160)
    swim(d2, [(1, (-6.6, 0.9, 1.5)), (N, (-3.4, 0.9, 1.3))])
    K.bubbles(14, lambda f: (-3.6 + 3 * (f - 1) / N + 0.85, 0.3), 1, N, y=0.0)
    K.bubbles(10, lambda f: (-6.6 + 3.2 * (f - 1) / N + 0.85, 1.7), 1, N, y=0.8, seed=4)
    K.motes(140, (-9, -1.5, -3.5), (9, 2.5, 3.5), frames=N)
    c = pcam([(0, (-2.6, -9.2, 0.2)), (1, (-1.2, -8.6, 0.2))])
    title(c, "2 TEMMUZ 2018", "10. GÜN", y=0.33, t=(0.0, 0.75))
def heads(x0=-5.6):
    """Su yüzeyine çıkmış iki dalgıç başı + kıyıya dönük fener."""
    out = []
    for i, (x, y) in enumerate(((x0, -1.6), (x0 - 1.2, -0.6))):
        r = K.empty(f"bas{i}", (x, y, 0.0))
        K.ball(K.mat("elbise", (0.025, 0.028, 0.035), rough=0.45), (0, 0, 0.12), 0.16, r)
        K.ball(K.mat("ten", (0.75, 0.55, 0.42)), (0.05, 0, 0.10), 0.13, r)
        K.box(K.mat("kask", (0.8, 0.8, 0.82)), (0, 0, 0.27), (0.2, 0.2, 0.06), r)
        K.ball(K.mat("lamba", (1, 0.95, 0.8), emit=6), (0.12, 0, 0.27), 0.04, r)
        out.append(r)
    return out
def s_c2():
    oda(torch=10, cool=3)
    hs = heads(-4.2)
    for i, r in enumerate(hs):
        K.move(r, [(1, (r.location.x, r.location.y, -0.5)), (F(0.3 + i * 0.12), (r.location.x, r.location.y, -0.5)), (F(0.5 + i * 0.12), (r.location.x + 0.2, r.location.y, 0.0)), (N, (r.location.x + 0.5, r.location.y, 0.0))])
    sp = K.light_cone(hs[0], (0.15, 0, 0.27), (0, rad(-90 - 14), 0), energy=2500, length=6.0, spread=16, peak=0.06)
    pcam([(0, (-2.4, -9.5, 1.5)), (1, (-1.8, -9.0, 1.6))], lens=30)
def s_c3():
    oda(torch=10, cool=3)
    hs = heads(-4.6)
    K.light_cone(hs[0], (0.15, 0, 0.27), (0, rad(-90 - 15), rad(4)), energy=4500, length=7.0, spread=34, peak=0.04)
    c = pcam([(0, (0.6, -8.8, 2.0)), (1, (1.3, -7.6, 2.1))], lens=34)
    m = K.flat("on3", (1, 1, 1), emit=1.0); K.fade(m, [(F(0.50), 0), (F(0.58), 1)])
    K.hud(c, "13 / 13", 0, 0.33, 0.06, m, spacing=1.2)
    m2 = K.flat("on3b", (0.95, 0.5, 0.04), emit=1.0); K.fade(m2, [(F(0.72), 0), (F(0.8), 1)])
    K.hud(c, "HEPSİ HAYATTA", 0, 0.285, 0.02, m2, spacing=1.4)
def drips(n=10, seed=2):
    rnd = random.Random(seed); m = K.mat("damla", (0.7, 0.85, 0.95), emit=0.8)
    for i in range(n):
        x, y = rnd.uniform(0, 4), rnd.uniform(-0.6, 1.8); f0 = rnd.randint(1, max(2, N - FPS))
        o = K.ball(m, (x, y, 6), 0.014, None, (1, 1, 2.5)); o.visible_shadow = False
        K.move(o, [(f0, (x, y, 5.5)), (f0 + int(FPS * 0.9), (x, y, bank(x) + 0.2))]); K.show(o, [(1, False), (f0, True), (f0 + int(FPS * 0.9), False)])
def s_c4():
    oda(torch=20, cool=4); drips(14)
    pcam([(0, (0.6, -6.2, 1.9)), (1, (3.0, -6.0, 2.3))], lens=40)
def s_c5():
    oda(torch=30, cool=8); drips(8, 5)
    pcam([(0, (5.5, -7.5, 3.4)), (1, (4.6, -6.8, 3.2))], lens=36).rotation_euler = (rad(84), 0, rad(14))
# ---------- sorun
def s_d1():
    kesit(dim=0.8)
    kcam([(0, 19.6, 46), (1, 21, 42)], zc=3)
    overview_labels(); marker(X_C9)
def s_d2():
    kesit()
    kcam([(0, 34.5, 15), (1, 17.5, 15)], zc=-1.5)
    route(37.2, 0.3, r=0.05)
    for x in (33.8, 26.5, 16):
        klabel("SU ALTINDA", x, floor(x) - 1.9, 0.48, K.mat("sul2", (0.45, 0.80, 0.95), emit=1.0), tick=(x, floor(x) - 0.1))
    klabel("9. ODA", 37.2, 6.6, 0.5, AMB(), tick=(37.2, ceil(37.2) + 0.1))
    klabel("PATTAYA\nBEACH", 30.5, 6.6, 0.45, tick=(30.5, ceil(30.5) + 0.1))
    dot([(1, 37.0), (N, 14.0)], r=0.17, off=-0.3)
def s_d3():
    tunel(gap=(0, 0.40), seed=4)
    rope(-30, 30, z=lambda x: -0.22)
    d = K.diver("d1", tanks=False, energy=350, peak=0.08); wash(d, 90)
    swim(d, [(1, (-3.4, 0.2, 0.0)), (N, (-1.5, 0.2, 0.0))], bob=0.01)
    t = K.empty("tupler"); K.limb((0, 0, 0), (0.6, 0, 0), 0.085, K.mat("tup", (0.55, 0.58, 0.62), rough=0.25), t)
    K.move(t, [(1, (-2.1, 0.0, -0.14)), (N, (-0.2, 0.0, -0.14))])
    K.motes(90, (-6, -1, -2), (6, 2, 2), frames=N)
    pcam([(0, (-0.8, -7.4, 0.0)), (1, (-0.3, -6.6, 0.0))])
def s_d4():
    oda(torch=30, cool=5)
    pcam([(0, (3.6, -5.6, 2.6)), (1, (2.4, -5.4, 2.2))], lens=42)
def s_d5():
    kesit()
    c = kcam([(0, 20, 46), (1, 20, 46)], zc=12)
    overview_labels(0.95); marker(X_C9, pulse=False)
    zt = surf(36.6)
    K.polyline("sondaj", [(36.6, -0.5, zt + 1.0), (36.6, -0.5, ceil(36.6) + 14)], 0.11, LBL(), draw=[(F(0.15), 0), (F(0.42), 1)])
    lm = K.flat("sl", (1, 1, 1), emit=1.0); K.fade(lm, [(F(0.12), 0), (F(0.2), 1)])
    K.text("YUKARIDAN\nDELMEK", (27.5, -0.5, zt - 13), 1.05, lm, spacing=1.15)
    rm = K.flat("carpi", (1.0, 0.16, 0.10), emit=1.0); K.fade(rm, [(F(0.44), 0), (F(0.48), 1)])
    for a in (45, -45):
        K.box(rm, (36.6, -0.7, ceil(36.6) + 14), (3.4, 0.05, 0.3), rot=(0, rad(a), 0), shadow=False)
    wm = K.flat("bek", (1, 1, 1), emit=1.0); K.fade(wm, [(F(0.52), 0), (F(0.6), 1)])
    K.hud(c, "AYLARCA\nBEKLEMEK", -0.02, 0.36, 0.022, wm, spacing=1.2)
    rm2 = K.flat("carpi2", (1.0, 0.16, 0.10), emit=1.0); K.fade(rm2, [(F(0.84), 0), (F(0.88), 1)])
    for a in (45, -45):
        h = K.hud(c, "", 0, 0, 0.01, rm2); 
        b = K.box(rm2, (-0.02, 0.352, 0.01), (0.09, 0.008, 0.001), parent=h.parent, rot=(0, 0, rad(a)), shadow=False)
# ---------- Saman Kunan
def tank_on_line(x, z=-0.9, y=0.3):
    t = K.empty("yedek", (x, y, z - 0.42))
    K.limb((0, 0, -0.3), (0, 0, 0.3), 0.09, K.mat("tup", (0.55, 0.58, 0.62), rough=0.25), t)
    K.box(K.mat("vana", (0.08, 0.08, 0.08)), (0, 0, 0.40), (0.08, 0.08, 0.1), t)
    return t
def s_e1():
    tunel(seed=5)
    zf = lambda x: -0.9 + 0.12 * math.sin(x * 0.6)
    rope(-30, 30)
    for x in (-6.5, -3.2): tank_on_line(x, zf(x))
    d = K.diver("d1", accent=(0.75, 0.75, 0.2)); wash(d)
    swim(d, [(1, (-2.4, 0, -0.2)), (N, (0.2, 0, -0.25))])
    t = tank_on_line(0, 0); t.parent = d["root"]; t.location = (0.75, -0.05, -0.05); t.rotation_euler = (0, rad(75), 0)
    K.bubbles(12, lambda f: (-2.4 + 2.6 * (f - 1) / N + 0.85, 0.0), 1, N, y=0.0)
    K.motes(120, (-9, -1.5, -3.5), (9, 2.5, 3.5), frames=N)
    c = pcam([(0, (-2.0, -9.4, 0.0)), (1, (-0.8, -8.8, 0.0))])
    title(c, "6 TEMMUZ 2018", None, y=0.33, t=(0.0, 0.6))
def s_e2():
    tunel(seed=5)
    zf = lambda x: -0.9 + 0.12 * math.sin(x * 0.6)
    rope(-30, 30)
    for x in (-4.5, -1.2, 2.2): tank_on_line(x, zf(x))
    bpy.ops.object.light_add(type="SPOT", location=(-1.2, -5, 2.5), rotation=(rad(62), 0, 0)); L = bpy.context.active_object
    L.data.spot_size = rad(50); L.data.spot_blend = 0.8; L.data.color = (1.0, 0.93, 0.78)
    for f, e in ((1, 2600), (F(0.85), 500)):
        L.data.energy = e; L.data.keyframe_insert("energy", frame=f)
    K.motes(120, (-9, -1.5, -3.5), (9, 2.5, 3.5), frames=N, drift=(0.05, 0, 0.02))
    c = pcam([(0, (-1.2, -8.2, -0.2)), (1, (-1.2, -9.6, -0.2))])
    title(c, "SAMAN KUNAN", "GÖNÜLLÜ DALGIÇ", y=0.33, t=(0.12, 1.0), fade_out=False, size=0.032)
# ---------- oksijen, yağış
def s_f1():
    oda(torch=18, cool=5)
    c = pcam([(0, (1.2, -9.4, 2.3)), (1, (2.0, -8.2, 2.3))], lens=34)
    vals = [21, 20, 19, 18, 17, 16, 15]
    ms = [K.flat(f"o{v}", (1, 1, 1) if v > 16 else ((1.0, 0.5, 0.2) if v == 16 else (1.0, 0.16, 0.10)), emit=1.0) for v in vals]
    counter(c, [(0.30 + i * 0.045 if i else 0.0, f"%{v}") for i, v in enumerate(vals)], y=0.31, size=0.07, m=ms, sub="OKSİJEN")
def s_f2():
    kesit(level=L1, rise=[(F(0.1), 0), (N, 0.8)], sky=(0.04, 0.05, 0.08), dim=0.8)
    kcam([(0, 35.6, 12), (1, 36.4, 10.5)], zc=0.5)
    marker(X_C9, r=0.75)
    dz = L2 + 0.25
    K.dashes(30, 42, dz, -0.5, K.mat("tehdit", (0.45, 0.80, 0.95), emit=1.0), step=0.4, thick=0.035)
    rain(36, 0, w=16, h=24, density=3.5, alpha=0.22)
    klabel("YENİ YAĞIŞ BEKLENİYOR", 36.2, 5.2, 0.42, K.mat("sul2", (0.45, 0.80, 0.95), emit=1.0))
# ---------- plan
def s_g1():
    tunel(seed=6)
    rope(-30, 30)
    K.motes(160, (-9, -1.5, -3.5), (9, 2.5, 3.5), frames=N)
    bpy.ops.object.light_add(type="SPOT", location=(-8, -3, 0.4), rotation=(0, rad(-80), rad(12))); L = bpy.context.active_object
    L.data.energy = 5000; L.data.spot_size = rad(40); L.data.spot_blend = 0.7
    c = pcam([(0, (-2.0, -9.2, 0.0)), (1, (0.5, -9.2, 0.0))])
    title(c, "TEK PLAN", "DAHA ÖNCE HİÇ DENENMEMİŞ", y=0.33, t=(0.1, 1.0), fade_out=False, size=0.042)
def pair(x0, x1, z=0.0, kid_dx=0.25, kid_dz=-0.36, y=0.0, lamp_energy=900):
    d = K.diver("kurtarici", energy=lamp_energy); wash(d)
    swim(d, [(1, (x0, y, z)), (N, (x1, y, z))], bob=0.04)
    c = K.carried(); c["root"].parent = d["root"]; c["root"].location = (kid_dx, -0.12, kid_dz)
    return d, c
def s_g2():
    tunel(seed=7); rope(-30, 30, z=lambda x: -1.2 + 0.1 * math.sin(x * 0.6))
    pair(-3.4, -0.8)
    K.bubbles(12, lambda f: (-3.4 + 2.6 * (f - 1) / N + 0.85, 0.2), 1, N, y=0.0)
    K.motes(140, (-9, -1.5, -3.5), (9, 2.5, 3.5), frames=N)
    pcam([(0, (-1.6, -10.5, 0.1)), (1, (-0.9, -9.6, 0.1))])
def lying(x, y=-0.2):
    c = K.carried("yatan", scale=0.85)
    c["root"].location = (x, y, bank(x) + 0.32); c["root"].rotation_euler = (math.pi, rad(-21), 0)
    return c
def s_g3():
    oda(torch=16, cool=5, kids=False)
    lying(1.6)
    doc = K.sitter("doktor", (0.05, 0.06, 0.08), scale=1.05); doc["root"].location = (2.75, 0.1, bank(2.75) + 0.05); doc["root"].rotation_euler = (0, 0, math.pi)
    d2 = K.stander("yardimci", (0.05, 0.06, 0.08), scale=1.0, helmet=True); d2["root"].location = (0.2, 0.6, bank(0.2) + 0.2); d2["root"].rotation_euler = (0, 0, 0)
    for i, x in enumerate((4.6, 5.3, 6.0, 5.0, 5.8)):
        s = K.sitter(f"b{i}", SHIRTS[i], scale=0.8); s["root"].location = (x, 1.0 + (i > 2) * 1.2, bank(x) + 0.25 + (i > 2) * 0.25); s["root"].rotation_euler = (0, 0, math.pi)
    c = pcam([(0, (2.2, -8.2, 2.2)), (1, (2.0, -6.8, 2.0))], lens=36)
    title(c, "DR. RICHARD HARRIS", "ANESTEZİ UZMANI  ·  MAĞARA DALGICI", y=0.33, t=(0.25, 1.0), fade_out=False, size=0.03)
def s_g4():
    oda(torch=16, cool=6, kids=False)
    lying(1.6)
    doc = K.sitter("doktor", (0.05, 0.06, 0.08), scale=1.05); doc["root"].location = (2.75, 0.1, bank(2.75) + 0.05); doc["root"].rotation_euler = (0, 0, math.pi)
    c = pcam([(0, (2.6, -6.4, 2.0)), (1, (1.9, -5.6, 1.9))], lens=42)
    lm = K.flat("mk", (1, 1, 1), emit=1.0); K.fade(lm, [(F(0.25), 0), (F(0.4), 1)])
    K.hud(c, "TAM YÜZ MASKESİ", 0, 0.30, 0.022, lm, spacing=1.4)
def s_g5():
    oda(torch=0, cool=4, kids=False)
    d2 = K.stander("harris", (0.05, 0.06, 0.08), scale=1.0, helmet=True); d2["root"].location = (-0.8, -0.2, bank(-0.8) + 0.02); d2["root"].rotation_euler = (0, 0, math.pi)
    K.light_cone(d2["root"], (0.1, 0, 1.75), (0, rad(-90 - 25), 0), energy=1500, length=5, spread=36, peak=0.10)
    pcam([(0, (-1.5, -9.0, 1.7)), (1, (-1.2, -8.0, 1.7))], lens=34)
# ---------- tahliye
def s_i0():
    tunel(seed=8); rope(-30, 30, z=lambda x: -1.2 + 0.1 * math.sin(x * 0.6))
    pair(-2.6, -0.9)
    K.bubbles(10, lambda f: (-2.6 + 1.7 * (f - 1) / N + 0.85, 0.2), 1, N, y=0.0)
    K.motes(140, (-9, -1.5, -3.5), (9, 2.5, 3.5), frames=N)
    c = pcam([(0, (-1.6, -7.0, -0.1)), (1, (-0.2, -6.6, -0.1))], lens=38)
    title(c, "8 TEMMUZ 2018", "TAHLİYE BAŞLIYOR", y=0.33, t=(0.0, 0.8))
def s_i1():
    tunel(seed=9); rope(-30, 30, z=lambda x: -1.2 + 0.1 * math.sin(x * 0.6))
    pair(-2.0, 0.6)
    K.bubbles(12, lambda f: (-2.0 + 2.6 * (f - 1) / N + 0.85, 0.2), 1, N, y=0.0)
    K.motes(140, (-9, -1.5, -3.5), (9, 2.5, 3.5), frames=N)
    pcam([(0, (-1.0, -5.2, -0.4)), (1, (1.4, -5.0, -0.4))], lens=40)
def s_i2():
    tunel(gap=(0, 0.42), seed=4)
    rope(-30, 30, z=lambda x: -0.25)
    d = K.diver("d1", tanks=False, energy=350, peak=0.08); wash(d, 90)
    swim(d, [(1, (-4.6, 0.1, 0.0)), (N, (-2.9, 0.1, 0.0))], bob=0.01)
    c = K.carried(); swim(c, [(1, (-3.2, 0.1, -0.02)), (N, (-1.5, 0.1, -0.02))], bob=0.01)
    K.motes(90, (-6, -1, -2), (6, 2, 2), frames=N)
    pcam([(0, (-1.6, -7.2, 0.0)), (1, (-0.9, -6.4, 0.0))])
def s_i3():
    kesit()
    kcam([(0, 29.5, 12), (1, 27.5, 12)], zc=-1.2)
    route(37.2, 0.3, r=0.04)
    dot([(1, 34.6), (F(0.42), 31.0), (F(0.75), 31.0), (N, 28.0)], r=0.17, off=-0.3)
    for x in (30.6, 31.3, 29.9): dot([(1, x), (N, x)], m=K.mat("bekleyen", (0.45, 0.80, 0.95), emit=1.0), r=0.13, off=-0.75)
    klabel("HAVA BOŞLUĞU\nNEFES KONTROLÜ", 30.5, 6.6, 0.38, tick=(30.5, ceil(30.5) + 0.1))
def s_i4():
    kesit()
    kcam([(0, 9.5, 15), (1, 4.5, 15)], zc=0)
    klabel("3. ODA", 12, 5.3, 0.45, tick=(12, ceil(12) + 0.1)); klabel("GİRİŞ", 0.6, 4.6, 0.45, tick=(0.3, ceil(0.3) + 0.1))
    K.polyline("halat", [(12 - i * 0.2, -0.3, cz(12 - i * 0.2) + 0.1 * hh(12 - i * 0.2)) for i in range(62)], 0.03, LBL())
    om = K.mat("zincir", (0.95, 0.5, 0.04), emit=1.0)
    for i in range(34): dot([(1, 11.6 - i * 0.36), (N, 11.6 - i * 0.36)], m=om, r=0.085, off=-0.8)
    dot([(1, 11.5), (N, 1.0)], r=0.2, off=-0.35)
def s_i5():
    kesit(sky=(0.10, 0.14, 0.20))
    c = kcam([(0, 19.6, 46), (1, 19.6, 44)], zc=3)
    overview_labels(c9=True)
    for k, t0 in enumerate((0.02, 0.36, 0.68)):
        dot([(1, 37.0), (F(t0), 37.0), (F(t0 + 0.26), 0.5), (N, 0.5)], r=0.34, off=-0.3, m=AMB())
    m = K.flat("sy", (1, 1, 1), emit=1.0)
    counter(c, [(0.0, "8 TEMMUZ"), (0.36, "9 TEMMUZ"), (0.68, "10 TEMMUZ")], y=0.375, size=0.026, m=m)
    counter(c, [(0.0, "0 / 13"), (0.26, "4 / 13"), (0.60, "8 / 13"), (0.93, "13 / 13")], y=0.30, size=0.06, m=K.flat("sy2", (1, 1, 1), emit=1.0))
def s_i6():
    kesit(sky=(0.42, 0.55, 0.68), dim=1.15)
    c = kcam([(0, -3.2, 9.5), (1, -3.0, 8.8)], zc=3.2)
    people([-7.2, -6.6, -5.9, -5.3, -4.7, -4.0, -3.4, -2.8, -2.2, -1.6, -1.0, 0.4, 1.1], scale=0.5)
    K.hud(c, "13 / 13", 0, 0.32, 0.075, K.flat("s13", (1, 1, 1), emit=1.0), spacing=1.2)
    K.hud(c, "HEPSİ KURTARILDI", 0, 0.268, 0.024, K.flat("s13b", (0.03, 0.05, 0.10), emit=1.0), spacing=1.4)
def s_i7():
    kesit(level=L1, rise=[(F(0.25), 0), (N, 1.0)], to=L2 + 0.9, sky=(0.05, 0.07, 0.10), dim=0.85)
    c = kcam([(0, 8, 20), (1, 12, 22)], zc=-0.5)
    klabel("3. ODA", 12, 5.3, 0.6, tick=(12, ceil(12) + 0.1))
    for i in range(5): dot([(1, 10.5 - i * 0.5), (F(0.8), 1.0 - i * 0.4), (N, -0.2 - i * 0.4)], r=0.14, off=-0.8)
    m = K.flat("ariza", (1.0, 0.16, 0.10), emit=1.0); K.fade(m, [(F(0.2), 0), (F(0.27), 1)])
    K.hud(c, "POMPA ARIZASI", 0, 0.33, 0.032, m, spacing=1.35)
# ---------- kapanış
def s_j1():
    kesit(sky=(0.16, 0.20, 0.27), level=L1)
    c = kcam([(0, 18, 46), (1, 18, 52)], zc=10)
    m = K.flat("k1", (1, 1, 1), emit=1.0)
    for i, (body, y, size) in enumerate((("17 GÜN", 0.39, 0.05), ("10.000+ İNSAN", 0.335, 0.028), ("13 HAYAT", 0.29, 0.028))):
        mm = K.flat(f"k{i}", (1, 1, 1) if i != 2 else (0.95, 0.5, 0.04), emit=1.0); K.fade(mm, [(F(0.02 + i * 0.3), 0), (F(0.1 + i * 0.3), 1)])
        K.hud(c, body, 0, y, size, mm, spacing=1.35)
def s_j2():
    kesit(sky=(0.30, 0.33, 0.40), dim=0.9)
    c = kcam([(0, -5.4, 8.5), (1, -5.4, 7.6)], zc=2.2)
    bronze = (0.38, 0.24, 0.10)
    K.box(K.mat("kaide", (0.25, 0.25, 0.26), emit=0.9), (-5.4, -0.6, GZ + 0.45), (1.0, 0.6, 0.9), shadow=False)
    st = K.stander("heykel", bronze, scale=1.0, helmet=False)
    glow(st["root"]); st["root"].location = (-5.4, -0.6, GZ + 0.9); st["root"].rotation_euler = (0, 0, rad(-60))
    m = K.flat("son", (1, 1, 1), emit=1.0); K.fade(m, [(F(0.1), 0), (F(0.25), 1)])
    K.hud(c, "SAMAN KUNAN", 0, 0.345, 0.034, m, spacing=1.35)
    K.hud(c, "THAM LUANG  ·  2018", 0, 0.305, 0.016, K.mat("amber", (0.95, 0.5, 0.04), emit=1.0), spacing=1.4)
    m3 = K.flat("sem", (0.8, 0.8, 0.8), emit=1.0); K.fade(m3, [(F(0.55), 0), (F(0.7), 1)])
    K.hud(c, "MAĞARA KESİTİ ŞEMATİKTİR, ÖLÇEKLİ DEĞİLDİR", 0, -0.405, 0.0095, m3, spacing=1.3)

if SHOT not in SHOTS: raise SystemExit("bilinmeyen çekim")
globals()["s_" + SHOTS[SHOT].get("fn", SHOT)]()
os.makedirs(f"{HERE}/stills", exist_ok=True)
K.render(f"{HERE}/stills/{SHOT}" if MODE == "still" else f"{HERE}/frames/{SHOT}", MODE, N, scale=SCALE)
