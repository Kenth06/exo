// Turns toolpath polylines into renderable bead geometry: each extrusion becomes a tube with an
// elliptical cross-section (bead width x layer height), so adjacent layers form real layer lines.
// Output is in a Y-up frame (three.js convention): (x, z, -y) of slicer space.

import { Feature, type FeatureCode, type Toolpath } from "./parse";

export interface BeadMesh {
  tool: number;
  positions: Float32Array;
  /** Normalized int16 normals. */
  normals: Int16Array;
  indices: Uint32Array;
}

export interface MeshResult {
  meshes: BeadMesh[];
  /** Y-up bounds of the generated geometry. */
  bounds: { min: [number, number, number]; max: [number, number, number] };
  sides: number;
  triangles: number;
}

export interface MeshOptions {
  includeSupports?: boolean;
  /** Include infill (hidden inside opaque prints; off by default to save memory). */
  includeInfill?: boolean;
  /** Vertex budget across all meshes; the profile resolution drops to fit it. */
  maxVertices?: number;
}

const COLLINEAR_EPS = 0.004;
const SHARP_CORNER_DOT = 0.5;

const visible = (f: number, opts: MeshOptions) => {
  if (f === Feature.Excluded || f === Feature.Preamble) return false;
  if (f === Feature.Bottom) return false;
  if (f === Feature.Infill) return !!opts.includeInfill;
  if (f === Feature.Support) return !!opts.includeSupports;
  return true;
};

interface Simplified {
  pos: Float32Array;
  w: Float32Array;
  h: Float32Array;
  /** [start, count, tool] per tube. */
  tubes: Uint32Array;
  vertexCount: number;
  tubeCount: number;
}

/** Remove collinear points and split polylines at sharp corners into independent tubes. */
const simplify = (tp: Toolpath, opts: MeshOptions): Simplified => {
  const src = tp.positions;
  let cap = 1024;
  for (let p = 0; p < tp.polylines.length; p += 4) {
    if (visible(tp.polylines[p + 3]! as FeatureCode, opts)) cap += tp.polylines[p + 1]! * 2;
  }
  const pos = new Float32Array(cap * 3);
  const w = new Float32Array(cap);
  const h = new Float32Array(cap);
  const tubes: number[] = [];
  let n = 0;

  const emit = (i: number) => {
    pos[n * 3] = src[i * 3]!;
    pos[n * 3 + 1] = src[i * 3 + 1]!;
    pos[n * 3 + 2] = src[i * 3 + 2]!;
    w[n] = tp.widths[i]!;
    h[n] = tp.heights[i]!;
    n++;
  };

  for (let p = 0; p < tp.polylines.length; p += 4) {
    const start = tp.polylines[p]!;
    const count = tp.polylines[p + 1]!;
    const tool = tp.polylines[p + 2]!;
    if (!visible(tp.polylines[p + 3]!, opts)) continue;

    let tubeStart = n;
    emit(start);
    let lastKept = start;
    for (let i = start + 1; i < start + count; i++) {
      const ax = src[i * 3]! - src[lastKept * 3]!;
      const ay = src[i * 3 + 1]! - src[lastKept * 3 + 1]!;
      const az = src[i * 3 + 2]! - src[lastKept * 3 + 2]!;
      const la = Math.hypot(ax, ay, az);
      if (la < 1e-3) continue;
      const isLast = i === start + count - 1;
      if (!isLast) {
        const bx = src[(i + 1) * 3]! - src[i * 3]!;
        const by = src[(i + 1) * 3 + 1]! - src[i * 3 + 1]!;
        const lb = Math.hypot(bx, by);
        if (lb > 1e-6) {
          const cross = Math.abs(ax * by - ay * bx) / (Math.hypot(ax, ay) * lb || 1);
          const dot = (ax * bx + ay * by) / (Math.hypot(ax, ay) * lb || 1);
          const widthSame = Math.abs(tp.widths[i]! - tp.widths[lastKept]!) < 0.04;
          if (cross < COLLINEAR_EPS && dot > 0 && widthSame && la < 20) continue;
          if (dot < SHARP_CORNER_DOT) {
            emit(i);
            if (n - tubeStart >= 2) tubes.push(tubeStart, n - tubeStart, tool);
            tubeStart = n;
            emit(i);
            lastKept = i;
            continue;
          }
        }
      }
      emit(i);
      lastKept = i;
    }
    if (n - tubeStart >= 2) tubes.push(tubeStart, n - tubeStart, tool);
    else n = tubeStart;
  }
  return { pos, w, h, tubes: Uint32Array.from(tubes), vertexCount: n, tubeCount: tubes.length / 3 };
};

