"""
Builds the three portfolio models and exports them as GLB + .blend.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_models.py

Outputs:
  public/models/robot_arm.glb   blender/robot_arm.blend
  public/models/smart_city.glb  blender/smart_city.blend
  public/models/atm.glb         blender/atm.blend

Named nodes used by the website for animation:
  robot_arm : J1 (base yaw), J2 (shoulder), J3 (elbow), J4 (wrist pitch), J5 (wrist roll), FingerL, FingerR
  smart_city: Rotor0..Rotor2, Car0..Car5, Beacon, Item0..Item3, ServoArm0/1, Laser0,
              Sensor1Light, Water0/1, TankGlass0/1, PumpRotor, Flow0..Flow3
  atm       : Screen, CashLight, CardLight
"""
import bpy
import bmesh
import math
import os
import random
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB = os.path.join(ROOT, "public", "models")
OUT_BLEND = os.path.join(ROOT, "blender")
os.makedirs(OUT_GLB, exist_ok=True)

# ------------------------------------------------------------------ helpers


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def hex_rgba(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    # sRGB -> linear
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), 1.0)


_mats = {}


def mat(name, color, metallic=0.0, rough=0.5, emit=None, strength=0.0):
    if name in _mats and _mats[name].name in bpy.data.materials:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emit:
        bsdf.inputs["Emission Color"].default_value = hex_rgba(emit)
        bsdf.inputs["Emission Strength"].default_value = strength
    _mats[name] = m
    return m


def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def finish_mesh(name, bm, material, parent=None, loc=(0, 0, 0), smooth_angle=None, bevel=0.0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth_angle is not None:
        try:
            me.shade_smooth()
            me.set_sharp_from_angle(angle=math.radians(smooth_angle))
        except Exception:
            for p in me.polygons:
                p.use_smooth = True
    me.materials.append(material)
    obj = bpy.data.objects.new(name, me)
    link(obj, parent)
    obj.location = loc
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    return obj


def bm_box(bm, size, loc=(0, 0, 0), rot=None):
    m = Matrix.Translation(loc)
    if rot is not None:
        m = m @ rot
    m = m @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_cyl(bm, r, d, loc=(0, 0, 0), rot=None, seg=48, r2=None):
    m = Matrix.Translation(loc)
    if rot is not None:
        m = m @ rot
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r, radius2=r if r2 is None else r2, depth=d, matrix=m)


def bm_sphere(bm, r, loc=(0, 0, 0), seg=24):
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r,
                              matrix=Matrix.Translation(loc))


def box(name, size, loc, material, parent=None, bevel=0.0, rot=None):
    bm = bmesh.new()
    bm_box(bm, size, (0, 0, 0), rot)
    return finish_mesh(name, bm, material, parent, loc, smooth_angle=30 if bevel else None, bevel=bevel)


def cyl(name, r, d, loc, material, parent=None, rot=None, seg=48, bevel=0.0, r2=None):
    bm = bmesh.new()
    bm_cyl(bm, r, d, (0, 0, 0), rot, seg, r2)
    return finish_mesh(name, bm, material, parent, loc, smooth_angle=35, bevel=bevel)


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.2
    link(e, parent)
    e.location = loc
    return e


ROT_X90 = Matrix.Rotation(math.pi / 2, 4, "X")
ROT_Y90 = Matrix.Rotation(math.pi / 2, 4, "Y")


def export(name):
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_BLEND, name + ".blend"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_GLB, name + ".glb"),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    print("EXPORTED", name)


# ------------------------------------------------------------------ robot arm


