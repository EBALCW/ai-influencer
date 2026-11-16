"""Stüdyo kalıbı: "nasıl çalışır" videoları için karanlık stüdyo sahnesi (Blender 5.x, EEVEE, başsız).

kit.py'nin üstüne kurulur. Verdikleri: karanlık fon + mavi ışık kaması + parlak zemin (`studio`, `cam`), ışıyan
malzemeler (`glow`, `soft_glow`, `glossy`), etiket kutusu ve kılavuz çizgisi (`tag`), yol boyunca akan parçacıklar
(`flow`), kare başına Python hareketi (`on_frame`), ok (`arrow`), kesit (`cutaway`), karşılaştırma dizilimleri
(`columns`, `tracks`, `barrels`, `gauge`), noktalı küre ve düz harita (`globe`, `dot_map`), çerçeveli fotoğraf
(`framed_photo`), dile göre ekran yazıları (`load_texts`).

Eksenler: zemin z=0, X sağa, Z yukarı, kamera -Y tarafında durur. Ekran yazıları `etiket` olarak işaretlenir ve
kit.render()'ın 'lab' kipinde tam çözünürlükte ayrı render edilir.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import kit as K
from studyo_post import Texts, load_texts, upper  # noqa: F401  (çekim betikleri buradan alır)

SERIF_PATH = "/System/Library/Fonts/Supplemental/Georgia.ttf"  # etiketler için; Türkçe harfleri var
BLUE = (0.30, 0.55, 1.0)
_serif = None
_flows = []
_ticks = []
rad = math.radians


# ---------------------------------------------------------------- sahne
def studio(samples=16, res=(720, 1280), world=(0.003, 0.005, 0.010), floor=True, floor_rough=0.2, key=1.0, rim=1.0,
           fill=1.0, ray=True, beam=True, tint=BLUE):
    """Karanlık stüdyo: neredeyse siyah dünya, parlak koyu zemin, sağ üstten mavi anahtar ışık (+ görünür huzme),
    arkadan kenar ışığı, önden çok hafif dolgu. Fondaki ışık kaması `cam()` ile gelir (kameraya bağlıdır).
    ray=True: zeminde ekran-uzayı yansıma (EEVEE raytracing; yarı çözünürlükte izlenir)."""
    global _serif
    sc = K.reset(res=res, samples=samples, world=world)
    _serif = bpy.data.fonts.load(SERIF_PATH)
    _flows.clear()
    _ticks.clear()
    bpy.app.handlers.frame_change_pre.append(_tick)
    if ray:
        try:
            sc.eevee.use_raytracing = True
            sc.eevee.ray_tracing_method = "SCREEN"
            sc.eevee.ray_tracing_options.resolution_scale = "2"
            sc.eevee.ray_tracing_options.trace_max_roughness = 0.5
        except Exception:
            pass
    out = {}
    if floor:
        fm = glossy("zemin", (0.010, 0.013, 0.020), rough=floor_rough)
        out["floor"] = K.prim(bpy.ops.mesh.primitive_plane_add, fm, smooth=False, size=300, location=(0, 0, 0))
    out["key"] = light("SPOT", (6.5, -3.5, 9.5), (0, 0, 0.8), 4200 * key, color=(0.62, 0.78, 1.0), spread=60, blend=0.85, soft=0.6)
    out["rim"] = light("SPOT", (-5.5, 7.0, 6.0), (0, 0, 1.2), 3800 * rim, color=(0.55, 0.72, 1.0), spread=70, blend=0.8, soft=0.4)
    out["fill"] = light("AREA", (-4.0, -7.0, 3.5), (0, 0, 1.2), 160 * fill, color=(0.85, 0.9, 1.0), size=7)
    out["fill"].data.specular_factor = 0.0     # parlak zeminde ışığın kendi yansıması beyaz leke yapar
    out["key"].data.specular_factor = 0.35
    if floor:                                  # arkadaki kenar ışığı zemini aydınlatmasın: yansıması ön planda patlar
        try:
            col = bpy.data.collections.new("kenar-isigi-disi")
            col.objects.link(out["floor"])
            out["rim"].light_linking.receiver_collection = col
            col.collection_objects[0].light_linking.link_state = "EXCLUDE"
        except Exception:
            out["rim"].data.specular_factor = 0.0
    if beam:   # görünür huzme: sağ üst arkadan zemine inen yumuşak koni (hacim render'ı yok)
        L = 22.0
        src, dst = Vector((9.5, 9.0, 15.0)), Vector((-1.5, 3.0, 0.0))
        c = K.prim(bpy.ops.mesh.primitive_cone_add, K.cone_mat("huzme", color=tint, peak=0.10, length=L), vertices=48,
                   radius1=5.5, radius2=0.3, depth=L, location=(src + dst) / 2, end_fill_type="NOTHING")
        c.rotation_euler = (src - dst).to_track_quat("Z", "Y").to_euler()
        c.visible_shadow = False
        out["beam"] = c
    return out


def light(kind, loc, target, energy, color=(1, 1, 1), spread=50, blend=0.7, size=3.0, soft=0.25, shadow=True):
    """Hedefe bakan ışık. kind: SPOT | AREA | POINT | SUN."""
    bpy.ops.object.light_add(type=kind, location=loc)
    o = bpy.context.active_object
    aim(o, target)
    o.data.energy = energy
    o.data.color = color
    if kind == "SPOT":
        o.data.spot_size = rad(spread)
        o.data.spot_blend = blend
        o.data.shadow_soft_size = soft
    elif kind == "AREA":
        o.data.size = size
    elif kind == "POINT":
        o.data.shadow_soft_size = soft
    try:
        o.data.use_shadow = shadow
    except Exception:
        pass
    return o


def aim(o, target):
    """Nesnenin -Z eksenini hedefe çevirir (ışık ve kamera için)."""
    d = Vector(target) - Vector(o.location)
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return o


def _wedge_mat(strength=0.5, color=BLUE, src=(0.30, 0.47), angle=-128.0, half=24.0):
    """Fondaki ışık kaması: sağ üst köşeden sol alta açılan, kenarı yumuşak, hafif çizgili mavi ışıma."""
    m = bpy.data.materials.new("kama")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes.new

    def math_(op, a=None, b=None):
        n = N("ShaderNodeMath")
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    def rng(v, a, b, c, d, interp="SMOOTHSTEP"):
        n = N("ShaderNodeMapRange")
        n.interpolation_type = interp
        nt.links.new(v, n.inputs["Value"])
        for k, val in (("From Min", a), ("From Max", b), ("To Min", c), ("To Max", d)):
            n.inputs[k].default_value = val
        return n.outputs[0]

    tc = N("ShaderNodeTexCoord")
    sep = N("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    dx = math_("SUBTRACT", sep.outputs["X"], src[0])
    dy = math_("SUBTRACT", sep.outputs["Y"], src[1])
    ang = math_("ARCTAN2", dy, dx)
    diff = math_("ABSOLUTE", math_("SUBTRACT", ang, rad(angle)))
    a = rng(diff, 0.0, rad(half), 1.0, 0.0)
    r = math_("SQRT", math_("ADD", math_("MULTIPLY", dx, dx), math_("MULTIPLY", dy, dy)))
    fall = rng(r, 0.05, 1.25, 1.0, 0.0)
    ns = N("ShaderNodeTexNoise")
    ns.noise_dimensions = "1D"
    ns.inputs["Scale"].default_value = 26.0
    ns.inputs["Detail"].default_value = 2.0
    nt.links.new(ang, ns.inputs["W"])
    streak = rng(ns.outputs[0], 0.3, 0.7, 0.72, 1.12, "LINEAR")
    val = math_("MULTIPLY", math_("MULTIPLY", math_("MULTIPLY", a, fall), streak), strength)
    em = N("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    nt.links.new(val, em.inputs["Strength"])
    out = N("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def cam(target=(0, 0, 1.2), dist=8.0, az=0.0, el=8.0, lens=50, to=None, frames=None, shift=-0.07, wedge=0.5, step=6,
        tint=BLUE):
    """Hedefe kilitli stüdyo kamerası. az: 0 iken kamera -Y'de (derece, + sağa döner), el: yükseklik açısı.
    to = dict(az=, el=, dist=, target=): çekim sonundaki değerler (verilmeyen sabit kalır); frames = kare sayısı.
    shift: konuyu karede yukarı almak için (negatif = konu yukarı; altyazı bandı %66-76'da durur).
    wedge: fondaki ışık kamasının gücü (0 = yok). Kama kameraya bağlıdır: kadrajın sağ üstünden gelir."""
    c = K.camera(lens=lens, loc=(0, -dist, 1))
    c.rotation_euler = (0, 0, 0)
    c.data.shift_y = shift
    tgt = K.empty("hedef", target)
    con = c.constraints.new("TRACK_TO")
    con.target, con.track_axis, con.up_axis = tgt, "TRACK_NEGATIVE_Z", "UP_Y"

    def pos(a, e, d, t):
        a, e = rad(a), rad(e)
        return (t[0] + d * math.cos(e) * math.sin(a), t[1] - d * math.cos(e) * math.cos(a), t[2] + d * math.sin(e))

    p0 = dict(az=az, el=el, dist=dist, target=tuple(target))
    c.location = pos(az, el, dist, target)
    if to and frames:
        p1 = {**p0, **to}
        fs = sorted(set(list(range(1, frames, step)) + [frames]))
        for f in fs:
            k = (f - 1) / max(1, frames - 1)
            mix = lambda a, b: a + (b - a) * k  # noqa: E731
            t = tuple(mix(a, b) for a, b in zip(p0["target"], p1["target"]))
            c.location = pos(mix(p0["az"], p1["az"]), mix(p0["el"], p1["el"]), mix(p0["dist"], p1["dist"]), t)
            c.keyframe_insert("location", frame=f)
            tgt.location = t
            tgt.keyframe_insert("location", frame=f)
    if wedge:
        D = 140.0
        h = D * c.data.sensor_width / c.data.lens
        b = K.prim(bpy.ops.mesh.primitive_plane_add, _wedge_mat(wedge, color=tint), smooth=False, parent=c, size=1,
                   location=(0, shift * h, -D))
        b.scale = (h * 1.3, h * 1.3, 1)
        b.visible_shadow = False
    c["hedef"] = tgt
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    return c


# ---------------------------------------------------------------- malzemeler
def glossy(name, color, rough=0.25, metal=0.0, coat=0.0, emit=0.0):
    """Parlak stüdyo malzemesi (gövde, zemin, makine parçası)."""
    m = K.flat(name, color, rough=rough, emit=emit)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.08
    return m


def glow(name, color, strength=1.6, alpha=1.0):
    """Işıyan malzeme (sıcak gaz, plazma, halka, ışın). Standard görünümde 1'in çok üstü beyaza kırpılır:
    doygun renk + 1-2 arası güç ver; haleyi studyo_post.glow_filter() ekler."""
    m = K.flat(name, color, emit=strength, alpha=alpha)
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0, 0, 0, 1)
    return m


def soft_glow(name, color, peak=0.5, power=1.6, strength=1.5, zfade=None, edge=False):
    """Hacim gibi görünen yumuşak ışıma: kenara doğru sönen yarı saydam kabuk (sütun, huzme, sıcak hava).
    edge=True ise tersine kenarlar parlar (atmosfer, kabarcık). zfade=(z0, z1): nesne Z'sinde z0'da tam, z1'de sıfır."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0, 0, 0, 1)
    b.inputs["Emission Color"].default_value = (*color, 1)
    b.inputs["Emission Strength"].default_value = strength
    b.inputs["Roughness"].default_value = 1.0
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    val = lw.outputs["Facing"]
    if not edge:
        inv = nt.nodes.new("ShaderNodeMath")
        inv.operation = "SUBTRACT"
        inv.inputs[0].default_value = 1.0
        nt.links.new(val, inv.inputs[1])
        val = inv.outputs[0]
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = power
    nt.links.new(val, pw.inputs[0])
    val = pw.outputs[0]
    if zfade:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs[0])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.interpolation_type = "SMOOTHSTEP"
        mr.inputs["From Min"].default_value = zfade[0]
        mr.inputs["From Max"].default_value = zfade[1]
        mr.inputs["To Min"].default_value = 1.0
        mr.inputs["To Max"].default_value = 0.0
        nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
        mu = nt.nodes.new("ShaderNodeMath")
        mu.operation = "MULTIPLY"
        nt.links.new(val, mu.inputs[0])
        nt.links.new(mr.outputs[0], mu.inputs[1])
        val = mu.outputs[0]
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = peak
    nt.links.new(val, mul.inputs[0])
    nt.links.new(mul.outputs[0], b.inputs["Alpha"])
    K._blend(m)
    return m


