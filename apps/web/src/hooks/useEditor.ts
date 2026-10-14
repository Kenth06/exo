import {
  DEFAULT_SETTINGS,
  MAX_PARTS,
  MAX_UPLOAD_BYTES,
  type ProjectDetail,
  type ProjectFile,
  type ProjectSettings,
} from "@exo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/client/http/api";
import { projectService } from "@/lib/client/services/project.service";
import { filamentForHex } from "@/lib/editor/colors";
import { type LoadedPart, loadParts } from "@/lib/engine/loader";

export interface SourceFile {
  file: ProjectFile;
  bytes: ArrayBuffer;
}

export type SaveState = "saved" | "saving" | "error";

const clientFileProblem = (f: File) => {
  const n = f.name.toLowerCase();
  if (f.size > MAX_UPLOAD_BYTES) return `${f.name} is larger than 100 MB.`;
  if (n.endsWith(".gcode") || n.endsWith(".gcode.3mf")) return null;
  if (n.endsWith(".bgcode")) return `${f.name}: binary G-code isn't supported. Export plain .gcode.`;
  if (/\.(stl|obj|step|stp)$/.test(n)) return `${f.name} is a model file. Slice it first.`;
  if (n.endsWith(".3mf")) return `${f.name} isn't sliced. Use Export plate sliced file (.gcode.3mf).`;
  return `${f.name} isn't a sliced .gcode or .gcode.3mf file.`;
};

const withDefaults = (raw: unknown): ProjectSettings => {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<ProjectSettings>;
  return { ...DEFAULT_SETTINGS, ...s, video: { ...DEFAULT_SETTINGS.video, ...s.video } };
};