def build_robot_arm():
    reset()
    _mats.clear()
    orange = mat("IndustrialOrange", "#ff6a13", 0.15, 0.32)
    graphite = mat("Graphite", "#262b33", 0.6, 0.35)
    steel = mat("Steel", "#b8c0cc", 1.0, 0.22)
    cyan = mat("StatusCyan", "#f5f5f5", 0.0, 0.3, emit="#f5f5f5", strength=6.0)
    rubber = mat("Rubber", "#111317", 0.0, 0.8)

    root = empty("RobotArm", (0, 0, 0))

    # base
    cyl("BasePlate", 0.58, 0.1, (0, 0, 0.05), graphite, root, bevel=0.015)
    bm = bmesh.new()
    for a in range(6):
        ang = a * math.pi / 3 + math.pi / 6
        bm_cyl(bm, 0.035, 0.03, (math.cos(ang) * 0.5, math.sin(ang) * 0.5, 0.115), seg=12)
    finish_mesh("Bolts", bm, steel, root, smooth_angle=35)
    cyl("BaseHousing", 0.4, 0.34, (0, 0, 0.27), orange, root, bevel=0.03)
    cyl("BaseRing", 0.405, 0.03, (0, 0, 0.38), cyan, root)

    # J1 - yaw
    j1 = empty("J1", (0, 0, 0.44), root)
    cyl("Turntable", 0.42, 0.1, (0, 0, 0.05), graphite, j1, bevel=0.015)
    box("ShoulderHousing", (0.52, 0.5, 0.42), (0, 0, 0.3), orange, j1, bevel=0.05)
    cyl("MotorJ1", 0.13, 0.22, (0, 0.3, 0.28), graphite, j1, rot=ROT_X90, bevel=0.01)

    # J2 - shoulder pitch
    j2 = empty("J2", (0, 0, 0.5), j1)
    cyl("ShoulderJoint", 0.22, 0.66, (0, 0, 0), graphite, j2, rot=ROT_Y90, bevel=0.02)
    cyl("ShoulderCapL", 0.15, 0.02, (-0.335, 0, 0), cyan, j2, rot=ROT_Y90)
    cyl("ShoulderCapR", 0.15, 0.02, (0.335, 0, 0), cyan, j2, rot=ROT_Y90)
    box("UpperArm", (0.28, 0.3, 1.0), (0, 0, 0.52), orange, j2, bevel=0.06)
    box("UpperArmPanel", (0.29, 0.18, 0.6), (0, 0, 0.52), graphite, j2, bevel=0.02)

    # J3 - elbow
    j3 = empty("J3", (0, 0, 1.05), j2)
    cyl("ElbowJoint", 0.17, 0.5, (0, 0, 0), graphite, j3, rot=ROT_Y90, bevel=0.02)
    box("Forearm", (0.21, 0.22, 0.78), (0, 0, 0.4), orange, j3, bevel=0.05)
    cyl("ForearmMotor", 0.1, 0.18, (0, -0.16, 0.12), graphite, j3, rot=ROT_X90, bevel=0.01)

    # J4 - wrist pitch
    j4 = empty("J4", (0, 0, 0.82), j3)
    cyl("WristJoint", 0.11, 0.26, (0, 0, 0), graphite, j4, rot=ROT_Y90, bevel=0.01)
    cyl("Wrist", 0.09, 0.16, (0, 0, 0.1), steel, j4, bevel=0.01)
    cyl("WristRing", 0.095, 0.02, (0, 0, 0.17), cyan, j4)

    # J5 - wrist roll + gripper
    j5 = empty("J5", (0, 0, 0.19), j4)
    box("Palm", (0.34, 0.12, 0.08), (0, 0, 0.04), graphite, j5, bevel=0.015)
    fl = empty("FingerL", (-0.11, 0, 0.08), j5)
    box("FingerLMesh", (0.04, 0.09, 0.22), (0, 0, 0.11), steel, fl, bevel=0.008)
    box("PadL", (0.012, 0.07, 0.1), (0.026, 0, 0.15), rubber, fl)
    fr = empty("FingerR", (0.11, 0, 0.08), j5)
    box("FingerRMesh", (0.04, 0.09, 0.22), (0, 0, 0.11), steel, fr, bevel=0.008)
    box("PadR", (0.012, 0.07, 0.1), (-0.026, 0, 0.15), rubber, fr)

    # cable running along the upper arm
    bm = bmesh.new()
    bm_cyl(bm, 0.025, 0.9, (0, 0.19, 0.52), seg=12)
    finish_mesh("Cable", bm, rubber, j2, smooth_angle=60)

    # pose for the .blend file (website overrides this)
    j2.rotation_euler = (math.radians(-20), 0, 0)
    j3.rotation_euler = (math.radians(-55), 0, 0)
    j4.rotation_euler = (math.radians(-40), 0, 0)
    export("robot_arm")


# ------------------------------------------------------------------ smart city


