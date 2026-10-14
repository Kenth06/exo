// Each catalog scene becomes a backdrop (seamless sweep or tabletop set), a lighting rig and an exposure.

import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
} from "three";
import { backdropTexture, type SurfaceKind, SURFACE_TILE_MM, surfaceTexture } from "./textures";

interface LightSpec {
  color: string;
  intensity: number;
  /** Degrees around the model, 0 = from the camera side. */
  azimuth: number;
  elevation: number;
  /** Shadow blur radius (higher = softer, bigger light). */
  softness: number;
}

export interface SceneSpec {
  backdrop:
    | { type: "sweep"; color: string; roughness: number }
    | {
        type: "set";
        surface: SurfaceKind;
        roughness: number;
        wallTop: string;
        wallBottom: string;
        glow: string | null;
      };
  plinth?: { color: string };
  key: LightSpec;
  rim?: LightSpec;
  sky: string;
  ground: string;
  hemiIntensity: number;
  envIntensity: number;
  exposure: number;
}

const studio = (color: string, exposure = 1, overrides: Partial<SceneSpec> = {}): SceneSpec => ({
  backdrop: { type: "sweep", color, roughness: 0.95 },
  key: { color: "#ffffff", intensity: 2.4, azimuth: -40, elevation: 52, softness: 9 },
  rim: { color: "#ffffff", intensity: 0.8, azimuth: 150, elevation: 35, softness: 6 },
  sky: "#ffffff",
  ground: color,
  hemiIntensity: 0.35,
  envIntensity: 0.9,
  exposure,
  ...overrides,
});

const set = (
  surface: SurfaceKind,
  wallTop: string,
  wallBottom: string,
  key: Partial<LightSpec>,
  extra: Partial<SceneSpec> = {},
  roughness = 0.75,
  glow: string | null = "rgba(255,248,235,0.55)",
): SceneSpec => ({
  backdrop: { type: "set", surface, roughness, wallTop, wallBottom, glow },
  key: { color: "#fff4e6", intensity: 2.6, azimuth: -60, elevation: 38, softness: 7, ...key },
  rim: { color: "#dfe8ff", intensity: 0.5, azimuth: 140, elevation: 30, softness: 6 },
  sky: "#f4f1ea",
  ground: "#7b6a58",
  hemiIntensity: 0.4,
  envIntensity: 0.8,
  exposure: 1,
  ...extra,
});

export const SCENE_SPECS: Record<string, SceneSpec> = {
  "white-sweep": studio("#f6f6f4", 0.95, { envIntensity: 0.8, hemiIntensity: 0.35 }),
  "grey-sweep": studio("#9a9b9c", 1),
  "black-sweep": studio("#161617", 1, {
    key: { color: "#ffffff", intensity: 2.2, azimuth: -55, elevation: 45, softness: 5 },
    rim: { color: "#ffffff", intensity: 2.2, azimuth: 160, elevation: 30, softness: 3 },
    envIntensity: 0.45,
    hemiIntensity: 0.1,
  }),
  "olive-paper": studio("#7d7f5a", 1.02),
  "powder-blue": studio("#b9cfe0", 1.04),
  "blush-paper": studio("#e9c9c4", 1.04),
  "stone-plinth": studio("#c9c2b6", 1.02, { plinth: { color: "#b3aca0" } }),
  "oak-table": set("oak", "#e9e4da", "#cfc6b6", {}),
  "walnut-desk": set(
    "walnut",
    "#4a3d33",
    "#2c241e",
    { color: "#ffd9a8", azimuth: 55, elevation: 34 },
    { exposure: 1.08, envIntensity: 0.55 },
    0.6,
    "rgba(255,200,140,0.45)",
  ),
  "marble-table": set("marble-white", "#f1efeb", "#dedbd5", {}, {}, 0.35),
  "black-marble": set(
    "marble-black",
    "#2a2a2c",
    "#1a1a1b",
    { azimuth: -50 },
    { envIntensity: 0.6 },
    0.25,
    "rgba(255,240,220,0.25)",
  ),
  "concrete-desk": set(
    "concrete",
    "#c9c9c7",
    "#a8a8a6",
    { color: "#f2f5ff", softness: 11 },
    {},
    0.9,
    "rgba(240,245,255,0.4)",
  ),
  "linen-cloth": set("linen", "#efe8dc", "#d8cfbf", { softness: 12 }, {}, 0.95),
  terrazzo: set("terrazzo", "#f3f1ec", "#e1ddd5", { intensity: 2.8 }, { exposure: 1.05 }, 0.5),
  slate: set(
    "slate",
    "#3a3d42",
    "#25272a",
    { azimuth: -80, elevation: 28, softness: 4 },
    { envIntensity: 0.5 },
    0.7,
    "rgba(220,230,255,0.25)",
  ),
  "maker-bench": set("plywood", "#d8d4cc", "#b9b2a6", { color: "#fff8ee" }, {}, 0.8),
  "kitchen-counter": set("quartz", "#f4f2ee", "#e4e0d8", { intensity: 2.9 }, { exposure: 1.06 }, 0.3),
  nightstand: set(
    "painted-wood",
    "#6b5a4c",
    "#3f342c",
    { color: "#ffcf96", azimuth: 60, elevation: 30 },
    { exposure: 1.1, envIntensity: 0.5 },
    0.6,
    "rgba(255,190,120,0.5)",
  ),
};

