import { Button, Select, Switch } from "@cloudflare/kumo";
import { MAX_PARTS } from "@exo/shared";
import { TrashIcon } from "@phosphor-icons/react";
import { FilamentPicker } from "@/components/filament/FilamentPicker";
import type { Editor } from "@/hooks/useEditor";
import { Dropzone } from "./Dropzone";

export const PartsPanel = ({ editor, onFiles }: { editor: Editor; onFiles: (f: File[]) => void }) => {
  const { sources, parts, settings } = editor;
  return (
    <div className="space-y-5">
      {sources.map((s, i) => {
        const part = parts?.[i];
        const tools = Math.max(1, part?.toolCount ?? settings.partColors[i]?.length ?? 1);
        return (
          <section key={s.file.id} className="rounded-xl border exo-border p-3">
            <div className="mb-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={s.file.filename}>
                  {s.file.filename}
                </p>
                <p className="text-xs exo-fg-soft">
                  {(s.file.size / 1048576).toFixed(1)} MB{part ? ` · ${part.layerCount} layers · ${part.slicer}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                shape="square"
                icon={<TrashIcon />}
                aria-label={`Remove ${s.file.filename}`}
                onClick={() => void editor.removeFile(s.file.id)}
              />
            </div>
            {part && part.plates.length > 1 && (
              <Select
                size="sm"
                label="Plate"
                className="mb-3"
                value={String(settings.plate[i] ?? part.plate)}
                onValueChange={(v) => editor.setPlate(i, Number(v))}
                items={Object.fromEntries(part.plates.map((p) => [String(p), `Plate ${p}`]))}
              />
            )}
            <div className="space-y-2">
              <Switch
                size="sm"
                label="Show plate side up"
                labelTooltip="For parts printed face-down: flips the part so the side that touched the bed faces the camera."
                checked={!!settings.flipped[i]}
                onClick={() => editor.setFlipped(i, !settings.flipped[i])}
              />
              {Array.from({ length: tools }, (_, t) => (
                <FilamentPicker
                  key={t}
                  label={tools > 1 ? `Filament ${t + 1}` : "Filament"}
                  value={settings.partColors[i]?.[t] ?? ""}
                  onChange={(id) => editor.setPartColor(i, t, id)}
                />
              ))}
            </div>
          </section>
        );
      })}
      {sources.length === 0 && (
        <p className="text-sm exo-fg-soft">Add a sliced file to start. Colors for each part show up here.</p>
      )}
      {sources.length > 0 && sources.length < MAX_PARTS && (
        <Dropzone compact onFiles={onFiles} busy={editor.uploading} />
      )}
      <Switch
        label="Show supports"
        checked={settings.showSupports}
        onClick={() => editor.update((s) => ({ showSupports: !s.showSupports }))}
      />
    </div>
  );
};