def build_smart_city():
    reset()
    _mats.clear()
    random.seed(7)
    slab = mat("Slab", "#1b2129", 0.2, 0.6)
    edge = mat("EdgeCyan", "#f5f5f5", 0.0, 0.3, emit="#f5f5f5", strength=4.0)
    asphalt = mat("Asphalt", "#2b3038", 0.0, 0.85)
    marking = mat("Marking", "#e8edf3", 0.0, 0.5, emit="#ffffff", strength=0.4)
    grass = mat("Grass", "#2f6b46", 0.0, 0.9)
    concrete = mat("Concrete", "#cfd6df", 0.1, 0.55)
    tower = mat("Tower", "#8fa3b8", 0.5, 0.3)
    glass = mat("WindowGlow", "#f1ece4", 0.0, 0.2, emit="#f1ece4", strength=2.5)
    warm = mat("WarmGlow", "#ffb347", 0.0, 0.3, emit="#ffb347", strength=3.0)
    solar = mat("Solar", "#232733", 0.7, 0.2)
    tree = mat("Tree", "#3fa36b", 0.0, 0.8)
    trunk = mat("Trunk", "#6b4f3a", 0.0, 0.8)
    white = mat("White", "#f1f5f9", 0.2, 0.4)
    water = mat("Water", "#7f97aa", 0.2, 0.05)
    orange = mat("IndustrialOrange", "#ff6a13", 0.15, 0.35)
    redlight = mat("RedLight", "#ef4444", 0.0, 0.3, emit="#ef4444", strength=5.0)

    root = empty("SmartCity", (0, 0, 0))
    H = 3.0  # half size of platform
    box("Platform", (2 * H, 2 * H, 0.2), (0, 0, -0.1), slab, root, bevel=0.03)
    box("PlatformEdge", (2 * H + 0.02, 2 * H + 0.02, 0.025), (0, 0, -0.06), edge, root)

    roads = [-0.95, 0.95]
    RW = 0.4
    bm = bmesh.new()
    for r in roads:
        bm_box(bm, (2 * H, RW, 0.02), (0, r, 0.01))
        bm_box(bm, (RW, 2 * H, 0.02), (r, 0, 0.011))
    finish_mesh("Roads", bm, asphalt, root)

    bm = bmesh.new()
    for r in roads:
        x = -H + 0.1
        while x < H - 0.1:
            if all(abs(x - q) > RW / 2 + 0.02 for q in roads):
                bm_box(bm, (0.12, 0.015, 0.005), (x, r, 0.023))
                bm_box(bm, (0.015, 0.12, 0.005), (r, x, 0.023))
            x += 0.22
    finish_mesh("RoadMarkings", bm, marking, root)

    centers = [-1.95, 0.0, 1.95]
    B = 1.5
    grass_bm = bmesh.new()
    conc_bm, tower_bm, glass_bm, warm_bm, solar_bm, white_bm = (bmesh.new() for _ in range(6))
    tree_bm, trunk_bm = bmesh.new(), bmesh.new()

    def add_building(cx, cy, w, d, h, mat_bm, glow_bm):
        mat_bm_box = mat_bm
        bm_box(mat_bm_box, (w, d, h), (cx, cy, h / 2 + 0.02))
        z = 0.12
        while z < h - 0.06:
            bm_box(glow_bm, (w + 0.008, d + 0.008, 0.028), (cx, cy, z + 0.02))
            z += 0.13
        return h + 0.02

    for i, cx in enumerate(centers):
        for j, cy in enumerate(centers):
            if (i, j) in ((2, 0), (0, 0)):
                continue  # industrial zone + water reservoirs, built below
            bm_box(grass_bm, (B, B, 0.03), (cx, cy, 0.015))
            if i == 1 and j == 1:
                continue  # central park, built below
            # 2x2 plots per block
            for px in (-0.38, 0.38):
                for py in (-0.38, 0.38):
                    if random.random() < 0.15:
                        # small park plot with trees
                        for _ in range(3):
                            tx = cx + px + random.uniform(-0.2, 0.2)
                            ty = cy + py + random.uniform(-0.2, 0.2)
                            bm_cyl(trunk_bm, 0.015, 0.08, (tx, ty, 0.07), seg=8)
                            bm_cyl(tree_bm, 0.09, 0.22, (tx, ty, 0.2), seg=10, r2=0.0)
                        continue
                    w = random.uniform(0.42, 0.6)
                    d = random.uniform(0.42, 0.6)
                    tall = (abs(cx) < 0.1) or (abs(cy) < 0.1)
                    h = random.uniform(0.6, 1.9) if tall else random.uniform(0.3, 1.1)
                    is_tower = h > 1.2
                    top = add_building(cx + px, cy + py, w, d, h,
                                       tower_bm if is_tower else conc_bm,
                                       glass_bm if (is_tower or random.random() < 0.6) else warm_bm)
                    if not is_tower and random.random() < 0.7:
                        # rooftop solar panels
                        for k in range(2):
                            bm_box(solar_bm, (w * 0.38, d * 0.7, 0.02),
                                   (cx + px - w * 0.2 + k * w * 0.4, cy + py, top + 0.04),
                                   Matrix.Rotation(math.radians(-18), 4, "X"))
                    elif is_tower:
                        bm_box(white_bm, (w * 0.5, d * 0.5, 0.08), (cx + px, cy + py, top + 0.04))
                        bm_cyl(white_bm, 0.01, 0.35, (cx + px, cy + py, top + 0.25), seg=8)

    # central park + smart hub
    for _ in range(14):
        a = random.uniform(0, 2 * math.pi)
        rr = random.uniform(0.38, 0.68)
        tx, ty = math.cos(a) * rr, math.sin(a) * rr
        bm_cyl(trunk_bm, 0.015, 0.08, (tx, ty, 0.07), seg=8)
        bm_cyl(tree_bm, 0.08, 0.2, (tx, ty, 0.2), seg=10, r2=0.0)

    finish_mesh("Grass", grass_bm, grass, root)
    finish_mesh("Buildings", conc_bm, concrete, root, smooth_angle=30)
    finish_mesh("Towers", tower_bm, tower, root, smooth_angle=30)
    finish_mesh("WindowsCool", glass_bm, glass, root)
    finish_mesh("WindowsWarm", warm_bm, warm, root)
    finish_mesh("SolarPanels", solar_bm, solar, root)
    finish_mesh("RoofDetails", white_bm, white, root, smooth_angle=40)
    finish_mesh("Trees", tree_bm, tree, root, smooth_angle=50)
    finish_mesh("Trunks", trunk_bm, trunk, root, smooth_angle=50)

    cyl("Pond", 0.26, 0.02, (0, 0, 0.04), water, root, seg=48)
    cyl("HubBase", 0.16, 0.14, (0, 0, 0.1), white, root, bevel=0.01)
    cyl("HubMast", 0.035, 1.2, (0, 0, 0.75), tower, root)
    beacon = empty("Beacon", (0, 0, 1.0), root)
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=False, segments=48, radius=0.18)
    bm.free()
    bm = bmesh.new()
    bm_cyl(bm, 0.2, 0.025, (0, 0, 0), seg=48)
    bm_cyl(bm, 0.12, 0.025, (0, 0, 0.18), seg=48)
    finish_mesh("BeaconRings", bm, edge, beacon)
    bm = bmesh.new()
    bm_sphere(bm, 0.04, (0, 0, 0.36), seg=16)
    finish_mesh("BeaconTip", bm, redlight, beacon, smooth_angle=80)

    # street lamps along roads
    pole_bm, lamp_bm = bmesh.new(), bmesh.new()
    for r in roads:
        for t in (-2.6, -1.95, -1.3, 1.3, 1.95, 2.6, -0.45, 0.45):
            for (x, y) in ((t, r + RW / 2 + 0.04), (r + RW / 2 + 0.04, t)):
                bm_cyl(pole_bm, 0.008, 0.22, (x, y, 0.13), seg=8)
                bm_box(lamp_bm, (0.05, 0.03, 0.015), (x, y - 0.0, 0.245))
    finish_mesh("LampPoles", pole_bm, tower, root)
    finish_mesh("LampHeads", lamp_bm, warm, root)

    # wind turbines on the platform corners
    for k, (x, y) in enumerate([(-2.7, 2.7), (2.7, -2.7), (2.7, 2.7)]):
        base = empty(f"Turbine{k}", (x, y, 0), root)
        cyl(f"TurbineMast{k}", 0.03, 1.0, (0, 0, 0.5), white, base, r2=0.018, seg=16)
        box(f"Nacelle{k}", (0.06, 0.12, 0.06), (0, 0, 1.02), white, base, bevel=0.01)
        rotor = empty(f"Rotor{k}", (0, -0.07, 1.02), base)
        bm = bmesh.new()
        for b in range(3):
            rot = Matrix.Rotation(b * 2 * math.pi / 3, 4, "Y")
            bm_box(bm, (0.035, 0.01, 0.42), (0, 0, 0), rot @ Matrix.Translation((0, 0, 0.22)))
        bm_sphere(bm, 0.025, (0, 0, 0), seg=12)
        finish_mesh(f"Blades{k}", bm, white, rotor, smooth_angle=40)
        # face the turbine towards the city centre
        base.rotation_euler = (0, 0, math.atan2(-y, -x) - math.pi / 2 + math.pi)

    build_industry(root, 1.95, -1.95)
    build_water(root, -1.95, -1.95)

    # cars (positioned/animated on the website)
    car_cols = ["#ff6a13", "#f5f5f5", "#f1f5f9", "#facc15", "#52525b", "#ef4444"]
    head = mat("Headlight", "#ffffff", 0.0, 0.2, emit="#ffffff", strength=6.0)
    for k, c in enumerate(car_cols):
        body_m = mat(f"Car{k}Paint", c, 0.4, 0.3)
        car = empty(f"Car{k}", (-2.4 + k * 0.9, -0.95 - 0.09, 0.02), root)
        box(f"Car{k}Body", (0.2, 0.1, 0.05), (0, 0, 0.04), body_m, car, bevel=0.012)
        box(f"Car{k}Cabin", (0.11, 0.085, 0.04), (-0.01, 0, 0.08), mat("CarGlass", "#0f172a", 0.6, 0.1), car, bevel=0.01)
        box(f"Car{k}Lights", (0.005, 0.07, 0.015), (0.101, 0, 0.045), head, car)

    # traffic lights at the crossings
    tl_bm = bmesh.new()
    for x in roads:
        for y in roads:
            bm_cyl(tl_bm, 0.008, 0.25, (x + 0.24, y + 0.24, 0.14), seg=8)
    finish_mesh("TrafficPoles", tl_bm, orange, root)

    export("smart_city")


