# Mağarada 17 Gün (3D) v2: çekim betiği.
#   Blender -b -P film.py -- <çekim-id> <still|anim|lab> [fps] [ölçek%]
# still: görüntü + yazılar birlikte (kadraj kontrolü). anim: görüntü geçişi (720x1280). lab: yazı geçişi (1080x1920, saydam).
# Süreler shots.json'dan (seslendirme zamanlarından üretilir) gelir.
import json, math, os, random, sys
import bpy, bmesh
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "kit") if os.path.isdir(os.path.join(HERE, "kit")) else os.path.join(HERE, "..", "..", "blender"))
import kit as K
import figures as Fg
from kit import R90
from mathutils import Vector, Matrix

A = K.argv()
SHOT, MODE = A[0], A[1]
FPS = int(A[2]) if len(A) > 2 else 12
SCALE = int(A[3]) if len(A) > 3 else 100
SHOTS = {s["id"]: s for s in json.load(open(f"{HERE}/shots.json"))}
DUR = SHOTS[SHOT]["dur"]
N = max(2, round(DUR * FPS))
SAMPLES = 16
def F(t): return int(round(1 + t * (N - 1)))
def S(sec): return int(round(1 + sec * FPS))
rad = math.radians
def reset(**kw):
    K.reset(samples=SAMPLES, **kw); Fg.forget()

# ================================================================ KESİT (şematik dağ kesiti, derinlikli)
ZS = 2.3
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
    return 2.9 * ZS + 12 * math.sin(math.pi * min(max(x + 0.4, 0), 50) / 56) ** 0.75 + 0.5 * math.sin(x * 1.3) + 0.3 * math.sin(x * 3.7)
X_ENT, X_C3, X_PB, X_C9 = 0.0, 12.0, 30.5, 37.2
L0, L1, L2 = -2.6 * ZS, -1.35 * ZS, -0.55 * ZS        # kuru mevsim, sel, tehdit seviyesi
DEP = 3.2                                             # mağara boşluğunun kesit yüzü arkasındaki derinliği
LBL = lambda: K.mat("etiket", (1, 1, 1), emit=1.0)
AMB = lambda: K.mat("amber", (0.95, 0.50, 0.04), emit=1.0)
RED = lambda: K.mat("kirmizi", (1.0, 0.16, 0.10), emit=1.0)
BLU = lambda: K.mat("sul2", (0.45, 0.80, 0.95), emit=1.0)

def kesit(level=L1, rise=None, to=None, sky=(0.05, 0.07, 0.10), dim=1.0, sun=2.2, inner=1.0):
    """Derinlikli kesit: kesit yüzü (tabakalı, kabartmalı, ışıklı) + arkasında oyuk mağara (tavan/taban/arka duvar,
    sarkıtlar, kayalar) + su (yarı saydam ön yüz ve görünür su yüzeyi). rise=[(kare,0..1)]: su level'dan to'ya yükselir."""
    reset(world=sky, strength=1.0)
    xs = [-30 + i * 0.25 for i in range(int(110 / 0.25) + 1)]
    cx = [-0.4 + i * 0.1 for i in range(int(41 / 0.1) + 1)]
    earth = K.strata_mat("toprak", [(0.34, 0.22, 0.13), (0.10, 0.07, 0.05), (0.42, 0.31, 0.19), (0.07, 0.055, 0.045), (0.25, 0.15, 0.10), (0.16, 0.13, 0.11)], dim=dim, depth=(-15, -5), bands=0.30, bump=1.0, floor_k=0.05)
    K.strip("ust", cx, ceil, surf, 0, earth)
    K.strip("alt", cx, lambda x: -80, floor, 0, earth)
    K.strip("sol", [x for x in xs if x < -0.4] + [-0.4], lambda x: -80, lambda x: surf(x - 0.001), 0, earth)
    K.strip("sag", [40.6] + [x for x in xs if x > 40.6], lambda x: -80, surf, 0, earth)
    forest = K.noise_mat("orman", (0.012, 0.05 * dim, 0.015), (0.03, 0.13 * dim, 0.03), 2.5, bump=0.8, emit=0.05)
    K.ribbon("ormanust", xs, lambda x: surf(x) + 0.02, 0, 26, forest, wobble=0.25, ny=6)
    K.polyline("ormankenar", [(x, 0.0, surf(x) + 0.08) for x in xs], 0.16, forest)
    for y, k, c in ((34, 0.82, 0.55), (52, 0.66, 0.8)):          # uzak sırtlar: derinlik
        col = [s_ * c + e * (1 - c) for s_, e in zip(sky, (0.02, 0.05, 0.03))]
        K.strip("sirt", [x * 2.2 for x in xs], lambda x: -80, lambda x, k=k, y=y: surf(max(x / 2.2 * 1.3 + y * 0.4 - 6, 0.5)) * k + 4, y, K.flat(f"sirt{y}", col, emit=1.0))
    crock = K.noise_mat("mkaya", (0.030 * inner, 0.034 * inner, 0.040 * inner), (0.13 * inner, 0.12 * inner, 0.11 * inner), 1.1, bump=1.0, emit=0.02, detail=8)
    K.strip("arka", cx, lambda x: floor(x) - 0.4, lambda x: ceil(x) + 0.4, DEP, crock)
    K.ribbon("tavanR", cx, ceil, 0, DEP, crock, wobble=0.10, seed=1)
    K.ribbon("tabanR", cx, floor, 0, DEP, K.noise_mat("mcamur", (0.07 * inner, 0.055 * inner, 0.04 * inner), (0.20 * inner, 0.15 * inner, 0.10 * inner), 1.6, bump=0.7, emit=0.02), wobble=0.08, seed=2)
    rim = K.flat("kenar", (0.55 * dim, 0.44 * dim, 0.32 * dim), emit=0.8)
    K.polyline("tavan", [(x, -0.02, ceil(x)) for x in cx], 0.035, rim)
    K.polyline("taban", [(x, -0.02, floor(x)) for x in cx], 0.035, rim)
    rnd = random.Random(11)
    me = bpy.data.meshes.new("sarkit"); bm = bmesh.new()         # sarkıt ve dikitler: tek ağ
    for i in range(150):
        x = rnd.uniform(0.5, 40); h = hh(x)
        if h < 0.5 * ZS: continue
        up = rnd.random() < 0.72
        L = rnd.uniform(0.25, 1.1) * min(1.0, h / (1.1 * ZS)) * (1 if up else 0.55)
        y = rnd.uniform(0.25, DEP - 1.0)
        z = ceil(x) - L / 2 + 0.06 if up else floor(x) + L / 2 - 0.05
        M4 = Matrix.Translation((x, y, z)) @ (Matrix.Rotation(math.pi, 4, "X") if up else Matrix.Identity(4))
        bmesh.ops.create_cone(bm, cap_ends=False, segments=7, radius1=rnd.uniform(0.05, 0.13), radius2=0.008, depth=L, matrix=M4)
    bm.to_mesh(me); bm.free(); o = K.link(bpy.data.objects.new("sarkit", me)); me.materials.append(crock)
    for p in me.polygons: p.use_smooth = True
    for i in range(16):
        x = rnd.uniform(1, 39.5)
        r = rnd.uniform(0.18, 0.42)
        K.rock_blob(crock, (x, rnd.uniform(0.5, DEP - 0.5), floor(x) + r * 0.4), (r * 1.4, r, r), seed=i, subdiv=2)
    wm = K.flat("su", (0.03, 0.20, 0.30), emit=0.55, alpha=0.80, rough=0.3)
    top = lambda L: (lambda x: max(floor(x), min(ceil(x), L)) if x > 0.6 else floor(x))
    water = K.strip("su", cx, floor, top(level), -0.01, wm)
    wt = K.box(K.flat("suyuz", (0.10, 0.42, 0.52), emit=0.55, rough=0.15), (20, DEP / 2 + 0.1, level), (46, DEP - 0.2, 0.03), shadow=False)
    if rise:
        tgt = L2 if to is None else to
        K.rise_key(water, floor, top(tgt), rise)
        K.move(wt, [(f, (20, DEP / 2 + 0.1, level + (tgt - level) * v)) for f, v in rise])
    if sun:
        bpy.ops.object.light_add(type="SUN", rotation=(rad(40), 0, rad(-30))); Ls = bpy.context.active_object
        Ls.data.energy = sun * dim * 1.5; Ls.data.angle = rad(3); Ls.data.color = (1.0, 0.95, 0.88)
    for i, (x, e) in enumerate(((2.5, 30), (12, 60), (21.5, 40), (30.5, 60), (37.2, 70))):   # odalarda loş iç ışık
        bpy.ops.object.light_add(type="POINT", location=(x, DEP * 0.45, cz(x) + 0.3 * hh(x))); Lp = bpy.context.active_object
        Lp.data.energy = e * inner * 2.2; Lp.data.color = (0.55, 0.75, 1.0); Lp.data.shadow_soft_size = 0.3
    return water

