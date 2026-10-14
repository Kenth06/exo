import { SCENES } from "@exo/shared";
import type { Editor } from "@/hooks/useEditor";

export const ScenePanel = ({ editor }: { editor: Editor }) => (
  <div className="space-y-5">
    {(["studio", "set"] as const).map((kind) => (
      <section key={kind}>
        <h3 className="mb-2 text-sm font-medium">{kind === "studio" ? "Studios" : "Sets"}</h3>
        <div className="grid grid-cols-2 gap-2">
          {SCENES.filter((s) => s.kind === kind).map((s) => {
            const active = editor.settings.scene === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => editor.update({ scene: s.id })}
                className={`rounded-lg border exo-border p-2.5 text-left ${active ? "bg-[var(--exo-fg)] text-[var(--exo-bg)]" : "hover:bg-[var(--exo-line)]"}`}
              >
                <span className="block text-sm font-medium">{s.name}</span>
                <span className={`block text-xs ${active ? "opacity-70" : "exo-fg-soft"}`}>{s.description}</span>
              </button>
            );
          })}
        </div>
      </section>
    ))}
  </div>
);
