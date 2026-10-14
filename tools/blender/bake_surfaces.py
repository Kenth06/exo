"""Bake tileable PBR surfaces for Exo's sets that Poly Haven doesn't have as continuous slabs.

Run inside Blender (Cycles available):  exec(open(r"...\\tools\\blender\\bake_surfaces.py").read())
Outputs <ROOT>/baked/<name>_{diff,rough,nor}.jpg at RES x RES. Every procedural pattern samples 4D noise
on a torus (cos/sin of U and V), so the images tile with no seams.
"""

import math
import os

import bpy

ROOT = r"C:\Users\Kenneth\Desktop\Projects\exo\assets-src\polyhaven"
OUT = os.path.join(ROOT, "baked")
RES = 1024
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene
previous_engine = scene.render.engine
scene.render.engine = "CYCLES"
scene.cycles.samples = 4
scene.cycles.device = "CPU"
scene.render.bake.margin = 0

plane = bpy.data.objects.get("BakePlane")
if plane is None:
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(5, 0, 0))
    plane = bpy.context.active_object
    plane.name = "BakePlane"


class Graph:
    def __init__(self, mat):
        self.t = mat.node_tree
        for n in list(self.t.nodes):
            self.t.nodes.remove(n)
        self.uv = self.node("ShaderNodeTexCoord").outputs["UV"]

    def node(self, kind, **inputs):
        n = self.t.nodes.new(kind)
        for k, v in inputs.items():
            n.inputs[k].default_value = v
        return n

    def link(self, a, b):
        self.t.links.new(a, b)

    def math(self, op, a, b=None):
        n = self.t.nodes.new("ShaderNodeMath")
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                self.link(v, n.inputs[i])
        return n.outputs[0]

    def noise(self, scale, detail, rough, seed, distortion=0.0):
        """Tileable 4D noise: U and V each map to a circle of circumference `scale`."""
        sep = self.t.nodes.new("ShaderNodeSeparateXYZ")
        self.link(self.uv, sep.inputs[0])
        r = scale / (2 * math.pi)

        def circle(src, fn):
            angle = self.math("MULTIPLY", src, 2 * math.pi)
            return self.math("ADD", self.math("MULTIPLY", self.math(fn, angle), r), seed)

        comb = self.t.nodes.new("ShaderNodeCombineXYZ")
        self.link(circle(sep.outputs[0], "COSINE"), comb.inputs[0])
        self.link(circle(sep.outputs[0], "SINE"), comb.inputs[1])
        self.link(circle(sep.outputs[1], "COSINE"), comb.inputs[2])
        n = self.t.nodes.new("ShaderNodeTexNoise")
        n.noise_dimensions = "4D"
        n.inputs["Scale"].default_value = 1.0
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        n.inputs["Distortion"].default_value = distortion
        self.link(comb.outputs[0], n.inputs["Vector"])
        self.link(circle(sep.outputs[1], "SINE"), n.inputs["W"])
        return n.outputs["Fac"]

    def ridge(self, fac, width):
        """1 on the 0.5 iso-line of the noise, fading to 0 at `width`: thin veins."""
        d = self.math("ABSOLUTE", self.math("SUBTRACT", fac, 0.5))
        m = self.node("ShaderNodeMapRange")
        m.inputs["From Min"].default_value = 0.0
        m.inputs["From Max"].default_value = width
        m.inputs["To Min"].default_value = 1.0
        m.inputs["To Max"].default_value = 0.0
        self.link(d, m.inputs["Value"])
        return m.outputs["Result"]

    def step(self, fac, lo, hi):
        m = self.node("ShaderNodeMapRange")
        m.inputs["From Min"].default_value = lo
        m.inputs["From Max"].default_value = hi
        m.clamp = True
        self.link(fac, m.inputs["Value"])
        return m.outputs["Result"]

    def mix(self, fac, a, b):
        m = self.t.nodes.new("ShaderNodeMix")
        m.data_type = "RGBA"
        self.link(fac, m.inputs["Factor"])
        for sock, v in ((m.inputs[6], a), (m.inputs[7], b)):
            if isinstance(v, tuple):
                sock.default_value = (*v, 1.0)
            else:
                self.link(v, sock)
        return m.outputs[2]


def marble(g, base, cloud, vein, vein_strength):
    cloudiness = g.noise(2.0, 5, 0.5, 1.7, distortion=0.3)
    # Few long primary veins plus faint hairline secondaries, like Carrara or Nero Marquina.
    v1 = g.ridge(g.noise(1.2, 10, 0.58, 4.1, distortion=1.2), 0.006)
    v2 = g.ridge(g.noise(2.6, 9, 0.6, 9.3, distortion=0.9), 0.0035)
    veins = g.math("MINIMUM", g.math("ADD", v1, g.math("MULTIPLY", v2, 0.4)), 1.0)
    color = g.mix(g.math("MULTIPLY", veins, vein_strength), g.mix(cloudiness, base, cloud), vein)
    rough = g.math("ADD", 0.16, g.math("MULTIPLY", veins, 0.08))
    height = g.math("MULTIPLY", veins, 0.15)
    return color, rough, height


