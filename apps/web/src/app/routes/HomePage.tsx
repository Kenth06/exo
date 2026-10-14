import { Button, Collapsible, Select, Tabs } from "@cloudflare/kumo";
import { SAMPLE_LAMP } from "@exo/gcode";
import {
  ANGLES,
  FILAMENTS,
  LINE_NAMES,
  MAX_PARTS,
  MOTIONS,
  PLATFORMS,
  resolveFilament,
  SCENES,
  TEMPLATES,
  VIDEO_ASPECTS,
  VIDEO_DURATIONS,
} from "@exo/shared";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { SwatchGrid } from "@/components/filament/SwatchGrid";
import { FAQ } from "@/components/marketing/content";
import { FactList, Section } from "@/components/marketing/Section";
import { SampleViewer } from "@/components/viewer/SampleViewer";
import { smoothPartFromSpec } from "@/lib/engine/smooth";

const HERO_COLORS = [
  "pla-matte-terracotta",
  "pla-silk-silk-rose-gold",
  "pla-matte-ivory-white",
  "pla-silk-silk-jade",
  "petg-hf-blue",
  "pla-matte-charcoal",
  "petg-translucent-amber",
  "pla-basic-yellow",
];
const LAMP = [SAMPLE_LAMP];
const DETAIL = { azimuth: 28, elevation: 10, fill: 1, detail: true };
const LAYERS = Math.round(SAMPLE_LAMP.height / SAMPLE_LAMP.layerHeight);

const SPECS: Array<[string, React.ReactNode]> = [
  ["Input", "Sliced .gcode.3mf or .gcode, up to 100 MB"],
  ["Slicers", "Bambu Studio, OrcaSlicer, PrusaSlicer, Cura"],
  ["Parts per product", `Up to ${MAX_PARTS} files, one filament each (multi-color files keep every tool)`],
  ["Filaments", `${FILAMENTS.length} colors in ${LINE_NAMES.length} lines, plus any custom color`],
  [
    "Scenes",
    `${SCENES.filter((s) => s.kind === "studio").length} studio sweeps, ${SCENES.filter((s) => s.kind === "set").length} lit sets`,
  ],
  ["Camera", `${ANGLES.length} angles, up to 6 per set, ${TEMPLATES.length} starting templates`],
  ["Images", `${PLATFORMS.length} platform sizes, up to ${Math.max(...PLATFORMS.map((p) => p.width))} px wide, JPEG`],
  [
    "Video",
    `${MOTIONS.length} camera moves, ${VIDEO_DURATIONS.join(" / ")} s, ${Object.keys(VIDEO_ASPECTS).join(" / ")}, H.264 MP4`,
  ],
  ["Price", "Free"],
];

export const HomePage = () => {
  const navigate = useNavigate();
  const [color, setColor] = useState(HERO_COLORS[0]!);
  const [scene, setScene] = useState("white-sweep");
  const [compare, setCompare] = useState<"gcode" | "stl">("gcode");
  const smooth = useMemo(() => [smoothPartFromSpec(SAMPLE_LAMP)], []);
  const current = resolveFilament(color);

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:pt-16">
        <div>
          <h1 className="text-4xl leading-[1.06] font-semibold sm:text-5xl">Product photos from your G-code</h1>
          <p className="mt-5 max-w-md text-lg exo-fg-soft">
            Upload the file you'd send to the printer. Exo builds every extrusion as geometry and renders it in your
            browser, so the photos show the layer lines you'll print. Free to use.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={() => navigate("/signup")}>
              Open the editor
            </Button>
            <Link to="/how-it-works" className="px-2 text-sm font-medium underline-offset-4 hover:underline">
              How it works
            </Link>
          </div>
        </div>

        <figure>
          <SampleViewer
            specs={LAMP}
            colors={[color]}
            scene={scene}
            autoRotate
            label={`Live render of a ribbed lamp in ${current.line} ${current.name}`}
            className="exo-outline aspect-[5/4] w-full rounded-xl"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <SwatchGrid
              filaments={HERO_COLORS.map(resolveFilament)}
              selected={color}
              onSelect={(f) => setColor(f.id)}
              size="sm"
            />
            <Select
              size="sm"
              aria-label="Scene"
              className="w-44"
              value={scene}
              onValueChange={(v) => setScene((v as string) ?? "white-sweep")}
              items={Object.fromEntries(SCENES.map((s) => [s.id, s.name]))}
            />
          </div>
          <figcaption className="mt-2 font-mono text-xs tabular-nums exo-fg-soft">
            Rendering live from {LAYERS} layers of G-code · {current.line} {current.name}
          </figcaption>
        </figure>
      </section>

      <Section
        title="What the toolpath adds"
        lede="An STL describes the shape you designed. The G-code describes the beads of plastic the nozzle lays down. Same lamp, same light, close up."
      >
        <Tabs
          value={compare}
          onValueChange={(v) => setCompare(v as "gcode" | "stl")}
          tabs={[
            { value: "gcode", label: "G-code" },
            { value: "stl", label: "STL" },
          ]}
        />
        <SampleViewer
          specs={LAMP}
          override={compare === "stl" ? smooth : undefined}
          colors={["pla-matte-latte-brown"]}
          scene="grey-sweep"
          shot={DETAIL}
          interactive
          label={
            compare === "stl"
              ? "Smooth STL surface of the lamp, close up"
              : "G-code render of the lamp wall, close up, showing layer lines"
          }
          className="exo-outline mt-4 aspect-[16/9] w-full rounded-xl"
        />
        <p className="mt-2 text-sm exo-fg-soft">
          Drag to orbit, scroll to zoom.{" "}
          <Link to="/why-gcode" className="underline underline-offset-4">
            More on why G-code
          </Link>
        </p>
      </Section>

      <Section title="Specs" lede="Everything renders on your own GPU, which is why it costs nothing.">
        <FactList items={SPECS} />
      </Section>

      <Section
        title="Output sizes"
        lede="Exo frames each image for the platform's aspect ratio, so the product is never cropped."
      >
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {(["Marketplaces", "Model repositories", "Social"] as const).map((g) => (
            <div key={g}>
              <h3 className="mb-2 text-sm font-medium">{g}</h3>
              <ul className="divide-y exo-border border-y exo-border">
                {PLATFORMS.filter((p) => p.group === g).map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    {p.name}
                    <span className="font-mono text-xs tabular-nums exo-fg-soft">
                      {p.width} × {p.height}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Questions">
        <div className="divide-y exo-border border-y exo-border">
          {FAQ.slice(0, 5).map((f) => (
            <Collapsible.Root key={f.q} className="py-2">
              <Collapsible.DefaultTrigger>{f.q}</Collapsible.DefaultTrigger>
              <Collapsible.DefaultPanel>
                <p className="max-w-2xl pb-3 exo-fg-soft">{f.a}</p>
              </Collapsible.DefaultPanel>
            </Collapsible.Root>
          ))}
        </div>
        <Link to="/faq" className="mt-4 inline-block text-sm underline underline-offset-4">
          All questions
        </Link>
      </Section>
    </>
  );
};
