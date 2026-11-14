"""Blender 5.x için 3D kesit anlatım kiti (başsız çalışır: Blender -b -P <çekim betiği> -- ...).

Bu modül sahne kurmaz; çekim betiklerinin kullandığı küçük yapı taşlarını verir:
malzemeler, yazı/etiket, kesit şeridi (toprak içinde mağara), kendini çizen rota çizgisi,
eklemli basit insan figürü (dalgıç, oturan çocuk, taşınan çocuk, ayakta kurtarıcı), ışık konisi,
kabarcık, kamera ve kameraya bağlı yazı, ortak render ayarı.

Eksenler: kesit XZ düzlemindedir, kamera -Y'den +Y'ye bakar. X sağa, Z yukarı.
"""
import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector, noise

FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"  # Türkçe harfleri var
_font = None
R90 = math.radians(90)


# ---------------------------------------------------------------- sahne / render
def reset(res=(720, 1280), samples=8, fps=24, world=(0.02, 0.03, 0.04), strength=1.0, linear=True):
    """Boş sahne + ortak render ayarı. linear=True: yeni anahtar kareler doğrusal (kesmede akan kamera)."""
    global _font
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _font = bpy.data.fonts.load(FONT_PATH)
    sc = bpy.context.scene
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*world, 1)
    bg.inputs["Strength"].default_value = strength
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.fps = fps
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.compression = 15
    sc.render.use_overwrite = False  # yarıda kalan render kaldığı yerden sürer
    try:
        sc.eevee.taa_render_samples = samples
    except Exception:
        pass
    try:
        sc.view_settings.view_transform = "Standard"  # AgX soluk kalıyordu
    except Exception:
        pass
    if linear:
        bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    return sc


def ease(on=True):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "BEZIER" if on else "LINEAR"


