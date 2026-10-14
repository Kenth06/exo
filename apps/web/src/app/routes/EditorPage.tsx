import { Badge, Banner, Input, Loader, Meter, Tabs, useKumoToastManager } from "@cloudflare/kumo";
import { SAMPLE_LAMP, SAMPLE_PLANTER, SAMPLE_SAUCER } from "@exo/gcode";
import { ANGLES } from "@exo/shared";
import { ArrowLeftIcon, WarningIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Dropzone } from "@/components/editor/Dropzone";
import { PartsPanel } from "@/components/editor/PartsPanel";
import { PhotosPanel } from "@/components/editor/PhotosPanel";
import { ScenePanel } from "@/components/editor/ScenePanel";
import { VideoPanel } from "@/components/editor/VideoPanel";
import { Viewer } from "@/components/viewer/Viewer";
import { useEditor } from "@/hooks/useEditor";
import { useRenderQueue } from "@/hooks/useRenderQueue";
import { sampleFile } from "@/hooks/useSampleParts";
import { shotFor } from "@/lib/engine/camera";
import type { Stage } from "@/lib/engine/stage";
import { motionAt } from "@/lib/engine/video";

type Panel = "parts" | "scene" | "photos" | "video";

const SAVE_LABEL = { saved: "Saved", saving: "Saving…", error: "Not saved" } as const;

