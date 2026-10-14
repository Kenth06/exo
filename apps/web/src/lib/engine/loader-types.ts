export interface LoaderPartInput {
  name: string;
  bytes: ArrayBuffer;
  /** Plate number inside a .gcode.3mf; the first plate when missing. */
  plate?: number;
}

export interface LoaderRequest {
  id: number;
  parts: LoaderPartInput[];
  includeSupports: boolean;
}

export interface LoadedMesh {
  tool: number;
  positions: Float32Array;
  normals: Int16Array;
  indices: Uint32Array;
}

export interface LoadedPart {
  name: string;
  plates: number[];
  plate: number;
  meshes: LoadedMesh[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  toolCount: number;
  filamentColors: string[];
  slicer: string;
  layerCount: number;
  triangles: number;
}

export type LoaderResponse =
  | { id: number; type: "progress"; fraction: number; stage: string }
  | { id: number; type: "done"; parts: LoadedPart[] }
  | { id: number; type: "error"; message: string };