# ------------------------------------------------------------------ smart city: industrial zone


def build_industry(root, cx, cy):
    """Production line with conveyor, 2 servo units, light-barrier + proximity sensors, PLC cabinet, hall."""
    floor = mat("FactoryFloor", "#3a4250", 0.1, 0.7)
    safety = mat("SafetyYellow", "#facc15", 0.0, 0.5, emit="#facc15", strength=0.3)
    frame = mat("ConveyorFrame", "#94a3b8", 0.9, 0.3)
    belt = mat("Belt", "#14161a", 0.0, 0.9)
    graphite = mat("Graphite", "#262b33", 0.6, 0.35)
    orange = mat("IndustrialOrange", "#ff6a13", 0.15, 0.35)
    steel = mat("SteelC", "#c5ccd6", 1.0, 0.2)
    laser = mat("LaserRed", "#ff2d2d", 0.0, 0.3, emit="#ff2d2d", strength=8.0)
    led_g = mat("LedGreen", "#22c55e", 0.0, 0.3, emit="#22c55e", strength=6.0)
    hall = mat("Hall", "#d5dbe3", 0.2, 0.5)
    glass = mat("WindowGlow", "#f1ece4", 0.0, 0.2, emit="#f1ece4", strength=2.5)
    solar = mat("Solar", "#232733", 0.7, 0.2)
    carton = mat("Carton", "#c8a165", 0.0, 0.7)
    screen = mat("PlcScreen", "#e4e4e7", 0.0, 0.2, emit="#ffffff", strength=1.6)

    zone = empty("IndustryZone", (cx, cy, 0), root)
    box("FactoryFloor", (1.5, 1.5, 0.03), (0, 0, 0.015), floor, zone)
    # safety lines
    bm = bmesh.new()
    for x in (-0.68, 0.68):
        bm_box(bm, (0.02, 1.36, 0.004), (x, 0, 0.032))
    for y in (-0.68, 0.68):
        bm_box(bm, (1.36, 0.02, 0.004), (0, y, 0.032))
    bm_box(bm, (1.3, 0.015, 0.004), (0, -0.4, 0.032))
    bm_box(bm, (1.3, 0.015, 0.004), (0, 0.0, 0.032))
    finish_mesh("SafetyLines", bm, safety, zone)

    # factory hall with saw-tooth roof
    HY = 0.42
    box("HallBody", (1.25, 0.48, 0.34), (0, HY, 0.2), hall, zone, bevel=0.01)
    box("HallStripe", (1.26, 0.49, 0.04), (0, HY, 0.3), orange, zone)
    box("HallDoor", (0.24, 0.01, 0.2), (-0.35, HY - 0.245, 0.13), graphite, zone)
    bm = bmesh.new()
    for k in range(4):
        x = -0.47 + k * 0.315
        bm_box(bm, (0.3, 0.46, 0.02), (x, HY + 0.05, 0.42), Matrix.Rotation(math.radians(-24), 4, "X"))
    finish_mesh("HallRoof", bm, solar, zone)
    bm = bmesh.new()
    for k in range(5):
        bm_box(bm, (0.14, 0.008, 0.06), (0.05 + k * 0.11 - 0.1, HY - 0.245, 0.2))
    finish_mesh("HallWindows", bm, glass, zone)

    # conveyor along X
    CY, CZ, CL = -0.2, 0.13, 1.2
    box("ConveyorFrame", (CL, 0.16, 0.04), (0, CY, CZ), frame, zone, bevel=0.006)
    box("ConveyorBelt", (CL - 0.02, 0.13, 0.012), (0, CY, CZ + 0.024), belt, zone)
    bm = bmesh.new()
    for x in (-0.55, -0.2, 0.2, 0.55):
        for y in (-0.065, 0.065):
            bm_box(bm, (0.02, 0.02, 0.11), (x, CY + y, 0.055))
    finish_mesh("ConveyorLegs", bm, graphite, zone)
    bm = bmesh.new()
    for x in (-CL / 2, CL / 2):
        bm_cyl(bm, 0.028, 0.17, (x, CY, CZ), ROT_X90, seg=20)
    finish_mesh("ConveyorRollers", bm, steel, zone, smooth_angle=40)
    # drive motor
    cyl("ConveyorMotor", 0.035, 0.09, (-CL / 2, CY - 0.13, CZ), graphite, zone, rot=ROT_X90, bevel=0.005)

    # light barrier sensor (two posts + laser beam)
    for k, y in enumerate((CY - 0.11, CY + 0.11)):
        cyl(f"SensorPost{k}", 0.012, 0.22, (-0.25, y, 0.11), graphite, zone, seg=12)
        box(f"SensorHead{k}", (0.04, 0.03, 0.05), (-0.25, y, 0.2), orange, zone, bevel=0.005)
    beam = cyl("Laser0", 0.004, 0.2, (-0.25, CY, 0.2), laser, zone, rot=ROT_X90, seg=8)

    # proximity sensor on a bracket above the belt
    box("ProxBracket", (0.02, 0.2, 0.02), (0.1, CY, 0.27), graphite, zone)
    cyl("ProxPost", 0.01, 0.27, (0.1, CY + 0.1, 0.135), graphite, zone, seg=10)
    cyl("ProxSensor", 0.018, 0.07, (0.1, CY, 0.23), steel, zone, seg=16)
    cyl("Sensor1Light", 0.019, 0.012, (0.1, CY, 0.27), led_g, zone, seg=16)

    # servo units with pusher arms
    for k, x in enumerate((0.3, -0.05)):
        side = -1 if k == 0 else 1
        sy = CY + side * 0.16
        box(f"ServoBody{k}", (0.09, 0.07, 0.1), (x, sy, 0.08), graphite, zone, bevel=0.008)
        box(f"ServoLabel{k}", (0.091, 0.071, 0.02), (x, sy, 0.1), orange, zone)
        cyl(f"ServoShaft{k}", 0.014, 0.05, (x, sy, 0.155), steel, zone, seg=16)
        arm = empty(f"ServoArm{k}", (x, sy, 0.17), zone)
        box(f"ServoHorn{k}", (0.03, 0.15, 0.015), (0, -side * 0.06, 0), orange, arm, bevel=0.004)
        box(f"ServoPad{k}", (0.06, 0.012, 0.03), (0, -side * 0.13, -0.005), steel, arm)

    # sorting bin at the end
    bm = bmesh.new()
    bm_box(bm, (0.18, 0.2, 0.012), (0.72, CY, 0.035))
    for (sx, sy, w, d) in ((0.81, CY, 0.012, 0.2), (0.63, CY, 0.012, 0.2), (0.72, CY + 0.1, 0.18, 0.012), (0.72, CY - 0.1, 0.18, 0.012)):
        bm_box(bm, (w, d, 0.08), (sx, sy, 0.07))
    finish_mesh("OutputBin", bm, orange, zone)

    # PLC control cabinet
    box("PlcCabinet", (0.2, 0.09, 0.3), (-0.5, -0.55, 0.18), mat("PlcGrey", "#cbd2da", 0.3, 0.4), zone, bevel=0.008)
    box("PlcScreen", (0.12, 0.006, 0.07), (-0.5, -0.597, 0.25), screen, zone)
    bm = bmesh.new()
    for k in range(4):
        bm_box(bm, (0.015, 0.006, 0.015), (-0.56 + k * 0.04, -0.597, 0.17))
    finish_mesh("PlcLeds", bm, led_g, zone)

    # parcels moving on the belt (animated on the website)
    for k in range(4):
        it = empty(f"Item{k}", (-0.5 + k * 0.3, CY, CZ + 0.03), zone)
        box(f"ItemBox{k}", (0.07, 0.07, 0.06), (0, 0, 0.03), carton, it, bevel=0.004)