def spot_glow(name, color, radius, loc=(0, 0, 0.012), peak=0.8, strength=1.5, power=1.6, parent=None):
    """Zeminde yumuşak ışık lekesi (ısınan toprak, iniş bölgesi, vurgu): merkezden kenara sönen ışıyan disk."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0, 0, 0, 1)
    b.inputs["Emission Color"].default_value = (*color, 1)
    b.inputs["Emission Strength"].default_value = strength
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ln = nt.nodes.new("ShaderNodeVectorMath")
    ln.operation = "LENGTH"
    nt.links.new(tc.outputs["Object"], ln.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.interpolation_type = "SMOOTHSTEP"
    mr.inputs["From Min"].default_value = 0.0
    mr.inputs["From Max"].default_value = 1.0
    mr.inputs["To Min"].default_value = 1.0
    mr.inputs["To Max"].default_value = 0.0
    nt.links.new(ln.outputs["Value"], mr.inputs["Value"])
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = power
    nt.links.new(mr.outputs[0], pw.inputs[0])
    mu = nt.nodes.new("ShaderNodeMath")
    mu.operation = "MULTIPLY"
    mu.inputs[1].default_value = peak
    nt.links.new(pw.outputs[0], mu.inputs[0])
    nt.links.new(mu.outputs[0], b.inputs["Alpha"])
    K._blend(m)
    o = K.prim(bpy.ops.mesh.primitive_circle_add, m, smooth=False, parent=parent, vertices=64, radius=1.0,
               fill_type="NGON", location=loc)
    o.scale = (radius, radius, 1)
    o.visible_shadow = False
    return o


# ---------------------------------------------------------------- basit gövdeler
def mesh_obj(name, verts, faces, material=None, smooth=False, parent=None, recalc=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    if recalc:                      # yüz sırası karışık verildiyse normalleri dışa çevir
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    o = K.link(bpy.data.objects.new(name, me), parent)
    if material:
        me.materials.append(material)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return o


def cyl(material, a, b, r, r2=None, verts=32, parent=None, cap=True):
    """a'dan b'ye silindir (r2 verilirse konik): boru, direk, tekerlek, namlu."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = K.prim(bpy.ops.mesh.primitive_cone_add, material, parent=parent, vertices=verts, radius1=r,
               radius2=r if r2 is None else r2, depth=d.length, location=(a + b) / 2,
               rotation=d.to_track_quat("Z", "Y").to_euler(), end_fill_type="NGON" if cap else "NOTHING")
    return o


