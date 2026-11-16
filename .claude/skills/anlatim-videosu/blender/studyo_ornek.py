"""Stüdyo kalıbının en küçük çalışan örnekleri: her yapı taşından bir durağan kare.
  Blender -b -P studyo_ornek.py -- <çıktı-öneki> <makine|kiyas|pist|kure> [still|anim] [saniye]
Yazılar bir sözlükten gelir; gerçek filmde studyo.load_texts(klasör, dil) ile texts.<dil>.json okunur."""
import math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K
import studyo as S

A = K.argv()
OUT, SCENE = A[0], A[1]
MODE = A[2] if len(A) > 2 else "still"
N = int(float(A[3]) * 24) if len(A) > 3 else 96
T = S.Texts({"govde": "REAKSİYON ODASI", "govde2": "kesit görünüm", "gaz": "sıcak gaz", "a": "ESKİ", "a2": "12 birim",
             "b": "YENİ", "b2": "31 birim", "varil": "24 varil", "hiz": "HIZ", "yer": "ARJANTİN", "yer2": "And Dağları",
             "not": "ŞEMATİK GÖSTERİM · ÖLÇEKLİ DEĞİLDİR"}, "tr")


def makine():
    S.studio()
    c = S.cam(target=(0, 0, 1.5), dist=9, az=-28, el=10, to=dict(az=-18), frames=N)
    body = S.cyl(S.glossy("govde", (0.10, 0.12, 0.16), rough=0.3, metal=0.7), (-1.6, 0, 1.5), (1.6, 0, 1.5), 0.8, verts=64, cap=False)
    body.modifiers.new("kabuk", "SOLIDIFY").thickness = 0.09      # içi boş gövde: kesit dolu kapak değil, kabuk gösterir
    S.cutaway(body, (0, -0.15, 0), (0, -1, 0), cap=S.glow("kesit", (0.10, 0.30, 0.55), 0.8))   # ön yarı açılır
    for x in (-1.6, 1.6):
        S.cyl(S.glossy("flans", (0.2, 0.22, 0.26), rough=0.25, metal=0.9), (x - 0.08, 0, 1.5), (x + 0.08, 0, 1.5), 0.95, verts=64)
    S.cyl(S.glossy("boru", (0.2, 0.22, 0.26), rough=0.25, metal=0.9), (1.6, 0, 1.5), (3.0, 0, 1.5), 0.22)
    for x in (-0.8, 0.0, 0.8):
        S.ring(S.glow("halka", (0.3, 0.6, 1.0), 1.5), (x, 0, 1.5), 0.55, tube=0.035, rot=(0, K.R90, 0))
    S.flow(lambda u, i, t: (-1.4 + 4.2 * u, 0.0, 1.5), n=70, size=0.035, spread=0.16,
           material=S.glow("gaz", (1.0, 0.5, 0.12), 1.8), speed=0.3)
    S.arrow((3.1, 0, 1.5), (3.9, 0, 1.5), S.glow("ok", (1.0, 0.5, 0.12), 1.6), grow=(N // 4, N // 2))
    S.tag(c, T("govde"), (-0.6, -0.15, 2.3), (0.3, 0, 1.2), sub=T("govde2"))
    S.tag(c, T("gaz"), (0.9, 0, 1.5), (1.2, -0.5, -1.0))
    S.note(c, T("not"))


def kiyas():
    S.studio()
    c = S.cam(target=(0, 0, 1.7), dist=10, az=14, el=12, to=dict(az=6), frames=N)
    cols = S.columns([1.2, 3.1], [S.glossy("s1", (0.10, 0.12, 0.16), rough=0.3, emit=0.0), S.glow("s2", (0.15, 0.45, 0.95), 0.9)],
                     origin=(-1.0, 0, 0), grow=(1, N // 2))
    for col, k in zip(cols, ("a", "b")):
        S.tag(c, T(k), col["top"], (0.0, 0, 0.75), sub=T(k + "2"))
    S.barrels(24, cols=4, origin=(2.3, 1.2, 0))
    S.tag(c, T("varil"), (2.3, 0, 0.8), (0.4, -0.3, 1.2))
    S.note(c, T("not"))


def pist():
    S.studio()
    c = S.cam(target=(0, 2.4, 0.9), dist=9, az=10, el=30, to=dict(el=26), frames=N)
    tr = S.tracks([3.0, 6.0], lane=0.7, gap=0.5, tick=1.0)
    for k, (t_, col) in enumerate(zip(tr, ((1.0, 0.5, 0.12), (0.3, 0.7, 1.0)))):
        b = K.ball(S.glow(f"top{k}", col, 1.6), (0, 0, 0), 0.2, None)
        K.move(b, [(1, (t_["x"], 0, 0.25)), (N, (t_["x"], t_["end"][1], 0.25))])
    g = S.gauge((-1.5, 3.0, 2.6), radius=0.8, zero=0)
    g["set"](0.1, 1); g["set"](0.8, N)
    S.tag(c, T("hiz"), (-1.5, 3.0, 3.45), (0.3, 0, 0.6))


def kure():
    S.studio(floor=False, beam=False)
    c = S.cam(target=(0, 0, 2.2), dist=9, az=0, el=4, wedge=0.6)
    g = S.globe(center=(0, 0, 2.9), radius=1.5)
    p = g["ll"](-40.1, -71.3, 0.01)
    S.marker(S.glow("isaret", (1.0, 0.5, 0.12), 1.8), p, r=0.035, parent=g["spin"], pulse=(1, N, 24))
    m = S.dot_map(center=(0, 0, 0.45), width=3.0, step=4)
    S.marker(S.glow("isaret", (1.0, 0.5, 0.12), 1.8), m["xy"](-40.1, -71.3) + K.Vector((0, -0.01, 0)), r=0.03, parent=m["root"])
    g["face"](-28, -66)
    S.tag(c, T("yer"), p, (0.9, 0, 0.9), sub=T("yer2"), parent=g["spin"])
    g["face"](-10, -95, 1); g["face"](-28, -66, N)


{"makine": makine, "kiyas": kiyas, "pist": pist, "kure": kure}[SCENE]()
if MODE == "still":
    K.render(OUT, "still", N, scale=50)
else:
    K.render(OUT, MODE, N)
