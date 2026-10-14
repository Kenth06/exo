import { Banner, Button, Checkbox, Meter, Select, Tabs } from "@cloudflare/kumo";
import { ANGLES, FILAMENTS, MAX_ANGLES, PLATFORMS, type RenderQuality, resolveFilament, TEMPLATES } from "@exo/shared";
import { DownloadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useMemo } from "react";
import { FilamentPicker } from "@/components/filament/FilamentPicker";
import { swatchStyle } from "@/components/filament/SwatchGrid";
import type { Editor } from "@/hooks/useEditor";
import type { QueueState } from "@/hooks/useRenderQueue";
import { downloadBlob, zipFiles } from "@/lib/editor/download";
import { imageJobs, type ImageJob } from "@/lib/editor/jobs";

interface PhotosPanelProps {
  editor: Editor;
  queue: QueueState;
  onRender: (jobs: ImageJob[], quality: RenderQuality) => void;
  onCancel: () => void;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const PhotosPanel = ({ editor, queue, onRender, onCancel }: PhotosPanelProps) => {
  const { settings, update, project } = editor;
  const jobs = useMemo(() => imageJobs(project?.name ?? "exo", settings), [project?.name, settings]);
  const ready = !!editor.parts && !queue.running;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-medium">Quality</h3>
        <Tabs
          value={settings.quality}
          onValueChange={(v) => update({ quality: v as RenderQuality })}
          tabs={[
            { value: "photo", label: "Photo" },
            { value: "fast", label: "Fast" },
          ]}
        />
        <p className="mt-2 text-xs exo-fg-soft">
          {settings.quality === "photo"
            ? "Path traced: real light bounce, soft shadows and depth of field. About a minute per image."
            : "The live preview at full size. A few seconds per image."}
        </p>
      </section>

      <Select
        label="Template"
        placeholder="Start from a template"
        value={null}
        onValueChange={(id) => {
          const t = TEMPLATES.find((x) => x.id === id);
          if (t) update({ scene: t.scene, angles: t.angles, platforms: t.platforms });
        }}
        items={Object.fromEntries(TEMPLATES.map((t) => [t.id, t.name]))}
      />

      <section>
        <h3 className="mb-2 text-sm font-medium">
          Angles{" "}
          <span className="exo-fg-soft">
            · {settings.angles.length}/{MAX_ANGLES}
          </span>
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {ANGLES.map((a) => (
            <Checkbox
              key={a.id}
              label={a.name}
              checked={settings.angles.includes(a.id)}
              disabled={!settings.angles.includes(a.id) && settings.angles.length >= MAX_ANGLES}
              onCheckedChange={() => update((s) => ({ angles: toggle(s.angles, a.id) }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">Platforms</h3>
        {(["Marketplaces", "Model repositories", "Social"] as const).map((g) => (
          <div key={g} className="mb-3">
            <p className="mb-1 text-xs exo-fg-soft">{g}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PLATFORMS.filter((p) => p.group === g).map((p) => (
                <Checkbox
                  key={p.id}
                  label={`${p.name}`}
                  checked={settings.platforms.includes(p.id)}
                  onCheckedChange={() => update((s) => ({ platforms: toggle(s.platforms, p.id) }))}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-medium">Color variants</h3>
        <p className="mb-2 text-xs exo-fg-soft">
          Each extra color replaces the first part's main filament and renders the full set again.
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {settings.variants.map((v) => {
            const f = resolveFilament(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => update((s) => ({ variants: s.variants.filter((x) => x !== v) }))}
                className="inline-flex items-center gap-1.5 rounded-full border exo-border py-1 pr-2 pl-1 text-xs hover:bg-[var(--exo-line)]"
                aria-label={`Remove variant ${f.name}`}
              >
                <span className="size-4 rounded-full" style={swatchStyle(f)} />
                {f.name}
                <XIcon size={10} />
              </button>
            );
          })}
        </div>
        <FilamentPicker
          label="Add a variant"
          value={FILAMENTS[0]!.id}
          onChange={(id) => update((s) => ({ variants: s.variants.includes(id) ? s.variants : [...s.variants, id] }))}
        />
      </section>

      <div className="sticky -bottom-4 -mx-4 -mb-4 border-t exo-border exo-bg px-4 pt-3 pb-4">
        {queue.running ? (
          <div className="space-y-2">
            <Meter
              label={queue.current ?? "Rendering"}
              value={queue.total ? Math.round((queue.done / queue.total) * 100) : 0}
              customValue={`${queue.done} / ${queue.total}`}
            />
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Stop after this image
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            className="w-full"
            disabled={!ready || jobs.length === 0}
            onClick={() => onRender(jobs, settings.quality)}
          >
            Render {jobs.length} {jobs.length === 1 ? "image" : "images"}
          </Button>
        )}
        {queue.error && <Banner className="mt-2" variant="error" title={queue.error} />}
        {!queue.running && queue.results.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {queue.results.slice(0, 8).map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  download={r.name}
                  title={r.label}
                  className="block overflow-hidden rounded-md border exo-border"
                >
                  <img src={r.url} alt={r.label} className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
            <Button
              size="sm"
              icon={<DownloadSimpleIcon />}
              className="w-full"
              onClick={async () => downloadBlob(await zipFiles(queue.results), `${project?.name ?? "exo"}-images.zip`)}
            >
              Download {queue.results.length} as .zip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