def rbox(material, loc, size, bevel=0.06, parent=None, rot=(0, 0, 0), segments=3):
    """Kenarları yuvarlatılmış kutu (makine gövdesi, araba, kaide)."""
    o = K.box(material, loc, size, parent=parent, rot=rot)
    md = o.modifiers.new("pah", "BEVEL")
    md.width = bevel
    md.segments = segments
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def ring(material, loc, radius, tube=0.02, parent=None, rot=(0, 0, 0)):
    """Halka (manyetik halka, işaret çemberi, kadran çerçevesi)."""
    o = K.prim(bpy.ops.mesh.primitive_torus_add, material, parent=parent, major_radius=radius, minor_radius=tube,
               major_segments=64, minor_segments=10, location=loc, rotation=rot)
    o.visible_shadow = False
    return o


def arrow(a, b, material, r=0.035, head=3.2, grow=None, parent=None):
    """a'dan b'ye ok. grow=(kare0, kare1): ok bu aralıkta a'dan uzayarak çıkar."""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    root = K.empty("ok", a, parent)
    root.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    hl = min(L * 0.45, r * head * 2.2)
    s = K.prim(bpy.ops.mesh.primitive_cylinder_add, material, parent=root, vertices=16, radius=r, depth=L - hl,
               location=(0, 0, (L - hl) / 2))
    h = K.prim(bpy.ops.mesh.primitive_cone_add, material, parent=root, vertices=24, radius1=r * head, radius2=0,
               depth=hl, location=(0, 0, L - hl / 2))
    s.visible_shadow = h.visible_shadow = False
    if grow:
        # başlamadan önce tümüyle görünmez olmalı: yalnız boyu sıfırlanırsa ok başı yassı bir disk olarak kalır
        K.move(root, [(grow[0], (0, 0, 0)), (grow[0] + 1, (1, 1, 0.04)), (grow[1], (1, 1, 1))], prop="scale")
    return root


