import { strFromU8, unzipSync } from "fflate";

export interface Plate {
  plate: number;
  gcode: string;
}

export class UnsupportedFileError extends Error {}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export const isZip = (bytes: Uint8Array) => ZIP_MAGIC.every((b, i) => bytes[i] === b);

/** Binary G-code (.bgcode) starts with "GCDE". */
export const isBinaryGcode = (bytes: Uint8Array) =>
  bytes[0] === 0x47 && bytes[1] === 0x43 && bytes[2] === 0x44 && bytes[3] === 0x45;

/**
 * Read a sliced file. A `.gcode.3mf` (Bambu Studio / Orca "export plate sliced file") contains
 * one `Metadata/plate_N.gcode` per sliced plate; plain `.gcode` is a single plate.
 */
export const readSlicedFile = (bytes: Uint8Array): Plate[] => {
  if (isBinaryGcode(bytes)) {
    throw new UnsupportedFileError("Binary G-code (.bgcode) isn't supported. Export plain .gcode instead.");
  }
  if (!isZip(bytes)) return [{ plate: 1, gcode: strFromU8(bytes) }];

  const entries = unzipSync(bytes, {
    filter: (f) => /(^|\/)plate_\d+\.gcode$/i.test(f.name) || /\.gcode$/i.test(f.name),
  });
  const plates: Plate[] = [];
  for (const [name, data] of Object.entries(entries)) {
    const m = /plate_(\d+)\.gcode$/i.exec(name);
    plates.push({ plate: m ? Number(m[1]) : plates.length + 1, gcode: strFromU8(data) });
  }
  if (plates.length === 0) {
    throw new UnsupportedFileError(
      "This 3MF has no sliced G-code. In Bambu Studio, slice the plate and use Export plate sliced file (.gcode.3mf).",
    );
  }
  return plates.toSorted((a, b) => a.plate - b.plate);
};
