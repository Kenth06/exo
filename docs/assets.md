# Scene assets

Photographic assets live in `apps/web/public` and load on demand per scene (`src/lib/engine/assets.ts`).

| Folder                             | What                                                                   | Source                                                                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env/*.hdr`                        | 1k HDRIs: lighting, reflections and the blurred background behind sets | [Poly Haven](https://polyhaven.com) (CC0): studio_small_08, studio_small_03, brown_photostudio_02, photo_studio_loft_hall, artist_workshop                                                                                    |
| `surfaces/*_{diff,nor,rough}.webp` | 1024 px PBR maps for tabletops and the plinth                          | Poly Haven scans (CC0): white_oak_veneer, wood_table_worn, concrete_floor_02, terrazzo_tiles, plywood, wood_cabinet_worn_long, rough_linen (normal). Baked in Blender: marble-white, marble-black, quartz, slate, linen color |

## Rebuilding them with Blender

Raw downloads go to `assets-src/` (git-ignored). With Blender open and the MCP addon running:

1. `tools/blender/bake_surfaces.py` bakes the procedural surfaces Poly Haven doesn't have as continuous
   slabs. Patterns sample 4D noise on a torus, so every map tiles without seams.
2. `tools/blender/export_web_assets.py` resizes everything to 1024 px WebP and copies the HDRIs into
   `apps/web/public`.

Run either from Blender's Python console or through the MCP with
`exec(open(r"...\tools\blender\<script>.py", encoding="utf-8").read())`.

Tile sizes (mm per texture repeat) live in `SURFACE_TILE_MM` in `assets.ts`; keep them in sync with the
source's real-world dimensions so wood grain and marble veins read at the right scale.

## Rendering modes

- **Preview / Fast**: WebGL raster with GTAO, the HDRI as PMREM environment, a shadow-casting key light
  aimed at the HDRI's brightest region.
- **Photo**: `three-gpu-pathtracer` (`src/lib/engine/photo.ts`). The same scene, lit only by the HDRI,
  256 samples, denoised, with a physical camera (f/11 for whole products, f/3.5 for layer close-ups).
  A `PhotoSession` builds the BVH once per backdrop and reuses it for every angle, size and color.