def cutaway(obj, point, normal, cap=None, size=40.0):
    """Nesneyi bir düzlemle keser (içini göstermek için): düzlemin `normal` tarafı atılır. cap: kesit yüzünün malzemesi.
    Dönen kesici nesneyi hareket ettirirsen kesit ilerler (örn. K.move(kesici, …))."""
    n = Vector(normal).normalized()
    bpy.ops.mesh.primitive_cube_add(size=size, location=Vector(point) + n * size / 2,
                                    rotation=n.to_track_quat("Z", "Y").to_euler())
    cut = bpy.context.active_object
    cut.name = "kesici"
    if cap:
        cut.data.materials.append(cap)
    cut.hide_render = True
    cut.display_type = "WIRE"
    md = obj.modifiers.new("kesit", "BOOLEAN")
    md.operation = "DIFFERENCE"
    md.object = cut
    md.solver = "EXACT"
    try:
        md.material_mode = "TRANSFER"
    except Exception:
        pass
    return cut


# ---------------------------------------------------------------- kare başına hareket + parçacık akışı
def _tick(scene, depsgraph=None):
    t = (scene.frame_current - 1) / scene.render.fps
    for fn in _ticks:
        fn(t, scene.frame_current)
    for f in _flows:
        _flow_update(f, t)


def on_frame(fn):
    """fn(t_saniye, kare) her kare değişiminde çağrılır: anahtar kare yazmadan Python'la hareket (sarmal uçuş,
    titreyen ibre). Başsız render'da da çalışır. Hemen bir kez de çağrılır."""
    _ticks.append(fn)
    sc = bpy.context.scene
    fn((sc.frame_current - 1) / sc.render.fps, sc.frame_current)
    return fn


_OCT = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))
_OCT_F = ((0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5))


def flow(path, n=60, size=0.03, material=None, speed=0.25, spread=0.0, seed=1, fade=0.12, even=True, name="akis"):
    """Bir yol boyunca akan parçacık noktaları (boruda gaz, kanat çevresinde hava, yükselen sıcak hava).
    path(u, i, t) -> (x, y, z): u 0..1 yol üzerindeki konum, i parçacık sırası (şerit seçmek için), t saniye.
    speed: saniyede kaç tam tur (0,25 = yol 4 saniyede geçilir). spread: yolun çevresinde rastgele saçılma.
    fade: yolun başında ve sonunda küçülerek belirme/kaybolma oranı. Hepsi TEK ağdır; köşeler her karede güncellenir."""
    rnd = random.Random(seed)
    verts, faces = [], []
    for k in range(n):
        verts += [(0, 0, 0)] * 6
        faces += [tuple(k * 6 + j for j in f) for f in _OCT_F]
    o = mesh_obj(name, verts, faces, material or glow("akisM", (0.5, 0.8, 1.0)))
    o.visible_shadow = False
    f = dict(obj=o, path=path, n=n, speed=speed, fade=fade,
             ph=[((k + rnd.random() * 0.8) / n if even else rnd.random()) for k in range(n)],
             off=[Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * spread for _ in range(n)],
             sz=[size * rnd.uniform(0.65, 1.3) for _ in range(n)])
    _flows.append(f)
    sc = bpy.context.scene
    _flow_update(f, (sc.frame_current - 1) / sc.render.fps)
    return o


def lanes(path, count, samples=72, radius=0.004, material=None, every=1, t=0.0):
    """flow() ile aynı yol fonksiyonunun şeritlerini soluk, ince çizgi olarak çizer (akım çizgisi). Parçacıklar
    tek başına dağınık noktalar gibi okunur; altlarındaki çizgi yönü gösterir. Yol zamana bağlıysa kullanma."""
    material = material or glow("serit", (0.35, 0.55, 0.9), 0.5)
    out = []
    for i in range(0, count, every):
        pts = [tuple(path(k / (samples - 1), i, t)) for k in range(samples)]
        out.append(K.polyline("serit", pts, radius, material))
    return out


