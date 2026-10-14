import {
  ANGLES,
  type MotionId,
  type ProjectSettings,
  type RenderQuality,
  resolveFilament,
  type VideoAspect,
} from "@exo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { renderService } from "@/lib/client/services/render.service";
import type { ImageJob } from "@/lib/editor/jobs";
import { shotFor } from "@/lib/engine/camera";
import { type PhotoProgress, PhotoSession } from "@/lib/engine/photo";
import type { Stage } from "@/lib/engine/stage";
import { recordVideo } from "@/lib/engine/video";

export interface RenderedFile {
  name: string;
  blob: Blob;
  url: string;
  label: string;
}

export interface QueueState {
  running: boolean;
  done: number;
  total: number;
  current: string | null;
  results: RenderedFile[];
  error: string | null;
}

const IDLE: QueueState = { running: false, done: 0, total: 0, current: null, results: [], error: null };
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Put the preview back to the project settings after a batch changed scenes and colors. */
const restore = (stage: Stage, settings: ProjectSettings) => {
  void stage.setScene(settings.scene);
  stage.setColors(settings.partColors);
};

/** Renders final images/videos on the Stage one at a time and saves each one to the gallery. */
export const useRenderQueue = (stage: Stage | null, projectId: string, settings: ProjectSettings) => {
  const [state, setState] = useState<QueueState>(IDLE);
  const cancelled = useRef(false);
  // Refs keep the callbacks stable while still reading the latest settings and results.
  const settingsRef = useRef(settings);
  const resultsRef = useRef<RenderedFile[]>([]);
  useEffect(() => {
    settingsRef.current = settings;
    resultsRef.current = state.results;
  });

  const runImages = useCallback(
    async (input: ImageJob[], quality: RenderQuality = "photo") => {
      if (!stage || input.length === 0) return;
      cancelled.current = false;
      resultsRef.current.forEach((r) => URL.revokeObjectURL(r.url));
      // Group by scene so a photo batch rebuilds the path tracer's BVH once per backdrop.
      const jobs = input.toSorted((a, b) => a.scene.localeCompare(b.scene));
      setState({ ...IDLE, running: true, total: jobs.length });
      const results: RenderedFile[] = [];
      let session: PhotoSession | null = null;
      let sessionScene: string | null = null;
      let sessionColors = "";
      try {
        for (const [i, job] of jobs.entries()) {
          if (cancelled.current) break;
          setState((s) => ({ ...s, current: job.label }));
          await tick();
          await stage.setScene(job.scene);
          stage.setColors(job.colors);
          const angle = ANGLES.find((a) => a.id === job.angle)!;
          let blob: Blob;
          if (quality === "photo") {
            const label = job.label;
            const progress: PhotoProgress = (f, phase) =>
              setState((s) => ({
                ...s,
                current:
                  phase === "building"
                    ? `Preparing the scene · ${Math.round(f * 100)}%`
                    : `${label} · ${Math.round(f * 100)}%`,
              }));
            if (!session) {
              session = await PhotoSession.create(stage, progress);
            } else if (sessionScene !== job.scene) {
              await session.rebuild(progress);
            } else if (sessionColors !== JSON.stringify(job.colors)) {
              session.updateMaterials();
            }
            sessionScene = job.scene;
            sessionColors = JSON.stringify(job.colors);
            blob = await session.render(job.width, job.height, shotFor(angle), { samples: 256, onProgress: progress });
          } else {
            blob = await stage.capture(job.width, job.height, shotFor(angle));
          }
          await renderService.save(blob, {
            kind: "image",
            label: job.label,
            projectId,
            platform: job.platform,
            filament: job.filament,
            scene: job.scene,
            angle: job.angle,
            width: job.width,
            height: job.height,
          });
          results.push({ name: job.filename, blob, url: URL.createObjectURL(blob), label: job.label });
          setState((s) => ({ ...s, done: i + 1, results: [...results] }));
        }
      } catch (e) {
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : "Rendering failed." }));
      } finally {
        session?.dispose();
        restore(stage, settingsRef.current);
        setState((s) => ({ ...s, running: false, current: null }));
      }
    },
    [stage, projectId],
  );

  const runVideo = useCallback(
    async (opts: { projectName: string; motion: MotionId; duration: number; aspect: VideoAspect; angle: string }) => {
      if (!stage) return;
      cancelled.current = false;
      setState({ ...IDLE, running: true, total: 1, current: "Rendering video" });
      try {
        const current = settingsRef.current;
        restore(stage, current);
        await stage.whenReady();
        const angle = ANGLES.find((a) => a.id === opts.angle) ?? ANGLES[0]!;
        const blob = await recordVideo(stage, {
          motion: opts.motion,
          duration: opts.duration,
          aspect: opts.aspect,
          base: { ...shotFor(angle), detail: false, fill: 0.78 },
          onProgress: (f) => setState((s) => ({ ...s, current: `Rendering video · ${Math.round(f * 100)}%` })),
        });
        const f = resolveFilament(current.partColors[0]?.[0] ?? "");
        const label = `${opts.projectName} · ${f.name} · ${opts.motion} · ${opts.aspect}`;
        const [w, h] = opts.aspect === "9:16" ? [1080, 1920] : opts.aspect === "4:5" ? [1080, 1350] : [1080, 1080];
        await renderService.save(blob, {
          kind: "video",
          label,
          projectId,
          motion: opts.motion,
          scene: current.scene,
          filament: f.id,
          width: w,
          height: h,
        });
        const name = `${opts.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${opts.motion}_${opts.aspect.replace(":", "x")}.mp4`;
        setState((s) => ({ ...s, done: 1, results: [{ name, blob, url: URL.createObjectURL(blob), label }] }));
      } catch (e) {
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : "Video rendering failed." }));
      } finally {
        restore(stage, settingsRef.current);
        setState((s) => ({ ...s, running: false, current: null }));
      }
    },
    [stage, projectId],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  return { state, runImages, runVideo, cancel };
};
