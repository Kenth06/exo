import { Button, Input, Popover, Select } from "@cloudflare/kumo";
import { FILAMENTS, type Filament, LINE_NAMES, resolveFilament } from "@exo/shared";
import { useMemo, useState } from "react";
import { SwatchGrid, swatchStyle } from "./SwatchGrid";

interface FilamentPickerProps {
  value: string;
  onChange: (id: string) => void;
  label: string;
}

const ALL = "all";

export const filterFilaments = (query: string, line: string): Filament[] => {
  const q = query.trim().toLowerCase();
  return FILAMENTS.filter(
    (f) => (line === ALL || f.line === line) && (!q || `${f.line} ${f.name} ${f.material}`.toLowerCase().includes(q)),
  );
};

export const FilamentPicker = ({ value, onChange, label }: FilamentPickerProps) => {
  const [query, setQuery] = useState("");
  const [line, setLine] = useState(ALL);
  const [custom, setCustom] = useState("#e8743b");
  const current = resolveFilament(value);
  const list = useMemo(() => filterFilaments(query, line), [query, line]);

  return (
    <Popover>
      <Popover.Trigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg border exo-border px-3 py-2 text-left hover:bg-[var(--exo-line)]"
            aria-label={`${label}: ${current.line} ${current.name}`}
          >
            <span className="size-6 shrink-0 rounded-full border border-black/10" style={swatchStyle(current)} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{current.name}</span>
              <span className="block truncate text-xs exo-fg-soft">{current.line}</span>
            </span>
          </button>
        }
      />
      <Popover.Content className="w-[min(92vw,380px)] p-3">
        <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
          <Input
            size="sm"
            placeholder="Search colors"
            aria-label="Search colors"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            size="sm"
            aria-label="Filament line"
            value={line}
            onValueChange={(v) => setLine((v as string) ?? ALL)}
            items={{ [ALL]: "All lines", ...Object.fromEntries(LINE_NAMES.map((l) => [l, l])) }}
          />
        </div>
        <div className="max-h-64 overflow-y-auto pr-1">
          <SwatchGrid filaments={list} selected={value} onSelect={(f) => onChange(f.id)} size="sm" />
          {list.length === 0 && <p className="py-6 text-center text-sm exo-fg-soft">No colors match.</p>}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t exo-border pt-3">
          <input
            type="color"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Custom color"
            className="size-8 cursor-pointer rounded border-0 bg-transparent"
          />
          <span className="text-xs exo-fg-soft">Custom</span>
          <Button size="xs" className="ml-auto" onClick={() => onChange(`custom:${custom}:matte`)}>
            Matte
          </Button>
          <Button size="xs" onClick={() => onChange(`custom:${custom}:basic`)}>
            Basic
          </Button>
          <Button size="xs" onClick={() => onChange(`custom:${custom}:silk`)}>
            Silk
          </Button>
        </div>
      </Popover.Content>
    </Popover>
  );
};
