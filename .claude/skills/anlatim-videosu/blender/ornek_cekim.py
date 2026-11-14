"""kit.py ile en küçük çekim örneği: su dolu tünelde kılavuz ipini izleyen dalgıç + tarih başlığı.

  Blender -b -P ornek_cekim.py -- <çıktı-öneki> still        # iki kare, yarı çözünürlük: önce bak
  Blender -b -P ornek_cekim.py -- <kare-klasörü> anim [sn]   # f-0001.png… (720x1280, 24 fps)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K  # noqa: E402

args = K.argv()
OUT, MODE = args[0], args[1]
SECONDS = float(args[2]) if len(args) > 2 else 8.0
FPS = 24
N = round(SECONDS * FPS)

K.reset(world=(0.004, 0.014, 0.020))  # loş su rengi; ışığı dalgıcın feneri verir
rock = K.noise_mat("kaya", (0.05, 0.085, 0.10), (0.30, 0.38, 0.40), 1.3, bump=1.0, emit=0.02)
K.box(rock, (0, 3.2, 0), (120, 0.1, 40))  # arka duvar
xs = [-30 + i * 0.3 for i in range(200)]
K.strip("tavan", xs, lambda x: 2.1 + 0.5 * math.sin(x * 0.45), lambda x: 25, 1.1, rock, wobble=0.06)
K.strip("taban", xs, lambda x: -25, lambda x: -2.2 + 0.5 * math.sin(x * 0.38), 1.1, rock, wobble=0.06)
for i in range(8):  # hacimli birkaç kaya: düz katmanlara gerçek ışık/gölge katar
    K.rock_blob(rock, (-14 + i * 4, 1.5, 2.8 if i % 2 else -2.8), (2.0, 1.2, 1.0), seed=i)
K.polyline("ip", [(x, 0.35, -0.9 + 0.12 * math.sin(x * 0.6)) for x in xs], 0.012, K.flat("ip", (0.9, 0.9, 0.85), emit=0.5))

d = K.diver()
# fener ileri bakar; arka duvarı aydınlatmak için duvara dönük, konisi çizilmeyen ikinci bir spot
K.light_cone(d["root"], (1.2, -1.0, 0.2), (K.R90, 0, math.radians(-28)), energy=260, spread=70, cone=False)
K.move(d["root"], [(1, (-3.5, 0, 0.1)), (N, (-0.6, 0, 0.0))])
K.kick(d, 1, N)
K.bubbles(14, lambda f: (-3.5 + 2.9 * (f - 1) / N + 0.85, 0.3), 1, N, y=0.0)
K.motes(140, (-9, -1.5, -3.5), (9, 2.5, 3.5), frames=N)

cam = K.camera(lens=35)
K.cam_move(cam, [(1, (-2.6, -9.2, 0.2)), (N, (-1.2, -8.6, 0.2))])  # yavaş kayma + hafif yaklaşma
title = K.fade(K.flat("baslik", (1, 1, 1), emit=1.4), [(1, 0.0), (12, 1.0)])
K.hud(cam, "2 TEMMUZ 2018", 0, 0.33, 0.034, title, spacing=1.35)  # y=+0.33: üst %17, platform arayüzünün altı

K.render(OUT, MODE, N, scale=50 if MODE == "still" else 100)
