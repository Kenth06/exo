// Streaming G-code parser that turns a sliced file into extrusion polylines.
// Understands Bambu Studio / Orca, PrusaSlicer and Cura comment conventions.

export const Feature = {
  OuterWall: 0,
  InnerWall: 1,
  Top: 2,
  Bottom: 3,
  Infill: 4,
  Bridge: 5,
  Support: 6,
  Other: 7,
  /** Never part of the product: skirt, brim, prime tower, purge, wipe, ironing. */
  Excluded: 8,
  /** Extrusion before the first layer marker (start G-code purge lines). */
  Preamble: 9,
} as const;
export type FeatureCode = (typeof Feature)[keyof typeof Feature];

export interface Toolpath {
  /** Vertex positions in slicer space (mm, Z up): x, y, z per vertex. */
  positions: Float32Array;
  /** Bead width per vertex (mm). */
  widths: Float32Array;
  /** Bead height per vertex (mm). */
  heights: Float32Array;
  /** Flat [start, count, tool, feature] per polyline. */
  polylines: Uint32Array;
  toolCount: number;
  filamentColors: string[];
  slicer: string;
  layerCount: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  stats: { lines: number; extrusionMoves: number; filamentMm: number };
}

class Grow {
  data: Float32Array;
  length = 0;
  constructor(capacity = 1 << 16) {
    this.data = new Float32Array(capacity);
  }
  push(v: number) {
    if (this.length === this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = v;
  }
  done() {
    return this.data.slice(0, this.length);
  }
}

class GrowU32 {
  data: Uint32Array;
  length = 0;
  constructor(capacity = 1 << 12) {
    this.data = new Uint32Array(capacity);
  }
  push(v: number) {
    if (this.length === this.data.length) {
      const next = new Uint32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = v;
  }
  done() {
    return this.data.slice(0, this.length);
  }
}

export const classifyFeature = (raw: string): FeatureCode => {
  const f = raw.trim().toLowerCase();
  if (/skirt|brim|prime tower|wipe|purge|flush|ironing|custom|mesh bed|^\(?nothing/.test(f)) return Feature.Excluded;
  if (/support/.test(f)) return Feature.Support;
  if (/outer wall|external perimeter|wall-outer|overhang wall|overhang perimeter/.test(f)) return Feature.OuterWall;
  if (/inner wall|^perimeter$|wall-inner|floating vertical shell/.test(f)) return Feature.InnerWall;
  if (/top surface|top solid infill|^skin$|^top$/.test(f)) return Feature.Top;
  if (/bottom surface|^bottom$/.test(f)) return Feature.Bottom;
  if (/internal bridge/.test(f)) return Feature.Infill;
  if (/bridge/.test(f)) return Feature.Bridge;
  if (/sparse infill|internal solid infill|internal infill|^solid infill$|^fill$|^infill$/.test(f))
    return Feature.Infill;
  if (/gap fill|gap infill/.test(f)) return Feature.InnerWall;
  return Feature.Other;
};

const parseColors = (value: string) =>
  value
    .split(/[;,]/)
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter((s) => /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s))
    .map((s) => s.slice(0, 7).toLowerCase());

const ARC_SEGMENT_MM = 0.4;
const ARC_MAX_ANGLE = Math.PI / 18;

/**
 * Parse sliced G-code into extrusion polylines. `onProgress` is called with a 0..1 fraction.
 */
export const parseGcode = (text: string, onProgress?: (fraction: number) => void): Toolpath => {
  const positions = new Grow(1 << 18);
  const widths = new Grow(1 << 16);
  const heights = new Grow(1 << 16);
  const polylines = new GrowU32();

  let absXYZ = true;
  let absE = true;
  let x = 0;
  let y = 0;
  let z = 0;
  let e = 0;
  let tool = 0;
  let maxTool = 0;
  let feature: FeatureCode = Feature.Other;
  let sawLayerMarker = false;
  let inFlush = false;
  let layerCount = 0;

  let filamentDiameter = 1.75;
  let nozzle = 0.4;
  let defaultLayerHeight = 0.2;
  let layerHeight = 0;
  let heightFromComment = false;
  let pendingLayerHeight = false;
  let prevLayerZ = 0;

  let filamentColors: string[] = [];
  let extruderColors: string[] = [];
  let slicer = "Unknown";

  let polyStart = -1;
  let polyTool = 0;
  let polyFeature: FeatureCode = Feature.Other;
  let lineCount = 0;
  let extrusionMoves = 0;
  let filamentMm = 0;

  const closePoly = () => {
    if (polyStart >= 0) {
      const count = positions.length / 3 - polyStart;
      if (count >= 2) {
        polylines.push(polyStart);
        polylines.push(count);
        polylines.push(polyTool);
        polylines.push(polyFeature);
      } else {
        positions.length = polyStart * 3;
        widths.length = polyStart;
        heights.length = polyStart;
      }
    }
    polyStart = -1;
  };

  const pushVertex = (px: number, py: number, pz: number, w: number, h: number) => {
    positions.push(px);
    positions.push(py);
    positions.push(pz);
    widths.push(w);
    heights.push(h);
  };

  const effectiveFeature = (): FeatureCode => {
    if (inFlush) return Feature.Excluded;
    if (!sawLayerMarker) return Feature.Preamble;
    return feature;
  };

  const extrude = (nx: number, ny: number, nz: number, dE: number) => {
    const dx = nx - x;
    const dy = ny - y;
    const len = Math.hypot(dx, dy);
    if (pendingLayerHeight) {
      if (!heightFromComment) {
        const dz = nz - prevLayerZ;
        layerHeight = dz > 0.02 && dz < 1.2 ? dz : layerHeight || defaultLayerHeight;
      }
      prevLayerZ = nz;
      pendingLayerHeight = false;
    }
    const h = layerHeight || defaultLayerHeight;
    const filamentArea = Math.PI * (filamentDiameter / 2) ** 2;
    // Rounded-rectangle bead model: area = (w - h) * h + pi * (h / 2)^2.
    const area = (dE * filamentArea) / len;
    let w = area / h + h * (1 - Math.PI / 4);
    if (!Number.isFinite(w)) w = nozzle;
    w = Math.min(Math.max(w, h * 0.6), nozzle * 3);
    const f = effectiveFeature();
    const contiguous =
      polyStart >= 0 &&
      polyTool === tool &&
      polyFeature === f &&
      Math.abs(positions.data[positions.length - 3]! - x) < 1e-4 &&
      Math.abs(positions.data[positions.length - 2]! - y) < 1e-4;
    if (!contiguous) {
      closePoly();
      polyStart = positions.length / 3;
      polyTool = tool;
      polyFeature = f;
      pushVertex(x, y, z, w, h);
    }
    pushVertex(nx, ny, nz, w, h);
    extrusionMoves++;
    filamentMm += dE;
  };

  // Parameter scratch, indexed by letter code.
  const params = new Float64Array(26);
  const has = new Uint8Array(26);

  const len = text.length;
  let pos = 0;
  let nextProgress = 0;

  while (pos < len) {
    let end = text.indexOf("\n", pos);
    if (end === -1) end = len;
    let line = text.slice(pos, end);
    pos = end + 1;
    lineCount++;
    if (onProgress && pos > nextProgress) {
      onProgress(pos / len);
      nextProgress = pos + 4_000_000;
    }

    let start = 0;
    while (start < line.length && (line.charCodeAt(start) === 32 || line.charCodeAt(start) === 9)) start++;
    if (start >= line.length) continue;

    if (line.charCodeAt(start) === 59 /* ; */) {
      const c = line.slice(start + 1).trim();
      if (c.length === 0) continue;
      let m: RegExpExecArray | null;
      if ((m = /^(?:FEATURE|TYPE):\s*(.+)$/i.exec(c))) {
        closePoly();
        feature = classifyFeature(m[1]!);
      } else if (/^(?:CHANGE_LAYER|LAYER_CHANGE)\b/i.test(c) || /^LAYER:\s*-?\d+/i.test(c)) {
        closePoly();
        sawLayerMarker = true;
        layerCount++;
        heightFromComment = false;
        pendingLayerHeight = true;
      } else if ((m = /^(?:LAYER_HEIGHT|HEIGHT):\s*([\d.]+)/i.exec(c))) {
        const v = Number(m[1]);
        if (v > 0.01 && v < 2) {
          layerHeight = v;
          heightFromComment = true;
        }
      } else if (/^FLUSH_START/i.test(c)) {
        closePoly();
        inFlush = true;
      } else if (/^FLUSH_END/i.test(c)) {
        closePoly();
        inFlush = false;
      } else if ((m = /^filament_colou?r\s*=\s*(.+)$/i.exec(c))) {
        filamentColors = parseColors(m[1]!);
      } else if ((m = /^extruder_colou?r\s*=\s*(.+)$/i.exec(c))) {
        extruderColors = parseColors(m[1]!);
      } else if ((m = /^(?:layer_height|Layer height)\s*[=:]\s*([\d.]+)/i.exec(c))) {
        defaultLayerHeight = Number(m[1]) || defaultLayerHeight;
      } else if ((m = /^filament_diameter\s*[=:]\s*([\d.]+)/i.exec(c))) {
        filamentDiameter = Number(m[1]) || filamentDiameter;
      } else if ((m = /^nozzle_diameter\s*[=:]\s*([\d.]+)/i.exec(c))) {
        nozzle = Number(m[1]) || nozzle;
      } else if (lineCount < 40 && slicer === "Unknown") {
        if (
          (m =
            /(BambuStudio|OrcaSlicer|PrusaSlicer|SuperSlicer|Cura_SteamEngine|Simplify3D|Slic3r)[\s_]*([\d.]*)/i.exec(
              c,
            ))
        ) {
          slicer = `${m[1]}${m[2] ? ` ${m[2]}` : ""}`;
        }
      }
      continue;
    }

    const semi = line.indexOf(";", start);
    if (semi !== -1) line = line.slice(0, semi);

    const letter = line.charCodeAt(start) & ~32;
    if (letter === 84 /* T */) {
      const n = Number.parseInt(line.slice(start + 1), 10);
      if (Number.isFinite(n) && n >= 0 && n < 16) {
        closePoly();
        tool = n;
        if (n > maxTool) maxTool = n;
      }
      continue;
    }
    if (letter !== 71 /* G */ && letter !== 77 /* M */) continue;

    let i = start + 1;
    let code = 0;
    while (i < line.length) {
      const ch = line.charCodeAt(i);
      if (ch < 48 || ch > 57) break;
      code = code * 10 + (ch - 48);
      i++;
    }
    if (line.charCodeAt(i) === 46 /* . */) {
      i++;
      while (i < line.length && line.charCodeAt(i) >= 48 && line.charCodeAt(i) <= 57) i++;
    }

    if (letter === 77) {
      if (code === 82) absE = true;
      else if (code === 83) absE = false;
      continue;
    }

    if (code === 90) {
      absXYZ = true;
      absE = true;
      continue;
    }
    if (code === 91) {
      absXYZ = false;
      absE = false;
      continue;
    }

    has.fill(0);
    while (i < line.length) {
      const ch = line.charCodeAt(i) & ~32;
      if (ch >= 65 && ch <= 90) {
        let j = i + 1;
        while (j < line.length) {
          const d = line.charCodeAt(j);
          if ((d >= 48 && d <= 57) || d === 46 || d === 45 || d === 43 || d === 101 || d === 69) {
            if ((d === 101 || d === 69) && !(j + 1 < line.length && /[-+\d]/.test(line[j + 1]!))) break;
            j++;
          } else break;
        }
        if (j > i + 1) {
          params[ch - 65] = Number(line.slice(i + 1, j));
          has[ch - 65] = 1;
        }
        i = j;
      } else i++;
    }
    const X = 23;
    const Y = 24;
    const Z = 25;
    const E = 4;

    if (code === 92) {
      if (has[E]) e = params[E]!;
      if (has[X]) x = params[X]!;
      if (has[Y]) y = params[Y]!;
      if (has[Z]) z = params[Z]!;
      continue;
    }
    if (code > 3) continue;

    const nx = has[X] ? (absXYZ ? params[X]! : x + params[X]!) : x;
    const ny = has[Y] ? (absXYZ ? params[Y]! : y + params[Y]!) : y;
    const nz = has[Z] ? (absXYZ ? params[Z]! : z + params[Z]!) : z;
    let dE = 0;
    if (has[E]) {
      dE = absE ? params[E]! - e : params[E]!;
      e = absE ? params[E]! : e + params[E]!;
    }

    const movesXY = Math.abs(nx - x) > 1e-6 || Math.abs(ny - y) > 1e-6;
    if (dE > 1e-6 && (movesXY || code >= 2)) {
      if (code >= 2 && (has[8] || has[9])) {
        // Arc: tessellate around the center (I, J are relative to the start point).
        const cx = x + (has[8] ? params[8]! : 0);
        const cy = y + (has[9] ? params[9]! : 0);
        const r = Math.hypot(x - cx, y - cy);
        const a0 = Math.atan2(y - cy, x - cx);
        const a1 = Math.atan2(ny - cy, nx - cx);
        let sweep = a1 - a0;
        if (code === 2) {
          if (sweep >= -1e-9) sweep -= Math.PI * 2;
        } else if (sweep <= 1e-9) sweep += Math.PI * 2;
        const segs = Math.min(
          720,
          Math.max(1, Math.ceil((Math.abs(sweep) * r) / ARC_SEGMENT_MM), Math.ceil(Math.abs(sweep) / ARC_MAX_ANGLE)),
        );
        const z0 = z;
        for (let s = 1; s <= segs; s++) {
          const t = s / segs;
          const a = a0 + sweep * t;
          const px = s === segs ? nx : cx + r * Math.cos(a);
          const py = s === segs ? ny : cy + r * Math.sin(a);
          const pz = z0 + (nz - z0) * t;
          extrude(px, py, pz, dE / segs);
          x = px;
          y = py;
          z = pz;
        }
      } else {
        extrude(nx, ny, nz, dE);
      }
    } else if (movesXY || Math.abs(nz - z) > 1e-6) {
      closePoly();
    }
    x = nx;
    y = ny;
    z = nz;
  }
  closePoly();
  onProgress?.(1);

  // Drop start-gcode purge lines when the slicer marked its layers.
  let polys = polylines.done();
  if (sawLayerMarker) {
    const kept: number[] = [];
    for (let p = 0; p < polys.length; p += 4) {
      if (polys[p + 3] !== Feature.Preamble) kept.push(polys[p]!, polys[p + 1]!, polys[p + 2]!, polys[p + 3]!);
    }
    polys = Uint32Array.from(kept);
  } else {
    for (let p = 0; p < polys.length; p += 4) if (polys[p + 3] === Feature.Preamble) polys[p + 3] = Feature.Other;
  }

  const pos3 = positions.done();
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let p = 0; p < polys.length; p += 4) {
    const f = polys[p + 3]!;
    if (f === Feature.Excluded) continue;
    const s = polys[p]!;
    const n = polys[p + 1]!;
    for (let v = s; v < s + n; v++) {
      for (let k = 0; k < 3; k++) {
        const c = pos3[v * 3 + k]!;
        if (c < min[k]!) min[k] = c;
        if (c > max[k]!) max[k] = c;
      }
    }
  }

  return {
    positions: pos3,
    widths: widths.done(),
    heights: heights.done(),
    polylines: polys,
    toolCount: maxTool + 1,
    filamentColors: filamentColors.length ? filamentColors : extruderColors,
    slicer,
    layerCount,
    bounds: { min, max },
    stats: { lines: lineCount, extrusionMoves, filamentMm },
  };
};