def argv():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def render(out_dir, mode, frames, stills=None, scale=100):
    """mode 'still': birkaç kareyi <out_dir>/<kare>.png yazar; 'anim': tüm kareleri f-0001.png… yazar."""
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    sc.render.resolution_percentage = scale
    if mode == "still":
        for f in stills or (max(1, frames // 3), frames - 1):
            sc.frame_set(int(f))
            sc.render.filepath = f"{out_dir}-{int(f):04d}.png"
            sc.render.use_overwrite = True
            bpy.ops.render.render(write_still=True)
    else:
        sc.render.filepath = f"{out_dir}/f-"
        bpy.ops.render.render(animation=True)


# ---------------------------------------------------------------- malzemeler
def _bsdf(m):
    return m.node_tree.nodes["Principled BSDF"]


def _blend(m):
    try:
        m.surface_render_method = "BLENDED"
    except Exception:
        m.blend_method = "BLEND"


def flat(name, color, emit=0.0, alpha=1.0, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        _blend(m)
    return m


def fade(mat, keys):
    """Malzemenin saydamlığını anahtarlar: keys = [(kare, alfa), …]. Yazı/çizgi belirip kaybolsun diye."""
    _blend(mat)
    inp = _bsdf(mat).inputs["Alpha"]
    for f, a in keys:
        inp.default_value = a
        inp.keyframe_insert("default_value", frame=f)
    return mat


def noise_mat(name, c1, c2, scale, bump=0.5, rough=0.9, stretch=(1, 1, 1), emit=0.0, bands=0.0, detail=8):
    """Gürültü dokulu kaya/toprak. bands>0: yatay katman çizgileri (kesitte tortul tabaka hissi)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = stretch
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    fac = n.outputs[0]
    if bands:
        wv = nt.nodes.new("ShaderNodeTexWave")
        wv.bands_direction = "Z"
        wv.inputs["Scale"].default_value = bands
        wv.inputs["Distortion"].default_value = 3.0
        wv.inputs["Detail"].default_value = 3.0
        nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
        mx = nt.nodes.new("ShaderNodeMath")
        mx.operation = "ADD"
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = 0.35
        nt.links.new(wv.outputs[1], mul.inputs[0])
        nt.links.new(n.outputs[0], mx.inputs[0])
        nt.links.new(mul.outputs[0], mx.inputs[1])
        sub = nt.nodes.new("ShaderNodeMath")
        sub.operation = "SUBTRACT"
        sub.inputs[1].default_value = 0.17
        nt.links.new(mx.outputs[0], sub.inputs[0])
        fac = sub.outputs[0]
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].position = 0.35
    r.color_ramp.elements[0].color = (*c1, 1)
    r.color_ramp.elements[1].position = 0.7
    r.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(fac, r.inputs[0])
    nt.links.new(r.outputs[0], b.inputs["Base Color"])
    if bump:
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        nt.links.new(fac, bp.inputs["Height"])
        nt.links.new(bp.outputs[0], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = rough
    if emit:
        nt.links.new(r.outputs[0], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit
    return m


def cone_mat(name="Koni", color=(1.0, 0.93, 0.75), peak=0.16, length=5.0):
    """Işık konisi: uca doğru ve kenarlarda sönen yarı saydam ışıma (hacim render'ı yok, ucuz)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = (0, 0, 0, 1)
    b.inputs["Emission Color"].default_value = (*color, 1)
    b.inputs["Emission Strength"].default_value = 1.0
    b.inputs["Roughness"].default_value = 1.0
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    rng = nt.nodes.new("ShaderNodeMapRange")  # tepe (z=+len/2) 1, taban (z=-len/2) 0
    rng.inputs["From Min"].default_value = -length / 2
    rng.inputs["From Max"].default_value = length / 2
    nt.links.new(sep.outputs["Z"], rng.inputs["Value"])
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 1.6
    nt.links.new(rng.outputs[0], pw.inputs[0])
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(lw.outputs["Facing"], inv.inputs[1])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(pw.outputs[0], mul.inputs[0])
    nt.links.new(inv.outputs[0], mul.inputs[1])
    mul2 = nt.nodes.new("ShaderNodeMath")
    mul2.operation = "MULTIPLY"
    mul2.inputs[1].default_value = peak
    nt.links.new(mul.outputs[0], mul2.inputs[0])
    nt.links.new(mul2.outputs[0], b.inputs["Alpha"])
    _blend(m)
    return m


# ---------------------------------------------------------------- temel nesneler
def link(o, parent=None):
    bpy.context.scene.collection.objects.link(o)
    if parent:
        o.parent = parent
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    return link(e, parent)


def prim(op, material, smooth=True, parent=None, **kw):
    op(**kw)
    o = bpy.context.active_object
    if material:
        o.data.materials.append(material)
    if smooth:
        bpy.ops.object.shade_smooth()
    if parent:
        o.parent = parent
    return o


def box(material, loc, scale, parent=None, rot=(0, 0, 0), shadow=True):
    o = prim(bpy.ops.mesh.primitive_cube_add, material, smooth=False, parent=parent, size=1, location=loc, rotation=rot)
    o.scale = scale
    o.visible_shadow = shadow
    return o


def text(body, loc, size, material, align="CENTER", spacing=1.0, rot=(R90, 0, 0), parent=None, line=1.0):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    t = bpy.context.active_object
    t.data.body = body
    t.data.font = _font
    t.data.size = size
    t.data.align_x = align
    t.data.space_character = spacing
    t.data.space_line = line
    t.data.materials.append(material)
    t.visible_shadow = False
    if parent:
        t.parent = parent
    return t


def dashes(x0, x1, z, y, material, step=0.5, fill=0.55, thick=0.05, parent=None):
    """Yatay kesik çizgi (derinlik/su seviyesi işareti)."""
    out = []
    x = x0
    while x < x1:
        d = box(material, (x + step * fill / 2, y, z), (step * fill, 0.02, thick), parent=parent, shadow=False)
        out.append(d)
        x += step
    return out


def strip(name, xs, lo, hi, y, material, wobble=0.0, seed=0):
    """XZ düzleminde, her x için lo(x)..hi(x) arasını dolduran şerit ağ (kesit: mağara boşluğu, su, kaya katmanı)."""
    rnd = random.Random(seed)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    prev = None
    for x in xs:
        a = bm.verts.new((x, y, lo(x) + rnd.uniform(-wobble, wobble)))
        b = bm.verts.new((x, y, hi(x) + rnd.uniform(-wobble, wobble)))
        if prev:
            bm.faces.new((prev[0], a, b, prev[1]))
        prev = (a, b)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    me.materials.append(material)
    return o


def rise_key(obj, lo, hi, frames):
    """strip() ile kurulmuş su şeridine 'yükselme' şekil anahtarı ekler: üst kenar hi(x)'e, alt kenar lo(x)'e gider.
    frames = [(kare, 0..1), …]."""
    obj.shape_key_add(name="Basis")
    k = obj.shape_key_add(name="Yuksel")
    for i, v in enumerate(obj.data.vertices):
        x = v.co.x
        k.data[i].co = (x, v.co.y, lo(x) if i % 2 == 0 else hi(x))
    for f, val in frames:
        k.value = val
        k.keyframe_insert("value", frame=f)
    return k


def polyline(name, pts, radius, material, draw=None, parent=None):
    """Noktalardan geçen kalın çizgi (ip, rota, boru). draw=[(kare, 0..1), …] verilirse kendini çizer."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (*c, 1)
    o = link(bpy.data.objects.new(name, cu), parent)
    cu.materials.append(material)
    o.visible_shadow = False
    if draw:
        for f, v in draw:
            cu.bevel_factor_end = v
            cu.keyframe_insert("bevel_factor_end", frame=f)
    return o


def rock_blob(material, loc, scale, seed=0, strength=0.35, subdiv=3):
    """Gürültüyle yamultulmuş kaya kütlesi."""
    o = prim(bpy.ops.mesh.primitive_ico_sphere_add, material, subdivisions=subdiv, radius=1, location=loc)
    for v in o.data.vertices:
        n = noise.noise(Vector(v.co) * 1.7 + Vector((seed * 3.1, seed, -seed)))
        v.co *= 1 + strength * n
    o.scale = scale
    return o


def show(obj, frames):
    """Görünürlük anahtarı: frames = [(kare, True/False), …] (sayaç rakamı, kart değişimi)."""
    for f, vis in frames:
        obj.hide_render = not vis
        obj.keyframe_insert("hide_render", frame=f)


def move(obj, keys, prop="location"):
    """keys = [(kare, değer), …]"""
    for f, v in keys:
        setattr(obj, prop, v)
        obj.keyframe_insert(prop, frame=f)


# ---------------------------------------------------------------- figürler
def limb(a, b, r, material, parent, r2=None):
    """İki eklem arasında silindir + uçlarda küre: her pozda düzgün duran kol/bacak."""
    a, b = Vector(a), Vector(b)
    d = b - a
    mid = (a + b) / 2
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    prim(bpy.ops.mesh.primitive_cone_add, material, parent=parent, vertices=12, radius1=r, radius2=r2 or r,
         depth=d.length, location=mid, rotation=rot)
    prim(bpy.ops.mesh.primitive_uv_sphere_add, material, parent=parent, segments=12, ring_count=8, radius=r, location=a)
    prim(bpy.ops.mesh.primitive_uv_sphere_add, material, parent=parent, segments=12, ring_count=8, radius=r2 or r,
         location=b)


def ball(material, loc, r, parent, scale=(1, 1, 1)):
    o = prim(bpy.ops.mesh.primitive_uv_sphere_add, material, parent=parent, segments=16, ring_count=10, radius=r,
             location=loc)
    o.scale = scale
    return o


_mats = {}


def mat(key, *a, **kw):
    """Aynı malzemeyi yeniden kullan (figür başına yüzlerce kopya olmasın)."""
    if key not in _mats:
        _mats[key] = flat(key, *a, **kw)
    return _mats[key]


def light_cone(parent, loc, rot, energy=900, length=5.0, spread=38, peak=0.16, color=(1.0, 0.93, 0.75), cone=True):
    """Fener: spot ışık + görünür koni. rot spot'un euler açısı (spot -Z'ye bakar)."""
    bpy.ops.object.light_add(type="SPOT", location=loc, rotation=rot)
    sp = bpy.context.active_object
    sp.parent = parent
    sp.data.energy = energy
    sp.data.spot_size = math.radians(spread)
    sp.data.spot_blend = 0.6
    sp.data.color = color
    if cone:
        rad = math.tan(math.radians(spread / 2)) * length
        c = prim(bpy.ops.mesh.primitive_cone_add, cone_mat(peak=peak, length=length, color=color), parent=sp,
                 vertices=40, radius1=rad, radius2=0.02, depth=length, location=(0, 0, -length / 2), end_fill_type="NOTHING")
        c.visible_shadow = False
    return sp


def diver(name="Dalgic", accent=(0.85, 0.55, 0.05), scale=1.0, lamp=True, energy=900, cone_len=5.0, peak=0.16,
          tanks=True, aim=-8):
    """Yüzen mağara dalgıcı. Gövde +X'e bakar (baş +X), sırt +Z. Dönen: kök, kalça boşlukları (palet vuruşu), spot."""
    root = empty(name)
    suit = mat("elbise", (0.025, 0.028, 0.035), rough=0.45)
    acc = mat(f"vurgu{accent}", accent, rough=0.5)
    skin = mat("ten", (0.75, 0.55, 0.42))
    steel = mat("tup", (0.55, 0.58, 0.62), rough=0.25)
    glass = mat("maske", (0.03, 0.10, 0.14), rough=0.1)
    ball(suit, (0.30, 0, 0.02), 1, root, (0.40, 0.19, 0.15))           # gövde
    ball(acc, (0.42, 0, 0.03), 1, root, (0.24, 0.195, 0.155))          # göğüs/omuz rengi
    ball(skin, (0.84, 0, 0.08), 0.105, root)                            # yüz
    ball(suit, (0.825, 0, 0.10), 0.118, root, (1, 1, 0.95))            # başlık
    box(glass, (0.93, 0, 0.075), (0.07, 0.17, 0.085), root)            # maske
    box(mat("kask", (0.8, 0.8, 0.82)), (0.84, 0, 0.215), (0.16, 0.14, 0.05), root)
    ball(mat("lamba", (1, 0.95, 0.8), emit=6), (0.93, 0, 0.21), 0.03, root)
    limb((0.70, 0, 0.05), (0.76, 0, 0.07), 0.07, suit, root)           # boyun
    # kollar: sağ kol (kameraya yakın, -Y) öne uzanmış fener tutuyor; sol kol ipe doğru
    limb((0.58, -0.20, 0.02), (0.84, -0.23, -0.10), 0.055, suit, root)
    limb((0.84, -0.23, -0.10), (1.10, -0.17, -0.06), 0.048, suit, root)
    ball(suit, (1.13, -0.17, -0.06), 0.055, root)
    limb((0.58, 0.20, 0.02), (0.74, 0.25, -0.16), 0.055, suit, root)
    limb((0.74, 0.25, -0.16), (0.98, 0.20, -0.22), 0.048, suit, root)
    if tanks:                                                           # yandan takılan tüpler (sidemount)
        for sy in (-0.27, 0.27):
            limb((-0.12, sy, -0.12), (0.46, sy, -0.10), 0.085, steel, root)
            box(mat("vana", (0.08, 0.08, 0.08)), (0.56, sy, -0.10), (0.09, 0.07, 0.07), root)
    hips = []
    for i, sy in enumerate((-0.10, 0.10)):                              # bacaklar: dizler hafif kırık, paletler yukarıda
        hip = empty(f"{name}-kalca{i}", (-0.02, sy, 0.0), root)
        limb((0, 0, 0), (-0.42, 0, -0.03), 0.082, suit, hip, r2=0.07)
        limb((-0.42, 0, -0.03), (-0.76, 0, 0.17), 0.066, suit, hip, r2=0.05)
        fin = box(mat("palet", (0.02, 0.02, 0.02), rough=0.3), (-1.02, 0, 0.27), (0.50, 0.17, 0.03), hip,
                  rot=(0, math.radians(18), 0))
        hips.append(hip)
    spot = None
    if lamp:
        spot = light_cone(root, (1.15, -0.17, -0.06), (0, math.radians(-90 + aim), 0), energy=energy, length=cone_len,
                          peak=peak)
    root.scale = (scale,) * 3
    return {"root": root, "hips": hips, "spot": spot}


def kick(fig, f0, f1, speed=0.32, amp=0.16, step=3):
    """Palet vuruşu: kalçaları karşılıklı salla."""
    for f in range(f0, f1 + 1, step):
        for i, hip in enumerate(fig["hips"]):
            hip.rotation_euler = (0, amp * math.sin(f * speed + i * math.pi), 0)
            hip.keyframe_insert("rotation_euler", frame=f)


def carried(name="Tasinan", scale=0.8, shirt=(0.05, 0.06, 0.08)):
    """Taşınan (uyutulmuş) çocuk: yatay, kollar yanda, tam yüz maskesi, göğüste tüp. Baş +X."""
    root = empty(name)
    suit = mat(f"cs{shirt}", shirt, rough=0.5)
    skin = mat("ten", (0.75, 0.55, 0.42))
    ball(suit, (0.30, 0, 0), 1, root, (0.38, 0.17, 0.14))
    ball(skin, (0.80, 0, 0.02), 0.10, root)
    ball(suit, (0.79, 0, 0.04), 0.112, root)
    box(mat("tamyuz", (0.10, 0.35, 0.45), rough=0.1, emit=0.25), (0.875, 0, -0.01), (0.09, 0.18, 0.17), root)
    limb((0.5, -0.20, 0), (0.05, -0.21, -0.02), 0.045, suit, root)
    limb((0.5, 0.20, 0), (0.05, 0.21, -0.02), 0.045, suit, root)
    for sy in (-0.09, 0.09):
        limb((0, sy, 0), (-0.45, sy, -0.01), 0.075, suit, root, r2=0.06)
        limb((-0.45, sy, -0.01), (-0.85, sy, -0.02), 0.06, suit, root, r2=0.045)
    limb((0.05, 0, -0.2), (0.55, 0, -0.2), 0.075, mat("tup", (0.55, 0.58, 0.62), rough=0.25), root)  # öndeki tüp
    root.scale = (scale,) * 3
    return {"root": root}


def sitter(name="Oturan", shirt=(0.45, 0.08, 0.08), scale=0.8, parent=None):
    """Dizlerini karnına çekmiş oturan figür. +X'e bakar, kalça yerde (z=0)."""
    root = empty(name, parent=parent)
    top = mat(f"forma{shirt}", shirt, rough=0.8)
    dark = mat("sort", (0.03, 0.03, 0.05), rough=0.8)
    skin = mat("ten", (0.75, 0.55, 0.42))
    hair = mat("sac", (0.02, 0.015, 0.01))
    limb((0, 0, 0.12), (0.06, 0, 0.50), 0.13, top, root, r2=0.12)
    ball(skin, (0.11, 0, 0.74), 0.105, root)
    ball(hair, (0.09, 0, 0.77), 0.105, root, (1, 1, 0.9))
    for sy in (-0.09, 0.09):
        limb((0.02, sy, 0.10), (0.36, sy, 0.36), 0.075, dark, root, r2=0.06)
        limb((0.36, sy, 0.36), (0.46, sy, 0.04), 0.055, skin, root, r2=0.045)
        limb((0.08, sy * 1.9, 0.50), (0.24, sy * 2.0, 0.30), 0.045, top, root)
        limb((0.24, sy * 2.0, 0.30), (0.40, sy * 1.2, 0.38), 0.038, skin, root)
    root.scale = (scale,) * 3
    return {"root": root}


def stander(name="Ayakta", color=(0.75, 0.35, 0.05), scale=1.0, parent=None, helmet=True):
    """Ayakta duran kurtarıcı. +X'e bakar, ayaklar z=0."""
    root = empty(name, parent=parent)
    top = mat(f"ust{color}", color, rough=0.8)
    dark = mat("pant", (0.04, 0.045, 0.06), rough=0.8)
    skin = mat("ten", (0.75, 0.55, 0.42))
    for sy in (-0.09, 0.09):
        limb((0, sy, 0.05), (0.0, sy, 0.50), 0.065, dark, root)
        limb((0, sy, 0.50), (0, sy, 0.92), 0.08, dark, root)
        limb((0, sy * 2.1, 1.38), (0.10, sy * 2.3, 1.10), 0.05, top, root)
        limb((0.10, sy * 2.3, 1.10), (0.28, sy * 2.0, 0.98), 0.042, top, root)
    limb((0, 0, 0.95), (0, 0, 1.38), 0.15, top, root, r2=0.14)
    ball(skin, (0.02, 0, 1.63), 0.105, root)
    if helmet:
        ball(mat("baret", (0.85, 0.85, 0.8)), (0.01, 0, 1.67), 0.115, root, (1, 1, 0.8))
    root.scale = (scale,) * 3
    return {"root": root}


def bubbles(n, src, f0, f1, rise=6.0, life=70, spread=0.3, y=-0.2, size=(0.015, 0.04), seed=1):
    """src(kare) -> (x, z): kabarcığın çıktığı nokta (dalgıcın ağzı). Kabarcıklar yukarı çıkar ve kaybolur."""
    rnd = random.Random(seed)
    m = mat("kabarcik", (0.85, 0.95, 1.0), emit=0.9, alpha=0.5)
    for _ in range(n):
        fa = rnd.randint(f0 - life // 2, f1)
        x, z = src(max(fa, f0))
        b = prim(bpy.ops.mesh.primitive_uv_sphere_add, m, segments=10, ring_count=6, radius=rnd.uniform(*size))
        b.visible_shadow = False
        b.location = (x + rnd.uniform(-spread, spread) * 0.3, y, z + 0.1)
        b.keyframe_insert("location", frame=fa)
        b.location = (x + rnd.uniform(-spread, spread), y, z + rise * rnd.uniform(0.7, 1.1))
        b.keyframe_insert("location", frame=fa + life)
        show(b, [(max(1, fa - 1), False), (max(2, fa), True), (fa + life, False)]) if fa > 1 else None


def motes(n, box_min, box_max, drift=(0.15, 0, 0.05), frames=240, seed=3, size=(0.008, 0.02)):
    """Suda asılı tortu tanecikleri: derinlik hissi ve hareket (hacim render'ı yerine)."""
    rnd = random.Random(seed)
    m = mat("tortu", (0.75, 0.8, 0.7), emit=0.6, alpha=0.55)
    for _ in range(n):
        p = Vector([rnd.uniform(a, b) for a, b in zip(box_min, box_max)])
        o = prim(bpy.ops.mesh.primitive_ico_sphere_add, m, smooth=False, subdivisions=1, radius=rnd.uniform(*size),
                 location=p)
        o.visible_shadow = False
        o.keyframe_insert("location", frame=1)
        o.location = p + Vector([d * rnd.uniform(0.3, 1.6) * frames / 100 for d in drift])
        o.keyframe_insert("location", frame=frames)


# ---------------------------------------------------------------- kamera
def camera(name="Kam", lens=40, ortho=None, loc=(0, -30, 0)):
    """ortho verilirse ortografik (kesit şeması); değilse perspektif. -Y'den +Y'ye bakar."""
    bpy.ops.object.camera_add(location=loc, rotation=(R90, 0, 0))
    c = bpy.context.active_object
    c.name = name
    c.data.clip_end = 500
    if ortho:
        c.data.type = "ORTHO"
        c.data.ortho_scale = ortho
    else:
        c.data.lens = lens
    bpy.context.scene.camera = c
    return c


def cam_move(cam, keys):
    """keys = [(kare, (x, y, z), ortho_scale|None), …]"""
    for k in keys:
        cam.location = k[1]
        cam.keyframe_insert("location", frame=k[0])
        if len(k) > 2 and k[2]:
            cam.data.ortho_scale = k[2]
            cam.data.keyframe_insert("ortho_scale", frame=k[0])


def hud(cam, body, x, y, size, material, align="CENTER", spacing=1.0, dist=2.0, line=1.0):
    """Kameraya bağlı yazı (başlık kartı, sayaç, gösterge). x,y: kare yüksekliği 1 kabul edilerek merkezden
    konum (y=+0.5 üst kenar, x=±0.28 yan kenarlar 9:16'da). size da aynı birimde. Ortografikte ortho_scale ile ölçeklenir."""
    holder = empty("hud", parent=cam)
    if cam.data.type == "ORTHO":
        k = cam.data.ortho_scale
        drv = holder.driver_add("scale")
        for d in drv:                      # ortho_scale değişse de ekrandaki boyut sabit kalsın
            v = d.driver.variables.new()
            v.name = "s"
            v.targets[0].id_type = "CAMERA"
            v.targets[0].id = cam.data
            v.targets[0].data_path = "ortho_scale"
            d.driver.expression = "s"
        holder.scale = (k, k, k)
        holder.location = (0, 0, -dist)
    else:
        h = 2 * dist * math.tan(cam.data.angle_y / 2) if cam.data.sensor_fit == "VERTICAL" else None
        if h is None:  # dikey karede AUTO: sensör genişliği uzun kenara (yükseklik) uygulanır
            h = dist * cam.data.sensor_width / cam.data.lens
        holder.scale = (h, h, h)
        holder.location = (0, 0, -dist)
    t = text(body, (x, y, 0), size, material, align=align, spacing=spacing, rot=(0, 0, 0), parent=holder, line=line)
    return t