export const EditorPage = () => {
  const { id = "" } = useParams();
  const editor = useEditor(id);
  const toast = useKumoToastManager();
  const [stage, setStage] = useState<Stage | null>(null);
  const [panel, setPanel] = useState<Panel>("parts");
  const [previewAngle, setPreviewAngle] = useState("hero");
  const [previewFrame, setPreviewFrame] = useState<"first" | "last" | null>(null);
  const queue = useRenderQueue(stage, id, editor.settings);
  const { parts, settings } = editor;

  useEffect(() => {
    if (stage && parts) stage.setParts(parts, settings.partColors);
    // Colors and scene are applied by their own effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, parts]);
  useEffect(() => stage?.setColors(settings.partColors), [stage, settings.partColors]);
  useEffect(() => stage?.setScene(settings.scene), [stage, settings.scene]);
  useEffect(() => {
    if (!stage || queue.state.running) return;
    const angle = ANGLES.find((a) => a.id === previewAngle) ?? ANGLES[0]!;
    if (panel === "video" && previewFrame) {
      const frame = motionAt(settings.video.motion, previewFrame === "first" ? 0 : 1, {
        ...shotFor(ANGLES[0]!),
        fill: 0.78,
      });
      stage.setReveal(frame.reveal);
      stage.setShot(frame.shot);
    } else {
      stage.setReveal(null);
      stage.setShot(shotFor(angle));
    }
  }, [stage, previewAngle, previewFrame, panel, settings.video.motion, queue.state.running, parts]);

  const onFiles = useCallback(
    async (files: File[]) => {
      const errors = await editor.upload(files);
      errors.forEach((e) => toast.add({ title: "Couldn't add a file", description: e, variant: "error" }));
    },
    [editor, toast],
  );

  if (editor.loadError) {
    return (
      <div className="mx-auto max-w-lg p-10">
        <Banner variant="error" icon={<WarningIcon weight="fill" />} title={editor.loadError} />
        <Link to="/app" className="mt-4 inline-block underline">
          Back to projects
        </Link>
      </div>
    );
  }
  if (!editor.project) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader size="lg" />
      </div>
    );
  }

  const empty = editor.sources.length === 0;
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:flex-row">
      <div className="flex min-h-[55vh] flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b exo-border px-3 py-2">
          <Link to="/app" aria-label="Back to projects" className="rounded p-1 hover:bg-[var(--exo-line)]">
            <ArrowLeftIcon size={18} />
          </Link>
          <Input
            size="sm"
            aria-label="Project name"
            className="w-56"
            value={editor.project.name}
            onChange={(e) => editor.rename(e.target.value)}
          />
          <span className={`text-xs ${editor.saveState === "error" ? "text-kumo-danger" : "exo-fg-soft"}`}>
            {SAVE_LABEL[editor.saveState]}
          </span>
          {editor.stats && (
            <div className="ml-auto hidden items-center gap-1.5 tabular-nums md:flex">
              <Badge variant="outline">{editor.stats.slicer}</Badge>
              <Badge variant="outline">{editor.stats.layers} layers</Badge>
              <Badge variant="outline">{(editor.stats.triangles / 1e6).toFixed(1)}M triangles</Badge>
            </div>
          )}
        </div>

        <div className="relative flex-1 exo-surface">
          {empty ? (
            <div className="grid h-full place-items-center p-6">
              <div className="w-full max-w-xl space-y-6">
                <Dropzone onFiles={onFiles} busy={editor.uploading} />
                <p className="text-center text-sm exo-fg-soft">
                  No file handy? Try a sample:{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => onFiles([sampleFile(SAMPLE_LAMP, "ribbed-lamp.gcode")])}
                  >
                    ribbed lamp
                  </button>{" "}
                  or{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() =>
                      onFiles([sampleFile(SAMPLE_PLANTER, "planter.gcode"), sampleFile(SAMPLE_SAUCER, "saucer.gcode")])
                    }
                  >
                    planter and saucer
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <>
              <Viewer
                className="absolute inset-0 block size-full"
                onStage={setStage}
                interactive
                label={`Preview of ${editor.project.name}`}
              />
              <span className="pointer-events-none absolute top-3 left-3 rounded bg-black/55 px-2 py-0.5 font-mono text-[11px] tracking-wider text-white uppercase">
                Preview
              </span>
              {editor.progress && (
                <div className="absolute inset-0 grid place-items-center bg-[var(--exo-surface)]/80">
                  <div className="w-64">
                    <Meter label={editor.progress.stage} value={Math.round(editor.progress.fraction * 100)} />
                  </div>
                </div>
              )}
              {editor.parseError && (
                <div className="absolute inset-x-4 top-12">
                  <Banner
                    variant="error"
                    icon={<WarningIcon weight="fill" />}
                    title="Couldn't read the file"
                    description={editor.parseError}
                  />
                </div>
              )}
              <div className="no-scrollbar absolute inset-x-0 bottom-0 flex gap-1 overflow-x-auto p-3">
                {ANGLES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={previewAngle === a.id}
                    onClick={() => {
                      setPreviewAngle(a.id);
                      setPreviewFrame(null);
                    }}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs backdrop-blur ${
                      previewAngle === a.id
                        ? "border-transparent bg-[var(--exo-fg)] text-[var(--exo-bg)]"
                        : "exo-border bg-[var(--exo-bg)]/70"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="flex w-full flex-col border-t exo-border lg:w-[400px] lg:border-t-0 lg:border-l">
        <div className="border-b exo-border p-3">
          <Tabs
            value={panel}
            onValueChange={(v) => setPanel(v as Panel)}
            tabs={[
              { value: "parts", label: "Parts" },
              { value: "scene", label: "Scene" },
              { value: "photos", label: "Photos" },
              { value: "video", label: "Video" },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {panel === "parts" && <PartsPanel editor={editor} onFiles={onFiles} />}
          {panel === "scene" && <ScenePanel editor={editor} />}
          {panel === "photos" && (
            <PhotosPanel editor={editor} queue={queue.state} onRender={queue.runImages} onCancel={queue.cancel} />
          )}
          {panel === "video" && (
            <VideoPanel
              editor={editor}
              queue={queue.state}
              previewFrame={previewFrame}
              onPreviewFrame={setPreviewFrame}
              onRender={() =>
                queue.runVideo({
                  projectName: editor.project?.name ?? "exo",
                  motion: settings.video.motion,
                  duration: settings.video.duration,
                  aspect: settings.video.aspect,
                  angle: "hero",
                })
              }
            />
          )}
        </div>
      </aside>
    </div>
  );
};
