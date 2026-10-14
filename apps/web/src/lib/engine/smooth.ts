import type { RevolvedSpec } from "@exo/gcode";
import type { LoadedPart } from "./loader-types";

/**
 * The designed surface of a revolved sample, as an STL would describe it: a perfectly smooth
 * shell with no layer lines. Used to show what a G-code render adds.
 */
export const smoothPartFromSpec = (spec: RevolvedSpec): LoadedPart => {
  const rings = 220;
  const segs = 220;
  const positions = new Float32Array((rings + 1) * (segs + 1) * 3);
  const normals = new Int16Array(positions.length);
  const indices = new Uint32Array(rings * segs * 6);
  const pt = (z: number, th: number): [number, number, number] => {
    const r = spec.radius(Math.max(z, 0.01), th);
    return [r * Math.cos(th), z, -r * Math.sin(th)];
  };
  let v = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i <= rings; i++) {
    const z = (i / rings) * spec.height;
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      const p = pt(z, th);
      const du = pt(z, th + 0.001);
      const dv = pt(z + 0.05, th);
      const a = [du[0] - p[0], du[1] - p[1], du[2] - p[2]];
      const b = [dv[0] - p[0], dv[1] - p[1], dv[2] - p[2]];
      let nx = a[1]! * b[2]! - a[2]! * b[1]!;
      let ny = a[2]! * b[0]! - a[0]! * b[2]!;
      let nz = a[0]! * b[1]! - a[1]! * b[0]!;
      // Make the normal point away from the axis.
      if (nx * p[0] + nz * p[2] < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      positions.set(p, v * 3);
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c]!, p[c]!);
        max[c] = Math.max(max[c]!, p[c]!);
      }
      normals[v * 3] = Math.round((nx / l) * 32767);
      normals[v * 3 + 1] = Math.round((ny / l) * 32767);
      normals[v * 3 + 2] = Math.round((nz / l) * 32767);
      v++;
    }
  }
  let k = 0;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const b = a + segs + 1;
      indices.set([a, a + 1, b, b, a + 1, b + 1], k);
      k += 6;
    }
  }
  return {
    name: `${spec.name} (STL)`,
    flipped: false,
    plates: [1],
    plate: 1,
    meshes: [{ tool: 0, positions, normals, indices }],
    bounds: { min, max },
    toolCount: 1,
    filamentColors: [spec.color],
    slicer: "STL",
    layerCount: 0,
    triangles: indices.length / 3,
  };
};
