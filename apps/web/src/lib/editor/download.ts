import { zip } from "fflate";

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** Bundle rendered files into one .zip (stored, not recompressed: JPEG/MP4 are already compressed). */
export const zipFiles = async (files: Array<{ name: string; blob: Blob }>) => {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const f of files) entries[f.name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  return new Promise<Blob>((resolve, reject) =>
    zip(entries, (err, data) =>
      err ? reject(err) : resolve(new Blob([data as BlobPart], { type: "application/zip" })),
    ),
  );
};