def _flow_update(f, t):
    co = []
    fade = f["fade"]
    for k in range(f["n"]):
        u = (f["ph"][k] + f["speed"] * t) % 1.0
        p = Vector(f["path"](u, k, t)) + f["off"][k]
        s = f["sz"][k]
        if fade:
            s *= max(0.0, min(1.0, u / fade, (1 - u) / fade))
        for d in _OCT:
            co += (p.x + d[0] * s, p.y + d[1] * s, p.z + d[2] * s)
    me = f["obj"].data
    me.vertices.foreach_set("co", co)
    me.update()


# ---------------------------------------------------------------- etiket
def _rrect(name, w, h, r, material, z=0.0, parent=None, seg=6):
    r = min(r, w / 2, h / 2)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = rad(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    o = mesh_obj(name, pts, [tuple(range(len(pts)))], material, parent=parent)
    o.visible_shadow = False
    return K.label(o)


def _serif_text(body, loc, size, material, parent, align="CENTER"):
    t = K.text(body, loc, size, material, align=align, rot=(0, 0, 0), parent=parent)
    t.data.font = _serif
    t.data.align_y = "CENTER"
    return t


def tag(cam_, body, anchor, offset=(0.9, 0.0, 0.9), sub=None, size=0.021, parent=None, appear=None, dot=True,
        accent=(0.55, 0.68, 0.95), lead=True):
    """Küçük etiket kutusu: koyu, köşeleri yuvarlak, ince kenarlıklı kutu + serif yazı + nesneye giden ince çizgi.
    anchor: işaret edilen nokta (parent verilirse onun yerel uzayında), offset: kutunun anchor'a göre yeri (dünya
    birimi). size: yazı yüksekliği, kare yüksekliğinin oranı (0,0165 ≈ 1920'de 32 px). sub: altına ikinci, küçük satır.
    appear: bu karede anchor'dan büyüyerek belirir. Kutu her karede kameraya döner; çizgi kurulduğu andaki kameraya
    göre kutunun yakın kenarına bağlanır (küçük kamera hareketlerinde yeter)."""
    anchor, offset = Vector(anchor), Vector(offset)
    root = K.empty("etiket", anchor, parent)
    bpy.context.view_layer.update()
    cm = cam_.matrix_world
    R = cm.to_3x3()
    right, up, fwd = R @ Vector((1, 0, 0)), R @ Vector((0, 1, 0)), R @ Vector((0, 0, -1))
    wa = root.matrix_world.translation
    depth = max(0.5, (wa + offset - cm.translation).dot(fwd))
    ts = size * depth * cam_.data.sensor_width / cam_.data.lens
    inv = root.matrix_world.to_3x3().inverted()       # üst nesne dönükse: dünya yönlerini kökün yerel uzayına çevir
    loc = lambda v: inv @ v  # noqa: E731
    board = K.empty("etiket-k", loc(offset), root)
    con = board.constraints.new("COPY_ROTATION")
    con.target = cam_
    tm = K.mat("etiketY", (1, 1, 1), emit=1.0)
    t1 = _serif_text(body, (0, 0.55 * ts if sub else 0, 0), ts, tm, board)
    ws = [t1]
    if sub:
        ws.append(_serif_text(sub, (0, -0.74 * ts, 0), ts * 0.74, K.mat("etiketY2", (0.70, 0.79, 0.93), emit=1.0), board))
    bpy.context.view_layer.update()
    w = max(o.dimensions.x for o in ws) + 1.5 * ts
    h = (3.15 if sub else 1.95) * ts
    bd = 0.07 * ts
    _rrect("etiket-ic", w, h, 0.42 * ts, K.mat("etiketZ", (0.022, 0.030, 0.052), emit=1.0), z=-0.03 * ts, parent=board)
    edge = K.mat(f"etiketC{accent}", accent, emit=1.0)
    _rrect("etiket-kenar", w + 2 * bd, h + 2 * bd, 0.42 * ts + bd, edge, z=-0.06 * ts, parent=board)
    if lead:
        ox, oy = offset.dot(right), offset.dot(up)
        if abs(oy) * w >= abs(ox) * h:
            end = offset - up * math.copysign(h / 2 + bd, oy)
        else:
            end = offset - right * math.copysign(w / 2 + bd, ox)
        if end.length > 0.05 * ts:
            K.label(K.polyline("etiket-cizgi", [(0, 0, 0), tuple(loc(end))], 0.035 * ts, edge, parent=root))
    if dot:
        d = K.ball(edge, (0, 0, 0), 0.16 * ts, root)
        d.visible_shadow = False
        K.label(d)
    if appear:
        K.move(root, [(max(1, appear - 1), (0.0001,) * 3), (appear + 5, (1, 1, 1))], prop="scale")
    return root


def note(cam_, body, y=-0.445, size=0.0095, color=(0.62, 0.66, 0.74)):
    """Karenin en altındaki küçük künye / uyarı yazısı ("ölçekli değildir", fotoğraf künyesi)."""
    return K.hud(cam_, body, 0, y, size, K.mat(f"not{color}", color, emit=1.0), spacing=1.25)


# ---------------------------------------------------------------- karşılaştırma dizilimleri
def columns(heights, materials, width=0.9, gap=0.6, origin=(0, 0, 0), grow=None):
    """Yan yana, farklı yükseklikte sütunlar. grow=(kare0, kare1): tabandan yükselerek çıkar.
    Dönen: [{"obj", "top": (x, y, z)}] (etiketi tepeye bağlamak için)."""
    n = len(heights)
    out = []
    x0 = origin[0] - (n - 1) * (width + gap) / 2
    for i, (h, m) in enumerate(zip(heights, materials)):
        me = bpy.data.meshes.new("sutun")
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.5, radius2=0.5, depth=1.0,
                              matrix=Matrix.Translation((0, 0, 0.5)))
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = len(p.vertices) == 4
        me.materials.append(m)
        o = K.link(bpy.data.objects.new("sutun", me))
        x = x0 + i * (width + gap)
        o.location = (x, origin[1], origin[2])
        o.scale = (width, width, h)
        if grow:
            K.move(o, [(grow[0], (width, width, 0.001)), (grow[1], (width, width, h))], prop="scale")
        out.append({"obj": o, "top": (x, origin[1], origin[2] + h)})
    return out


