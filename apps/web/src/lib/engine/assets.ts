// Loads the photographic assets behind each scene: Poly Haven HDRIs (lighting + blurred background)
// and PBR surfaces (scans, or materials baked in Blender by tools/blender). Everything is cached.

import {
  type DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
} from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

export type HdriId =
  | "studio_small_08"
  | "studio_small_03"
  | "brown_photostudio_02"
  | "photo_studio_loft_hall"
  | "artist_workshop";

export type SurfaceId =
  | "oak"
  | "walnut"
  | "marble-white"
  | "marble-black"
  | "concrete"
  | "linen"
  | "terrazzo"
  | "slate"
  | "plywood"
  | "quartz"
  | "painted-wood";

/** Real-world size (mm) of one texture tile, from Poly Haven metadata or the bake settings. */
export const SURFACE_TILE_MM: Record<SurfaceId, [number, number]> = {
  oak: [500, 500],
  walnut: [550, 550],
  "marble-white": [900, 900],
  "marble-black": [900, 900],
  concrete: [2000, 2000],
  linen: [271, 271],
  terrazzo: [2000, 2000],
  slate: [900, 900],
  plywood: [500, 500],
  quartz: [900, 900],
  "painted-wood": [1000, 500],
};

export interface Hdri {
  texture: DataTexture;
  /** Unit direction (before scene rotation) of the brightest light in the panorama. */
  sun: Vector3;
}

export interface Surface {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
}

const hdris = new Map<HdriId, Promise<Hdri>>();
const surfaces = new Map<SurfaceId, Promise<Surface>>();
const textureLoader = new TextureLoader();

/**
 * Average direction of the brightest 0.2% of pixels: where the key light should come from so the
 * cast shadow agrees with the reflections. Uses three's equirect convention (u from atan2(z, x)).
 */
const brightestDirection = (tex: DataTexture): Vector3 => {
  const { data, width, height } = tex.image as { data: Float32Array; width: number; height: number };
  const step = 2;
  const lum: number[] = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      lum.push(0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!);
    }
  }
  const threshold = lum.toSorted((a, b) => b - a)[Math.max(0, Math.floor(lum.length * 0.002))]!;
  const dir = new Vector3();
  let k = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const l = lum[k++]!;
      if (l < threshold) continue;
      // Row 0 is the top of the panorama.
      const v = 1 - (y + 0.5) / height;
      const u = (x + 0.5) / width;
      const theta = (v - 0.5) * Math.PI;
      const phi = (u - 0.5) * 2 * Math.PI;
      dir.x += Math.cos(theta) * Math.cos(phi) * l;
      dir.y += Math.sin(theta) * l;
      dir.z += Math.cos(theta) * Math.sin(phi) * l;
    }
  }
  if (dir.lengthSq() === 0) return new Vector3(-0.5, 0.7, 0.5).normalize();
  return dir.normalize();
};

export const loadHdri = (id: HdriId): Promise<Hdri> => {
  let p = hdris.get(id);
  if (!p) {
    p = new HDRLoader()
      .setDataType(FloatType)
      .loadAsync(`/env/${id}.hdr`)
      .then((texture) => {
        texture.mapping = EquirectangularReflectionMapping;
        return { texture, sun: brightestDirection(texture) };
      });
    hdris.set(id, p);
    p.catch(() => hdris.delete(id));
  }
  return p;
};

const loadMap = async (url: string, color: boolean) => {
  const t = await textureLoader.loadAsync(url);
  t.colorSpace = color ? SRGBColorSpace : LinearSRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
};

export const loadSurface = (id: SurfaceId): Promise<Surface> => {
  let p = surfaces.get(id);
  if (!p) {
    const base = `/surfaces/${id}`;
    p = Promise.all([
      loadMap(`${base}_diff.webp`, true),
      loadMap(`${base}_nor.webp`, false),
      loadMap(`${base}_rough.webp`, false),
    ]).then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }));
    surfaces.set(id, p);
    p.catch(() => surfaces.delete(id));
  }
  return p;
};
