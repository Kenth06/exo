"""Convert the chosen surfaces and HDRIs into web assets for apps/web/public.

Run inside Blender after bake_surfaces.py:  exec(open(r"...\\tools\\blender\\export_web_assets.py").read())
Writes surfaces/<id>_{diff,nor,rough}.webp (1024 px max) and env/<hdri>.hdr (copied as-is, 1k).
"""

import os
import shutil

import bpy

SRC = r"C:\Users\Kenneth\Desktop\Projects\exo\assets-src\polyhaven"
PUBLIC = r"C:\Users\Kenneth\Desktop\Projects\exo\apps\web\public"
MAX = 1024

# surface id -> (folder, file prefix, maps). Baked surfaces live in baked/, scans in tex/.
SURFACES = {
    "oak": ("tex", "white_oak_veneer", ("diff", "nor", "rough")),
    "walnut": ("tex", "wood_table_worn", ("diff", "nor", "rough")),
    "marble-white": ("baked", "marble_white", ("diff", "nor", "rough")),
    "marble-black": ("baked", "marble_black", ("diff", "nor", "rough")),
    "concrete": ("tex", "concrete_floor_02", ("diff", "nor", "rough")),
    "linen": ("baked", "linen", ("diff", "rough")),
    "terrazzo": ("tex", "terrazzo_tiles", ("diff", "nor", "rough")),
    "slate": ("baked", "slate", ("diff", "nor", "rough")),
    "plywood": ("tex", "plywood", ("diff", "nor", "rough")),
    "quartz": ("baked", "quartz", ("diff", "nor", "rough")),
    "painted-wood": ("tex", "wood_cabinet_worn_long", ("diff", "nor", "rough")),
}
# The linen normal comes straight from the scan.
EXTRA = {"linen_nor": os.path.join(SRC, "tex", "rough_linen_nor.jpg")}
HDRIS = ["studio_small_08", "studio_small_03", "brown_photostudio_02", "photo_studio_loft_hall", "artist_workshop"]

os.makedirs(os.path.join(PUBLIC, "surfaces"), exist_ok=True)
os.makedirs(os.path.join(PUBLIC, "env"), exist_ok=True)
scene = bpy.context.scene
settings = scene.render.image_settings


def export(src_path, out_name, quality, non_color):
    img = bpy.data.images.load(src_path, check_existing=False)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    scale = min(1.0, MAX / max(w, h))
    if scale < 1.0:
        img.scale(round(w * scale), round(h * scale))
    settings.file_format = "WEBP"
    settings.quality = quality
    settings.color_mode = "RGB"
    out = os.path.join(PUBLIC, "surfaces", out_name + ".webp")
    img.save_render(out, scene=scene)
    bpy.data.images.remove(img)
    return out, os.path.getsize(out)


report = []
for sid, (folder, prefix, maps) in SURFACES.items():
    for m in maps:
        path = os.path.join(SRC, folder, f"{prefix}_{m}.jpg")
        report.append(export(path, f"{sid}_{m}", 82 if m == "diff" else 90, m != "diff"))
for name, path in EXTRA.items():
    report.append(export(path, name, 90, True))
for h in HDRIS:
    dst = os.path.join(PUBLIC, "env", h + ".hdr")
    shutil.copyfile(os.path.join(SRC, "hdri", h + ".hdr"), dst)
    report.append((dst, os.path.getsize(dst)))

total = sum(s for _, s in report)
print(f"{len(report)} files, {total / 1e6:.1f} MB")