def tracks(lengths, lane=0.5, gap=0.5, origin=(0, 0, 0), rail=None, edge=None, tick=None):
    """Derinliğe (+Y) uzanan paralel pistler: iki nesneyi yarıştırmak ya da mesafe karşılaştırmak için.
    lengths: her pistin uzunluğu. tick: bu aralıkla enine işaret çizgisi. Dönen: [{"start", "end", "x"}]."""
    rail = rail or glossy("pist", (0.03, 0.04, 0.06), rough=0.3)
    edge = edge or glow("pistK", (0.35, 0.6, 1.0), 1.2)
    n = len(lengths)
    out = []
    x0 = origin[0] - (n - 1) * (lane + gap) / 2
    for i, L in enumerate(lengths):
        x = x0 + i * (lane + gap)
        K.box(rail, (x, origin[1] + L / 2, origin[2] + 0.02), (lane, L, 0.04))
        for sx in (-1, 1):
            K.box(edge, (x + sx * lane / 2, origin[1] + L / 2, origin[2] + 0.045), (0.018, L, 0.012), shadow=False)
        K.box(edge, (x, origin[1] + L, origin[2] + 0.05), (lane + 0.12, 0.05, 0.03), shadow=False)
        if tick:
            y = tick
            while y < L - 1e-6:
                K.box(edge, (x, origin[1] + y, origin[2] + 0.045), (lane * 0.5, 0.014, 0.01), shadow=False)
                y += tick
        out.append({"x": x, "start": (x, origin[1], origin[2] + 0.04), "end": (x, origin[1] + L, origin[2] + 0.04)})
    return out


def barrels(n, cols=4, origin=(0, 0, 0), r=0.26, h=0.72, gap=0.1, material=None, band=None):
    """Izgara halinde varil grubu ("şu kadar yakıt" karşılaştırması). Dönen: nesne listesi."""
    material = material or glossy("varil", (0.05, 0.10, 0.18), rough=0.3, metal=0.6)
    band = band or glow("varilB", (1.0, 0.55, 0.12), 1.2)
    step = 2 * r + gap
    rows = math.ceil(n / cols)
    out = []
    for k in range(n):
        cx, cy = k % cols, k // cols
        x = origin[0] + (cx - (min(n, cols) - 1) / 2) * step
        y = origin[1] + (cy - (rows - 1) / 2) * step
        b = cyl(material, (x, y, origin[2]), (x, y, origin[2] + h), r, verts=28)
        for z in (0.28, 0.72):
            ring(band, (x, y, origin[2] + h * z), r * 1.01, tube=0.012)
        out.append(b)
    return out


def gauge(center, radius=1.0, a0=-150.0, a1=150.0, ticks=11, major=1, face=None, mark=None, needle=None, zero=0.0):
    """Kadranlı gösterge (XZ düzleminde, -Y'ye bakar). Açılar derece; 0 = `zero` yönü (0: yukarı, -90: sol),
    + saat yönü. Dönen: {"root", "needle", "set"}; set(deger01, kare) ibreyi a0..a1 arasında anahtarlar,
    "angle"(deger01) açıyı (radyan) verir (on_frame ile sürmek için)."""
    face = face or glossy("kadran", (0.015, 0.02, 0.035), rough=0.35)
    mark = mark or glow("kadranC", (0.75, 0.86, 1.0), 1.0)
    needle = needle or glow("ibre", (1.0, 0.45, 0.10), 1.6)
    root = K.empty("gosterge", center)
    cyl(face, (0, 0.06, 0), (0, 0, 0), radius * 1.08, verts=64, parent=root)
    ring(glossy("kadranK", (0.25, 0.28, 0.34), rough=0.25, metal=0.9), (0, 0, 0), radius * 1.08, tube=radius * 0.045,
         parent=root, rot=(K.R90, 0, 0))
    for i in range(ticks):
        a = rad(zero + a0 + (a1 - a0) * i / (ticks - 1))
        big = i % major == 0
        L = radius * (0.14 if big else 0.07)
        rr = radius * 0.92 - L / 2
        K.box(mark, (rr * math.sin(a), -0.012, rr * math.cos(a)), (radius * (0.028 if big else 0.016), 0.01, L),
              parent=root, rot=(0, a, 0), shadow=False)
    piv = K.empty("ibre", (0, -0.03, 0), root)
    K.box(needle, (0, 0, radius * 0.36), (radius * 0.045, 0.012, radius * 0.86), parent=piv, shadow=False)
    cyl(glossy("gobek", (0.3, 0.32, 0.36), rough=0.2, metal=1.0), (0, 0.0, 0), (0, -0.05, 0), radius * 0.09, parent=piv)

    def angle(v):
        return rad(zero + a0 + (a1 - a0) * v)

    def set_(v, frame):
        piv.rotation_euler = (0, angle(v), 0)
        piv.keyframe_insert("rotation_euler", frame=frame)

    return {"root": root, "needle": piv, "set": set_, "angle": angle, "radius": radius}


