import { Tabs } from "@cloudflare/kumo";
import { SAMPLE_LAMP } from "@exo/gcode";
import { useMemo, useState } from "react";
import { FactList, PageHeader, Section } from "@/components/marketing/Section";
import { SampleViewer } from "@/components/viewer/SampleViewer";
import { smoothPartFromSpec } from "@/lib/engine/smooth";

const LAMP = [SAMPLE_LAMP];
const DETAIL = { azimuth: 28, elevation: 10, fill: 1, detail: true };
const WHOLE = { azimuth: 32, elevation: 18, fill: 0.8 };

const DIFFERENCES: Array<[string, string]> = [
  [
    "Layer height",
    "A 0.08 mm print and a 0.28 mm print of the same model look different. The G-code knows which one you sliced.",
  ],
  [
    "Line width",
    "Exo sizes each bead from the plastic the move extrudes, so thin walls and wide first layers come out right.",
  ],
  ["Seams and arcs", "Seam position, arc moves and where each loop starts all come from the toolpath."],
  [
    "What gets left out",
    "Exo drops skirts, brims, purge lines, prime towers and supports from the product shot. You can turn supports back on.",
  ],
];

export const WhyGcodePage = () => {
  const [mode, setMode] = useState<"gcode" | "stl">("gcode");
  const [view, setView] = useState<"detail" | "whole">("detail");
  const smooth = useMemo(() => [smoothPartFromSpec(SAMPLE_LAMP)], []);
  return (
    <>
      <PageHeader
        title="Why Exo renders G-code"
        lede="An STL is the smooth surface you designed. G-code is the path the nozzle follows, thousands of stacked beads of plastic. Exo renders the beads."
      />
      <Section title="Compare" lede="Same lamp, same light, same camera.">
        <div className="mb-4 flex flex-wrap gap-3">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "gcode" | "stl")}
            tabs={[
              { value: "gcode", label: "G-code" },
              { value: "stl", label: "STL" },
            ]}
          />
          <Tabs
            variant="underline"
            value={view}
            onValueChange={(v) => setView(v as "detail" | "whole")}
            tabs={[
              { value: "detail", label: "Close-up" },
              { value: "whole", label: "Whole print" },
            ]}
          />
        </div>
        <SampleViewer
          specs={LAMP}
          override={mode === "stl" ? smooth : undefined}
          colors={["pla-matte-latte-brown"]}
          scene="grey-sweep"
          shot={view === "detail" ? DETAIL : WHOLE}
          interactive
          label={mode === "stl" ? "Smooth STL surface of the lamp" : "G-code render of the lamp showing layer lines"}
          className="exo-outline aspect-[16/10] w-full rounded-xl"
        />
        <p className="mt-2 text-sm exo-fg-soft">Drag to orbit, scroll to zoom.</p>
      </Section>
      <Section title="What the toolpath adds">
        <FactList items={DIFFERENCES} />
      </Section>
    </>
  );
};