def klabel(body, x, z, size=0.42, m=None, tick=None, align="CENTER", y=-0.5):
    """Kesit üstünde etiket; tick=(x,z) verilirse o noktaya ince çizgi çeker."""
    m = m or LBL()
    t = K.text(body, (x, y, z), size, m, align=align, spacing=1.15, line=1.15)
    if tick:
        lines = body.count("\n")
        K.label(K.polyline("cizgi", [(x, y, z - 0.18 - lines * size * 1.15 if tick[1] < z else z + size), (tick[0], y, tick[1])], 0.022, m))
    return t
def clabel(body, x, dz=2.2, size=0.5, m=None):
    """Mağara tavanının dz üstünde etiket + tavana inen çizgi."""
    return klabel(body, x, ceil(x) + dz, size, m, tick=(x, ceil(x) + 0.15))

def route(x0, x1, draw=None, m=None, r=0.07, y=-0.3):
    step = 0.15 if x1 > x0 else -0.15
    n = int(abs(x1 - x0) / 0.15)
    return K.label(K.polyline("rota", [(x0 + i * step, y, cz(x0 + i * step) - 0.25 * hh(x0 + i * step)) for i in range(n + 1)], r, m or AMB(), draw=draw))

def dot(x_keys, m=None, r=0.14, off=-0.25, y=-0.4):
    """Mağara içinde yol alan nokta: x_keys=[(kare,x),…]."""
    m = m or LBL()
    o = K.ball(m, (0, 0, 0), r, None); o.visible_shadow = False; K.label(o)
    f0, f1 = x_keys[0][0], x_keys[-1][0]
    def xat(f):
        for (fa, xa), (fb, xb) in zip(x_keys, x_keys[1:]):
            if f <= fb: return xa + (xb - xa) * (f - fa) / max(1, fb - fa)
        return x_keys[-1][1]
    for f in sorted(set(list(range(f0, f1 + 1, 2)) + [f1])):
        x = xat(f); o.location = (x, y, cz(x) + off * hh(x)); o.keyframe_insert("location", frame=f)
    return o

LENS = 85
def ocam(keys, pitch=4.0, yaw=0.0):
    """keys=[(t0..1, x, z, genişlik), …]: kesit yüzünde (y=0) karenin ortasına gelen nokta ve görünen yatay genişlik.
    Perspektif kamera: katmanlar arasında paralaks olur. pitch: aşağı bakış (su yüzeyi ve taban görünür). yaw: yandan bakış."""
    c = K.camera("K", lens=LENS)
    c.data.clip_end = 2000
    c.rotation_euler = (rad(90 - pitch), 0, rad(yaw))
    for t, x, z, w in keys:
        d = w * 16 / 9 * LENS / 36
        back = Vector((math.sin(rad(yaw)) * math.cos(rad(pitch)), -math.cos(rad(yaw)) * math.cos(rad(pitch)), math.sin(rad(pitch))))
        c.location = Vector((x, 0, z)) + back * d
        c.keyframe_insert("location", frame=F(t))
    return c
def kcam(keys, zc=-2.0, shift=0.10, **kw):
    """Mağara karenin üst-orta bölümünde kalsın (altyazı bandı %70-78'de). keys=[(t, x, genişlik[, zc])]"""
    return ocam([(k[0], k[1], (k[3] if len(k) > 3 else zc) - shift * k[2] * 16 / 9, k[2]) for k in keys], **kw)

def title(cam, big, small=None, y=0.30, t=(0.0, 1.0), size=0.034, fade_out=True):
    m = K.flat("baslik", (1, 1, 1), emit=1.0)
    f0, f1 = F(t[0]), F(t[1])
    ks = [(f0, 0.0), (f0 + S(0.5), 1.0)] + ([(f1 - S(0.5), 1.0), (f1, 0.0)] if fade_out else [])
    K.fade(m, ks)
    K.hud(cam, big, 0, y, size, m, spacing=1.35, line=1.25)
    if small:
        m2 = K.flat("alt", (0.95, 0.50, 0.04), emit=1.0); K.fade(m2, ks)
        K.hud(cam, small, 0, y - size * 1.5 - (size * 1.25 if "\n" in big else 0), size * 0.55, m2, spacing=1.4)
def note(cam, body="ŞEMATİK GÖSTERİM · ÖLÇEKLİ DEĞİLDİR", y=-0.44):
    K.hud(cam, body, 0, y, 0.0105, K.flat("sem", (0.72, 0.72, 0.72), emit=1.0), spacing=1.4)

def rain(cx_, cz_, w=14, h=26, density=9, speed=24, seed=5, y=-0.8, alpha=0.4):
    rnd = random.Random(seed)
    fall = speed * DUR
    me = bpy.data.meshes.new("yagmur"); bm = bmesh.new()
    for i in range(int(density * w * (h + fall) / 10)):
        x, z = rnd.uniform(-w / 2, w / 2), rnd.uniform(-h / 2, h / 2 + fall)
        l = rnd.uniform(0.35, 0.8); t = 0.016
        vs = [bm.verts.new(v) for v in ((x, 0, z), (x + t, 0, z), (x + t + l * 0.14, 0, z + l), (x + l * 0.14, 0, z + l))]
        bm.faces.new(vs)
    bm.to_mesh(me); bm.free()
    o = K.link(bpy.data.objects.new("yagmur", me)); me.materials.append(K.flat("yagmurM", (0.55, 0.62, 0.70), emit=1.0, alpha=alpha))
    o.visible_shadow = False
    K.move(o, [(1, (cx_, y, cz_)), (N, (cx_ - fall * 0.14, y, cz_ - fall))])
    return o
