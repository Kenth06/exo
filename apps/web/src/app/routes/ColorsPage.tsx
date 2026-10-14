import { Badge, Input, Select } from "@cloudflare/kumo";
import { SAMPLE_LAMP } from "@exo/gcode";
import { LINE_NAMES, resolveFilament } from "@exo/shared";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { filterFilaments } from "@/components/filament/FilamentPicker";
import { SwatchGrid } from "@/components/filament/SwatchGrid";
import { PageHeader } from "@/components/marketing/Section";
import { SampleViewer } from "@/components/viewer/SampleViewer";

const LAMP = [SAMPLE_LAMP];

export const ColorsPage = () => {
  const [params, setParams] = useSearchParams();
  const selected = params.get("c") ?? "pla-matte-latte-brown";
  const [query, setQuery] = useState("");
  const [line, setLine] = useState("all");
  const list = useMemo(() => filterFilaments(query, line), [query, line]);
  const f = resolveFilament(selected);

  return (
    <>
      <PageHeader
        title="Filament library"
        lede="Each color renders with its finish: matte sheen, silk shimmer, glossy PETG, translucent PETG or carbon fill. Pick one to see it on the lamp."
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <SampleViewer
            specs={LAMP}
            colors={[selected]}
            scene="white-sweep"
            interactive
            label={`Lamp rendered in ${f.line} ${f.name}`}
            className="exo-outline aspect-square w-full rounded-xl"
          />
          <div className="mt-3 flex items-center gap-2">
            <h2 className="text-xl font-semibold">{f.name}</h2>
            <Badge variant="outline">{f.line}</Badge>
            <Badge variant="neutral">{f.finish}</Badge>
            <span className="ml-auto font-mono text-xs tabular-nums exo-fg-soft">{f.hex}</span>
          </div>
        </div>
        <div>
          <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
            <Input
              placeholder="Search colors"
              aria-label="Search colors"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              aria-label="Filament line"
              value={line}
              onValueChange={(v) => setLine((v as string) ?? "all")}
              items={{ all: "All lines", ...Object.fromEntries(LINE_NAMES.map((l) => [l, l])) }}
            />
          </div>
          {LINE_NAMES.filter((l) => line === "all" || l === line).map((l) => {
            const inLine = list.filter((x) => x.line === l);
            if (inLine.length === 0) return null;
            return (
              <section key={l} className="mb-6">
                <h3 className="mb-2 text-sm font-medium">
                  {l} <span className="exo-fg-soft">· {inLine.length}</span>
                </h3>
                <SwatchGrid
                  filaments={inLine}
                  selected={selected}
                  onSelect={(x) => setParams({ c: x.id }, { replace: true })}
                />
              </section>
            );
          })}
          {list.length === 0 && <p className="exo-fg-soft">No colors match “{query}”.</p>}
        </div>
      </div>
    </>
  );
};
