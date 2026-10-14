import { Button } from "@cloudflare/kumo";
import {
  ANGLES,
  MAX_ANGLES,
  MAX_PARTS,
  MOTIONS,
  PLATFORMS,
  TEMPLATES,
  VIDEO_ASPECTS,
  VIDEO_DURATIONS,
} from "@exo/shared";
import { useNavigate } from "react-router";
import { FactList, PageHeader, Section } from "@/components/marketing/Section";

const STEPS = [
  {
    title: "Slice the model",
    body: "Use Bambu Studio, OrcaSlicer, PrusaSlicer or Cura with the profile you print with. Export the plate as a sliced file.",
  },
  {
    title: "Upload the file",
    body: `Drop in a .gcode.3mf or .gcode up to 100 MB. Exo reads the toolpath in your browser and shows a preview in the colors the slicer saved. A product can have up to ${MAX_PARTS} files.`,
  },
  {
    title: "Set up the shots",
    body: `Pick filaments, a scene, up to ${MAX_ANGLES} of the ${ANGLES.length} camera angles, and the platforms you sell on. You can start from one of ${TEMPLATES.length} templates. Each extra color adds a full set of variants.`,
  },
  {
    title: "Render and download",
    body: `Exo renders every image at the platform's size and bundles them in a .zip. Videos run ${VIDEO_DURATIONS.join(", ")} seconds with one camera move, in ${Object.keys(VIDEO_ASPECTS).join(", ")}.`,
  },
];

export const HowItWorksPage = () => {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="How Exo works"
        lede="Four steps take you from a sliced file to images sized for your store. Rendering runs on your own GPU."
      />
      <Section title="Steps">
        <ol className="divide-y exo-border border-y exo-border">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid gap-1 py-5 sm:grid-cols-[3rem_1fr]">
              <span className="font-mono text-sm tabular-nums exo-fg-soft">{i + 1}</span>
              <div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-1 max-w-2xl exo-fg-soft">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Files that won't load" lede="Exo needs a toolpath. These formats don't have one.">
        <FactList
          items={[
            ["STL, OBJ, STEP", "Model files describe a shape. Slice them first."],
            ["Project .3mf", "Use Export plate sliced file to get a .gcode.3mf."],
            [".bgcode", "Turn off binary G-code in the printer settings and export .gcode."],
          ]}
        />
      </Section>
      <Section title="Video" lede="One camera move per clip. Preview the first and last frame before you render.">
        <FactList items={MOTIONS.map((m) => [m.name, m.description])} />
      </Section>
      <Section title="Output sizes">
        <FactList items={PLATFORMS.map((p) => [p.name, `${p.width} × ${p.height} px`])} />
      </Section>
      <Section
        title="Your files"
        lede="Exo stores uploads and the renders you keep in Cloudflare R2. Deleting a project deletes its files."
      >
        <Button variant="primary" onClick={() => navigate("/signup")}>
          Open the editor
        </Button>
      </Section>
    </>
  );
};
