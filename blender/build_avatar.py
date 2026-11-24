"""
Stylized (Pixar / Memoji-like) 3D avatar of Granit: short dark hair with a fade,
thick straight eyebrows, brown eyes, short full beard + moustache, white shirt.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_avatar.py

Outputs public/models/avatar.glb and blender/avatar.blend
Animated nodes on the website: HeadPivot (look at cursor), EyeL / EyeR (gaze + blink), Torso (breathing)
"""
import bpy
import bmesh
import math
import os
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)


def mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = srgb(emit)
        b.inputs["Emission Strength"].default_value = strength
    return m


SKIN = mat("Skin", "#e2a888", 0.55)
SKIN_DARK = mat("SkinShadow", "#c98a6c", 0.6)
LIP = mat("Lip", "#b8746a", 0.45)
HAIR = mat("Hair", "#16110f", 0.75)
FADE = mat("HairFade", "#4a3a33", 0.85)
BEARD = mat("Beard", "#1d1512", 0.85)
STUBBLE = mat("Stubble", "#5c4337", 0.9)
BROW = mat("Brow", "#15100e", 0.8)
SCLERA = mat("Sclera", "#f6f4f1", 0.12)
IRIS = mat("Iris", "#4b2e1c", 0.2)
PUPIL = mat("Pupil", "#050404", 0.1)
SPARK = mat("Sparkle", "#ffffff", 0.1, emit="#ffffff", strength=4.0)
SHIRT = mat("Shirt", "#f3f2ef", 0.6)
SHIRT_SHADE = mat("ShirtShade", "#dcdad5", 0.65)
BUTTON = mat("Button", "#e9e6df", 0.3)


def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    link(e, parent)
    e.location = loc
    return e


def mesh_from_bm(name, bm, material, parent=None, loc=(0, 0, 0), smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    me.materials.append(material)
    o = bpy.data.objects.new(name, me)
    link(o, parent)
    o.location = loc
    return o


def ellipsoid(name, size, loc, material, parent=None, rot=None, seg=40):
    bm = bmesh.new()
    m = Matrix.Diagonal((size[0], size[1], size[2], 1.0))
    if rot is not None:
        m = rot @ m
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2 + 4, radius=1.0, matrix=m)
    return mesh_from_bm(name, bm, material, parent, loc)


def capsule_x(name, length, radius, loc, material, parent=None, rot=None):
    """Rounded bar along X (for eyebrows)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        v.co = Vector((x * (length / 2), y * radius * 0.7, z * radius))
        # taper the outer end a little
        v.co.z *= 1.0 - 0.25 * max(0.0, v.co.x / (length / 2))
    if rot is not None:
        bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    return mesh_from_bm(name, bm, material, parent, loc)


# ------------------------------------------------------------------ head shape
HX, HY, HZ = 0.93, 0.95, 1.08


def head_shape(u, scale=1.0):
    """Map a unit-sphere direction to the stylized head surface."""
    x, y, z = u.x * HX, u.y * HY, u.z * HZ
    if u.z < 0:
        t = -u.z
        x *= 1 - 0.17 * t ** 1.5           # narrower jaw / chin
        if u.y < 0:
            y *= 1 + 0.05 * t               # chin slightly forward
    if u.z > 0.2:
        x *= 1 + 0.03 * (u.z - 0.2)          # a touch wider at the temples
    return Vector((x, y, z)) * scale


def shell(name, keep, scale, material, parent, loc, seg=(72, 48)):
    """Head-shaped shell keeping only faces whose unit-sphere centre passes `keep`."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0)
    bm.faces.ensure_lookup_table()
    drop = []
    for f in bm.faces:
        c = f.calc_center_median().normalized()
        if not keep(c):
            drop.append(f)
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    for v in bm.verts:
        v.co = head_shape(v.co.normalized(), scale)
    return mesh_from_bm(name, bm, material, parent, loc)


root = empty("Avatar", (0, 0, 0))

