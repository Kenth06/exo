import { Loader, Meter } from "@cloudflare/kumo";
import type { RevolvedSpec } from "@exo/gcode";
import { useEffect, useState } from "react";
import { useSampleParts } from "@/hooks/useSampleParts";
import type { Shot } from "@/lib/engine/camera";
import type { LoadedPart } from "@/lib/engine/loader-types";
import type { Stage } from "@/lib/engine/stage";
import { Viewer } from "./Viewer";

interface SampleViewerProps {
  specs: RevolvedSpec[];
  /** Filament id per part. */
  colors: string[];
  scene: string;
  shot?: Shot;
  autoRotate?: boolean;
  interactive?: boolean;
  className?: string;
  label: string;
  /** Replace the parsed parts (e.g. the smooth STL comparison). */
  override?: LoadedPart[];
}

export const SampleViewer = ({
  specs,
  colors,
  scene,
  shot,
  autoRotate,
  interactive,
  className,
  label,
  override,
}: SampleViewerProps) => {
  const { parts, progress, error } = useSampleParts(specs);
  const [stage, setStage] = useState<Stage | null>(null);
  const shown = override ?? parts;
  const colorKey = colors.join(",");

  useEffect(() => {
    if (stage && shown)
      stage.setParts(
        shown,
        colors.map((c) => [c]),
      );
    // Colors are applied separately below so recoloring doesn't rebuild geometry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, shown]);

  useEffect(() => {
    stage?.setColors(colors.map((c) => [c]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, colorKey]);

  useEffect(() => stage?.setScene(scene), [stage, scene]);
  useEffect(() => {
    if (shot) stage?.setShot(shot);
  }, [stage, shot]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <Viewer
        className="block size-full"
        onStage={setStage}
        label={label}
        autoRotate={autoRotate}
        interactive={interactive}
        pauseOffscreen
      />
      {!shown && !error && (
        <div className="absolute inset-0 grid place-items-center bg-[var(--exo-surface)]">
          <div className="w-48 space-y-3 text-center">
            <Loader />
            <Meter label="Reading G-code" value={Math.round(progress * 100)} />
          </div>
        </div>
      )}
      {error && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm">{error}</p>}
    </div>
  );
};
