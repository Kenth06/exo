/// <reference lib="webworker" />
import { buildBeadMeshes, parseGcode, readSlicedFile, UnsupportedFileError } from "@exo/gcode";
import type { LoadedPart, LoaderRequest, LoaderResponse } from "./loader-types";

const post = (msg: LoaderResponse, transfer: Transferable[] = []) =>
  (self as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

self.addEventListener("message", (ev: MessageEvent<LoaderRequest>) => {
  const { id, parts, includeSupports } = ev.data;
  try {
    const out: LoadedPart[] = [];
    // Split the vertex budget across parts so 4-part products still fit in GPU memory.
    const budget = Math.floor(9_000_000 / Math.max(1, parts.length));
    parts.forEach((part, index) => {
      const plates = readSlicedFile(new Uint8Array(part.bytes));
      const plate = plates.find((p) => p.plate === part.plate) ?? plates[0]!;
      const tp = parseGcode(plate.gcode, (f) =>
        post({ id, type: "progress", fraction: (index + f * 0.8) / parts.length, stage: `Reading ${part.name}` }),
      );
      post({
        id,
        type: "progress",
        fraction: (index + 0.85) / parts.length,
        stage: `Building layer lines for ${part.name}`,
      });
      const mesh = buildBeadMeshes(tp, { includeSupports, maxVertices: budget });
      out.push({
        name: part.name,
        plates: plates.map((p) => p.plate),
        plate: plate.plate,
        meshes: mesh.meshes.map((m) => ({
          tool: m.tool,
          // subarray views share a larger buffer; copy so we transfer exactly what is used.
          positions: m.positions.slice(),
          normals: m.normals.slice(),
          indices: m.indices.slice(),
        })),
        bounds: mesh.bounds,
        toolCount: tp.toolCount,
        filamentColors: tp.filamentColors,
        slicer: tp.slicer,
        layerCount: tp.layerCount,
        triangles: mesh.triangles,
      });
    });
    const finalTransfer: Transferable[] = [];
    for (const p of out)
      for (const m of p.meshes) finalTransfer.push(m.positions.buffer, m.normals.buffer, m.indices.buffer);
    post({ id, type: "done", parts: out }, finalTransfer);
  } catch (err) {
    const message =
      err instanceof UnsupportedFileError
        ? err.message
        : `Couldn't read this file: ${err instanceof Error ? err.message : String(err)}`;
    post({ id, type: "error", message });
  }
});
