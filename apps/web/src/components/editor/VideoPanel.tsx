import { Banner, Button, Meter, Radio, Tabs } from "@cloudflare/kumo";
import { ANGLES, type MotionId, MOTIONS, VIDEO_ASPECTS, VIDEO_DURATIONS, type VideoAspect } from "@exo/shared";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import type { Editor } from "@/hooks/useEditor";
import type { QueueState } from "@/hooks/useRenderQueue";
import { downloadBlob } from "@/lib/editor/download";
import { videoSupported } from "@/lib/engine/video";

interface VideoPanelProps {
  editor: Editor;
  queue: QueueState;
  previewFrame: "first" | "last" | null;
  onPreviewFrame: (f: "first" | "last" | null) => void;
  onRender: () => void;
}

export const VideoPanel = ({ editor, queue, previewFrame, onPreviewFrame, onRender }: VideoPanelProps) => {
  const { video } = editor.settings;
  const setVideo = (patch: Partial<typeof video>) => editor.update((s) => ({ video: { ...s.video, ...patch } }));
  const result = queue.results.find((r) => r.name.endsWith(".mp4"));

  return (
    <div className="space-y-6">
      {!videoSupported() && (
        <Banner
          variant="alert"
          title="This browser can't encode video"
          description="Use a recent Chrome, Edge or Safari."
        />
      )}
      <Radio legend="Camera move" value={video.motion} onValueChange={(v) => setVideo({ motion: v as MotionId })}>
        {MOTIONS.map((m) => (
          <Radio.Item key={m.id} value={m.id} label={m.name} description={m.description} />
        ))}
      </Radio>
      <div>
        <p className="mb-2 text-sm font-medium">Length</p>
        <Tabs
          value={String(video.duration)}
          onValueChange={(v) => setVideo({ duration: Number(v) as (typeof VIDEO_DURATIONS)[number] })}
          tabs={VIDEO_DURATIONS.map((d) => ({ value: String(d), label: `${d} s` }))}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Format</p>
        <Tabs
          value={video.aspect}
          onValueChange={(v) => setVideo({ aspect: v as VideoAspect })}
          tabs={Object.keys(VIDEO_ASPECTS).map((a) => ({ value: a, label: a }))}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Preview frames</p>
        <div className="flex gap-2">
          {(["first", "last"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={previewFrame === f ? "primary" : "secondary"}
              onClick={() => onPreviewFrame(previewFrame === f ? null : f)}
            >
              {f === "first" ? "First frame" : "Last frame"}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs exo-fg-soft">
          Starts from the {ANGLES[0]!.name.toLowerCase()} angle in the current scene and colors.
        </p>
      </div>
      <div className="border-t exo-border pt-4">
        {queue.running ? (
          <Meter label={queue.current ?? "Rendering"} value={Number(/(\d+)%/.exec(queue.current ?? "")?.[1] ?? 0)} />
        ) : (
          <Button variant="primary" className="w-full" disabled={!editor.parts || !videoSupported()} onClick={onRender}>
            Render {video.duration} s video
          </Button>
        )}
        {queue.error && <Banner className="mt-2" variant="error" title={queue.error} />}
        {result && !queue.running && (
          <div className="mt-3 space-y-2">
            <video
              src={result.url}
              controls
              loop
              muted
              playsInline
              className="w-full rounded-lg border exo-border"
              aria-label={result.label}
            />
            <Button
              size="sm"
              className="w-full"
              icon={<DownloadSimpleIcon />}
              onClick={() => downloadBlob(result.blob, result.name)}
            >
              Download MP4
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