def marker(x, m=None, r=0.9, pulse=True):
    m = m or AMB()
    o = K.prim(bpy.ops.mesh.primitive_torus_add, m, major_radius=r, minor_radius=r * 0.05, location=(x, -0.45, cz(x) - 0.3 * hh(x)), rotation=(R90, 0, 0))
    o.visible_shadow = False; K.label(o)
    if pulse:
        for f in range(1, N + 1, max(1, FPS // 2)):
            sc = 1.0 + 0.18 * math.sin(f / FPS * 3.0); o.scale = (sc, sc, sc); o.keyframe_insert("scale", frame=f)
    return o
def counter(cam, items, y=0.30, size=0.05, m=None, sub=None):
    m = m or K.flat("sayac", (1, 1, 1), emit=1.0)
    for i, (t0, body) in enumerate(items):
        o = K.hud(cam, body, 0, y, size, m[i] if isinstance(m, list) else m, spacing=1.2)
        t1 = items[i + 1][0] if i + 1 < len(items) else None
        ks = [(1, t0 <= 0)] + ([(F(t0), True)] if t0 > 0 else []) + ([(F(t1), False)] if t1 is not None else [])
        K.show(o, ks)
    if sub: K.hud(cam, sub, 0, y + size * 1.5, size * 0.42, AMB(), spacing=1.4)
GZ = floor(-0.4)
_crowd = {}
def people(xs, colors=((0.70, 0.30, 0.04), (0.10, 0.18, 0.40), (0.42, 0.42, 0.16)), scale=0.44, y=-0.7, z=None, poses=("stand", "reach")):
    """Kesit önünde küçük insan figürleri (MPFB, paylaşılan ağ)."""
    for i, x in enumerate(xs):
        key = (colors[i % len(colors)], poses[i % len(poses)])
        if key not in _crowd:
            _crowd[key] = Fg.rescuer(f"k{len(_crowd)}", key[0], pose_name=key[1], lod=0.25)
            p = _crowd[key]
        else:
            p = Fg.clone(_crowd[key])
        p["root"].location = (x, y - 0.25 * (i % 2), floor(max(x, -0.4)) if z is None else z)
        p["root"].rotation_euler = (0, 0, rad(-25) if i % 3 else rad(205)); p["root"].scale = (scale,) * 3
def bike(x, z, sc=0.33):
    m = K.mat("bisiklet", (0.55, 0.57, 0.6), emit=0.5); q = sc / 0.33
    for dx in (-0.55, 0.55):
        w = K.prim(bpy.ops.mesh.primitive_torus_add, m, major_radius=0.36 * q, minor_radius=0.03, location=(x + dx * q, -0.6, z + 0.38 * q), rotation=(R90, 0, 0)); w.visible_shadow = False
    K.polyline("kadro", [(x - 0.55 * q, -0.6, z + 0.38 * q), (x - 0.1 * q, -0.6, z + 0.38 * q), (x + 0.3 * q, -0.6, z + 0.85 * q), (x - 0.3 * q, -0.6, z + 0.85 * q), (x - 0.55 * q, -0.6, z + 0.38 * q)], 0.025, m)
    K.polyline("gidon", [(x - 0.1 * q, -0.6, z + 0.38 * q), (x - 0.3 * q, -0.6, z + 0.95 * q), (x + 0.3 * q, -0.6, z + 0.85 * q), (x + 0.55 * q, -0.6, z + 0.38 * q), (x + 0.42 * q, -0.6, z + 1.0 * q)], 0.025, m)
def ground_front(dim=1.0, y0=-2.6):
    """Giriş önündeki düzlük: kesit yüzü burada öne taşar (tabakalı ön yüz + üstünde çimenli zemin)."""
    xs = [-45 + i * 0.5 for i in range(90)] + [-0.4]
    K.strip("onyuz", xs, lambda x: -80, lambda x: GZ, y0, bpy.data.materials["toprak"])
    K.ribbon("onzemin", xs, lambda x: GZ, y0, 0.0, K.noise_mat("zemin", (0.05 * dim, 0.07 * dim, 0.035), (0.12 * dim, 0.14 * dim, 0.07), 2.0, bump=0.5, emit=0.04), ny=2)
    K.strip("onyan", [y0 + i * 0.2 for i in range(14)], lambda x: -80, lambda x: GZ, 0, bpy.data.materials["toprak"]).matrix_world = Matrix.Translation((-0.4, 0, 0)) @ Matrix.Rotation(rad(90), 4, "Z")
def kids_dots(keys_fn, n=13, r=0.12, off=-0.85):
    cols = [K.mat(f"n{i}", c, emit=1.0) for i, c in enumerate(((0.9, 0.3, 0.25), (0.95, 0.8, 0.5), (0.5, 0.7, 0.95)))]
    for i in range(n): dot(keys_fn(i), m=cols[i % 3], r=r if i else r * 1.25, off=off)

# ================================================================ TÜNEL (su altı geçit, perspektif)
def tunel(murky=False, gap=None, length=60, seed=1, front=True, fill=1.0):
    wcol = (0.030, 0.022, 0.010) if murky else (0.004, 0.014, 0.020)
    reset(world=wcol, strength=1.0)
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
        K.strip("tav", xs, lambda x, k=k: ce(x, k), lambda x: 25, y, m, wobble=w, seed=k)
        K.strip("tab", xs, lambda x: -25, lambda x, k=k: fl(x, k), y, m, wobble=w, seed=k + 5)
    if front:
        K.strip("ontav", xs, lambda x: ce(x, 2) + 1.3 + squeeze(x) * 1.5, lambda x: 25, -2.4, dark, wobble=0.1, seed=9)
        K.strip("ontab", xs, lambda x: -25, lambda x: fl(x, 2) - 1.2 - squeeze(x) * 1.5, -2.4, dark, wobble=0.1, seed=10)
    for i in range(int(length / 2.2)):
        x = -length / 2 + i * 2.2 * 2 + rnd.uniform(-1, 1)
        if gap and abs(x - gap[0]) < 3: continue
        up = i % 2 == 0
        K.rock_blob(rock, (x, rnd.uniform(0.6, 2.4), (ce(x) + 0.5) if up else (fl(x) - 0.4)), (rnd.uniform(1.2, 2.4), 1.2, rnd.uniform(0.7, 1.2)), seed=i)
    bpy.ops.object.light_add(type="AREA", location=(0, -8, 3), rotation=(rad(70), 0, 0)); fl_ = bpy.context.active_object
    fl_.data.energy = (300 if not murky else 1100) * fill; fl_.data.size = 14; fl_.data.color = (0.45, 0.75, 0.9) if not murky else (0.9, 0.7, 0.4)
    if gap:
        for sgn, f in ((1, ce), (-1, fl)):
            K.rock_blob(rock, (gap[0], 1.2, f(gap[0]) + sgn * 1.5), (3.0, 1.6, 1.6), seed=40 + sgn, strength=0.25)
    return ce, fl

def rope(x0, x1, z=lambda x: -0.9 + 0.12 * math.sin(x * 0.6), y=0.35, draw=None):
    n = int((x1 - x0) / 0.4)
    return K.polyline("ip", [(x0 + i * 0.4, y, z(x0 + i * 0.4)) for i in range(n + 1)], 0.012, K.mat("ipM", (0.9, 0.9, 0.85), emit=0.4), draw=draw)
def silt(n=1100, drift=(0.12, 0, 0.04), box=((-9, -1.4, -3.5), (10, 2.6, 3.5)), seed=3, size=(0.0035, 0.010), emit=0.03):
    K.silt(n, box[0], box[1], drift=tuple(d * 24 / FPS for d in drift), frames=N, seed=seed, size=size, emit=emit)

def lamp(fig, energy=1400, length=6.5, spread=30, peak=0.10, aim=-5, yaw=0, wash=200, color=(1.0, 0.93, 0.78)):
    """Dalgıcın el feneri: spot + yumuşak huzme konisi; ayrıca arka duvara düşen loş ışık (koni yok)."""
    sp = K.light_cone(fig["root"], tuple(fig["lamp"]), (0, rad(-90 + aim), rad(yaw)), energy=energy, length=length, spread=spread, peak=peak, color=color)
    sp.data.shadow_soft_size = 0.03
    if wash:
        w = K.light_cone(fig["root"], (1.6, -1.6, 0.3), (rad(90), 0, rad(-32)), energy=wash, spread=75, cone=False, color=color)
        w.data.spot_blend = 1.0
    return sp
def rimlight(fig, energy=60):
    """Figürü karanlıktan ayıran loş kenar ışığı (kameranın karşısından, üstten)."""
    bpy.ops.object.light_add(type="AREA", location=(-0.4, 1.4, 1.6), rotation=(rad(-50), 0, 0)); L = bpy.context.active_object
    L.parent = fig["root"]; L.data.energy = energy; L.data.size = 2.0; L.data.color = (0.6, 0.85, 1.0)
    bpy.ops.object.light_add(type="AREA", location=(0.2, -3.0, 0.8), rotation=(rad(75), 0, 0)); L2 = bpy.context.active_object
    L2.parent = fig["root"]; L2.data.energy = energy * 0.9; L2.data.size = 3.0; L2.data.color = (0.75, 0.9, 1.0)

def swim(fig, keys, bob=0.06, rot=0.0, kick=True):
    r = fig["root"]
    f0, f1 = keys[0][0], keys[-1][0]
    for f in sorted(set(list(range(f0, f1 + 1, 3)) + [f1])):
        for (fa, pa), (fb, pb) in zip(keys, keys[1:]):
            if f <= fb:
                t = (f - fa) / max(1, fb - fa); p = [a + (b - a) * t for a, b in zip(pa, pb)]; break
        else: p = keys[-1][1]
        r.location = (p[0], p[1], p[2] + bob * math.sin(f * 0.09 * 24 / FPS))
        r.rotation_euler = (0, rot + 0.04 * math.sin(f * 0.07 * 24 / FPS), 0)
        r.keyframe_insert("location", frame=f); r.keyframe_insert("rotation_euler", frame=f)
    if kick and fig.get("arm"): Fg.kick(fig, f0, f1, period=round(1.9 * FPS), step=2)
def bubbles(fig, n=12, seed=1):
    r = fig["root"]
    def src(f):
        bpy.context.scene.frame_set(f); return (r.location.x + 0.78, r.location.z + 0.02)
    K.bubbles(n, src, 1, N, y=r.location.y - 0.15, seed=seed, rise=5.0, life=int(2.8 * FPS))
    bpy.context.scene.frame_set(1)

def pcam(keys, lens=35):
    c = K.camera("P", lens=lens)
    K.cam_move(c, [(F(t), p) for t, p in keys])
    return c

# ================================================================ ODA (çocukların sığındığı çıkıntı, perspektif)
def bank(x): return 0.25 + 0.42 * max(0, x + 3.2) ** 0.9 if x > -3.2 else 0.25 - 0.5 * (-3.2 - x)
def oda(water=[(1, 0.0)], torch=40, kids=True, cool=6, n=13):
    reset(world=(0.004, 0.006, 0.009), strength=1.0)
    rock = K.noise_mat("okaya", (0.07, 0.06, 0.05), (0.30, 0.25, 0.20), 0.9, bump=1.0, emit=0.006, detail=10)
    mud = K.noise_mat("camur", (0.10, 0.07, 0.045), (0.26, 0.19, 0.12), 2.0, bump=0.6, emit=0.006)
    K.box(rock, (0, 4.2, 4), (60, 0.1, 30))
    xs = [-16 + i * 0.3 for i in range(110)]
    for y, dz, sd in ((2.4, 0.5, 1), (1.2, 0.25, 2), (0.0, 0.0, 3), (-1.2, -0.3, 4)):
        K.strip("set", xs, lambda x: -8, lambda x, dz=dz, sd=sd: bank(x) + dz + 0.10 * math.sin(x * 1.7 + sd), y, mud, wobble=0.04, seed=sd)
        K.ribbon("setust", xs, lambda x, dz=dz, sd=sd: bank(x) + dz + 0.10 * math.sin(x * 1.7 + sd), y, y + 1.25, mud, wobble=0.03, seed=sd, ny=2)
    K.strip("otavan", xs, lambda x: 5.6 + 0.6 * math.sin(x * 0.5) + 0.3 * math.sin(x * 1.9) - 0.16 * x, lambda x: 30, 1.8, rock, wobble=0.08)
    K.strip("otavan2", xs, lambda x: 6.6 + 0.5 * math.sin(x * 0.7 + 2) - 0.2 * x, lambda x: 30, -1.6, K.flat("osil", (0.004, 0.004, 0.005)), wobble=0.1)
    for i, (x, z, sc) in enumerate(((7.5, 6.2, 2.2), (-6, 7.5, 2.6), (1, 7.3, 2.0), (11, 2.5, 2.4))):
        K.rock_blob(rock, (x, 2.0, z), (sc * 1.5, 1.5, sc), seed=i + 7)
    w = K.box(K.flat("osu", (0.012, 0.045, 0.055), rough=0.45, emit=0.02), (0, -4, -1.0), (80, 20, 2.0))
    K.move(w, [(f, (0, -4, -1.0 + lv)) for f, lv in water])
    figs = []
    if kids:
        rnd = random.Random(4)
        spots = [(0.2, 0.0), (0.95, 0.0), (1.7, 0.0), (2.5, 0.0), (3.3, 0.0), (0.6, 1.2), (1.4, 1.2), (2.1, 1.2), (2.9, 1.2), (3.7, 1.2), (1.1, 2.4), (2.0, 2.4), (3.0, 2.4)][:n]
        dzs = {0.0: 0.0, 1.2: 0.25, 2.4: 0.5}
        for i, (x, y) in enumerate(spots):
            coach = i == 12
            s = Fg.boy(f"c{i}", Fg.SHIRTS[i % len(Fg.SHIRTS)], age=0.5 if coach else rnd.uniform(0.24, 0.34), height=rnd.uniform(0.35, 0.55),
                       pose_name="huddle" if rnd.random() < 0.6 else "rest", seed=i, lod=0.45)
            s["root"].location = (x, y + 0.45, gz(x, y + 0.45) - 0.03)
            s["root"].rotation_euler = (0, rad(-8), math.pi + rnd.uniform(-0.6, 0.6))
            figs.append(s)
    if torch:
        bpy.ops.object.light_add(type="POINT", location=(1.6, -0.9, 1.9)); L = bpy.context.active_object
        L.data.energy = torch * 4; L.data.color = (1.0, 0.78, 0.5); L.data.shadow_soft_size = 0.08
    if cool:
        bpy.ops.object.light_add(type="AREA", location=(-6, -6, 5), rotation=(rad(60), 0, rad(-40))); L2 = bpy.context.active_object
        L2.data.energy = cool * 40; L2.data.size = 8; L2.data.color = (0.5, 0.7, 1.0)
    return figs, w
def gz(x, y):
    """Odadaki basamaklı setin (x, y) noktasındaki zemin yüksekliği."""
    for y0, dz, sd in ((2.4, 0.5, 1), (1.2, 0.25, 2), (0.0, 0.0, 3), (-1.2, -0.3, 4)):
        if y >= y0: return bank(x) + dz + 0.10 * math.sin(x * 1.7 + sd)
    return bank(x) - 0.3
def drips(n=10, seed=2):
    rnd = random.Random(seed); m = K.mat("damla", (0.7, 0.85, 0.95), emit=0.8)
    for i in range(n):
        x, y = rnd.uniform(0, 4), rnd.uniform(-0.6, 1.8); f0 = rnd.randint(1, max(2, N - FPS))
        o = K.ball(m, (x, y, 6), 0.014, None, (1, 1, 2.5)); o.visible_shadow = False
        K.move(o, [(f0, (x, y, 5.5)), (f0 + int(FPS * 0.9), (x, y, bank(x) + 0.2))]); K.show(o, [(1, False), (f0, True), (f0 + int(FPS * 0.9), False)])
def surfaced(x0=-4.2, lampe=2500, spread=18, length=6.0, peak=0.05, aimz=-12):
    """Su yüzeyine çıkmış iki dalgıç (dik, göğse kadar suda) + kıyıya dönük fener."""
    out = []
    for i, (x, y) in enumerate(((x0, -1.6), (x0 - 1.2, -0.6))):
        d = Fg.diver(f"y{i}", accent=((0.80, 0.42, 0.04), (0.55, 0.1, 0.08))[i], swim=False, fins=False, tanks=False, hand_light=False, lod=0.6)
        Fg.pose(d, [("upperarm01.LR", (0.25, -0.2, -1)), ("lowerarm01.LR", (0.0, -0.8, -0.5)), ("head", (0, -0.05, 1))])
        d["arm"].rotation_euler = (0, 0, rad(90)); Fg.freeze(d)
        H = d["lm"]["H"]; d["root"].location = (x, y, -H + 0.42)
        d["H"] = H; out.append(d)
    h = out[0]
    K.light_cone(h["root"], (0.16, 0, h["H"] - 0.06), (0, rad(-90 + aimz), 0), energy=lampe, length=length, spread=spread, peak=peak)
    return out

# ================================================================ ÇEKİMLER
# ---------- kanca
def s_h1():
    oda(torch=30, cool=7)
    pcam([(0, (1.9, -11.5, 2.6)), (1, (1.9, -9.6, 2.4))], lens=34)
def s_h3():
    kesit()
    c = kcam([(0, 31.5, 15), (1, 6.5, 15)], zc=-2.2)
    marker(X_C9, r=1.1)
    clabel("13 KİŞİ", 37.2, 2.4, 0.62, AMB()); clabel("GİRİŞ", 0.6, 3.0, 0.55)
    route(37.2, 0.3, draw=[(F(0.04), 0), (F(0.92), 1)])
    m = K.flat("km", (1, 1, 1), emit=1.0); K.fade(m, [(F(0.30), 0), (F(0.42), 1)])
    K.hud(c, "≈ 2,5 KM", 0, 0.335, 0.05, m, spacing=1.2)
    m2 = K.flat("km2", (0.95, 0.5, 0.04), emit=1.0); K.fade(m2, [(F(0.30), 0), (F(0.42), 1)])
    K.hud(c, "GİRİŞE UZAKLIK", 0, 0.395, 0.017, m2, spacing=1.4)
    note(c)
def s_h2():
    figs, w = oda(water=[(1, 0.0), (N, 0.50)], torch=42, cool=9)
    pcam([(0, (0.6, -8.2, 1.3)), (1, (1.1, -7.4, 1.6))], lens=30)
# ---------- 23 Haziran
SKY_DAY = (0.20, 0.27, 0.36)
def s_a1():
    kesit(level=L0, sky=SKY_DAY, sun=3.0)
    c = kcam([(0, 9, 26), (1, 11.5, 23)], zc=5, shift=0.06)
    title(c, "23 HAZİRAN 2018", "THAM LUANG  ·  KUZEY TAYLAND", y=0.335, t=(0.03, 1.0), fade_out=False)
def s_a2():
    kesit(level=L0, sky=SKY_DAY, sun=3.0); ground_front()
    c = kcam([(0, 1.0, 11.5), (1, 3.4, 11.5)], zc=-0.5, shift=0.08)
    clabel("GİRİŞ", 0.5, 2.2, 0.42)
    kids_dots(lambda i: [(1, -5.5 - i * 0.42), (N, 6.0 - i * 0.42)], r=0.11)
    for i in range(4): bike(-9.0 + i * 0.5, GZ, 0.2)
    note(c)
def s_a3():
    kesit(level=L0, sky=SKY_DAY, sun=3.0)
    kcam([(0, 12.5, 12.5), (1, 17.5, 12.5)], zc=-3.2, shift=0.08)
    kids_dots(lambda i: [(1, 11.0 - i * 0.36), (N, 20.5 - i * 0.36)])
    clabel("3. ODA", 12, 2.0, 0.45)
def s_a4():
    kesit(level=L0, sky=(0.07, 0.09, 0.13), dim=0.8, sun=1.2)
    c = kcam([(0, 8, 24), (1, 10, 22)], zc=6, shift=0.06)
    rain(10, 14, w=44, h=64, density=7)
    title(c, "MUSON", None, y=0.33, t=(0.1, 1.0), fade_out=False)
def s_a5():
    kesit(level=L0, rise=[(F(0.0), 0), (F(0.85), 1)], to=L1, dim=0.9, sun=1.4)
    c = kcam([(0, 23, 15), (1, 33.5, 13.5)], zc=-2.8, shift=0.08)
    kids_dots(lambda i: [(1, 27.5 - i * 0.3), (F(0.8), 37.9 - i * 0.12), (N, 37.9 - i * 0.12)], r=0.13)
    lm = K.flat("sul", (0.45, 0.80, 0.95), emit=1.0); K.fade(lm, [(F(0.15), 0), (F(0.3), 1)])
    K.hud(c, "SU YÜKSELİYOR", 0, 0.33, 0.03, lm, spacing=1.3)
    clabel("9. ODA", 37.2, 0.9, 0.5, AMB())
def s_a6():
    kesit(level=L1, sky=(0.035, 0.045, 0.07), dim=0.7, sun=0.9); ground_front(0.7)
    kcam([(0, -3.6, 8.5), (1, -3.0, 7.6)], zc=1.2, shift=0.12)
    for i in range(5): bike(-7.0 + i * 1.05 + (0.1 if i % 2 else 0), GZ, 0.27)
    for i, x in enumerate((-1.9, -1.5, -1.25)):
        K.box(K.mat(f"canta{i}", ((0.5, 0.12, 0.1), (0.1, 0.2, 0.45), (0.2, 0.2, 0.2))[i], emit=0.3), (x, -0.6, GZ + 0.13), (0.26, 0.2, 0.26), shadow=False)
    bpy.ops.object.light_add(type="POINT", location=(-4, -3, GZ + 2.5)); L = bpy.context.active_object; L.data.energy = 400; L.data.color = (0.7, 0.8, 1.0)
    rain(-3, 2, w=18, h=24, density=7)
# ---------- arama
def s_b1():
    tunel(murky=True, seed=3, fill=0.8)
    rope(-30, 30)
    d = Fg.diver("d1"); lamp(d, energy=700, peak=0.10, length=3.2, wash=110, color=(1.0, 0.85, 0.55)); rimlight(d, 50)
    swim(d, [(1, (-1.6, 0, 0.1)), (N, (-0.4, 0, 0.2))], bob=0.12, rot=-0.12)
    d2 = Fg.diver("d2", accent=(0.1, 0.25, 0.5), lod=0.6); lamp(d2, energy=500, peak=0.08, length=3.0, wash=0, color=(1.0, 0.85, 0.55))
    swim(d2, [(1, (-4.6, 0.9, 1.5)), (N, (-3.6, 0.9, 1.3))], bob=0.12, rot=0.1)
    silt(1500, drift=(-1.5, 0, 0.1), box=((-9, -1.6, -4), (22, 2.5, 4)), size=(0.006, 0.017), seed=8, emit=0.08)
    bubbles(d, 12)
    pcam([(0, (-0.9, -6.6, 0.3)), (1, (-0.3, -6.2, 0.3))])
def s_b2():
    kesit(level=L1, sky=(0.04, 0.05, 0.08), dim=0.7, sun=0.8); ground_front(0.7)
    c = kcam([(0, -4.2, 10), (1, -3.4, 9)], zc=1.6, shift=0.12)
    people([-8.5, -7.9, -7.1, -6.2, -5.6, -4.4, -3.5, -2.9, -1.2, -0.3, 0.8, 1.6])
    for i, x in enumerate((-7.4, -4.9)):
        K.polyline("cadir", [(x - 0.9, -0.3, GZ), (x, -0.3, GZ + 1.1), (x + 0.9, -0.3, GZ)], 0.05, K.mat("cadir", (0.75, 0.72, 0.6), emit=0.5))
    pm = K.mat("pompa", (0.75, 0.55, 0.08), emit=0.3)
    for x in (-2.2, -1.9): K.box(pm, (x - 0.1, -0.5, GZ + 0.22), (0.5, 0.3, 0.44), shadow=False)
    K.polyline("boru", [(3.5, -0.5, floor(3.5) + 0.12), (1.5, -0.5, floor(1.5) + 0.12), (-0.4, -0.5, GZ + 0.15), (-2.2, -0.5, GZ + 0.15), (-6, -0.5, GZ + 0.15), (-9.5, -0.5, GZ + 0.15), (-14.5, -0.5, GZ + 0.15)], 0.07, K.mat("boruM", (0.25, 0.4, 0.55), emit=0.5))
    for x, e in ((-6, 500), (-1.5, 500)):
        bpy.ops.object.light_add(type="POINT", location=(x, -3, GZ + 2.6)); L = bpy.context.active_object; L.data.energy = e; L.data.color = (1.0, 0.85, 0.6)
    rain(-3, 3, w=22, h=26, density=5)
    counter(c, [(i / 9 * 0.92, f"GÜN {i + 1}") for i in range(9)], y=0.33, size=0.05, m=K.flat("gun", (1, 1, 1), emit=1.0))
# ---------- bulunuş
def s_c1():
    tunel(seed=2)
    rope(-30, 30)
    d = Fg.diver("d1"); lamp(d, energy=1300); rimlight(d)
    swim(d, [(1, (-3.0, 0, 0.1)), (N, (-0.3, 0, 0.0))])
    d2 = Fg.diver("d2", accent=(0.55, 0.1, 0.08), lod=0.6); lamp(d2, energy=450, wash=0, peak=0.05, length=4.0, aim=-12); rimlight(d2, 30)
    swim(d2, [(1, (-6.4, 0.9, 1.5)), (N, (-3.6, 0.9, 1.3))])
    bubbles(d, 14); bubbles(d2, 10, seed=4)
    silt(800)
    c = pcam([(0, (-1.9, -6.0, 0.3)), (1, (-0.6, -5.6, 0.3))])
    title(c, "2 TEMMUZ 2018", "10. GÜN", y=0.33, t=(0.0, 0.75))
def s_c2():
    oda(torch=10, cool=5)
    hs = surfaced(-4.0)
    for i, d in enumerate(hs):
        r = d["root"]; x, y, z = r.location
        K.move(r, [(1, (x, y, z - 0.6)), (F(0.25 + i * 0.12), (x, y, z - 0.6)), (F(0.45 + i * 0.12), (x + 0.2, y, z)), (N, (x + 0.5, y, z))])
    pcam([(0, (-2.4, -9.0, 1.5)), (1, (-1.8, -8.5, 1.6))], lens=30)
def s_c3():
    oda(torch=8, cool=3)
    surfaced(-4.6, lampe=7000, spread=34, length=7.0, peak=0.035, aimz=-13)
    c = pcam([(0, (0.6, -8.8, 2.0)), (1, (1.3, -7.6, 2.1))], lens=34)
    m = K.flat("on3", (1, 1, 1), emit=1.0); K.fade(m, [(F(0.52), 0), (F(0.60), 1)])
    K.hud(c, "13 / 13", 0, 0.33, 0.06, m, spacing=1.2)
    m2 = K.flat("on3b", (0.95, 0.5, 0.04), emit=1.0); K.fade(m2, [(F(0.74), 0), (F(0.82), 1)])
    K.hud(c, "HEPSİ HAYATTA", 0, 0.285, 0.02, m2, spacing=1.4)
def s_c4():
    oda(torch=22, cool=5); drips(14)
    pcam([(0, (0.6, -6.2, 1.9)), (1, (2.6, -6.0, 2.3))], lens=40)
def s_c5():
    oda(torch=30, cool=8); drips(8, 5)
    pcam([(0, (5.5, -7.5, 3.4)), (1, (4.6, -6.8, 3.2))], lens=36).rotation_euler = (rad(84), 0, rad(14))
# ---------- sorun
def s_d1():
    kesit(dim=0.85)
    c = kcam([(0, 36.5, 12.5), (1, 35.0, 13.5)], zc=-2.0)
    marker(X_C9, r=1.1); klabel("9. ODA", 33.2, cz(37.2) + 2.2, 0.5, AMB())
def s_d2():
    kesit()
    c = kcam([(0, 34.0, 13.5), (1, 24.0, 13.5)], zc=-3.0)
    route(37.2, 0.3, r=0.05)
    for x in (33.8, 26.5):
        klabel("SU ALTINDA", x, floor(x) - 1.7, 0.46, BLU(), tick=(x, floor(x) - 0.1))
    clabel("9. ODA", 37.2, 1.6, 0.5, AMB()); clabel("PATTAYA\nBEACH", 30.5, 2.2, 0.42)
    dot([(1, 37.0), (N, 22.0)], r=0.17, off=-0.3)
    note(c)
def s_d3():
    tunel(gap=(0, 0.46), seed=4)
    rope(-30, 30, z=lambda x: -0.26)
    d = Fg.diver("d1", tanks=False); lamp(d, energy=500, peak=0.06, wash=110, length=3.5); rimlight(d, 45)
    swim(d, [(1, (-3.6, 0.2, 0.0)), (N, (-1.2, 0.2, 0.0))], bob=0.01)
    t = Fg._caps(K.mat("f-celik", (0.20, 0.22, 0.25), rough=0.4), (0, 0, 0), (0.6, 0, 0), 0.075); t.parent = d["root"]; t.location = (1.25, 0.1, -0.12)
    silt(500, box=((-6, -1.5, -2), (6, 2, 2)))
    c = pcam([(0, (-0.9, -6.4, 0.0)), (1, (-0.3, -5.6, 0.0))])
    m = K.flat("saat", (1, 1, 1), emit=1.0); K.fade(m, [(F(0.50), 0), (F(0.58), 1)])
    K.hud(c, "GİDİŞ DÖNÜŞ", 0, 0.375, 0.017, m, spacing=1.4)
    K.hud(c, "11 SAAT", 0, 0.32, 0.05, m, spacing=1.2)
def s_d4():
    oda(torch=30, cool=6)
    pcam([(0, (3.6, -5.8, 2.6)), (1, (2.4, -5.6, 2.3))], lens=40)
def s_d5():
    kesit()
    c = kcam([(0, 34.0, 24), (1, 34.0, 24)], zc=3.2, shift=0.0)
    marker(X_C9, pulse=False, r=1.0); klabel("9. ODA", 41.5, cz(37.2), 0.7, AMB(), align="LEFT")
    zt = surf(36.6)
    K.label(K.polyline("sondaj", [(36.6, -0.5, zt + 1.5), (36.6, -0.5, ceil(36.6) + 7)], 0.10, LBL(), draw=[(F(0.15), 0), (F(0.42), 1)]))
    lm = K.flat("sl", (1, 1, 1), emit=1.0); K.fade(lm, [(F(0.12), 0), (F(0.2), 1), (F(0.5), 1), (F(0.55), 0)])
    K.hud(c, "YUKARIDAN DELMEK", 0, 0.405, 0.026, lm, spacing=1.25)
    rm = K.flat("carpi", (1.0, 0.16, 0.10), emit=1.0); K.fade(rm, [(F(0.44), 0), (F(0.48), 1)])
    for a in (45, -45):
        K.label(K.box(rm, (36.6, -0.7, ceil(36.6) + 7), (3.0, 0.05, 0.26), rot=(0, rad(a), 0), shadow=False))
    wm = K.flat("bek", (1, 1, 1), emit=1.0); K.fade(wm, [(F(0.55), 0), (F(0.62), 1)])
    K.hud(c, "AYLARCA BEKLEMEK", 0, 0.405, 0.026, wm, spacing=1.25)
    rm2 = K.flat("carpi2", (1.0, 0.16, 0.10), emit=1.0); K.fade(rm2, [(F(0.84), 0), (F(0.88), 1)])
    K.hud(c, "X", 0, 0.383, 0.07, rm2)
    note(c)
# ---------- Saman Kunan
def tank_on_line(x, z=-0.9, y=0.3):
    t = K.empty("yedek", (x, y, z - 0.42))
    K.limb((0, 0, -0.3), (0, 0, 0.3), 0.09, K.mat("f-celik", (0.20, 0.22, 0.25), rough=0.4), t)
    K.box(K.mat("vana", (0.05, 0.05, 0.05)), (0, 0, 0.40), (0.08, 0.08, 0.1), t)
    return t
def s_e1():
    tunel(seed=5)
    zf = lambda x: -0.9 + 0.12 * math.sin(x * 0.6)
    rope(-30, 30)
    for x in (-6.5, -3.4): tank_on_line(x, zf(x))
    d = Fg.diver("d1", accent=(0.70, 0.70, 0.18)); lamp(d, energy=1200); rimlight(d)
    swim(d, [(1, (-1.9, 0, -0.1)), (N, (0.2, 0, -0.15))])
    t = tank_on_line(0, 0); t.parent = d["root"]; t.location = (0.95, -0.12, -0.42); t.rotation_euler = (0, rad(80), 0)
    bubbles(d, 12); silt(800)
    c = pcam([(0, (-1.2, -6.0, -0.1)), (1, (-0.2, -5.6, -0.1))])
    title(c, "6 TEMMUZ 2018", None, y=0.33, t=(0.0, 0.7))
def s_e2():
    tunel(seed=5)
    zf = lambda x: -0.9 + 0.12 * math.sin(x * 0.6)
    rope(-30, 30)
    for x in (-4.5, -1.2, 2.2): tank_on_line(x, zf(x))
    bpy.ops.object.light_add(type="SPOT", location=(-1.2, -5, 2.5), rotation=(rad(62), 0, 0)); L = bpy.context.active_object
    L.data.spot_size = rad(50); L.data.spot_blend = 0.8; L.data.color = (1.0, 0.93, 0.78)
    for f, e in ((1, 2400), (F(0.85), 450)):
        L.data.energy = e; L.data.keyframe_insert("energy", frame=f)
    silt(700, drift=(0.05, 0, 0.02))
    c = pcam([(0, (-1.2, -8.2, -0.2)), (1, (-1.2, -9.4, -0.2))])
    title(c, "SAMAN KUNAN", "ESKİ DONANMA DALGICI", y=0.33, t=(0.12, 1.0), fade_out=False, size=0.032)
# ---------- oksijen, yağış
def s_f1():
    oda(torch=20, cool=6)
    c = pcam([(0, (1.2, -9.4, 2.3)), (1, (2.0, -8.2, 2.3))], lens=34)
    vals = [21, 20, 19, 18, 17, 16, 15]
    ms = [K.flat(f"o{v}", (1, 1, 1) if v > 16 else ((1.0, 0.5, 0.2) if v == 16 else (1.0, 0.16, 0.10)), emit=1.0) for v in vals]
    counter(c, [(0.30 + i * 0.045 if i else 0.0, f"%{v}") for i, v in enumerate(vals)], y=0.31, size=0.07, m=ms, sub="OKSİJEN")
def s_f2():
    kesit(level=L1, rise=[(F(0.1), 0), (N, 0.8)], sky=(0.04, 0.05, 0.08), dim=0.8, sun=1.2)
    c = kcam([(0, 35.6, 11.5), (1, 36.4, 10.5)], zc=0.0)
    marker(X_C9, r=0.8)
    K.label(K.dashes(30, 42, L2 + 0.25, -0.5, BLU(), step=0.4, thick=0.035)[0])
    rain(36, 0, w=18, h=26, density=3.5, alpha=0.22)
    K.hud(c, "YENİ YAĞIŞ BEKLENİYOR", 0, 0.33, 0.024, BLU(), spacing=1.3)
# ---------- plan
def s_g1():
    tunel(seed=6)
    rope(-30, 30)
    silt(900)
    bpy.ops.object.light_add(type="SPOT", location=(-8, -3, 0.4), rotation=(0, rad(-80), rad(12))); L = bpy.context.active_object
    L.data.energy = 4500; L.data.spot_size = rad(40); L.data.spot_blend = 0.8
    c = pcam([(0, (-2.0, -9.2, 0.0)), (1, (0.5, -9.2, 0.0))])
    title(c, "TEK PLAN", "DAHA ÖNCE HİÇ DENENMEMİŞ", y=0.33, t=(0.1, 1.0), fade_out=False, size=0.042)
def pair(x0, x1, z=0.0, y=0.0, energy=1200, tanks=True):
    """Dalgıç + altında/yanında taşıdığı uyutulmuş çocuk (yüzü aşağı, dalgıcın altında)."""
    d = Fg.diver("kurtarici", tanks=tanks); lamp(d, energy=energy); rimlight(d, 55)
    Fg.pose(d, [("upperarm01.L", (0.25, -1, 0.25)), ("lowerarm01.L", (-0.15, -1, 0.1))])   # sol kol aşağıda: çocuğu tutuyor
    swim(d, [(1, (x0, y, z)), (N, (x1, y, z))], bob=0.04)
    c = Fg.carried(); c["root"].parent = d["root"]; c["root"].location = (0.30, -0.10, -0.50)
    return d, c
def s_g2():
    tunel(seed=7); rope(-30, 30, z=lambda x: -1.35 + 0.1 * math.sin(x * 0.6))
    d, c = pair(-2.8, -0.4)
    bubbles(d, 12); silt(800)
    pcam([(0, (-1.6, -5.6, -0.2)), (1, (-0.5, -5.0, -0.2))])
def patient(x=1.6, y=0.3):
    c = Fg.carried("yatan", face_down=False, lod=1.0)
    c["root"].location = (x, y, gz(x, y) + 0.16); c["root"].rotation_euler = (0, rad(-21), 0)
    return c
def s_g3():
    oda(torch=18, cool=6, kids=False)
    patient(1.9)
    doc = Fg.rescuer("doktor", pose_name="kneel", dark=True, helmet=True, lod=1.0); doc["root"].location = (2.35, 1.05, gz(2.35, 1.05) - 0.03); doc["root"].rotation_euler = (0, 0, rad(-90))
    d2 = Fg.rescuer("yardimci", pose_name="stand", dark=True, lod=0.6); d2["root"].location = (0.2, 0.7, gz(0.2, 0.7) - 0.03); d2["root"].rotation_euler = (0, 0, rad(-20))
    rnd = random.Random(2)
    for i, x in enumerate((4.9, 5.6, 6.3, 5.3, 6.1)):
        s = Fg.boy(f"b{i}", Fg.SHIRTS[i], age=0.3, pose_name="huddle", seed=i + 20, lod=0.4); s["root"].location = (x, 1.6 + (i > 2) * 1.2, gz(x, 1.6 + (i > 2) * 1.2) - 0.03); s["root"].rotation_euler = (0, rad(-8), math.pi + rnd.uniform(-0.3, 0.3))
    c = pcam([(0, (2.4, -7.6, 2.3)), (1, (2.2, -6.4, 2.1))], lens=36)
    title(c, "DR. RICHARD HARRIS", "ANESTEZİ UZMANI  ·  MAĞARA DALGICI", y=0.33, t=(0.25, 1.0), fade_out=False, size=0.03)
def s_g4():
    oda(torch=18, cool=7, kids=False)
    patient(1.9)
    doc = Fg.rescuer("doktor", pose_name="kneel", dark=True, helmet=True, lod=1.0); doc["root"].location = (2.35, 1.05, gz(2.35, 1.05) - 0.03); doc["root"].rotation_euler = (0, 0, rad(-90))
    c = pcam([(0, (2.9, -5.4, 2.0)), (1, (2.3, -4.6, 1.9))], lens=42)
    lm = K.flat("mk", (1, 1, 1), emit=1.0); K.fade(lm, [(F(0.15), 0), (F(0.3), 1)])
    K.hud(c, "TAM YÜZ MASKESİ", 0, 0.37, 0.022, lm, spacing=1.4)
def s_g5():
    oda(torch=0, cool=4, kids=False)
    d2 = Fg.rescuer("harris", pose_name="stand", dark=True, lod=1.0); d2["root"].location = (-0.8, 0.4, gz(-0.8, 0.4) - 0.03); d2["root"].rotation_euler = (0, 0, math.pi)
    K.light_cone(d2["root"], (0.12, 0, 1.70), (0, rad(-90 - 25), 0), energy=1500, length=5, spread=36, peak=0.07)
    bpy.ops.object.light_add(type="AREA", location=(1.5, -3.5, 2.6), rotation=(rad(60), 0, rad(25))); L = bpy.context.active_object; L.data.energy = 90; L.data.size = 3; L.data.color = (1.0, 0.85, 0.65)
    pcam([(0, (-1.5, -8.4, 1.7)), (1, (-1.2, -7.4, 1.7))], lens=34)
# ---------- tahliye
def s_i0():
    tunel(seed=8); rope(-30, 30, z=lambda x: -1.35 + 0.1 * math.sin(x * 0.6))
    d, c_ = pair(-2.2, -0.6)
    bubbles(d, 10); silt(800)
    c = pcam([(0, (-1.2, -5.4, -0.25)), (1, (0.0, -5.0, -0.25))], lens=38)
    title(c, "8 TEMMUZ 2018", "TAHLİYE BAŞLIYOR", y=0.33, t=(0.0, 0.8))
def s_i1():
    tunel(seed=9); rope(-30, 30, z=lambda x: -1.35 + 0.1 * math.sin(x * 0.6))
    d, c_ = pair(-1.6, 0.4)
    bubbles(d, 12); silt(800)
    pcam([(0, (-0.9, -4.6, -0.4)), (1, (1.0, -4.4, -0.4))], lens=40)
def s_i2():
    tunel(gap=(0, 0.50), seed=4)
    rope(-30, 30, z=lambda x: -0.30)
    d = Fg.diver("d1", tanks=False); lamp(d, energy=420, peak=0.05, wash=100, length=3.0, aim=-3); rimlight(d, 50)
    Fg.pose(d, [("upperarm01.L", (0.12, -0.5, 1)), ("lowerarm01.L", (-0.05, -0.3, 1))])
    swim(d, [(1, (-4.9, 0.1, 0.02)), (N, (-3.3, 0.1, 0.02))], bob=0.01)
    c = Fg.carried(); c["root"].parent = d["root"]; c["root"].location = (1.75, 0.0, -0.06)
    bpy.ops.object.light_add(type="AREA", location=(-1.5, -3.0, 0.3), rotation=(rad(84), 0, 0)); L = bpy.context.active_object; L.data.energy = 60; L.data.size = 3; L.data.color = (0.75, 0.9, 1.0)
    silt(500, box=((-6, -1.5, -2), (6, 2, 2)))
    pcam([(0, (-2.3, -6.6, 0.0)), (1, (-1.6, -5.8, 0.0))])
def s_i3():
    kesit()
    c = kcam([(0, 31.2, 11), (1, 30.2, 11)], zc=-1.6)
    route(37.2, 0.3, r=0.04)
    dot([(1, 33.2), (F(0.6), 31.0), (N, 30.8)], r=0.17, off=-0.3)
    clabel("YOLDA EK DOZ", 30.5, 1.8, 0.42)
def s_i4():
    kesit()
    c = kcam([(0, 9.5, 13), (1, 4.5, 13)], zc=-1.2)
    clabel("3. ODA", 12, 2.0, 0.45); clabel("GİRİŞ", 0.5, 2.4, 0.45)
    K.label(K.polyline("halat", [(12 - i * 0.2, -0.3, cz(12 - i * 0.2) + 0.1 * hh(12 - i * 0.2)) for i in range(62)], 0.03, LBL()))
    om = K.mat("zincir", (0.95, 0.5, 0.04), emit=1.0)
    for i in range(34): dot([(1, 11.6 - i * 0.36), (N, 11.6 - i * 0.36)], m=om, r=0.085, off=-0.8)
    dot([(1, 11.5), (N, 1.0)], r=0.2, off=-0.35)
    note(c)
def s_i5():
    kesit(sky=(0.10, 0.14, 0.20))
    c = kcam([(0, 33.5, 15), (0.30, 33.5, 15), (0.36, 4.5, 15), (0.64, 4.5, 15), (0.68, 33.5, 15), (0.74, 33.5, 15), (0.94, 4.5, 15), (1, 4.5, 15)], zc=-2.4)
    clabel("9. ODA", 37.2, 1.8, 0.5, AMB()); clabel("3. ODA", 12, 2.0, 0.5); clabel("GİRİŞ", 0.5, 2.6, 0.5)
    for k, (t0, t1) in enumerate(((0.02, 0.36), (0.38, 0.64), (0.70, 0.94))):
        dot([(1, 37.0), (F(t0), 37.0), (F(t1), 0.5), (N, 0.5)], r=0.3, off=-0.3, m=AMB())
    counter(c, [(0.0, "8 TEMMUZ"), (0.37, "9 TEMMUZ"), (0.68, "10 TEMMUZ")], y=0.39, size=0.024, m=K.flat("sy", (1, 1, 1), emit=1.0))
    counter(c, [(0.0, "0 / 13"), (0.34, "4 / 13"), (0.63, "8 / 13"), (0.93, "13 / 13")], y=0.315, size=0.06, m=K.flat("sy2", (1, 1, 1), emit=1.0))
def s_i6():
    kesit(sky=(0.42, 0.55, 0.68), dim=1.15, sun=3.5); ground_front(1.1)
    c = kcam([(0, -3.6, 9.0), (1, -3.4, 8.4)], zc=1.6, shift=0.12)
    people([-7.2, -6.6, -5.9, -5.3, -4.7, -4.0, -3.4, -2.8, -2.2, -1.6, -1.0, 0.4, 1.1], scale=0.5)
    K.hud(c, "13 / 13", 0, 0.32, 0.075, K.flat("s13", (1, 1, 1), emit=1.0), spacing=1.2)
    K.hud(c, "HEPSİ KURTARILDI", 0, 0.268, 0.024, K.flat("s13b", (0.03, 0.05, 0.10), emit=1.0), spacing=1.4)
def s_i7():
    kesit(level=L1, rise=[(F(0.25), 0), (N, 1.0)], to=L2 + 0.9, sky=(0.05, 0.07, 0.10), dim=0.85, sun=1.4)
    c = kcam([(0, 8, 14), (1, 11, 15)], zc=-2.2)
    for i in range(5): dot([(1, 10.5 - i * 0.5), (F(0.8), 1.0 - i * 0.4), (N, -0.2 - i * 0.4)], r=0.14, off=-0.8)
    m = K.flat("ariza", (1.0, 0.16, 0.10), emit=1.0); K.fade(m, [(F(0.2), 0), (F(0.27), 1)])
    K.hud(c, "ANA POMPA DURDU", 0, 0.33, 0.03, m, spacing=1.35)
# ---------- kapanış
def s_j1():
    kesit(sky=(0.16, 0.20, 0.27), level=L1, sun=2.6)
    c = kcam([(0, 12, 26), (1, 12, 30)], zc=6, shift=0.04)
    for i, (body, y, size) in enumerate((("17 GÜN", 0.39, 0.05), ("10.000'E YAKIN İNSAN", 0.335, 0.024), ("13 HAYAT", 0.29, 0.028))):
        mm = K.flat(f"k{i}", (1, 1, 1) if i != 2 else (0.95, 0.5, 0.04), emit=1.0); K.fade(mm, [(F(0.02 + i * 0.3), 0), (F(0.1 + i * 0.3), 1)])
        K.hud(c, body, 0, y, size, mm, spacing=1.35)
def s_j2():
    kesit(sky=(0.30, 0.33, 0.40), dim=0.9, sun=2.6); ground_front(0.9)
    c = kcam([(0, -5.4, 7.6), (1, -5.4, 6.8)], zc=2.0, shift=0.13)
    K.box(K.mat("kaide", (0.18, 0.18, 0.19), rough=0.7), (-5.4, -0.9, GZ + 0.45), (1.0, 0.8, 0.9))
    st = Fg.diver("heykel", swim=False, fins=False, hand_light=False)        # temsili heykel: ekipmanlı dalgıç, ayakta
    Fg.shoes(st, Fg._m()["bot"])
    Fg.pose(st, [("upperarm01.LR", (0.20, 0.0, -1)), ("lowerarm01.LR", (0.06, -0.25, -1))])
    st["arm"].rotation_euler = (0, 0, rad(90)); Fg.ground(st); Fg.freeze(st)
    bz = K.mat("bronz", (0.16, 0.10, 0.045), rough=0.45); bz.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.85
    for i in range(len(st["mesh"].data.materials)): st["mesh"].data.materials[i] = bz
    st["root"].location = (-5.4, -0.9, GZ + 0.9); st["root"].rotation_euler = (0, 0, rad(-60)); st["root"].scale = (1.25,) * 3
    bpy.ops.object.light_add(type="AREA", location=(-7.5, -5, GZ + 4), rotation=(rad(60), 0, rad(-25))); L = bpy.context.active_object; L.data.energy = 250; L.data.size = 4
    m = K.flat("son", (1, 1, 1), emit=1.0); K.fade(m, [(F(0.1), 0), (F(0.25), 1)])
    K.hud(c, "SAMAN KUNAN", 0, 0.345, 0.034, m, spacing=1.35)
    K.hud(c, "THAM LUANG  ·  2018", 0, 0.305, 0.016, K.mat("amber", (0.95, 0.5, 0.04), emit=1.0), spacing=1.4)
    m3 = K.flat("sem2", (0.8, 0.8, 0.8), emit=1.0); K.fade(m3, [(F(0.55), 0), (F(0.7), 1)])
    K.hud(c, "MAĞARA KESİTİ ŞEMATİKTİR, ÖLÇEKLİ DEĞİLDİR", 0, -0.43, 0.0095, m3, spacing=1.3)

if SHOT not in SHOTS: raise SystemExit("bilinmeyen çekim")
globals()["s_" + SHOTS[SHOT].get("fn", SHOT)]()
os.makedirs(f"{HERE}/stills", exist_ok=True)
if MODE == "still":
    K.render(f"{HERE}/stills/{SHOT}", MODE, N, scale=SCALE, stills=(max(1, N // 3), N - 1))
else:
    K.render(f"{HERE}/frames/{SHOT}", MODE, N, label_dir=f"{HERE}/labels/{SHOT}", split_labels=True)
