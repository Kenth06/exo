import type { Filament } from "@exo/shared";
import { useRef } from "react";

interface SwatchGridProps {
  filaments: Filament[];
  selected?: string;
  onSelect: (f: Filament) => void;
  size?: "sm" | "base";
  columns?: string;
}

const finishStyle = (f: Filament): React.CSSProperties => {
  if (f.finish === "silk") {
    return {
      background: `linear-gradient(135deg, ${f.hex} 0%, color-mix(in srgb, ${f.hex} 55%, white) 45%, ${f.hex} 70%)`,
    };
  }
  if (f.finish === "translucent") {
    return { background: `linear-gradient(135deg, color-mix(in srgb, ${f.hex} 70%, transparent), ${f.hex})` };
  }
  if (f.finish === "carbon") {
    return {
      background: `repeating-linear-gradient(45deg, ${f.hex} 0 3px, color-mix(in srgb, ${f.hex} 80%, white) 3px 4px)`,
    };
  }
  return { background: f.hex };
};

export const swatchStyle = finishStyle;

/** Keyboard-navigable grid of filament swatches (arrow keys move, Enter selects). */
export const SwatchGrid = ({ filaments, selected, onSelect, size = "base", columns }: SwatchGridProps) => {
  const ref = useRef<HTMLDivElement>(null);
  // Small swatches get an invisible 6px halo so every hit area is 40px; the 12px gap keeps halos from overlapping.
  const dim = size === "sm" ? "size-7 before:absolute before:-inset-1.5 before:content-['']" : "size-10";
  const gap = size === "sm" ? "gap-3" : "gap-2";

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>("button[data-swatch]");
    if (!buttons) return;
    const perRow = Math.max(
      1,
      Math.round(ref.current!.clientWidth / (buttons[0]!.offsetWidth + (size === "sm" ? 12 : 8))),
    );
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    buttons[Math.min(buttons.length - 1, Math.max(0, i + delta))]?.focus();
  };

  return (
    <div ref={ref} role="listbox" aria-label="Filament colors" className={columns ?? `flex flex-wrap ${gap}`}>
      {filaments.map((f, i) => (
        <button
          key={f.id}
          type="button"
          role="option"
          data-swatch
          aria-selected={selected === f.id}
          title={`${f.line} · ${f.name}`}
          aria-label={`${f.line} ${f.name}`}
          onClick={() => onSelect(f)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={`${dim} relative shrink-0 rounded-full border border-black/10 outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--exo-accent)] dark:border-white/15 ${
            selected === f.id ? "ring-2 ring-[var(--exo-accent)] ring-offset-2 ring-offset-[var(--exo-bg)]" : ""
          }`}
          style={finishStyle(f)}
        />
      ))}
    </div>
  );
};