def quartz(g):
    cloud = g.noise(6.0, 4, 0.5, 2.2)
    flecks = g.step(g.noise(55.0, 2, 0.4, 7.7), 0.66, 0.72)
    color = g.mix(flecks, g.mix(cloud, (0.86, 0.86, 0.84), (0.9, 0.9, 0.88)), (0.55, 0.55, 0.56))
    rough = g.math("ADD", 0.26, g.math("MULTIPLY", flecks, 0.1))
    return color, rough, g.math("MULTIPLY", flecks, 0.05)


def slate(g):
    layers = g.noise(3.0, 12, 0.7, 5.5, distortion=0.3)
    grain = g.noise(28.0, 6, 0.6, 3.3)
    tone = g.math("ADD", g.math("MULTIPLY", layers, 0.7), g.math("MULTIPLY", grain, 0.3))
    streaks = g.step(g.noise(1.5, 8, 0.65, 8.8, distortion=0.5), 0.45, 0.75)
    tone = g.math("ADD", g.math("MULTIPLY", tone, 0.75), g.math("MULTIPLY", streaks, 0.25))
    color = g.mix(tone, (0.025, 0.03, 0.036), (0.15, 0.155, 0.165))
    rough = g.math("ADD", 0.62, g.math("MULTIPLY", grain, 0.2))
    return color, rough, g.math("MULTIPLY", tone, 1.0)


def linen(g):
    """Poly Haven's rough_linen scan, desaturated and tinted to undyed oat linen."""
    img = g.node("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.join(ROOT, "tex", "rough_linen_diff.jpg"), check_existing=True)
    g.link(g.uv, img.inputs["Vector"])
    hsv = g.node("ShaderNodeHueSaturation", Saturation=0.0, Value=1.15)
    g.link(img.outputs["Color"], hsv.inputs["Color"])
    tint = g.t.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    g.link(hsv.outputs["Color"], tint.inputs[6])
    tint.inputs[7].default_value = (0.86, 0.79, 0.67, 1.0)
    rough_img = g.node("ShaderNodeTexImage")
    rough_img.image = bpy.data.images.load(os.path.join(ROOT, "tex", "rough_linen_rough.jpg"), check_existing=True)
    rough_img.image.colorspace_settings.name = "Non-Color"
    g.link(g.uv, rough_img.inputs["Vector"])
    return tint.outputs[2], rough_img.outputs["Color"], None


SURFACES = {
    "marble_white": lambda g: marble(g, (0.91, 0.9, 0.88), (0.84, 0.84, 0.83), (0.38, 0.4, 0.44), 0.8),
    "marble_black": lambda g: marble(g, (0.022, 0.022, 0.025), (0.05, 0.05, 0.053), (0.8, 0.79, 0.76), 0.75),
    "quartz": quartz,
    "slate": slate,
    "linen": linen,
}


def bake_pass(mat, g, source, kind, name, colorspace):
    """Bake `source` into an image: EMIT for color/roughness, NORMAL for the bumped normal."""
    img = bpy.data.images.new(f"{name}_{kind}", RES, RES, alpha=False)
    img.colorspace_settings.name = colorspace
    target = g.node("ShaderNodeTexImage")
    target.image = img
    out = g.node("ShaderNodeOutputMaterial")
    if kind == "nor":
        bsdf = g.node("ShaderNodeBsdfPrincipled")
        if source is not None:
            bump = g.node("ShaderNodeBump", Strength=0.35, Distance=0.002)
            g.link(source, bump.inputs["Height"])
            g.link(bump.outputs["Normal"], bsdf.inputs["Normal"])
        g.link(bsdf.outputs["BSDF"], out.inputs["Surface"])
        bake_type = "NORMAL"
    else:
        emit = g.node("ShaderNodeEmission")
        g.link(source, emit.inputs["Color"])
        g.link(emit.outputs["Emission"], out.inputs["Surface"])
        bake_type = "EMIT"
    for n in g.t.nodes:
        n.select = False
    target.select = True
    g.t.nodes.active = target
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    plane.select_set(True)
    bpy.context.view_layer.objects.active = plane
    bpy.ops.object.bake(type=bake_type, normal_space="TANGENT")
    img.filepath_raw = os.path.join(OUT, f"{name}_{kind}.jpg")
    img.file_format = "JPEG"
    scene.render.image_settings.quality = 92
    img.save()
    g.t.nodes.remove(out)
    g.t.nodes.remove(target)
    return img.filepath_raw


done = []
for name, build in SURFACES.items():
    mat = bpy.data.materials.get(f"Bake_{name}") or bpy.data.materials.new(f"Bake_{name}")
    mat.use_nodes = True
    plane.data.materials.clear()
    plane.data.materials.append(mat)
    g = Graph(mat)
    color, rough, height = build(g)
    done.append(bake_pass(mat, g, color, "diff", name, "sRGB"))
    done.append(bake_pass(mat, g, rough, "rough", name, "Non-Color"))
    if height is not None:
        done.append(bake_pass(mat, g, height, "nor", name, "Non-Color"))

scene.render.engine = previous_engine
print("baked", len(done), "maps")
