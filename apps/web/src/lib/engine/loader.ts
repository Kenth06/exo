import type { LoadedPart, LoaderPartInput, LoaderResponse } from "./loader-types";

export type { LoadedPart, LoaderPartInput } from "./loader-types";

let worker: Worker | null = null;
let nextId = 1;

const getWorker = () => {
  worker ??= new Worker(new URL("./loader.worker.ts", import.meta.url), { type: "module" });
  return worker;
};

/** Parse sliced files and build bead meshes off the main thread. Buffers are transferred, not copied. */
export const loadParts = (
  parts: LoaderPartInput[],
  opts: { includeSupports: boolean; onProgress?: (fraction: number, stage: string) => void },
): Promise<LoadedPart[]> =>
  new Promise((resolve, reject) => {
    const w = getWorker();
    const id = nextId++;
    const onMessage = (ev: MessageEvent<LoaderResponse>) => {
      const msg = ev.data;
      if (msg.id !== id) return;
      if (msg.type === "progress") {
        opts.onProgress?.(msg.fraction, msg.stage);
        return;
      }
      w.removeEventListener("message", onMessage);
      if (msg.type === "done") resolve(msg.parts);
      else reject(new Error(msg.message));
    };
    w.addEventListener("message", onMessage);
    // Copy each input so the caller keeps its bytes (they are re-used for re-parsing with other options).
    const inputs = parts.map((p) => ({ ...p, bytes: p.bytes.slice(0) }));
    w.postMessage(
      { id, parts: inputs, includeSupports: opts.includeSupports },
      inputs.map((p) => p.bytes),
    );
  });
