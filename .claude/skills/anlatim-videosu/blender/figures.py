"""MPFB2 (MakeHuman) gövdesinden giydirilmiş, pozlanmış insan figürleri: dalgıç, formalı çocuk, taşınan çocuk,
kurtarıcı. Başsız çalışır; MPFB eklentisi kurulu olmalı (modül: bl_ext.user_default.mpfb). İnternetten varlık indirmez:
giysi, gövde ağının yüzlerini boyayarak ve kopyalayıp şişirerek (kabuk) yapılır; ekipman basit ağlardır.

Figür çerçevesi (ayakta): Z yukarı, yüz -Y'ye bakar, +X figürün solu. Her kurucu {"root", "arm", "mesh", …} döndürür;
sahnede "root" taşınır/döndürülür.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import kit as K

_svc = None
rad = math.radians


def _mpfb():
    global _svc
    if _svc is None:
        bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
        from bl_ext.user_default.mpfb.services.humanservice import HumanService
        from bl_ext.user_default.mpfb.services.targetservice import TargetService
        _svc = (HumanService, TargetService)
    return _svc


def forget():
    """K.reset() sahneyi sıfırlayınca eklenti de kapanır; yeniden açılsın diye çağır."""
    global _svc
    _svc = None
    K._mats.clear()


def _region(bone):
    n = bone.split(".")[0]
    for pre, reg in (("upperarm", "uarm"), ("lowerarm", "larm"), ("wrist", "hand"), ("finger", "hand"),
                     ("metacarpal", "hand"), ("upperleg", "thigh"), ("lowerleg", "shin"), ("foot", "foot"),
                     ("toe", "foot"), ("pelvis", "hip"), ("root", "hip"), ("spine", "torso"), ("breast", "torso"),
                     ("clavicle", "torso"), ("shoulder", "torso"), ("neck", "neck")):
        if n.startswith(pre):
            return reg
    return "head"


def _over(obj, others=()):
    return bpy.context.temp_override(active_object=obj, object=obj, selected_objects=[obj, *others],
                                     selected_editable_objects=[obj, *others])


def body(name="insan", age=0.5, height=0.5, weight=0.5, muscle=0.5, gender=1.0, hair=True, lod=1.0):
    """Çıplak MPFB gövdesi + iskelet. age: 0.19≈10 yaş, 0.3≈14, 0.5≈25. Yardımcı geometri silinir (saç ve göz kalır).
    Dönen sözlükte 'lm' (yer işaretleri) iskelet uzayındadır. Gövde MUTLAKA paint() ile giydirilmelidir."""
    HS, TS = _mpfb()
    d = TS.get_default_macro_info_dict()
    d.update(age=age, height=height, weight=weight, muscle=muscle, gender=gender)
    d["race"] = {"asian": 1.0, "caucasian": 0.0, "african": 0.0}
    h = HS.create_human(scale=0.1, macro_detail_dict=d)
    TS.bake_targets(h)
    HS.add_builtin_rig(h, "default_no_toes")
    arm = h.parent
    h.name, arm.name = name, name + "-iskelet"
    for m in list(h.modifiers):
        if m.type == "MASK":
            h.modifiers.remove(m)
    gi = {g.name: g.index for g in h.vertex_groups}
    keep = {gi["body"]} | ({gi["helper-hair"]} if hair else set()) | {gi["helper-l-eye"], gi["helper-r-eye"]}
    extra = {gi["helper-hair"]: 1, gi["helper-l-eye"]: 2, gi["helper-r-eye"]: 2}
    head_g = gi["head"]
    bones = {gi[b.name] for b in arm.data.bones if b.name in gi}
    B = arm.data.bones
    E0 = (B["eye.L"].head_local + B["eye.R"].head_local) / 2
    s0 = max(v.co.z for v in h.data.vertices) / 1.66
    bm = bmesh.new()
    bm.from_mesh(h.data)
    dl = bm.verts.layers.deform.verify()
    tag = bm.verts.layers.int.new("etiket")          # 1 saç, 2 göz
    dead = []
    for v in bm.verts:
        w = v[dl]
        ks = [k for k in w.keys() if k in keep and w[k] > 0.5]
        if not ks:
            dead.append(v)
            continue
        if gi["helper-hair"] in ks and not (v.co.z > E0.z + 0.05 * s0 or (v.co.y > E0.y + 0.10 * s0 and v.co.z > E0.z - 0.06 * s0)):
            dead.append(v)                               # yardımcı saç uzun bir peruk; kısa kesim bırak
            continue
        for k in ks:
            if k in extra:
                v[tag] = extra[k]
                for b in [b for b in w.keys() if b in bones]:
                    del w[b]
                w[head_g] = 1.0
    bmesh.ops.delete(bm, geom=dead, context="VERTS")
    bm.to_mesh(h.data)
    bm.free()
    for p in h.data.polygons:
        p.use_smooth = True
    H = max(v.co.z for v in h.data.vertices)
    lm = {"H": H, "s": H / 1.66, "eye": (B["eye.L"].head_local + B["eye.R"].head_local) / 2,
          "hip": B["upperleg01.L"].head_local.z, "knee": B["lowerleg01.L"].head_local.z,
          "waist": B["spine05"].tail_local.z, "ankle": B["foot.L"].head_local.z,
          "chest": B["spine02"].head_local.copy(), "shoulder": B["upperarm01.L"].head_local.z}
    root = K.empty(name + "-kok")
    arm.parent = root
    return {"root": root, "arm": arm, "mesh": h, "lm": lm, "name": name, "lod": lod}


def paint(fig, rule, mats):
    """Gövdeyi giydirir. rule(bölge, kemik, co, lm, etiket) -> 'anahtar' ya da ('anahtar', kabuk_kalınlığı).
    mats: anahtar -> malzeme. Kabuk: yüz kopyalanıp normal yönünde şişirilir (bol şort/forma); alttaki yüz de aynı
    malzemeyi alır, böylece hiçbir pozda ten sızmaz."""
    h, arm, lm = fig["mesh"], fig["arm"], fig["lm"]
    names = {g.index: g.name for g in h.vertex_groups}
    bone_names = {b.name for b in arm.data.bones}
    keys = list(mats)
    for k in keys:
        h.data.materials.append(mats[k])
    bm = bmesh.new()
    bm.from_mesh(h.data)
    dl = bm.verts.layers.deform.verify()
    tag = bm.verts.layers.int.get("etiket")
    dom = {}
    for v in bm.verts:
        best, bw = "spine03", 0.0
        for g, w in v[dl].items():
            n = names.get(g)
            if n in bone_names and w > bw:
                best, bw = n, w
        dom[v.index] = best
    shells = {}
    for f in bm.faces:
        tags = [v[tag] for v in f.verts] if tag else [0]
        t = tags[0] if min(tags) == max(tags) else 0
        counts = {}
        for v in f.verts:
            counts[dom[v.index]] = counts.get(dom[v.index], 0) + 1
        bone = max(counts, key=counts.get)
        r = rule(_region(bone), bone, f.calc_center_median(), lm, t)
        if isinstance(r, tuple):
            shells.setdefault(r, []).append(f)
            r = r[0]
        f.material_index = keys.index(r)
    for (key, off), faces in shells.items():
        new = bmesh.ops.duplicate(bm, geom=faces)["geom"]
        nv = [e for e in new if isinstance(e, bmesh.types.BMVert)]
        bm.normal_update()
        for v in nv:                                     # sınırda kalınlık sıfır: etek/kol ağzı püskül püskül olmaz
            edge = any(e.is_boundary for e in v.link_edges)
            near = edge or any(any(e2.is_boundary for e2 in e.other_vert(v).link_edges) for e in v.link_edges)
            v.co += v.normal * off * (0.0 if edge else (0.55 if near else 1.0))
    bm.to_mesh(h.data)
    bm.free()
    if fig.get("lod", 1.0) < 1.0:                        # boyadıktan sonra azalt: giysi sınırları düzgün kalır
        dm = h.modifiers.new("Azalt", "DECIMATE")
        dm.ratio = fig["lod"]
        with _over(h):
            bpy.ops.object.modifier_move_to_index(modifier="Azalt", index=0)
            bpy.ops.object.modifier_apply(modifier="Azalt")
    return fig


def shoes(fig, mat):
    """Ayağı örten basit ayakkabı/bot (çıplak ayak parmakları görünmesin)."""
    s = fig["lm"]["s"]
    for side in (".L", ".R"):
        b = fig["arm"].data.bones["foot" + side]
        a, t = b.head_local, b.tail_local
        d = (t - a).normalized()
        c = a + (t - a) * 0.62 + Vector((0, 0, -0.012 * s))
        o = K.ball(mat, c, 1, None, (0.055 * s, 0.135 * s, 0.052 * s))
        o.rotation_euler = Vector((0, 1, 0)).rotation_difference(Vector((d.x, d.y, d.z * 0.5)).normalized()).to_euler()
        with _over(o):
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        attach(fig, o, "foot" + side)


# ---------------------------------------------------------------- poz
def aim(arm, bone, d):
    """Kemiği, iskelet uzayındaki d yönüne çevirir (en kısa dönüş). Sıra önemli: önce üst kemik."""
    pb = arm.pose.bones[bone]
    bpy.context.view_layer.update()
    M = pb.matrix.copy()
    cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    R = cur.rotation_difference(Vector(d).normalized()).to_matrix().to_4x4()
    T = Matrix.Translation(M.translation)
    pb.matrix = T @ R @ T.inverted() @ M
    bpy.context.view_layer.update()


def pose(fig, dirs):
    """dirs = [(kemik, (x, y, z)), …]; '.L' ile biten ad verilip mirror=True denirse sağ taraf da x'i ters alır.
    Poz sırasında ağ değerlendirilmesin diye iskelet değiştiricisi geçici kapatılır."""
    h, arm = fig["mesh"], fig["arm"]
    mods = [m for m in h.modifiers if m.type == "ARMATURE"]
    for m in mods:
        m.show_viewport = False
    for item in dirs:
        bone, d = item[0], item[1]
        if bone.endswith(".LR"):
            aim(arm, bone[:-3] + ".L", d)
            aim(arm, bone[:-3] + ".R", (-d[0], d[1], d[2]))
        else:
            aim(arm, bone, d)
    for m in mods:
        m.show_viewport = True
    return fig


def bone_point(fig, bone, tail=True):
    """Pozlanmış kemiğin ucu, dünya uzayında (fener/aksesuar yerleştirmek için)."""
    bpy.context.view_layer.update()
    pb = fig["arm"].pose.bones[bone]
    return fig["arm"].matrix_world @ (pb.tail if tail else pb.head)


def kick(fig, f0, f1, period=30, amp=11, knee=13, step=2):
    """Palet vuruşu: uyluk ve baldır karşılıklı sallanır (iki uç poz arasında küresel ara değer)."""
    arm = fig["arm"]
    mods = [m for m in fig["mesh"].modifiers if m.type == "ARMATURE"]
    for m in mods:
        m.show_viewport = False
    ext = {}
    for side in (".L", ".R"):
        for b, a in (("upperleg01" + side, amp), ("lowerleg01" + side, knee)):
            pb = arm.pose.bones[b]
            base = pb.rotation_quaternion.copy()
            bpy.context.view_layer.update()
            cur = (pb.matrix.to_3x3() @ Vector((0, 1, 0))).normalized()
            out = []
            for sgn in (-1, 1):
                aim(arm, b, Matrix.Rotation(rad(a * sgn), 3, "X") @ cur)
                out.append(pb.rotation_quaternion.copy())
                pb.rotation_quaternion = base
                pb.location = (0, 0, 0)
            if out[0].dot(out[1]) < 0:
                out[1].negate()
            ext[b] = out
    for f in range(f0, f1 + 1, step):
        for i, side in enumerate((".L", ".R")):
            ph = 2 * math.pi * f / period + i * math.pi
            for b, lag in (("upperleg01" + side, 0.0), ("lowerleg01" + side, -0.9)):
                pb = arm.pose.bones[b]
                t = 0.5 + 0.5 * math.sin(ph + lag)
                pb.rotation_quaternion = ext[b][0].slerp(ext[b][1], t)
                pb.keyframe_insert("rotation_quaternion", frame=f)
    for m in mods:
        m.show_viewport = True


def freeze(fig):
    """Pozu ağa işler, iskeleti siler: durağan figür (render'da iskelet hesabı yok)."""
    h, arm, root = fig["mesh"], fig["arm"], fig["root"]
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(h.evaluated_get(dg))
    mw = h.matrix_world.copy()
    h.modifiers.clear()
    h.data = me
    h.parent = root
    h.matrix_world = mw
    bpy.data.objects.remove(arm)
    fig["arm"] = None
    return fig


def ground(fig, z=0.0):
    """Figürün en alt noktası kök düzleminde z'ye otursun."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = fig["mesh"].evaluated_get(dg)
    inv = fig["root"].matrix_world.inverted()
    lo = min((inv @ (ev.matrix_world @ v.co)).z for i, v in enumerate(ev.data.vertices) if i % 5 == 0)
    top = fig["arm"] or fig["mesh"]
    top.location.z += z - lo
    return fig


def attach(fig, obj, bone):
    """Aksesuarı gövde ağına katar ve tek kemiğe bağlar (ağırlık 1): pozla birlikte taşınır."""
    h = fig["mesh"]
    if obj.type != "MESH":
        with _over(obj):
            bpy.ops.object.convert(target="MESH")
    obj.parent = None
    g = obj.vertex_groups.new(name=bone)
    g.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    with _over(h, [obj]):
        bpy.ops.object.join()


def _caps(mat, a, b, r):
    """a-b arası kapsül (tüp, kol bandı)."""
    e = K.empty("gecici")
    K.limb(a, b, r, mat, e)
    kids = list(e.children)
    for k in kids:
        k.parent = None
    with _over(kids[0], kids[1:]):
        bpy.ops.object.join()
    bpy.data.objects.remove(e)
    return kids[0]


# ---------------------------------------------------------------- malzemeler
def _m():
    return {
        "ten": K.mat("f-ten", (0.52, 0.34, 0.24), rough=0.65),
        "sac": K.mat("f-sac", (0.012, 0.010, 0.009), rough=0.6),
        "goz": K.mat("f-goz", (0.02, 0.015, 0.012), rough=0.3),
        "neopren": K.mat("f-neopren", (0.022, 0.025, 0.03), rough=0.55),
        "bot": K.mat("f-bot", (0.02, 0.02, 0.022), rough=0.5),
        "cam": K.mat("f-cam", (0.02, 0.07, 0.10), rough=0.12),
        "celik": K.mat("f-celik", (0.20, 0.22, 0.25), rough=0.4),
        "kask": K.mat("f-kask", (0.30, 0.30, 0.31), rough=0.5),
        "lamba": K.mat("f-lamba", (1.0, 0.95, 0.8), emit=5.0),
        "palet": K.mat("f-palet", (0.015, 0.015, 0.018), rough=0.35),
        "corap": K.mat("f-corap", (0.75, 0.75, 0.72), rough=0.8),
        "sort": K.mat("f-sort", (0.03, 0.03, 0.045), rough=0.85),
    }


# ---------------------------------------------------------------- hazır figürler
def diver(name="Dalgic", accent=(0.80, 0.42, 0.04), age=0.5, tanks=True, fins=True, helmet=True, swim=True,
          hand_light=True, lod=1.0):
    """Mağara dalgıcı: başlıklı neopren, maske, regülatör + hortum, yandan tüpler, kask + lambalar, paletler.
    swim=True: yatay yüzme pozu, kök çerçevesinde baş +X, sırt +Z (kit.diver ile aynı). Dönen: + 'lamp' (dünya konumu)."""
    fig = body(name, age=age, hair=False, lod=lod, weight=0.55, muscle=0.6)
    lm = fig["lm"]
    s, E, H = lm["s"], lm["eye"], lm["H"]
    M = _m()
    M["vurgu"] = K.mat(f"f-vurgu{accent}", accent, rough=0.55)

    def rule(reg, bone, co, lm, t):
        if t == 2:
            return "goz"
        if reg == "head" and co.y < E.y + 0.045 * s and E.z - 0.10 * s < co.z < E.z + 0.04 * s:
            return "ten"
        if bone.startswith("lowerarm02") or (reg == "shin" and co.z > lm["knee"] - 0.11 * s):
            return "vurgu"
        return "neopren"
    paint(fig, rule, M)
    add = lambda o, b: attach(fig, o, b)
    add(K.ball(M["cam"], (0, E.y - 0.022 * s, E.z + 0.003 * s), 1, None, (0.082 * s, 0.035 * s, 0.047 * s)), "head")
    add(K.box(M["bot"], (0, E.y - 0.004 * s, E.z + 0.003 * s), (0.175 * s, 0.04 * s, 0.105 * s)), "head")
    add(K.prim(bpy.ops.mesh.primitive_cylinder_add, M["bot"], vertices=16, radius=0.032 * s, depth=0.06 * s,
               location=(0, E.y - 0.03 * s, E.z - 0.092 * s), rotation=(K.R90, 0, 0)), "head")
    if helmet:
        o = K.ball(M["kask"], (0, E.y + 0.105 * s, H - 0.085 * s), 1, None, (0.105 * s, 0.125 * s, 0.085 * s))
        add(o, "head")
        for sx in (-1, 1):
            add(K.prim(bpy.ops.mesh.primitive_cylinder_add, M["bot"], vertices=12, radius=0.024 * s, depth=0.09 * s,
                       location=(sx * 0.115 * s, E.y + 0.09 * s, H - 0.07 * s)), "head")
            add(K.ball(M["lamba"], (sx * 0.115 * s, E.y + 0.09 * s, H - 0.022 * s), 0.02 * s, None), "head")
    if tanks:
        z0 = lm["hip"] - 0.16 * s
        for sx in (-1, 1):
            x = sx * 0.225 * s
            add(_caps(M["celik"], (x, 0.0, z0), (x, 0.01, z0 + 0.52 * s), 0.07 * s), "spine03")
            add(K.box(M["bot"], (x, 0.01, z0 + 0.62 * s), (0.06 * s, 0.06 * s, 0.07 * s)), "spine03")
        hose = K.polyline("hortum", [(0.0, E.y - 0.05 * s, E.z - 0.095 * s), (-0.09 * s, E.y - 0.03 * s, E.z - 0.12 * s),
                                     (-0.17 * s, -0.03 * s, lm["shoulder"] - 0.02 * s),
                                     (-0.225 * s, 0.0, z0 + 0.64 * s)], 0.011 * s, M["bot"])
        add(hose, "spine01")
    add(K.ball(M["vurgu"], (0, lm["chest"].y + 0.115 * s, lm["waist"] + 0.24 * s), 1, None,
               (0.15 * s, 0.045 * s, 0.24 * s)), "spine03")                      # sırt kanadı
    if fins:
        for side in (".L", ".R"):
            b = fig["arm"].data.bones["foot" + side]
            d = (b.tail_local - b.head_local).normalized()
            c = b.tail_local + d * 0.21 * s
            rot = Vector((0, 1, 0)).rotation_difference(d).to_euler()
            fin = K.box(M["palet"], c, (0.17 * s, 0.46 * s, 0.03 * s), rot=rot)
            for v in fin.data.vertices:                                           # uca doğru genişleyen kanat
                if v.co.y > 0:
                    v.co.x *= 1.35
                else:
                    v.co.x *= 0.6
            add(fin, "foot" + side)
    if swim:
        pose(fig, [("spine05", (0, 0.06, 1)), ("spine03", (0, 0.10, 1)), ("spine01", (0, 0.16, 1)),
                   ("neck01", (0, 0.45, 1)), ("head", (0, 0.75, 1)),
                   ("upperarm01.R", (-0.12, -0.38, 1)), ("lowerarm01.R", (0.06, -0.22, 1)), ("wrist.R", (0.03, -0.15, 1)),
                   ("upperarm01.L", (0.22, -0.60, 0.9)), ("lowerarm01.L", (-0.10, -0.40, 1)), ("wrist.L", (-0.05, -0.3, 1)),
                   ("upperleg01.LR", (0.09, -0.06, -1)), ("lowerleg01.LR", (0.02, 0.10, -1)), ("foot.LR", (0, 0.06, -1))])
        fig["arm"].matrix_basis = Matrix.Rotation(rad(-13), 4, "Y") @ Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
        c = bone_point(fig, "spine03", tail=False)                                 # gövde ortası kökte olsun
        fig["arm"].location -= fig["root"].matrix_world.inverted() @ c
    if hand_light:
        p = bone_point(fig, "wrist.R")
        fig["lamp"] = fig["root"].matrix_world.inverted() @ p
    return fig


SHIRTS = [(0.42, 0.05, 0.05), (0.06, 0.13, 0.36), (0.45, 0.28, 0.04), (0.08, 0.28, 0.14), (0.33, 0.33, 0.36),
          (0.28, 0.08, 0.28), (0.50, 0.50, 0.46)]


def _kit_rule(shell=True):
    def rule(reg, bone, co, lm, t):
        s = lm["s"]
        if t == 1:
            return "sac"
        if t == 2:
            return "goz"
        k = 1 if shell else 0
        if reg == "hip" or (reg == "thigh" and co.z > lm["knee"] + 0.42 * (lm["hip"] - lm["knee"])) or \
                (reg == "torso" and co.z < lm["waist"] - 0.03 * s):
            return ("sort", 0.011 * s * k) if shell else "sort"
        if reg == "torso" or bone.startswith(("upperarm01", "shoulder", "clavicle")):
            return ("forma", 0.017 * s * k) if shell else "forma"
        if reg == "neck" and co.z < lm["shoulder"] + 0.045 * s:
            return "forma"
        if reg == "foot":
            return "bot"
        if reg == "shin" and co.z < lm["ankle"] + 0.62 * (lm["knee"] - lm["ankle"]):
            return "corap"
        return "ten"
    return rule


def boy(name="Cocuk", shirt=SHIRTS[0], age=0.30, height=0.45, pose_name="huddle", seed=0, lod=0.4, static=True):
    """Futbol formalı çocuk (yüz ayrıntısı yok denecek kadar sade; kimse tanınmaz). pose_name: huddle | rest | lie | stand.
    Kök çerçevesinde +X'e bakar, en alt noktası z=0."""
    rnd = random.Random(seed)
    fig = body(name, age=age, height=height, lod=lod, weight=0.42, muscle=0.4)
    M = _m()
    M["forma"] = K.mat(f"f-forma{shirt}", shirt, rough=0.85)
    paint(fig, _kit_rule(), M)
    shoes(fig, M["bot"])
    j = lambda a: rnd.uniform(-a, a)
    if pose_name == "huddle":            # dizler karna çekili, kollar dizlerde
        pose(fig, [("spine05", (0, -0.25 + j(0.1), 1)), ("spine03", (j(0.05), -0.5 + j(0.1), 1)),
                   ("spine01", (0, -0.6 + j(0.15), 1)), ("neck01", (0, -0.5, 1)), ("head", (j(0.15), -0.55 + j(0.3), 1)),
                   ("upperleg01.LR", (0.16, -1, 0.80 + j(0.1))), ("lowerleg01.LR", (0.0, -0.30, -1)), ("foot.LR", (0, -1, -0.25)),
                   ("upperarm01.LR", (0.22, -1, -0.30)), ("lowerarm01.LR", (-0.45, -1, 0.35)), ("wrist.LR", (-0.6, -0.6, 0.1))])
    elif pose_name == "rest":            # bacaklar yarı uzanmış, eller yanda yerde
        pose(fig, [("spine05", (0, 0.12, 1)), ("spine03", (0, -0.15 + j(0.1), 1)), ("spine01", (0, -0.35, 1)),
                   ("neck01", (0, -0.3, 1)), ("head", (j(0.2), -0.25 + j(0.2), 1)),
                   ("upperleg01.L", (0.20, -1, 0.45)), ("lowerleg01.L", (0.05, -0.55, -1)), ("foot.L", (0, -1, -0.3)),
                   ("upperleg01.R", (-0.25, -1, 0.15)), ("lowerleg01.R", (-0.05, -1, -0.45)), ("foot.R", (0, -1, 0.2)),
                   ("upperarm01.LR", (0.35, 0.05, -1)), ("lowerarm01.LR", (0.15, -0.45, -1))])
    elif pose_name == "lie":             # sırtüstü, kollar yanda
        pose(fig, [("upperarm01.LR", (0.16, 0.0, -1)), ("lowerarm01.LR", (0.04, -0.12, -1)),
                   ("upperleg01.LR", (0.03, -0.02, -1)), ("lowerleg01.LR", (0.0, 0.03, -1))])
    else:                                # ayakta, kollar aşağıda
        pose(fig, [("upperarm01.LR", (0.22, 0.0, -1)), ("lowerarm01.LR", (0.08, -0.3, -1))])
    fig["arm"].rotation_euler = (0, 0, rad(90))
    ground(fig)
    return freeze(fig) if static else fig


def carried(name="Tasinan", age=0.30, height=0.45, lod=0.6, sked=False, face_down=True):
    """Uyutulmuş, taşınan çocuk: baştan ayağa neopren, tam yüz maskesi, göğüste tüp, koşum bantları. Yüz görünmez.
    Kök çerçevesinde yatay, baş +X; face_down=True ise yüz aşağı (su altında taşınırken). sked=True: sedye sargısı."""
    fig = body(name, age=age, height=height, hair=False, lod=lod, weight=0.42, muscle=0.4)
    lm = fig["lm"]
    s, E, H = lm["s"], lm["eye"], lm["H"]
    M = _m()
    M["bant"] = K.mat("f-bant", (0.30, 0.23, 0.04), rough=0.8)
    M["tup2"] = K.mat("f-tup2", (0.10, 0.11, 0.12), rough=0.55)
    M["tamyuz"] = K.mat("f-tamyuz", (0.03, 0.12, 0.16), rough=0.15)
    paint(fig, lambda reg, bone, co, lm, t: "goz" if t == 2 else ("bot" if reg == "foot" else "neopren"), M)
    add = lambda o, b: attach(fig, o, b)
    add(K.ball(M["tamyuz"], (0, E.y - 0.005 * s, E.z - 0.035 * s), 1, None, (0.085 * s, 0.07 * s, 0.115 * s)), "head")
    add(K.ball(M["bot"], (0, E.y + 0.02 * s, E.z - 0.035 * s), 1, None, (0.10 * s, 0.06 * s, 0.13 * s)), "head")
    add(K.prim(bpy.ops.mesh.primitive_cylinder_add, M["bot"], vertices=14, radius=0.03 * s, depth=0.05 * s,
               location=(0, E.y - 0.075 * s, E.z - 0.085 * s), rotation=(K.R90, 0, 0)), "head")
    cy = lm["chest"].y
    add(_caps(M["tup2"], (0, cy - 0.20 * s, lm["waist"] - 0.02 * s), (0, cy - 0.20 * s, lm["waist"] + 0.30 * s), 0.055 * s), "spine02")
    for z in (lm["waist"] + 0.05 * s, lm["waist"] + 0.24 * s):
        t = K.prim(bpy.ops.mesh.primitive_torus_add, M["bant"], major_radius=0.165 * s, minor_radius=0.014 * s,
                   location=(0, cy - 0.04 * s, z), major_segments=24, minor_segments=6)
        t.scale = (1.0, 1.05, 1.0)
        add(t, "spine02")
    pose(fig, [("upperarm01.LR", (0.13, 0.05, -1)), ("lowerarm01.LR", (0.0, 0.05, -1)),
               ("upperleg01.LR", (0.02, 0.0, -1)), ("lowerleg01.LR", (0.0, 0.06, -1)), ("foot.LR", (0, -0.25, -1)),
               ("neck01", (0, -0.1, 1))])
    if face_down:
        fig["arm"].matrix_basis = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    else:
        fig["arm"].matrix_basis = Matrix(((0, 0, 1, 0), (-1, 0, 0, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
    c = bone_point(fig, "spine03", tail=False)
    fig["arm"].location -= fig["root"].matrix_world.inverted() @ c
    freeze(fig)
    if sked:
        m = K.mat("f-sedye", (0.55, 0.20, 0.03), rough=0.8)
        sk = K.prim(bpy.ops.mesh.primitive_cylinder_add, m, vertices=20, radius=0.23 * s, depth=H * 0.92,
                    location=(-0.08 * H, 0, 0), rotation=(0, K.R90, 0), end_fill_type="NOTHING", parent=fig["root"])
        sk.scale = (0.8, 1.0, 1.0)
    return fig


def rescuer(name="Kurtarici", color=(0.70, 0.30, 0.04), pose_name="stand", helmet=True, age=0.5, lod=0.5, static=True,
            dark=False):
    """Kuru bölümdeki kurtarıcı/doktor: tulum, bot, baret + lamba. pose_name: stand | kneel | reach.
    +X'e bakar, ayaklar z=0. dark=True: neopren (suya girecek dalgıç)."""
    fig = body(name, age=age, lod=lod, hair=not helmet)
    lm = fig["lm"]
    s, E, H = lm["s"], lm["eye"], lm["H"]
    M = _m()
    M["tulum"] = M["neopren"] if dark else K.mat(f"f-tulum{color}", color, rough=0.85)

    def rule(reg, bone, co, lm, t):
        if t == 1:
            return "sac"
        if t == 2:
            return "goz"
        if reg in ("head", "hand") or (reg == "neck" and co.z > lm["shoulder"] + 0.05 * s):
            return "neopren" if (dark and reg == "head" and not (co.y < E.y + 0.05 * s and E.z - 0.11 * s < co.z < E.z + 0.05 * s)) else "ten"
        if reg == "foot" or (reg == "shin" and co.z < lm["ankle"] + 0.35 * (lm["knee"] - lm["ankle"])):
            return "bot"
        return "tulum" if dark else ("tulum", 0.016 * s)
    paint(fig, rule, M)
    shoes(fig, M["bot"])
    if helmet:
        attach(fig, K.ball(M["kask"], (0, E.y + 0.10 * s, H - 0.07 * s), 1, None, (0.100 * s, 0.118 * s, 0.075 * s)), "head")
        attach(fig, K.ball(M["lamba"], (0, E.y - 0.012 * s, H - 0.06 * s), 0.016 * s, None), "head")
    if pose_name == "kneel":             # tek diz yerde, öne eğilmiş, eller önde
        pose(fig, [("spine05", (0, -0.25, 1)), ("spine03", (0, -0.55, 1)), ("spine01", (0, -0.8, 1)), ("neck01", (0, -0.9, 1)),
                   ("head", (0, -1, 0.9)),
                   ("upperleg01.L", (0.15, -1, 0.12)), ("lowerleg01.L", (0.0, -0.05, -1)), ("foot.L", (0, -1, -0.1)),
                   ("upperleg01.R", (-0.10, -0.25, -1)), ("lowerleg01.R", (0, 1, -0.12)), ("foot.R", (0, 0.6, -1)),
                   ("upperarm01.LR", (0.12, -1, -0.75)), ("lowerarm01.LR", (-0.12, -1, -0.45))])
    elif pose_name == "reach":           # ayakta, kollar öne (taşıma)
        pose(fig, [("spine03", (0, -0.2, 1)), ("upperarm01.LR", (0.15, -0.8, -1)), ("lowerarm01.LR", (-0.05, -1, -0.1))])
    else:
        pose(fig, [("upperarm01.LR", (0.20, 0.0, -1)), ("lowerarm01.LR", (0.06, -0.3, -1))])
    fig["arm"].rotation_euler = (0, 0, rad(90))
    ground(fig)
    return freeze(fig) if static else fig


def clone(fig, name=None):
    """Durağan (freeze edilmiş) figürün ağını paylaşan kopya: kalabalık için ucuz."""
    root = K.empty(name or fig["name"] + "-kopya")
    o = fig["mesh"].copy()
    K.link(o, root)
    o.matrix_basis = fig["mesh"].matrix_basis.copy()
    return {"root": root, "mesh": o, "arm": None, "lm": fig["lm"], "name": root.name}
