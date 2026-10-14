import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  buildBeadMeshes,
  Feature,
  generateRevolvedGcode,
  parseGcode,
  readSlicedFile,
  SAMPLE_LAMP,
  UnsupportedFileError,
} from "../src";

const polylineFeatures = (polys: Uint32Array) => {
  const out: number[] = [];
  for (let p = 0; p < polys.length; p += 4) out.push(polys[p + 3]!);
  return out;
};

describe("parseGcode", () => {
  const small = { ...SAMPLE_LAMP, height: 6 };
  const tp = parseGcode(generateRevolvedGcode(small));

  it("reads Bambu header metadata", () => {
    expect(tp.slicer).toBe("BambuStudio 02.02.00.85");
    expect(tp.filamentColors).toEqual(["#d79a88"]);
    expect(tp.layerCount).toBe(25);
  });

  it("drops the start-gcode purge line before the first layer", () => {
    expect(tp.bounds.min[0]).toBeGreaterThan(60);
    expect(tp.bounds.min[1]).toBeGreaterThan(60);
    expect(polylineFeatures(tp.polylines)).not.toContain(Feature.Preamble);
  });

  it("classifies walls and bottom surfaces", () => {
    const f = polylineFeatures(tp.polylines);
    expect(f).toContain(Feature.OuterWall);
    expect(f).toContain(Feature.InnerWall);
    expect(f).toContain(Feature.Bottom);
    expect(tp.bounds.max[2]).toBeCloseTo(6, 1);
  });

  it("derives bead width from extrusion volume", () => {
    const w = tp.widths[10]!;
    expect(w).toBeGreaterThan(0.4);
    expect(w).toBeLessThan(0.5);
  });

  it("excludes skirts and tracks absolute E (M82)", () => {
    const g = [
      "M82",
      ";LAYER_CHANGE",
      ";Z:0.2",
      ";HEIGHT:0.2",
      ";TYPE:Skirt/Brim",
      "G1 X0 Y0 Z0.2 E0",
      "G1 X10 Y0 E1",
      ";TYPE:External perimeter",
      "G1 X20 Y0",
      "G1 X30 Y0 E2",
      "G1 X30 Y10 E3",
      "G92 E0",
      "G1 X20 Y10 E1",
    ].join("\n");
    const t = parseGcode(g);
    const f = polylineFeatures(t.polylines);
    expect(f).toEqual([Feature.Excluded, Feature.OuterWall]);
    expect(t.polylines[5]).toBe(4);
    expect(t.bounds.min[0]).toBe(20);
  });

  it("tessellates G2/G3 arcs and ends on the target point", () => {
    const g = [";LAYER:0", "M83", "G1 X10 Y0 Z0.2 F600", ";TYPE:WALL-OUTER", "G3 X-10 Y0 I-10 J0 E1.5"].join("\n");
    const t = parseGcode(g);
    const count = t.polylines[1]!;
    expect(count).toBeGreaterThan(20);
    const last = t.polylines[0]! + count - 1;
    expect(t.positions[last * 3]).toBeCloseTo(-10, 4);
    expect(t.positions[last * 3 + 1]).toBeCloseTo(0, 4);
    // CCW from (10,0) to (-10,0) passes through positive Y.
    const mid = t.polylines[0]! + Math.floor(count / 2);
    expect(t.positions[mid * 3 + 1]).toBeGreaterThan(9);
  });

  it("tracks tool changes for multi-color prints", () => {
    const g = [
      ";LAYER:0",
      "M83",
      "T0",
      ";TYPE:WALL-OUTER",
      "G1 X0 Y0 Z0.2",
      "G1 X10 Y0 E1",
      "T1",
      "G1 X10 Y10 E1",
    ].join("\n");
    const t = parseGcode(g);
    expect(t.toolCount).toBe(2);
    expect(t.polylines[2]).toBe(0);
    expect(t.polylines[6]).toBe(1);
  });
});

describe("buildBeadMeshes", () => {
  const tp = parseGcode(generateRevolvedGcode({ ...SAMPLE_LAMP, height: 3 }));
  const res = buildBeadMeshes(tp);

  it("builds an outward-facing closed bead surface", () => {
    const m = res.meshes[0]!;
    expect(res.sides).toBe(8);
    expect(m.indices.length % 3).toBe(0);
    let agree = 0;
    const tris = m.indices.length / 3;
    for (let t = 0; t < tris; t++) {
      const [a, b, c] = [m.indices[t * 3]!, m.indices[t * 3 + 1]!, m.indices[t * 3 + 2]!];
      const p = (i: number) => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];
      const [pa, pb, pc] = [p(a), p(b), p(c)];
      const u = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!];
      const v = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!];
      const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
      const sn = [0, 1, 2].map((k) => m.normals[a * 3 + k]! + m.normals[b * 3 + k]! + m.normals[c * 3 + k]!);
      if (n[0]! * sn[0]! + n[1]! * sn[1]! + n[2]! * sn[2]! > 0) agree++;
    }
    expect(agree / tris).toBeGreaterThan(0.98);
  });

  it("uses a Y-up frame resting on the bed", () => {
    expect(res.bounds.min[1]).toBeGreaterThanOrEqual(-0.01);
    expect(res.bounds.max[1]).toBeCloseTo(13 * 0.24, 2);
  });

  it("adds bottom surfaces and a flat bed side for parts shown plate side up", () => {
    const flipped = buildBeadMeshes(tp, { includeBottom: true, flattenBedSide: true });
    expect(flipped.triangles).toBeGreaterThan(res.triangles);
    const m = flipped.meshes[0]!;
    let onBed = 0;
    let facingDown = 0;
    for (let v = 0; v < m.positions.length / 3; v++) {
      if (Math.abs(m.positions[v * 3 + 1]!) < 1e-4) {
        onBed++;
        if (m.normals[v * 3 + 1]! < -32000) facingDown++;
      }
    }
    expect(onBed).toBeGreaterThan(1000);
    expect(facingDown / onBed).toBeGreaterThan(0.95);
  });

  it("drops the profile resolution to stay within the vertex budget", () => {
    const low = buildBeadMeshes(tp, { maxVertices: 1000 });
    expect(low.sides).toBe(4);
  });
});

describe("readSlicedFile", () => {
  it("extracts every sliced plate from a .gcode.3mf", () => {
    const zip = zipSync({
      "Metadata/plate_2.gcode": strToU8("; two"),
      "Metadata/plate_1.gcode": strToU8("; one"),
      "3D/3dmodel.model": strToU8("<model/>"),
    });
    const plates = readSlicedFile(zip);
    expect(plates.map((p) => p.plate)).toEqual([1, 2]);
    expect(plates[0]!.gcode).toBe("; one");
  });

  it("rejects unsliced 3MF and binary G-code", () => {
    expect(() => readSlicedFile(zipSync({ "3D/3dmodel.model": strToU8("<model/>") }))).toThrow(UnsupportedFileError);
    expect(() => readSlicedFile(strToU8("GCDE\u0001"))).toThrow(/bgcode/);
  });

  it("treats plain text as a single plate", () => {
    expect(readSlicedFile(strToU8("G1 X1"))).toEqual([{ plate: 1, gcode: "G1 X1" }]);
  });
});
