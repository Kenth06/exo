import { ANGLES, PLATFORM_BY_ID, type ProjectSettings, resolveFilament } from "@exo/shared";

export interface ImageJob {
  key: string;
  colors: string[][];
  filament: string;
  angle: string;
  platform: string;
  scene: string;
  width: number;
  height: number;
  label: string;
  filename: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Color variants: the project's own colors first, then each extra filament on the first part's main tool. */
export const variantColorSets = (s: ProjectSettings): Array<{ filament: string; colors: string[][] }> => {
  const base = s.partColors;
  const first = base[0]?.[0] ?? "";
  const sets = [{ filament: first, colors: base }];
  for (const v of s.variants) {
    if (v === first) continue;
    const colors = base.map((tools, i) => (i === 0 ? [v, ...tools.slice(1)] : tools));
    sets.push({ filament: v, colors });
  }
  return sets;
};

export const imageJobs = (projectName: string, s: ProjectSettings): ImageJob[] => {
  const jobs: ImageJob[] = [];
  for (const variant of variantColorSets(s)) {
    const f = resolveFilament(variant.filament);
    for (const angleId of s.angles) {
      const angle = ANGLES.find((a) => a.id === angleId);
      if (!angle) continue;
      for (const platformId of s.platforms) {
        const p = PLATFORM_BY_ID.get(platformId);
        if (!p) continue;
        // Marketplaces that require a pure white main image always get the white sweep.
        const scene = p.whiteBackground ? "white-sweep" : s.scene;
        jobs.push({
          key: `${variant.filament}|${angleId}|${platformId}`,
          colors: variant.colors,
          filament: variant.filament,
          angle: angleId,
          platform: platformId,
          scene,
          width: p.width,
          height: p.height,
          label: `${projectName} · ${f.name} · ${angle.name} · ${p.name}`,
          filename: `${slug(projectName)}_${slug(f.name)}_${angleId}_${platformId}.jpg`,
        });
      }
    }
  }
  return jobs;
};