export const buildBeadMeshes = (tp: Toolpath, opts: MeshOptions = {}): MeshResult => {
  const s = simplify(tp, opts);
  const budget = opts.maxVertices ?? 9_000_000;
  const sides = s.vertexCount * 8 <= budget ? 8 : s.vertexCount * 6 <= budget ? 6 : 4;

  // Precompute the unit profile: angle k -> (cos, sin).
  const cosK = new Float32Array(sides);
  const sinK = new Float32Array(sides);
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2 + (sides === 4 ? Math.PI / 4 : 0);
    cosK[k] = Math.cos(a);
    sinK[k] = Math.sin(a);
  }

  const toolCount = Math.max(1, tp.toolCount);
  const vCount = new Uint32Array(toolCount);
  const iCount = new Uint32Array(toolCount);
  for (let t = 0; t < s.tubeCount; t++) {
    const count = s.tubes[t * 3 + 1]!;
    const tool = s.tubes[t * 3 + 2]!;
    vCount[tool]! += count * sides + 2;
    iCount[tool]! += (count - 1) * sides * 6 + sides * 6;
  }

  const meshes: BeadMesh[] = [];
  const out = new Map<number, { p: Float32Array; nrm: Int16Array; idx: Uint32Array; v: number; i: number }>();
  for (let tool = 0; tool < toolCount; tool++) {
    if (!vCount[tool]) continue;
    out.set(tool, {
      p: new Float32Array(vCount[tool]! * 3),
      nrm: new Int16Array(vCount[tool]! * 3),
      idx: new Uint32Array(iCount[tool]!),
      v: 0,
      i: 0,
    });
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const P = s.pos;

  for (let t = 0; t < s.tubeCount; t++) {
    const start = s.tubes[t * 3]!;
    const count = s.tubes[t * 3 + 1]!;
    const o = out.get(s.tubes[t * 3 + 2]!)!;
    const base = o.v;

    let tx0 = 0;
    let ty0 = 0;
    for (let j = 0; j < count; j++) {
      const v = start + j;
      // Tangent in slicer XY: average of incoming and outgoing directions.
      let ix = 0;
      let iy = 0;
      let ox = 0;
      let oy = 0;
      if (j > 0) {
        ix = P[v * 3]! - P[(v - 1) * 3]!;
        iy = P[v * 3 + 1]! - P[(v - 1) * 3 + 1]!;
        const l = Math.hypot(ix, iy) || 1;
        ix /= l;
        iy /= l;
      }
      if (j < count - 1) {
        ox = P[(v + 1) * 3]! - P[v * 3]!;
        oy = P[(v + 1) * 3 + 1]! - P[v * 3 + 1]!;
        const l = Math.hypot(ox, oy) || 1;
        ox /= l;
        oy /= l;
      }
      let tx = ix + ox;
      let ty = iy + oy;
      const tl = Math.hypot(tx, ty);
      if (tl < 1e-6) {
        tx = ox || ix || 1;
        ty = oy || iy;
      } else {
        tx /= tl;
        ty /= tl;
      }
      if (j === 0) {
        tx0 = tx;
        ty0 = ty;
      }
      // Miter keeps the bead width constant through gentle bends.
      const ref = j > 0 ? ix * tx + iy * ty : 1;
      const miter = 1 / Math.max(0.6, ref);
      const sx = ty;
      const sy = -tx;
      const hw = (s.w[v]! / 2) * miter;
      const hh = s.h[v]! / 2;
      const cx = P[v * 3]!;
      const cy = P[v * 3 + 1]!;
      const cz = P[v * 3 + 2]! - hh;
      const invW = 1 / (s.w[v]! / 2);
      const invH = 1 / hh;
      for (let k = 0; k < sides; k++) {
        const lat = cosK[k]! * hw;
        const up = sinK[k]! * hh;
        const px = cx + sx * lat;
        const py = cy + sy * lat;
        const pz = cz + up;
        const vi = o.v * 3;
        // Slicer (x, y, z) -> Y-up (x, z, -y).
        o.p[vi] = px;
        o.p[vi + 1] = pz;
        o.p[vi + 2] = -py;
        let nl = cosK[k]! * invW;
        let nu = sinK[k]! * invH;
        const nlen = Math.hypot(nl, nu) || 1;
        nl /= nlen;
        nu /= nlen;
        o.nrm[vi] = Math.round(sx * nl * 32767);
        o.nrm[vi + 1] = Math.round(nu * 32767);
        o.nrm[vi + 2] = Math.round(-sy * nl * 32767);
        if (px < min[0]) min[0] = px;
        if (px > max[0]) max[0] = px;
        if (pz < min[1]) min[1] = pz;
        if (pz > max[1]) max[1] = pz;
        if (-py < min[2]) min[2] = -py;
        if (-py > max[2]) max[2] = -py;
        o.v++;
      }
      if (j > 0) {
        const a = base + (j - 1) * sides;
        const b = base + j * sides;
        for (let k = 0; k < sides; k++) {
          const k1 = (k + 1) % sides;
          o.idx[o.i++] = a + k;
          o.idx[o.i++] = b + k;
          o.idx[o.i++] = b + k1;
          o.idx[o.i++] = a + k;
          o.idx[o.i++] = b + k1;
          o.idx[o.i++] = a + k1;
        }
      }
      if (j === count - 1) {
        // Rounded end caps: a fan to a point pushed out along the tangent.
        const capFor = (ring: number, dirX: number, dirY: number, vtx: number, flip: boolean) => {
          const hwc = s.w[vtx]! / 2;
          const ci = o.v * 3;
          o.p[ci] = P[vtx * 3]! + dirX * hwc;
          o.p[ci + 1] = P[vtx * 3 + 2]! - s.h[vtx]! / 2;
          o.p[ci + 2] = -(P[vtx * 3 + 1]! + dirY * hwc);
          o.nrm[ci] = Math.round(dirX * 32767);
          o.nrm[ci + 1] = 0;
          o.nrm[ci + 2] = Math.round(-dirY * 32767);
          const c = o.v++;
          for (let k = 0; k < sides; k++) {
            const k1 = (k + 1) % sides;
            o.idx[o.i++] = ring + k;
            o.idx[o.i++] = flip ? ring + k1 : c;
            o.idx[o.i++] = flip ? c : ring + k1;
          }
        };
        capFor(base, -tx0, -ty0, start, false);
        capFor(base + j * sides, tx, ty, v, true);
      }
    }
  }

  let triangles = 0;
  for (const [tool, o] of out) {
    meshes.push({
      tool,
      positions: o.p.subarray(0, o.v * 3),
      normals: o.nrm.subarray(0, o.v * 3),
      indices: o.idx.subarray(0, o.i),
    });
    triangles += o.i / 3;
  }
  if (!Number.isFinite(min[0])) {
    min.fill(0);
    max.fill(0);
  }
  return { meshes, bounds: { min, max }, sides, triangles };
};
