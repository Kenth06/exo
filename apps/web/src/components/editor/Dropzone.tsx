import { Button } from "@cloudflare/kumo";
import { UploadSimpleIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  compact?: boolean;
}

export const Dropzone = ({ onFiles, busy, compact }: DropzoneProps) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files]);
      }}
      className={`rounded-xl border-2 border-dashed text-center transition-colors ${over ? "border-[var(--exo-accent)] bg-[var(--exo-line)]" : "exo-border"} ${compact ? "p-4" : "p-10"}`}
    >
      {!compact && <UploadSimpleIcon size={36} className="mx-auto mb-3 opacity-60" aria-hidden="true" />}
      <p className={compact ? "text-sm" : "text-xl font-semibold"}>
        {compact ? "Add another part" : "Drop a sliced file"}
      </p>
      {!compact && (
        <p className="mt-1 text-sm exo-fg-soft">.gcode.3mf or .gcode, up to 100 MB. Up to 4 files for one product.</p>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept=".gcode,.3mf,.gcode.3mf"
        className="sr-only"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <div className="mt-4 flex justify-center">
        <Button
          variant={compact ? "secondary" : "primary"}
          size={compact ? "sm" : "base"}
          loading={busy}
          onClick={() => input.current?.click()}
        >
          Choose files
        </Button>
      </div>
    </div>
  );
};