# ------------------------------------------------------------------ smart city: water reservoirs


def build_water(root, cx, cy):
    """Two glass water reservoirs with level sensors, pump and pipe network."""
    floor = mat("PlantFloor", "#3a4250", 0.1, 0.7)
    concrete = mat("Concrete", "#cfd6df", 0.1, 0.55)
    tank_glass = mat("TankGlass", "#e5e7eb", 0.0, 0.05)
    water = mat("TankWater", "#7f97aa", 0.1, 0.1, emit="#3e5566", strength=0.4)
    steel = mat("SteelC", "#c5ccd6", 1.0, 0.2)
    pipe = mat("Pipe", "#64748b", 0.8, 0.35)
    graphite = mat("Graphite", "#262b33", 0.6, 0.35)
    led_c = mat("LedCyan", "#f5f5f5", 0.0, 0.3, emit="#f5f5f5", strength=6.0)
    orange = mat("IndustrialOrange", "#ff6a13", 0.15, 0.35)

    zone = empty("WaterZone", (cx, cy, 0), root)
    box("PlantFloor", (1.5, 1.5, 0.03), (0, 0, 0.015), floor, zone)

    H, R = 0.72, 0.22
    for k, x in enumerate((-0.32, 0.32)):
        y = -0.12
        cyl(f"TankBase{k}", R + 0.04, 0.06, (x, y, 0.06), concrete, zone, bevel=0.01)
        cyl(f"TankRingBottom{k}", R + 0.012, 0.03, (x, y, 0.105), steel, zone)
        cyl(f"TankRingTop{k}", R + 0.012, 0.03, (x, y, 0.09 + H), steel, zone)
        cyl(f"TankLid{k}", R + 0.005, 0.03, (x, y, 0.12 + H), steel, zone, bevel=0.005)
        cyl(f"TankGlass{k}", R, H, (x, y, 0.09 + H / 2), tank_glass, zone, seg=48)
        # water column: origin at the bottom so the website can scale it in height
        wat = empty(f"Water{k}", (x, y, 0.1), zone)
        cyl(f"WaterMesh{k}", R - 0.012, H - 0.04, (0, 0, (H - 0.04) / 2), water, wat, seg=48)
        # level sensor on the lid
        box(f"LevelSensor{k}", (0.07, 0.05, 0.05), (x + 0.08, y, 0.16 + H), graphite, zone, bevel=0.005)
        box(f"LevelLed{k}", (0.03, 0.052, 0.012), (x + 0.08, y, 0.17 + H), led_c, zone)
        # ladder
        bm = bmesh.new()
        for sx in (-0.04, 0.04):
            bm_box(bm, (0.008, 0.008, H), (x + sx, y + R + 0.03, 0.09 + H / 2))
        for r_ in range(7):
            bm_box(bm, (0.08, 0.006, 0.006), (x, y + R + 0.03, 0.15 + r_ * 0.09))
        finish_mesh(f"Ladder{k}", bm, steel, zone)
        box(f"TankBand{k}", (0.02, 0.01, 0.5), (x - R * 0.7, y - R * 0.72, 0.1 + H / 2), orange, zone)

    # pipe network + pump between the tanks
    bm = bmesh.new()
    bm_cyl(bm, 0.022, 0.4, (0, -0.12, 0.16), ROT_Y90, seg=16)
    bm_cyl(bm, 0.022, 0.6, (0, 0.18, 0.16), ROT_X90, seg=16)
    bm_cyl(bm, 0.022, 0.7, (0.35, 0.48, 0.16), ROT_Y90, seg=16)
    finish_mesh("Pipes", bm, pipe, zone, smooth_angle=50)
    box("PumpBody", (0.12, 0.12, 0.12), (0, -0.12, 0.13), graphite, zone, bevel=0.01)
    cyl("PumpMotor", 0.05, 0.12, (0, -0.24, 0.15), orange, zone, rot=ROT_X90, bevel=0.006)
    rot = empty("PumpRotor", (0, -0.31, 0.15), zone)
    bm = bmesh.new()
    for b in range(4):
        bm_box(bm, (0.012, 0.01, 0.08), (0, 0, 0), Matrix.Rotation(b * math.pi / 4, 4, "Y"))
    finish_mesh("PumpFan", bm, steel, rot)
    # flow markers travelling along the outgoing pipe
    for k in range(4):
        fm = empty(f"Flow{k}", (0, 0.18, 0.16), zone)
        bm = bmesh.new()
        bm_sphere(bm, 0.026, (0, 0, 0), seg=12)
        finish_mesh(f"FlowDot{k}", bm, led_c, fm, smooth_angle=80)