# ---------------------------------------------------------------- küre ve harita
# Kıta ana hatları: elle çizilmiş, kaba (boylam, enlem) çokgenleri. Şematiktir; gerçek kıyı verisi değildir, dış veri
# kullanılmaz. Bir yeri "dünyada şurada" diye göstermeye yeter; kıyı ayrıntısı gereken iş için uygun değildir.
LAND = [
    [(-80, 9), (-72, 12), (-62, 10.5), (-52, 5), (-50, 0), (-35, -5.5), (-35, -9), (-39, -15), (-41, -22), (-48, -26),
     (-53, -33.5), (-57, -38), (-62, -39), (-65, -45), (-68, -52), (-72, -53), (-75, -47), (-73, -38), (-71, -30),
     (-70, -18), (-76, -14), (-81, -5), (-80, 1), (-77, 4), (-78, 8)],                                   # G. Amerika
    [(-168, 66), (-156, 71), (-128, 70), (-110, 68), (-95, 72), (-82, 70), (-78, 62), (-65, 60), (-56, 52), (-66, 45),
     (-70, 42), (-76, 35), (-81, 31), (-80, 25), (-83, 29), (-90, 29.5), (-97, 26), (-97, 20), (-91, 18.5), (-87, 21),
     (-87, 16), (-83, 10), (-78, 8), (-80, 9), (-86, 12), (-92, 15), (-105, 20), (-110, 24), (-114, 31), (-117, 33),
     (-124, 40), (-124, 48), (-135, 58), (-150, 60), (-162, 55), (-165, 62)],                           # K. Amerika
    [(-55, 60), (-43, 60), (-22, 70), (-20, 80), (-40, 83), (-60, 82), (-70, 77), (-55, 70)],           # Grönland
    [(-17, 15), (-16, 22), (-10, 29), (-6, 35.5), (10, 37), (11, 33), (20, 31), (32, 31), (35, 24), (43, 12), (51, 12),
     (48, 5), (40, -3), (40, -15), (35, -24), (32, -29), (26, -34), (19, -34.5), (15, -27), (12, -17), (13, -8),
     (9, -1), (9, 4), (-4, 5), (-8, 4.5), (-13, 8), (-17, 12)],                                         # Afrika
    [(-9, 37), (-9, 43), (-1, 44), (-4, 48), (2, 51), (8, 54), (8, 57), (5, 59), (6, 62), (14, 68), (25, 71), (40, 67),
     (60, 69), (70, 73), (105, 77), (140, 73), (170, 70), (180, 66), (170, 60), (160, 53), (155, 58), (142, 54),
     (135, 44), (128, 38), (122, 31), (120, 23), (110, 20), (108, 12), (104, 9), (100, 13), (98, 8), (103, 1.5),
     (98, 16), (92, 22), (87, 21), (80, 15), (78, 8), (73, 18), (67, 25), (57, 25.5), (52, 16.5), (44, 12.5), (35, 28),
     (36, 36), (28, 36.5), (26, 40), (23, 37), (19, 42), (13, 45.5), (16, 38), (12, 44), (3, 43), (0, 39), (-5, 36)],  # Avrasya
    [(114, -22), (122, -17), (130, -12), (137, -12), (142, -11), (146, -19), (153, -26), (150, -37), (143, -39),
     (135, -35), (125, -33), (115, -34)],                                                               # Avustralya
]


def is_land(lon, lat):
    if lat < -70:
        return True
    for poly in LAND:
        inside = False
        j = len(poly) - 1
        for i in range(len(poly)):
            (xi, yi), (xj, yj) = poly[i], poly[j]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
        if inside:
            return True
    return False


def _dots(name, pts, r, material, parent=None, seg=6):
    """pts: [(merkez, normal)]; her biri normaline dik küçük altıgen. Tek ağ."""
    verts, faces = [], []
    for c, n in pts:
        c, n = Vector(c), Vector(n).normalized()
        a = n.orthogonal().normalized()
        b = n.cross(a)
        k = len(verts)
        for i in range(seg):
            t = 2 * math.pi * i / seg
            verts.append(c + (a * math.cos(t) + b * math.sin(t)) * r)
        faces.append(tuple(range(k, k + seg)))
    o = mesh_obj(name, verts, faces, material, parent=parent)
    o.visible_shadow = False
    return o