# ------------------------------------------------------------------ body (white shirt)
def superellipsoid_bm(sx, sy, sz, e=0.55, seg=(64, 40)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        f = lambda a: math.copysign(abs(a) ** e, a)
        v.co = Vector((f(x) * sx, f(y) * sy, f(z) * sz))
    return bm


body = empty("Torso", (0, 0, 0.2), root)
bm = superellipsoid_bm(1.18, 0.6, 1.15, e=0.62)
for v in bm.verts:
    x, y, z = v.co
    if z > 0.35:  # sloped shoulders + rounder chest
        k = (z - 0.35) / 0.8
        v.co.z -= (abs(x) / 1.18) ** 2.2 * 0.55 * k
        v.co.y *= 1 - 0.25 * k * (abs(x) / 1.18)
mesh_from_bm("ShirtBody", bm, SHIRT, body)

# neck, open collar and placket
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=0.34, radius2=0.31, depth=0.7)
mesh_from_bm("Neck", bm, SKIN, root, loc=(0, 0.02, 1.48))
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=False, segments=48, radius1=0.5, radius2=0.41, depth=0.2)
mesh_from_bm("CollarBand", bm, SHIRT, root, loc=(0, 0.03, 1.33))
for side in (-1, 1):
    rot = Matrix.Rotation(math.radians(-38 * side), 4, "Y") @ Matrix.Rotation(math.radians(-12), 4, "X")
    ellipsoid(f"CollarFlap{'L' if side < 0 else 'R'}", (0.11, 0.035, 0.22), (0.15 * side, -0.56, 1.13), SHIRT, root, rot=rot)
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.08, 0.02, 0.8, 1.0)))
mesh_from_bm("Placket", bm, SHIRT_SHADE, root, loc=(0, -0.66, 0.42), smooth=False)
for i, z in enumerate((0.72, 0.42, 0.12)):
    ellipsoid(f"Button{i}", (0.032, 0.015, 0.032), (0, -0.68, z), BUTTON, root, seg=16)

# ------------------------------------------------------------------ head
pivot = empty("HeadPivot", (0, 0, 1.55), root)
HC = (0, 0, 0.8)  # head centre relative to the pivot


def ss(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def hairline(c):
    return 0.32 + 0.24 * (-c.y) if c.y < 0 else 0.32 - 0.5 * c.y


def weights(c):
    ax = abs(c.x)
    line = -0.25 + 0.55 * max(0.0, ax - 0.42)
    zone = ss(line + 0.07, line - 0.07, c.z) * ss(0.4, 0.0, c.y)
    mouth = ss(0.2, 0.13, ax) * ss(0.055, 0.0, abs(c.z + 0.435)) * ss(-0.45, -0.62, c.y)
    zone *= 1 - mouth
    chin = ss(line - 0.04, line - 0.22, c.z)
    stache = ss(-0.45, -0.39, c.z) * ss(-0.25, -0.31, c.z) * ss(0.36, 0.27, ax) * ss(-0.45, -0.62, c.y)
    dense = max(chin, stache) * zone
    h = hairline(c)
    top = ss(h - 0.025, h + 0.045, c.z)
    near_face = ss(-0.3, -0.7, c.y) * ss(0.6, 0.38, c.z)
    fade = ss(h - 0.5, h - 0.34, c.z) * (1 - near_face)
    return zone, dense, fade, top


bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=160, v_segments=110, radius=1.0)
cols = []
c_skin, c_stub, c_beard = Vector(srgb("#e2a888")[:3]), Vector(srgb("#4a3429")[:3]), Vector(srgb("#1a1310")[:3])
c_fade, c_hair = Vector(srgb("#3a2d27")[:3]), Vector(srgb("#16110f")[:3])
for v in bm.verts:
    c = v.co.normalized()
    zone, dense, fade, top = weights(c)
    tex = 0.5 + 0.5 * math.sin(math.atan2(c.x, -c.y) * 22) * math.sin(c.z * 26)
    disp = 0.012 * zone + 0.035 * dense + 0.01 * fade + top * (0.06 + 0.06 * ss(0.45, 0.95, c.z) + 0.018 * tex)
    v.co = head_shape(c) + head_shape(c).normalized() * disp
    col = c_skin.lerp(c_fade, fade * (1 - top))
    col = col.lerp(c_stub, zone * 0.92)
    col = col.lerp(c_beard, dense)
    col = col.lerp(c_hair * (0.85 + 0.3 * tex), top)
    cols.append(col)
