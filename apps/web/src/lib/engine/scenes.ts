// Each catalog scene is a backdrop (seamless paper sweep or a tabletop set), an HDRI that lights it,
// and for sets the same HDRI blurred behind the table like a shallow depth of field.

import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
  Vector3,
} from "three";
import { type Hdri, type HdriId, loadHdri, loadSurface, type Surface, SURFACE_TILE_MM, type SurfaceId } from "./assets";

export interface SceneSpec {
  hdri: HdriId;
  /** Rotation of the HDRI around the vertical axis, degrees. Turns the window to a flattering side. */
  hdriRotation: number;
  backdrop:
    | { type: "sweep"; color: string; roughness: number }
    | { type: "set"; surface: SurfaceId; roughness: number; blur: number; backgroundIntensity: number };
  plinth?: SurfaceId;
  /** Key light: casts the contact shadow. Its direction follows the HDRI's brightest region. */
  keyIntensity: number;
  keyColor: string;
  softness: number;
  /** Optional back light for dark backdrops, degrees around the model. */
  rim?: { intensity: number; azimuth: number; elevation: number };
  envIntensity: number;
  exposure: number;
}

const sweep = (color: string, overrides: Partial<SceneSpec> = {}): SceneSpec => ({
  hdri: "studio_small_08",
  hdriRotation: 0,
  backdrop: { type: "sweep", color, roughness: 0.95 },
  keyIntensity: 1.6,
  keyColor: "#ffffff",
  softness: 10,
  envIntensity: 0.85,
  exposure: 1,
  ...overrides,
});

const set = (surface: SurfaceId, hdri: HdriId, overrides: Partial<SceneSpec> = {}, roughness = 1): SceneSpec => ({
  hdri,
  hdriRotation: 0,
  backdrop: { type: "set", surface, roughness, blur: 0.32, backgroundIntensity: 0.9 },
  keyIntensity: 1.4,
  keyColor: "#fff6ec",
  softness: 8,
  envIntensity: 1,
  exposure: 1,
  ...overrides,
});

export const SCENE_SPECS: Record<string, SceneSpec> = {
  "white-sweep": sweep("#f4f4f2", { exposure: 0.95, envIntensity: 0.9 }),
  "grey-sweep": sweep("#9c9d9e"),
  "black-sweep": sweep("#141415", {
    hdri: "studio_small_03",
    keyIntensity: 1.8,
    softness: 5,
    envIntensity: 0.55,
    rim: { intensity: 2.2, azimuth: 160, elevation: 30 },
  }),
  "olive-paper": sweep("#7d7f5a"),
  "powder-blue": sweep("#b9cfe0"),
  "blush-paper": sweep("#e8c8c2"),
  "stone-plinth": sweep("#c6bfb3", { plinth: "concrete" }),
  "oak-table": set("oak", "photo_studio_loft_hall"),
  "walnut-desk": set("walnut", "brown_photostudio_02", { keyColor: "#ffe2bd", exposure: 1.05 }),
  "marble-table": set("marble-white", "photo_studio_loft_hall"),
  "black-marble": set("marble-black", "studio_small_03", { envIntensity: 0.75, softness: 5 }),
  "concrete-desk": set("concrete", "artist_workshop", { keyColor: "#f2f5ff", softness: 11 }),
  "linen-cloth": set("linen", "brown_photostudio_02", { softness: 12 }),
  terrazzo: set("terrazzo", "photo_studio_loft_hall", { exposure: 1.03 }),
  slate: set("slate", "studio_small_03", { envIntensity: 0.7, softness: 4 }),
  "maker-bench": set("plywood", "artist_workshop"),
  "kitchen-counter": set("quartz", "photo_studio_loft_hall", { exposure: 1.04 }),
  nightstand: set("painted-wood", "brown_photostudio_02", { keyColor: "#ffd7a3", exposure: 1.06 }),
};

/** A cyclorama: floor that curves up into a back wall, extruded across X. Origin at floor center. */
const sweepGeometry = (width: number, depth: number, radius: number, height: number) => {
  const profile: Array<[number, number]> = [
    [depth, 0],
    [0, 0],
  ];
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    profile.push([-Math.sin(a) * radius, radius - Math.cos(a) * radius]);
  }
  profile.push([-radius, height]);
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  profile.forEach(([z, y], i) => {
    const prev = profile[Math.max(0, i - 1)]!;
    const next = profile[Math.min(profile.length - 1, i + 1)]!;
    const tz = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const l = Math.hypot(tz, ty) || 1;
    for (const x of [-width / 2, width / 2]) {
      pos.push(x, y, z);
      nrm.push(0, -tz / l, ty / l);
    }
  });
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
};

/** Radial fade so the tabletop dissolves into the blurred background instead of ending in a hard edge. */
let fadeTexture: Texture | null = null;
const tableFade = () => {
  if (fadeTexture) return fadeTexture;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.55, "#fff");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  fadeTexture = new CanvasTexture(c);
  return fadeTexture;
};

