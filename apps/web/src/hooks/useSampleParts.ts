import { generateRevolvedGcode, type RevolvedSpec } from "@exo/gcode";
import { useEffect, useState } from "react";
import { type LoadedPart, loadParts } from "@/lib/engine/loader";

const encoder = new TextEncoder();

export const sampleFile = (spec: RevolvedSpec, name: string) => {
  const bytes = encoder.encode(generateRevolvedGcode(spec));
  return new File([bytes], name, { type: "text/plain" });
};

/** Generate procedural sample prints and run them through the real G-code pipeline. */
export const useSampleParts = (specs: RevolvedSpec[]) => {
  const [parts, setParts] = useState<LoadedPart[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const key = specs.map((s) => s.name).join("|");

  useEffect(() => {
    let cancelled = false;
    const inputs = specs.map((s) => ({
      name: s.name,
      bytes: encoder.encode(generateRevolvedGcode(s)).buffer as ArrayBuffer,
    }));
    loadParts(inputs, { includeSupports: false, onProgress: (f) => !cancelled && setProgress(f) })
      .then((p) => !cancelled && setParts(p))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // The specs are module constants; `key` identifies them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { parts, progress, error };
};