me = bpy.data.meshes.new("Head")
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = True
ca = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
for i, col in enumerate(cols):
    ca.data[i].color = (col.x, col.y, col.z, 1.0)
head_mat = bpy.data.materials.new("HeadPaint")
head_mat.use_nodes = True
nt = head_mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.6
me.materials.append(head_mat)
head = bpy.data.objects.new("Head", me)
link(head, pivot)
head.location = HC


def hc(x, y, z):
    return (HC[0] + x, HC[1] + y, HC[2] + z)


# ears
for side in (-1, 1):
    rot = Matrix.Rotation(math.radians(-12 * side), 4, "Z")
    ellipsoid(f"Ear{'L' if side < 0 else 'R'}", (0.1, 0.17, 0.25), hc(0.9 * side, 0.04, 0.02), SKIN, pivot, rot=rot)
    ellipsoid(f"EarIn{'L' if side < 0 else 'R'}", (0.05, 0.1, 0.16), hc(0.97 * side, -0.01, 0.02), SKIN_DARK, pivot, rot=rot)

# nose
ellipsoid("NoseBridge", (0.065, 0.09, 0.2), hc(0, -0.93, -0.03), SKIN, pivot)
ellipsoid("NoseTip", (0.12, 0.11, 0.1), hc(0, -0.99, -0.2), SKIN, pivot)
for side in (-1, 1):
    ellipsoid(f"Nostril{'L' if side < 0 else 'R'}", (0.06, 0.065, 0.055), hc(0.085 * side, -0.95, -0.235), SKIN, pivot)

# eyes (big, Pixar style) with upper lids
for side, nm in ((-1, "L"), (1, "R")):
    eye = empty(f"Eye{nm}", hc(0.35 * side, -0.69, 0.06), pivot)
    ellipsoid(f"Sclera{nm}", (0.27, 0.27, 0.27), (0, 0, 0), SCLERA, eye)
    ellipsoid(f"Iris{nm}", (0.155, 0.03, 0.155), (0, -0.252, 0), IRIS, eye)
    ellipsoid(f"Pupil{nm}", (0.075, 0.02, 0.075), (0, -0.272, 0), PUPIL, eye)
    ellipsoid(f"Spark{nm}", (0.032, 0.02, 0.032), (0.055, -0.28, 0.06), SPARK, eye, seg=16)
    ellipsoid(f"Spark2{nm}", (0.016, 0.01, 0.016), (-0.05, -0.282, -0.05), SPARK, eye, seg=12)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=28, radius=0.292)
    bm.faces.ensure_lookup_table()
    drop = [f for f in bm.faces if f.calc_center_median().z < 0.085]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.radians(-8), 4, "X"), verts=bm.verts)
    mesh_from_bm(f"Lid{nm}", bm, SKIN, eye)

# eyebrows: thick and fairly straight
for side, nm in ((-1, "L"), (1, "R")):
    rot = Matrix.Rotation(math.radians(-6 * side), 4, "Y") @ Matrix.Rotation(math.radians(8 * side), 4, "Z")
    o = capsule_x(f"Brow{nm}", 0.44, 0.075, hc(0.36 * side, -0.86, 0.35), BROW, pivot, rot=rot)
    if side < 0:
        o.scale.x = -1

# mouth
ellipsoid("LipLower", (0.14, 0.055, 0.045), hc(0, -0.935, -0.5), LIP, pivot)
ellipsoid("LipUpper", (0.15, 0.045, 0.028), hc(0, -0.945, -0.455), LIP, pivot)

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", "avatar.blend"))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, "public", "models", "avatar.glb"), export_format="GLB", export_apply=True, export_yup=True)
print("EXPORTED avatar")
