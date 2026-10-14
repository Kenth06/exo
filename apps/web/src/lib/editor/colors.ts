import { FILAMENTS } from "@exo/shared";

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/** Map a slicer color to the closest library filament, or keep it as a custom color. */
export const filamentForHex = (hex: string): string => {
  const [r, g, b] = rgb(hex);
  let best = FILAMENTS[0]!;
  let bestD = Infinity;
  for (const f of FILAMENTS) {
    const [fr, fg, fb] = rgb(f.hex);
    // Weighted RGB distance approximates perceived difference well enough for this.
    const d = 2 * (fr - r) ** 2 + 4 * (fg - g) ** 2 + 3 * (fb - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return bestD < 2400 ? best.id : `custom:${hex.toLowerCase()}:basic`;
};