/** All editor state for one project: files, parsed parts, settings with autosave. */
export const useEditor = (projectId: string) => {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [parts, setParts] = useState<LoadedPart[] | null>(null);
  const [progress, setProgress] = useState<{ fraction: number; stage: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [uploading, setUploading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ name?: string; settings?: ProjectSettings }>({});

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    projectService
      .get(projectId)
      .then(async (p) => {
        if (cancelled) return;
        setProject(p);
        setSettings(withDefaults(p.settings));
        const loaded = await Promise.all(
          p.files.map(async (file) => ({ file, bytes: await projectService.fileBytes(file) })),
        );
        if (!cancelled) setSources(loaded);
      })
      .catch(
        (e: unknown) => !cancelled && setLoadError(e instanceof ApiError ? e.message : "Couldn't open this project."),
      );
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (!patch.name && !patch.settings) return;
    setSaveState("saving");
    try {
      await projectService.update(projectId, patch);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [projectId]);

  const scheduleSave = useCallback(
    (patch: { name?: string; settings?: ProjectSettings }) => {
      pending.current = { ...pending.current, ...patch };
      setSaveState("saving");
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  useEffect(() => () => void flush(), [flush]);

  const update = useCallback(
    (patch: Partial<ProjectSettings> | ((s: ProjectSettings) => Partial<ProjectSettings>)) => {
      setSettings((prev) => {
        const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
        scheduleSave({ settings: next });
        return next;
      });
    },
    [scheduleSave],
  );

  const rename = useCallback(
    (name: string) => {
      setProject((p) => (p ? { ...p, name } : p));
      if (name.trim()) scheduleSave({ name: name.trim() });
    },
    [scheduleSave],
  );

  // Re-parse whenever the files, chosen plates or support visibility change.
  const plateKey = settings.plate.join(",");
  const flipKey = settings.flipped.join(",");
  const sourceKey = sources.map((s) => s.file.id).join(",");
  useEffect(() => {
    if (sources.length === 0) {
      setParts(null);
      return;
    }
    let cancelled = false;
    setParseError(null);
    setProgress({ fraction: 0, stage: "Reading G-code" });
    loadParts(
      sources.map((s, i) => ({
        name: s.file.filename,
        bytes: s.bytes,
        plate: settings.plate[i],
        flipped: !!settings.flipped[i],
      })),
      {
        includeSupports: settings.showSupports,
        onProgress: (fraction, stage) => !cancelled && setProgress({ fraction, stage }),
      },
    )
      .then((loaded) => {
        if (cancelled) return;
        setParts(loaded);
        setProgress(null);
        // First load of a part: start from the colors saved by the slicer.
        setSettings((prev) => {
          const partColors = loaded.map((p, i) => {
            const existing = prev.partColors[i];
            if (existing && existing.length >= p.toolCount) return existing;
            return Array.from(
              { length: Math.max(1, p.toolCount) },
              (_, t) =>
                existing?.[t] ?? (p.filamentColors[t] ? filamentForHex(p.filamentColors[t]!) : "pla-matte-ivory-white"),
            );
          });
          if (JSON.stringify(partColors) === JSON.stringify(prev.partColors)) return prev;
          const next = { ...prev, partColors };
          scheduleSave({ settings: next });
          return next;
        });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setParseError(e.message);
        setProgress(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, plateKey, flipKey, settings.showSupports]);

  const upload = useCallback(
    async (files: File[]): Promise<string[]> => {
      const errors: string[] = [];
      const room = MAX_PARTS - sources.length;
      if (files.length > room) errors.push(`A product can have up to ${MAX_PARTS} parts; extra files were skipped.`);
      const accepted: File[] = [];
      for (const f of files.slice(0, Math.max(0, room))) {
        const problem = clientFileProblem(f);
        if (problem) errors.push(problem);
        else accepted.push(f);
      }
      if (accepted.length === 0) return errors;
      setUploading(true);
      try {
        for (const f of accepted) {
          try {
            const [file, bytes] = await Promise.all([projectService.uploadFile(projectId, f), f.arrayBuffer()]);
            setSources((prev) => [...prev, { file, bytes }]);
          } catch (e) {
            errors.push(e instanceof ApiError ? `${f.name}: ${e.message}` : `${f.name}: upload failed.`);
          }
        }
      } finally {
        setUploading(false);
      }
      return errors;
    },
    [projectId, sources.length],
  );

  const removeFile = useCallback(
    async (fileId: string) => {
      const index = sources.findIndex((s) => s.file.id === fileId);
      await projectService.removeFile(fileId);
      setSources((prev) => prev.filter((s) => s.file.id !== fileId));
      if (index >= 0) {
        update((s) => ({
          partColors: s.partColors.filter((_, i) => i !== index),
          plate: s.plate.filter((_, i) => i !== index),
          flipped: s.flipped.filter((_, i) => i !== index),
        }));
      }
    },
    [sources, update],
  );

  const setPartColor = useCallback(
    (part: number, tool: number, filament: string) =>
      update((s) => {
        const partColors = s.partColors.map((tools) => [...tools]);
        while (partColors.length <= part) partColors.push([]);
        partColors[part]![tool] = filament;
        return { partColors };
      }),
    [update],
  );

  const setFlipped = useCallback(
    (part: number, flipped: boolean) =>
      update((s) => {
        const f = [...s.flipped];
        f[part] = flipped;
        return { flipped: f };
      }),
    [update],
  );

  const setPlate = useCallback(
    (part: number, plate: number) =>
      update((s) => {
        const p = [...s.plate];
        p[part] = plate;
        return { plate: p };
      }),
    [update],
  );

  const stats = useMemo(() => {
    if (!parts) return null;
    return {
      slicer: [...new Set(parts.map((p) => p.slicer))].join(", "),
      layers: Math.max(...parts.map((p) => p.layerCount)),
      triangles: parts.reduce((a, p) => a + p.triangles, 0),
    };
  }, [parts]);

  return {
    project,
    settings,
    sources,
    parts,
    progress,
    loadError,
    parseError,
    saveState,
    uploading,
    stats,
    update,
    rename,
    upload,
    removeFile,
    setPartColor,
    setPlate,
    setFlipped,
  };
};

export type Editor = ReturnType<typeof useEditor>;