def globe(center=(0, 0, 2.2), radius=1.6, step=2.6, sea=None, land=None, face=None, atmosphere=True):
    """Noktalı dünya küresi: koyu parlak küre + karalar ışıyan noktalar (LAND çokgenlerinden, şematik).
    face=(enlem, boylam): bu nokta kameraya (-Y) bakar. Dönen: {"tilt", "spin", "ll", "face"}:
    ll(enlem, boylam, h=0) kürenin yerel uzayında nokta verir (işaret ve etiket için; parent=g["spin"]);
    face(enlem, boylam, kare=None) küreyi çevirir ve istenirse anahtarlar."""
    sea = sea or glossy("deniz", (0.006, 0.014, 0.035), rough=0.28)
    land = land or glow("kara", (0.22, 0.62, 0.80), 1.0)
    tilt = K.empty("kure-egim", center)
    spin = K.empty("kure-don", (0, 0, 0), tilt)
    K.prim(bpy.ops.mesh.primitive_uv_sphere_add, sea, parent=spin, segments=72, ring_count=36, radius=radius)

    def ll(lat, lon, h=0.0):
        la, lo = rad(lat), rad(lon)
        return Vector((math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la))) * (radius * (1 + h))

    pts = []
    lat = -88.0
    while lat <= 88:
        dl = step / max(0.08, math.cos(rad(lat)))
        nlon = max(1, int(360 / dl))
        for i in range(nlon):
            lon = -180 + 360 * (i + 0.5 * (int(lat / step) % 2)) / nlon
            if is_land(lon, lat):
                p = ll(lat, lon, 0.004)
                pts.append((p, p))
        lat += step
    _dots("karalar", pts, radius * rad(step) * 0.33, land, parent=spin)
    if atmosphere:
        a = K.prim(bpy.ops.mesh.primitive_uv_sphere_add, soft_glow("atmosfer", (0.25, 0.5, 1.0), peak=0.30, power=3.5,
                                                                   strength=1.2, edge=True), parent=tilt, segments=48,
                   ring_count=24, radius=radius * 1.035)
        a.visible_shadow = False

    def face_(lat, lon, frame=None):
        tilt.rotation_euler = (rad(lat), 0, 0)
        spin.rotation_euler = (0, 0, rad(-90 - lon))
        if frame is not None:
            tilt.keyframe_insert("rotation_euler", frame=frame)
            spin.keyframe_insert("rotation_euler", frame=frame)

    if face:
        face_(*face)
    return {"tilt": tilt, "spin": spin, "ll": ll, "face": face_, "radius": radius}


def dot_map(center=(0, 0, 2.0), width=4.0, step=3.0, land=None, lon=(-180, 180), lat=(-60, 80)):
    """Düz noktalı harita (XZ düzleminde, -Y'ye bakar; eşit aralıklı projeksiyon, şematik).
    Dönen: {"root", "xy"}; xy(enlem, boylam) haritanın yerel uzayında nokta verir."""
    land = land or glow("kara", (0.22, 0.62, 0.80), 1.0)
    root = K.empty("harita", center)
    k = width / (lon[1] - lon[0])

    def xy(la, lo):
        return Vector(((lo - (lon[0] + lon[1]) / 2) * k, 0, (la - (lat[0] + lat[1]) / 2) * k))

    pts = []
    la = lat[0]
    while la <= lat[1]:
        lo = lon[0]
        while lo < lon[1]:
            if is_land(lo, la):
                pts.append((xy(la, lo), (0, -1, 0)))
            lo += step
        la += step
    _dots("harita-kara", pts, step * k * 0.36, land, parent=root)
    return {"root": root, "xy": xy}


def marker(material, loc, r=0.05, parent=None, pulse=None):
    """Işıyan işaret noktası + çevresinde halka. pulse=(kare0, kare1, periyot): halka büyüyüp küçülerek atar."""
    root = K.empty("isaret", loc, parent)
    b = K.ball(material, (0, 0, 0), r, root)
    b.visible_shadow = False
    n = Vector(loc).normalized() if Vector(loc).length > 1e-6 else Vector((0, -1, 0))
    rg = ring(material, (0, 0, 0), r * 2.4, tube=r * 0.22, parent=root, rot=n.to_track_quat("Z", "Y").to_euler())
    if pulse:
        f0, f1, per = pulse
        f = f0
        while f <= f1:
            K.move(rg, [(f, (1, 1, 1)), (f + per // 2, (1.9, 1.9, 1.9))], prop="scale")
            f += per
    return root


# ---------------------------------------------------------------- çerçeveli fotoğraf
def framed_photo(image_path, loc=(0, 0, 1.6), width=1.4, pedestal=1.0, frame=None, stand=None):
    """Kaide üstünde çerçeveli fotoğraf (bir kişi önemliyse). Fotoğraf lisanslı olmalı; künyesini `note()` ile karede
    göster ve credits.md'ye yaz. loc: fotoğrafın merkezi. Dönen: {"root", "photo"}."""
    img = bpy.data.images.load(image_path)
    asp = img.size[1] / max(1, img.size[0])
    m = bpy.data.materials.new("foto")
    m.use_nodes = True
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    b = nt.nodes["Principled BSDF"]
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 0.85
    b.inputs["Roughness"].default_value = 0.5
    root = K.empty("foto", loc)
    h = width * asp
    p = K.prim(bpy.ops.mesh.primitive_plane_add, m, smooth=False, parent=root, size=1, location=(0, -0.031, 0),
               rotation=(K.R90, 0, 0))
    p.scale = (width, h, 1)
    frame = frame or glossy("cerceve", (0.02, 0.025, 0.035), rough=0.3, metal=0.8)
    K.box(frame, (0, 0, 0), (width + 0.12, 0.06, h + 0.12), parent=root)
    if pedestal:
        stand = stand or glossy("kaide", (0.03, 0.035, 0.05), rough=0.3)
        top = -h / 2 - 0.06
        rbox(stand, (0, 0.05, top - (loc[2] + top) / 2), (width * 0.7, 0.5, loc[2] + top), bevel=0.03, parent=root)
    return {"root": root, "photo": p}