const surfaceMaterial = (surface: Surface, id: SurfaceId, extent: number, roughness: number) => {
  const [tw, th] = SURFACE_TILE_MM[id];
  const [map, normalMap, roughnessMap] = [surface.map, surface.normalMap, surface.roughnessMap].map((t) => {
    const c = t.clone();
    c.repeat.set(extent / tw, extent / th);
    c.needsUpdate = true;
    return c;
  });
  return new MeshStandardMaterial({ map, normalMap, roughnessMap, roughness, metalness: 0 });
};

export interface SceneAssets {
  hdri: Hdri;
  surface: Surface | null;
  plinth: Surface | null;
}

export const loadSceneAssets = async (spec: SceneSpec): Promise<SceneAssets> => {
  const [hdri, surface, plinth] = await Promise.all([
    loadHdri(spec.hdri),
    spec.backdrop.type === "set" ? loadSurface(spec.backdrop.surface) : Promise.resolve(null),
    spec.plinth ? loadSurface(spec.plinth) : Promise.resolve(null),
  ]);
  return { hdri, surface, plinth };
};

export interface BuiltScene {
  group: Group;
  /** Height the model must be lifted (plinths). */
  lift: number;
  background: Color | Texture;
  backgroundBlurriness: number;
  backgroundIntensity: number;
  rotation: Euler;
  /** Direct lights, switched off in Photo mode where the HDRI alone lights the scene. */
  lights: DirectionalLight[];
  spec: SceneSpec;
  dispose: () => void;
}

/** Build the scene around a model whose footprint is `size` mm (largest dimension) and `height` mm tall. */
export const buildScene = (spec: SceneSpec, assets: SceneAssets, size: number, height: number): BuiltScene => {
  const group = new Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const S = Math.max(size, 20);
  const rotation = new Euler(0, MathUtils.degToRad(spec.hdriRotation), 0);
  let lift = 0;
  let background: Color | Texture;
  let blur = 0;
  let bgIntensity = 1;

  if (spec.backdrop.type === "sweep") {
    const geo = sweepGeometry(S * 40, S * 20, S * 4, S * 24);
    const mat = new MeshStandardMaterial({
      color: spec.backdrop.color,
      roughness: spec.backdrop.roughness,
      metalness: 0,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.z = -S * 1.6;
    mesh.receiveShadow = true;
    group.add(mesh);
    disposables.push(geo, mat);
    background = new Color(spec.backdrop.color);
  } else {
    const extent = S * 14;
    const geo = new PlaneGeometry(extent, extent);
    const mat = surfaceMaterial(assets.surface!, spec.backdrop.surface, extent, spec.backdrop.roughness);
    mat.alphaMap = tableFade();
    mat.transparent = true;
    const top = new Mesh(geo, mat);
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    group.add(top);
    disposables.push(geo, mat);
    background = assets.hdri.texture;
    blur = spec.backdrop.blur;
    bgIntensity = spec.backdrop.backgroundIntensity;
  }

  if (spec.plinth && assets.plinth) {
    lift = Math.max(12, height * 0.28);
    const r = size * 0.62;
    const geo = new CylinderGeometry(r, r * 1.02, lift, 96, 1);
    const mat = surfaceMaterial(assets.plinth, spec.plinth, r * 2, 1);
    const plinth = new Mesh(geo, mat);
    plinth.position.y = lift / 2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);
    disposables.push(geo, mat);
  }

  // Key light from the HDRI's brightest region, kept above 20° so the shadow lands on the table.
  const sun = assets.hdri.sun.clone().applyEuler(rotation);
  const elevation = Math.max(MathUtils.degToRad(20), Math.asin(MathUtils.clamp(sun.y, -1, 1)));
  const azimuth = Math.atan2(sun.x, sun.z);
  const dir = new Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  );
  const key = new DirectionalLight(spec.keyColor, spec.keyIntensity);
  key.position.copy(dir).multiplyScalar(S * 6);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.radius = spec.softness;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02 * (S / 100);
  const cam = key.shadow.camera;
  const half = S * 1.6;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = S * 0.5;
  cam.far = S * 14;
  group.add(key);
  group.add(key.target);
  key.target.position.set(0, height * 0.4, 0);

  const lights = [key];
  if (spec.rim) {
    const az = MathUtils.degToRad(spec.rim.azimuth);
    const el = MathUtils.degToRad(spec.rim.elevation);
    const rim = new DirectionalLight("#ffffff", spec.rim.intensity);
    rim.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(S * 6);
    group.add(rim);
    lights.push(rim);
  }

  return {
    group,
    lift,
    background,
    backgroundBlurriness: blur,
    backgroundIntensity: bgIntensity,
    rotation,
    lights,
    spec,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
};
