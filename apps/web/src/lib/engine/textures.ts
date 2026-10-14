// Procedural, tileable surface textures for the sets. Generated once on a canvas and cached,
// so no image assets are shipped or fetched.

import { CanvasTexture, LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

export type SurfaceKind =
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
  | "painted-wood"
  | "stone";

/** Physical size (mm) one texture tile covers, so grain reads at a believable scale. */
export const SURFACE_TILE_MM: Record<SurfaceKind, number> = {
  oak: 700,
  walnut: 700,
  "marble-white": 900,
  "marble-black": 900,
  concrete: 600,
  linen: 90,
  terrazzo: 450,
  slate: 600,
  plywood: 700,
  quartz: 900,
  "painted-wood": 500,
  stone: 400,
};

const SIZE = 1024;

const hash = (x: number, y: number, seed: number) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** Periodic value noise: wraps every `period` lattice cells so textures tile seamlessly. */
const valueNoise = (x: number, y: number, period: number, seed: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const w = (i: number) => ((i % period) + period) % period;
  const a = hash(w(xi), w(yi), seed);
  const b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed);
  const d = hash(w(xi + 1), w(yi + 1), seed);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

const fbm = (u: number, v: number, base: number, octaves: number, seed: number) => {
  let sum = 0;
  let amp = 0.5;
  let freq = base;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(u * freq, v * freq, freq, seed + o * 17);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
};

type Rgb = [number, number, number];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

type Shader = (u: number, v: number) => Rgb;

const shaders: Record<SurfaceKind, Shader> = {
  oak: (u, v) => {
    const warp = fbm(u, v, 4, 4, 1) * 2;
    const rings = Math.sin((v * 34 + warp * 6 + fbm(u, v, 2, 3, 2) * 4) * Math.PI);
    const grain = fbm(u * 0.25, v * 8, 8, 4, 3);
    const t = clamp01(0.5 + rings * 0.22 + (grain - 0.5) * 0.5);
    return mix([196, 160, 118], [158, 118, 78], t);
  },
  walnut: (u, v) => {
    const warp = fbm(u, v, 4, 4, 5) * 2;
    const rings = Math.sin((v * 26 + warp * 7) * Math.PI);
    const grain = fbm(u * 0.25, v * 8, 8, 4, 6);
    const t = clamp01(0.45 + rings * 0.25 + (grain - 0.5) * 0.6);
    return mix([104, 70, 48], [58, 37, 26], t);
  },
  "marble-white": (u, v) => {
    const n = fbm(u, v, 3, 6, 7);
    const vein = Math.abs(Math.sin((u * 3 + v * 2 + n * 4) * Math.PI));
    const fine =
      Math.pow(1 - vein, 18) * 0.7 + Math.pow(1 - Math.abs(Math.sin((u * 7 - v * 5 + n * 6) * Math.PI)), 40) * 0.4;
    return mix([238, 236, 232], [150, 152, 158], clamp01(fine + (n - 0.5) * 0.12));
  },
  "marble-black": (u, v) => {
    const n = fbm(u, v, 3, 6, 9);
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 2 + v * 3 + n * 5) * Math.PI)), 30);
    const base = mix([24, 24, 26], [44, 43, 45], n);
    return mix(base, [196, 160, 98], clamp01(vein * 0.9));
  },
  concrete: (u, v) => {
    const n = fbm(u, v, 6, 6, 11);
    const pits = hash(Math.floor(u * SIZE), Math.floor(v * SIZE), 12) > 0.996 ? -40 : 0;
    const g = 150 + (n - 0.5) * 60 + pits;
    return [g, g * 0.99, g * 0.97];
  },
  linen: (u, v) => {
    const warp = Math.sin(u * Math.PI * 2 * 48) * 0.5 + 0.5;
    const weft = Math.sin(v * Math.PI * 2 * 48) * 0.5 + 0.5;
    const slub = fbm(u, v * 0.1, 16, 3, 13);
    const t = clamp01(0.5 + (warp - weft) * 0.18 + (slub - 0.5) * 0.4);
    return mix([216, 204, 184], [186, 172, 150], t);
  },
  terrazzo: (u, v) => {
    const cell = 48;
    const cx = Math.floor(u * cell);
    const cy = Math.floor(v * cell);
    let color: Rgb = mix([232, 228, 220], [220, 215, 206], fbm(u, v, 8, 3, 14));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = (cx + dx + cell) % cell;
        const gy = (cy + dy + cell) % cell;
        const px = (cx + dx + hash(gx, gy, 15)) / cell;
        const py = (cy + dy + hash(gx, gy, 16)) / cell;
        const r = (0.15 + hash(gx, gy, 17) * 0.35) / cell;
        if (Math.hypot(u - px, v - py) < r) {
          const pick = hash(gx, gy, 18);
          color =
            pick < 0.3 ? [196, 98, 72] : pick < 0.55 ? [64, 72, 80] : pick < 0.8 ? [214, 176, 120] : [150, 160, 150];
        }
      }
    }
    return color;
  },
  slate: (u, v) => {
    const n = fbm(u * 0.5, v * 2, 4, 6, 19);
    const g = 52 + (n - 0.5) * 30;
    return [g * 0.95, g, g * 1.08];
  },
  plywood: (u, v) => {
    const warp = fbm(u, v, 3, 4, 21);
    const bands = Math.sin((v * 12 + warp * 3) * Math.PI);
    const t = clamp01(0.5 + bands * 0.18 + (fbm(u * 0.2, v * 6, 8, 3, 22) - 0.5) * 0.3);
    return mix([222, 196, 156], [196, 164, 120], t);
  },
  quartz: (u, v) => {
    const n = fbm(u, v, 10, 4, 23);
    const fleck = hash(Math.floor(u * SIZE), Math.floor(v * SIZE), 24) > 0.985 ? -18 : 0;
    const g = 238 + (n - 0.5) * 10 + fleck;
    return [g, g, g - 2];
  },
  "painted-wood": (u, v) => {
    const grain = fbm(u * 0.2, v * 6, 8, 4, 25);
    const g = 214 + (grain - 0.5) * 14;
    return [g * 0.98, g * 0.96, g * 0.9];
  },
  stone: (u, v) => {
    const n = fbm(u, v, 5, 6, 27);
    const g = 176 + (n - 0.5) * 40;
    return [g, g * 0.97, g * 0.92];
  },
};

const cache = new Map<SurfaceKind, Texture>();

export const surfaceTexture = (kind: SurfaceKind): Texture => {
  const hit = cache.get(kind);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  const shade = shaders[kind];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = shade(x / SIZE, y / SIZE);
      const i = (y * SIZE + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  cache.set(kind, tex);
  return tex;
};

/** Soft out-of-focus room behind a set: vertical gradient plus a blurred window glow. */
export const backdropTexture = (top: string, bottom: string, glow: string | null): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  if (glow) {
    const r = ctx.createRadialGradient(140, 180, 10, 140, 180, 260);
    r.addColorStop(0, glow);
    r.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, 512, 512);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};

/** Tiny normal-ish roughness variation for matte surfaces (kept linear). */
export const roughnessNoise = (): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const n = 200 + (fbm(x / 256, y / 256, 16, 3, 31) - 0.5) * 80;
      const i = (y * 256 + x) * 4;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = LinearSRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
};
