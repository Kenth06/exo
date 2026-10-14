import { SAMPLE_LAMP } from "@exo/gcode";
import { SCENES } from "@exo/shared";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/marketing/Section";
import { SampleViewer } from "@/components/viewer/SampleViewer";

const LAMP = [SAMPLE_LAMP];

export const ScenesPage = () => {
  const [params, setParams] = useSearchParams();
  const selected = params.get("s") ?? "oak-table";
  const scene = SCENES.find((s) => s.id === selected) ?? SCENES[0]!;
  return (
    <>
      <PageHeader
        title="Scenes"
        lede="Seamless studio papers for clean listings. Lit tabletop sets when the product needs a setting."
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SampleViewer
            specs={LAMP}
            colors={["pla-matte-latte-brown"]}
            scene={scene.id}
            interactive
            label={`Lamp in the ${scene.name} scene`}
            className="exo-outline aspect-[4/3] w-full rounded-xl"
          />
          <h2 className="mt-4 text-xl font-semibold">{scene.name}</h2>
          <p className="exo-fg-soft">{scene.description}</p>
        </div>
        <div className="space-y-6">
          {(["studio", "set"] as const).map((kind) => (
            <section key={kind}>
              <h3 className="mb-2 text-sm font-medium">{kind === "studio" ? "Studios" : "Sets"}</h3>
              <div className="grid grid-cols-2 gap-2">
                {SCENES.filter((s) => s.kind === kind).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === scene.id}
                    onClick={() => setParams({ s: s.id }, { replace: true })}
                    className={`rounded-lg border exo-border p-3 text-left text-sm ${s.id === scene.id ? "bg-[var(--exo-fg)] text-[var(--exo-bg)]" : "hover:bg-[var(--exo-line)]"}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
};