/** A cyclorama: floor that curves up into a back wall, extruded across X. Origin at floor center. */
const sweepGeometry = (width: number, depth: number, radius: number, height: number) => {
  const profile: Array<[number, number]> = [];
  profile.push([depth, 0]);
  profile.push([0, 0]);
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

export interface BuiltScene {
  group: Group;
  keyLight: DirectionalLight;
  /** Height the model must be lifted (plinths). */
  lift: number;
  background: Color;
  spec: SceneSpec;
  dispose: () => void;
}

const lightFrom = (spec: LightSpec, size: number) => {
  const l = new DirectionalLight(spec.color, spec.intensity);
  const az = (spec.azimuth * Math.PI) / 180;
  const el = (spec.elevation * Math.PI) / 180;
  const d = size * 6;
  l.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
  return l;
};

/**
 * Build the scene around a model whose footprint is `size` mm (largest dimension) and `height` mm tall.
 */
export const buildScene = (id: string, size: number, height: number): BuiltScene => {
  const spec = SCENE_SPECS[id] ?? SCENE_SPECS["white-sweep"]!;
  const group = new Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const S = Math.max(size, 20);
  let lift = 0;
  let background: Color;

  if (spec.backdrop.type === "sweep") {
    const geo = sweepGeometry(S * 40, S * 20, S * 4, S * 24);
    const mat = new MeshStandardMaterial({
      color: spec.backdrop.color,
      roughness: spec.backdrop.roughness,
      metalness: 0,
    });
    const sweep = new Mesh(geo, mat);
    sweep.position.z = -S * 1.6;
    sweep.receiveShadow = true;
    group.add(sweep);
    disposables.push(geo, mat);
    background = new Color(spec.backdrop.color);
  } else {
    const tex = surfaceTexture(spec.backdrop.surface).clone();
    tex.needsUpdate = true;
    const extent = S * 30;
    tex.repeat.set(extent / SURFACE_TILE_MM[spec.backdrop.surface], extent / SURFACE_TILE_MM[spec.backdrop.surface]);
    const geo = new PlaneGeometry(extent, extent);
    const mat = new MeshStandardMaterial({ map: tex, roughness: spec.backdrop.roughness, metalness: 0 });
    const top = new Mesh(geo, mat);
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    group.add(top);
    const wallTex: Texture = backdropTexture(spec.backdrop.wallTop, spec.backdrop.wallBottom, spec.backdrop.glow);
    const wallGeo = new PlaneGeometry(extent, extent * 0.6);
    const wallMat = new MeshStandardMaterial({
      map: wallTex,
      roughness: 1,
      emissive: "#ffffff",
      emissiveMap: wallTex,
      emissiveIntensity: 0.35,
    });
    const wall = new Mesh(wallGeo, wallMat);
    wall.position.set(0, extent * 0.3 - S * 0.5, -S * 9);
    group.add(wall);
    disposables.push(tex, geo, mat, wallTex, wallGeo, wallMat);
    background = new Color(spec.backdrop.wallBottom);
  }

  if (spec.plinth) {
    lift = Math.max(12, height * 0.28);
    const r = size * 0.62;
    const geo = new CylinderGeometry(r, r * 1.02, lift, 96, 1);
    const tex = surfaceTexture("stone");
    const mat = new MeshStandardMaterial({ color: spec.plinth.color, map: tex, roughness: 0.85 });
    const plinth = new Mesh(geo, mat);
    plinth.position.y = lift / 2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);
    disposables.push(geo, mat);
  }

  const hemi = new HemisphereLight(spec.sky, spec.ground, spec.hemiIntensity);
  group.add(hemi);

  const keyLight = lightFrom(spec.key, S);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(4096, 4096);
  keyLight.shadow.radius = spec.key.softness;
  keyLight.shadow.blurSamples = 16;
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.normalBias = 0.02 * (S / 100);
  const cam = keyLight.shadow.camera;
  const half = S * 1.6;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = S * 0.5;
  cam.far = S * 14;
  group.add(keyLight);
  group.add(keyLight.target);
  keyLight.target.position.set(0, height * 0.4, 0);

  if (spec.rim) {
    const rim = lightFrom(spec.rim, S);
    group.add(rim);
  }

  return {
    group,
    keyLight,
    lift,
    background,
    spec,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
};