# ------------------------------------------------------------------ ATM


def build_atm():
    reset()
    _mats.clear()
    shell = mat("Shell", "#dfe4ea", 0.35, 0.35)
    navy = mat("Navy", "#1c1c22", 0.4, 0.35)
    graphite = mat("Graphite", "#22272e", 0.6, 0.4)
    steel = mat("Steel", "#c5ccd6", 1.0, 0.2)
    black = mat("Black", "#0b0d10", 0.2, 0.5)
    cyan = mat("AccentCyan", "#f5f5f5", 0.0, 0.3, emit="#f5f5f5", strength=5.0)
    orange = mat("IndustrialOrange", "#ff6a13", 0.15, 0.35, emit="#ff6a13", strength=0.6)
    green = mat("GreenLight", "#22c55e", 0.0, 0.3, emit="#22c55e", strength=6.0)
    screen = mat("ScreenGlow", "#27272a", 0.0, 0.15, emit="#f4f4f5", strength=1.2)
    key = mat("Key", "#9aa4b1", 0.9, 0.3)
    keyred = mat("KeyRed", "#dc2626", 0.3, 0.4)
    keyyel = mat("KeyYellow", "#eab308", 0.3, 0.4)
    keygrn = mat("KeyGreen", "#16a34a", 0.3, 0.4)

    root = empty("ATM", (0, 0, 0))
    W, D = 0.8, 0.7
    FY = -D / 2  # front face y

    box("Plinth", (W + 0.1, D + 0.06, 0.08), (0, 0, 0.04), graphite, root, bevel=0.01)
    box("Body", (W, D, 1.5), (0, 0, 0.83), shell, root, bevel=0.025)
    box("Header", (W + 0.02, D + 0.02, 0.24), (0, 0, 1.7), navy, root, bevel=0.03)
    box("HeaderStrip", (W - 0.1, 0.01, 0.04), (0, FY - 0.011, 1.7), cyan, root)
    for sx in (-1, 1):
        box(f"SideStrip{'L' if sx < 0 else 'R'}", (0.01, 0.03, 1.4), (sx * (W / 2 + 0.006), FY + 0.06, 0.85), cyan, root)

    # screen area with privacy hood
    box("ScreenBezel", (0.6, 0.03, 0.46), (0, FY - 0.01, 1.3), black, root, bevel=0.01)
    scr = box("Screen", (0.5, 0.01, 0.34), (0, FY - 0.03, 1.31), screen, root)
    box("HoodL", (0.03, 0.14, 0.5), (-0.315, FY - 0.07, 1.3), navy, root, bevel=0.008)
    box("HoodR", (0.03, 0.14, 0.5), (0.315, FY - 0.07, 1.3), navy, root, bevel=0.008)
    box("HoodTop", (0.66, 0.14, 0.03), (0, FY - 0.07, 1.565), navy, root, bevel=0.008)
    bm = bmesh.new()
    bm_sphere(bm, 0.014, (0, 0, 0), seg=16)
    finish_mesh("Camera", bm, black, root, loc=(0, FY - 0.13, 1.55), smooth_angle=80)
    # side buttons (function keys)
    bm = bmesh.new()
    for i in range(4):
        z = 1.2 + i * 0.06
        bm_box(bm, (0.025, 0.015, 0.03), (-0.275, FY - 0.035, z))
        bm_box(bm, (0.025, 0.015, 0.03), (0.275, FY - 0.035, z))
    finish_mesh("FunctionKeys", bm, key, root)

    # console shelf (tilted)
    tilt = Matrix.Rotation(math.radians(14), 4, "X")
    shelf = empty("Console", (0, FY - 0.13, 1.0), root)
    shelf.rotation_euler = (math.radians(14), 0, 0)
    box("Shelf", (0.72, 0.26, 0.06), (0, 0, 0), graphite, shelf, bevel=0.012)
    box("ShelfLip", (0.72, 0.02, 0.07), (0, -0.13, 0.0), orange, shelf, bevel=0.005)
    # keypad 4x4
    bm_k, bm_r, bm_y, bm_g = bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new()
    for r in range(4):
        for c in range(4):
            x = 0.06 + c * 0.055
            y = 0.08 - r * 0.05
            target = bm_k
            if c == 3:
                target = (bm_r, bm_y, bm_g, bm_k)[r]
            bm_box(target, (0.045, 0.04, 0.016), (x, y, 0.038))
    finish_mesh("Keypad", bm_k, key, shelf)
    finish_mesh("KeyCancel", bm_r, keyred, shelf)
    finish_mesh("KeyClear", bm_y, keyyel, shelf)
    finish_mesh("KeyEnter", bm_g, keygrn, shelf)
    box("PinShieldL", (0.012, 0.2, 0.06), (0.025, 0.0, 0.06), black, shelf)
    box("PinShieldR", (0.012, 0.2, 0.06), (0.255, 0.0, 0.06), black, shelf)
    # card reader
    box("CardReader", (0.14, 0.09, 0.09), (-0.2, 0.04, 0.07), black, shelf, bevel=0.01)
    box("CardLight", (0.1, 0.006, 0.012), (-0.2, -0.008, 0.09), green, shelf)
    box("NFCPad", (0.1, 0.08, 0.008), (-0.2, -0.07, 0.034), cyan, shelf)

    # cash dispenser + receipt
    box("CashSlotFrame", (0.46, 0.03, 0.09), (0, FY - 0.012, 0.8), steel, root, bevel=0.008)
    box("CashSlot", (0.38, 0.01, 0.025), (0, FY - 0.028, 0.8), black, root)
    box("CashLight", (0.4, 0.006, 0.008), (0, FY - 0.029, 0.765), green, root)
    box("ReceiptSlot", (0.12, 0.02, 0.02), (0.24, FY - 0.01, 0.9), black, root)

    # safe door
    box("SafeDoor", (0.68, 0.012, 0.6), (0, FY - 0.004, 0.38), mat("SafePanel", "#c3cad3", 0.5, 0.35), root, bevel=0.006)
    cyl("Dial", 0.045, 0.03, (0.2, FY - 0.02, 0.42), steel, root, rot=ROT_X90, bevel=0.004)
    box("Handle", (0.02, 0.03, 0.16), (-0.25, FY - 0.025, 0.4), steel, root, bevel=0.006)
    box("BrandPlate", (0.22, 0.008, 0.035), (0, FY - 0.012, 0.6), orange, root)

    export("atm")


build_robot_arm()
build_smart_city()
build_atm()
print("DONE")
