// Catalog shared by the Worker (pricing, validation) and the client (UI, renderer).

export type Material = "PLA" | "PETG" | "ABS" | "ASA" | "TPU" | "PCTG" | "PC" | "PA";
export type Finish = "matte" | "basic" | "silk" | "glossy" | "translucent" | "carbon";

export interface Filament {
  id: string;
  name: string;
  line: string;
  material: Material;
  finish: Finish;
  hex: string;
}

const LINES: Array<{ line: string; material: Material; finish: Finish; colors: Array<[string, string]> }> = [
  {
    line: "PLA Matte",
    material: "PLA",
    finish: "matte",
    colors: [
      ["Ivory White", "#f1ede4"],
      ["Bone", "#e2d9c6"],
      ["Ash Grey", "#a9a9a6"],
      ["Charcoal", "#3b3b3d"],
      ["Jet Black", "#1d1d1f"],
      ["Latte Brown", "#a7825f"],
      ["Dark Chocolate", "#5a3c2c"],
      ["Terracotta", "#b8613f"],
      ["Desert Tan", "#cdb08a"],
      ["Sakura Pink", "#e8b4bc"],
      ["Dusty Rose", "#c48b8b"],
      ["Scarlet", "#b3282d"],
      ["Mandarin", "#e5752b"],
      ["Lemon", "#e9cf4a"],
      ["Mustard", "#c99a2e"],
      ["Grass Green", "#6f9a4a"],
      ["Olive", "#6c6b3d"],
      ["Dark Green", "#2f4b3a"],
      ["Ice Blue", "#a9c8dc"],
      ["Sky Blue", "#5d9bd0"],
      ["Marine Blue", "#264f86"],
      ["Navy", "#1f2b47"],
      ["Lilac", "#b4a3cf"],
      ["Plum", "#5d3a5c"],
    ],
  },
  {
    line: "PLA Basic",
    material: "PLA",
    finish: "basic",
    colors: [
      ["White", "#f4f4f2"],
      ["Light Grey", "#c8c8c8"],
      ["Grey", "#8a8d91"],
      ["Black", "#151515"],
      ["Red", "#c8202c"],
      ["Magenta", "#c3307f"],
      ["Pink", "#f19bbd"],
      ["Orange", "#f2711c"],
      ["Yellow", "#f7d117"],
      ["Gold", "#d4a73a"],
      ["Signal Green", "#00ae42"],
      ["Mint", "#8fd6b4"],
      ["Cyan", "#14a0c8"],
      ["Blue", "#1e5bc6"],
      ["Cobalt", "#0e3b8c"],
      ["Purple", "#5e3a9c"],
      ["Brown", "#7a4a2a"],
      ["Beige", "#e3cfa8"],
      ["Silver", "#a6a9ad"],
      ["Bronze", "#8c6239"],
      ["Turquoise", "#25b4a8"],
      ["Indigo", "#2d2f7a"],
      ["Maroon", "#6d1f2a"],
      ["Cocoa", "#7b5a47"],
    ],
  },
  {
    line: "PLA Silk",
    material: "PLA",
    finish: "silk",
    colors: [
      ["Silk Gold", "#d3a744"],
      ["Silk Silver", "#c3c6ca"],
      ["Silk Copper", "#b4673e"],
      ["Silk Champagne", "#e3cda4"],
      ["Silk Rose Gold", "#d79a88"],
      ["Silk Jade", "#3f9c7f"],
      ["Silk Sapphire", "#2c58a8"],
      ["Silk Ruby", "#a3233b"],
      ["Silk Pearl White", "#efece6"],
      ["Silk Titanium", "#6f7377"],
      ["Silk Violet", "#7a4fb0"],
      ["Silk Mint", "#9fdcc3"],
    ],
  },
  {
    line: "PETG HF",
    material: "PETG",
    finish: "glossy",
    colors: [
      ["White", "#f5f5f3"],
      ["Black", "#121212"],
      ["Grey", "#7d8186"],
      ["Red", "#c0202a"],
      ["Orange", "#ef6a1e"],
      ["Yellow", "#f2c81c"],
      ["Green", "#2e9a4c"],
      ["Forest", "#1f5a3a"],
      ["Blue", "#1b54b8"],
      ["Navy", "#1b2a4f"],
      ["Cream", "#ece2c8"],
      ["Peach", "#f1b08f"],
    ],
  },
  {
    line: "PETG Translucent",
    material: "PETG",
    finish: "translucent",
    colors: [
      ["Clear", "#e9f0f2"],
      ["Smoke", "#5d6166"],
      ["Ocean", "#2e7fb8"],
      ["Lime", "#9bd14a"],
      ["Amber", "#e09a2a"],
      ["Ruby", "#c42a3a"],
      ["Teal", "#1f9e98"],
      ["Violet", "#7a4ab8"],
    ],
  },
  {
    line: "ABS",
    material: "ABS",
    finish: "basic",
    colors: [
      ["White", "#f0efea"],
      ["Black", "#1a1a1a"],
      ["Silver", "#9fa3a8"],
      ["Red", "#b72530"],
      ["Orange", "#e26a22"],
      ["Blue", "#2759b0"],
      ["Olive", "#5f6a3b"],
      ["Tan", "#c8ab82"],
    ],
  },
  {
    line: "ASA",
    material: "ASA",
    finish: "matte",
    colors: [
      ["White", "#eceae4"],
      ["Black", "#1c1c1c"],
      ["Grey", "#7f8287"],
      ["Red", "#a72430"],
      ["Green", "#3c7a46"],
      ["Blue", "#2b4f8f"],
    ],
  },
  {
    line: "TPU 95A",
    material: "TPU",
    finish: "basic",
    colors: [
      ["White", "#efefec"],
      ["Black", "#181818"],
      ["Grey", "#8b8e92"],
      ["Red", "#c22d35"],
      ["Neon Green", "#7fd63a"],
      ["Blue", "#2465c2"],
      ["Orange", "#f07a2a"],
      ["Pink", "#e88aad"],
    ],
  },
  {
    line: "PCTG",
    material: "PCTG",
    finish: "glossy",
    colors: [
      ["Clear White", "#f3f4f4"],
      ["Black", "#151515"],
      ["Slate", "#4f5a66"],
      ["Sand", "#d6c39e"],
    ],
  },
  {
    line: "PC",
    material: "PC",
    finish: "glossy",
    colors: [
      ["Natural", "#e6e8e8"],
      ["Black", "#141414"],
      ["Grey", "#80858b"],
    ],
  },
  {
    line: "PA6-CF",
    material: "PA",
    finish: "carbon",
    colors: [
      ["Carbon Black", "#232425"],
      ["Carbon Grey", "#4a4c4f"],
      ["Carbon Olive", "#454a39"],
    ],
  },
  {
    line: "PLA-CF",
    material: "PLA",
    finish: "carbon",
    colors: [
      ["Black", "#262728"],
      ["Burgundy", "#5a2730"],
      ["Royal Blue", "#2a3b6b"],
      ["Jeans Blue", "#4d6585"],
      ["Lava Grey", "#5c5e61"],
    ],
  },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const FILAMENTS: Filament[] = LINES.flatMap((l) =>
  l.colors.map(([name, hex]) => ({
    id: `${slug(l.line)}-${slug(name)}`,
    name,
    line: l.line,
    material: l.material,
    finish: l.finish,
    hex,
  })),
);

export const FILAMENT_BY_ID = new Map(FILAMENTS.map((f) => [f.id, f]));
export const MATERIALS = [...new Set(FILAMENTS.map((f) => f.material))];
export const LINE_NAMES = [...new Set(FILAMENTS.map((f) => f.line))];

/** A filament id or a custom color ("custom:#rrggbb:finish"). */
export const resolveFilament = (id: string): Filament => {
  const known = FILAMENT_BY_ID.get(id);
  if (known) return known;
  const m = /^custom:(#[0-9a-f]{6}):(matte|basic|silk|glossy|translucent|carbon)$/i.exec(id);
  if (m) return { id, name: m[1]!.toUpperCase(), line: "Custom", material: "PLA", finish: m[2] as Finish, hex: m[1]! };
  return FILAMENTS[0]!;
};

export type SceneKind = "studio" | "set";
export interface SceneMeta {
  id: string;
  name: string;
  kind: SceneKind;
  description: string;
}

export const SCENES: SceneMeta[] = [
  {
    id: "white-sweep",
    name: "White sweep",
    kind: "studio",
    description: "Seamless white cyclorama. Marketplace-safe.",
  },
  { id: "grey-sweep", name: "Grey sweep", kind: "studio", description: "Neutral mid-grey paper, soft key." },
  { id: "black-sweep", name: "Black sweep", kind: "studio", description: "Low-key black paper with a rim light." },
  { id: "olive-paper", name: "Olive paper", kind: "studio", description: "Muted olive seamless paper." },
  { id: "powder-blue", name: "Powder blue paper", kind: "studio", description: "Pale blue seamless paper." },
  { id: "blush-paper", name: "Blush paper", kind: "studio", description: "Warm pink seamless paper." },
  { id: "stone-plinth", name: "Stone plinth", kind: "studio", description: "Round stone plinth on warm grey." },
  { id: "oak-table", name: "Oak table", kind: "set", description: "Light oak tabletop, daylight from the left." },
  { id: "walnut-desk", name: "Walnut desk", kind: "set", description: "Dark walnut, warm lamp light." },
  { id: "marble-table", name: "Marble table", kind: "set", description: "White Carrara-style marble." },
  { id: "black-marble", name: "Black marble", kind: "set", description: "Nero marble with gold veins." },
  { id: "concrete-desk", name: "Concrete desk", kind: "set", description: "Poured concrete, overcast light." },
  { id: "linen-cloth", name: "Linen cloth", kind: "set", description: "Natural linen weave, soft window light." },
  { id: "terrazzo", name: "Terrazzo counter", kind: "set", description: "Speckled terrazzo, bright kitchen." },
  { id: "slate", name: "Slate slab", kind: "set", description: "Dark slate, moody side light." },
  { id: "maker-bench", name: "Maker's bench", kind: "set", description: "Plywood workbench, workshop light." },
  { id: "kitchen-counter", name: "Kitchen counter", kind: "set", description: "White quartz with a tiled wall." },
  { id: "nightstand", name: "Nightstand", kind: "set", description: "Painted wood, warm evening light." },
];
export const SCENE_IDS = SCENES.map((s) => s.id);

export interface CameraAngle {
  id: string;
  name: string;
  azimuth: number;
  elevation: number;
  detail?: boolean;
}

export const ANGLES: CameraAngle[] = [
  { id: "hero", name: "Three-quarter", azimuth: 32, elevation: 18 },
  { id: "front", name: "Front", azimuth: 0, elevation: 8 },
  { id: "left", name: "Three-quarter left", azimuth: -38, elevation: 20 },
  { id: "side", name: "Side", azimuth: 90, elevation: 10 },
  { id: "high", name: "High", azimuth: 25, elevation: 48 },
  { id: "low", name: "Low hero", azimuth: 20, elevation: 2 },
  { id: "top", name: "Top down", azimuth: 0, elevation: 88 },
  { id: "back", name: "Back", azimuth: 180, elevation: 15 },
  { id: "detail", name: "Layer detail", azimuth: 28, elevation: 10, detail: true },
];
export const ANGLE_IDS = ANGLES.map((a) => a.id);
export const MAX_ANGLES = 6;

export type PlatformGroup = "Marketplaces" | "Model repositories" | "Social";
export interface Platform {
  id: string;
  name: string;
  group: PlatformGroup;
  width: number;
  height: number;
  /** Marketplaces that require a pure white background for the main image. */
  whiteBackground?: boolean;
}

export const PLATFORMS: Platform[] = [
  { id: "etsy", name: "Etsy", group: "Marketplaces", width: 3000, height: 2400 },
  { id: "shopify", name: "Shopify", group: "Marketplaces", width: 2048, height: 2048 },
  { id: "amazon", name: "Amazon", group: "Marketplaces", width: 2000, height: 2000, whiteBackground: true },
  { id: "ebay", name: "eBay", group: "Marketplaces", width: 1600, height: 1600 },
  { id: "google-shopping", name: "Google Shopping", group: "Marketplaces", width: 1500, height: 1500 },
  { id: "woocommerce", name: "WooCommerce", group: "Marketplaces", width: 1200, height: 1200 },
  { id: "makerworld", name: "MakerWorld", group: "Model repositories", width: 1600, height: 1200 },
  { id: "printables", name: "Printables", group: "Model repositories", width: 1600, height: 1200 },
  { id: "thingiverse", name: "Thingiverse", group: "Model repositories", width: 1200, height: 900 },
  { id: "cults3d", name: "Cults3D", group: "Model repositories", width: 1500, height: 1500 },
  { id: "instagram", name: "Instagram", group: "Social", width: 1080, height: 1350 },
  { id: "facebook", name: "Facebook", group: "Social", width: 1200, height: 1200 },
  { id: "pinterest", name: "Pinterest", group: "Social", width: 1000, height: 1500 },
  { id: "tiktok", name: "TikTok", group: "Social", width: 1080, height: 1920 },
  { id: "x", name: "X", group: "Social", width: 1600, height: 900 },
];
export const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

export const MOTIONS = [
  { id: "orbit", name: "Turntable", description: "A full 360° turn around the print." },
  { id: "sway", name: "Sway", description: "A gentle side-to-side arc." },
  { id: "push", name: "Push in", description: "A slow dolly toward the layer lines." },
  { id: "reveal", name: "Build reveal", description: "The print grows layer by layer." },
  { id: "rise", name: "Rise", description: "The camera lifts from table height to above." },
] as const;
export type MotionId = (typeof MOTIONS)[number]["id"];
export const VIDEO_DURATIONS = [6, 8, 10] as const;
export const VIDEO_ASPECTS = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
} as const;
export type VideoAspect = keyof typeof VIDEO_ASPECTS;

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_PARTS = 4;

export interface ProjectSettings {
  /** Filament per part per tool: partColors[part][tool] = filament id. */
  partColors: string[][];
  /** Extra color variants: each variant swaps the first part's first tool color. */
  variants: string[];
  scene: string;
  angles: string[];
  platforms: string[];
  showSupports: boolean;
  plate: number[];
  video: { motion: MotionId; duration: (typeof VIDEO_DURATIONS)[number]; aspect: VideoAspect };
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  partColors: [],
  variants: [],
  scene: "white-sweep",
  angles: ["hero"],
  platforms: ["etsy"],
  showSupports: false,
  plate: [],
  video: { motion: "orbit", duration: 8, aspect: "4:5" },
};

export interface Template {
  id: string;
  name: string;
  description: string;
  scene: string;
  angles: string[];
  platforms: string[];
}

export const TEMPLATES: Template[] = [
  {
    id: "etsy-listing",
    name: "Etsy listing",
    description: "Hero, front, side and detail on white.",
    scene: "white-sweep",
    angles: ["hero", "front", "side", "detail"],
    platforms: ["etsy"],
  },
  {
    id: "etsy-lifestyle",
    name: "Etsy lifestyle",
    description: "Hero and detail on an oak table.",
    scene: "oak-table",
    angles: ["hero", "detail"],
    platforms: ["etsy"],
  },
  {
    id: "amazon-main",
    name: "Amazon main image",
    description: "Pure white background, front and hero.",
    scene: "white-sweep",
    angles: ["front", "hero"],
    platforms: ["amazon"],
  },
  {
    id: "shopify-store",
    name: "Shopify store",
    description: "Square crops for a product page.",
    scene: "grey-sweep",
    angles: ["hero", "front", "high", "detail"],
    platforms: ["shopify"],
  },
  {
    id: "all-marketplaces",
    name: "Every marketplace",
    description: "One hero for all six marketplaces.",
    scene: "white-sweep",
    angles: ["hero"],
    platforms: ["etsy", "shopify", "amazon", "ebay", "google-shopping", "woocommerce"],
  },
  {
    id: "makerworld-cover",
    name: "MakerWorld cover",
    description: "Bench shot plus a layer close-up.",
    scene: "maker-bench",
    angles: ["hero", "detail"],
    platforms: ["makerworld"],
  },
  {
    id: "printables-cover",
    name: "Printables cover",
    description: "Clean studio cover and detail.",
    scene: "stone-plinth",
    angles: ["hero", "detail"],
    platforms: ["printables", "thingiverse"],
  },
  {
    id: "repos-all",
    name: "Every model site",
    description: "Cover for all four model repositories.",
    scene: "concrete-desk",
    angles: ["hero"],
    platforms: ["makerworld", "printables", "thingiverse", "cults3d"],
  },
  {
    id: "instagram-post",
    name: "Instagram post",
    description: "4:5 lifestyle pair.",
    scene: "linen-cloth",
    angles: ["hero", "low"],
    platforms: ["instagram"],
  },
  {
    id: "pinterest-pin",
    name: "Pinterest pin",
    description: "Tall marble shot.",
    scene: "marble-table",
    angles: ["hero"],
    platforms: ["pinterest"],
  },
  {
    id: "social-pack",
    name: "Social pack",
    description: "One shot sized for all five networks.",
    scene: "terrazzo",
    angles: ["hero"],
    platforms: ["instagram", "facebook", "pinterest", "tiktok", "x"],
  },
  {
    id: "moody-dark",
    name: "Moody dark",
    description: "Black sweep with rim light.",
    scene: "black-sweep",
    angles: ["hero", "low"],
    platforms: ["instagram", "shopify"],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    description: "For kitchenware and planters.",
    scene: "kitchen-counter",
    angles: ["hero", "high"],
    platforms: ["etsy", "instagram"],
  },
  {
    id: "desk-setup",
    name: "Desk setup",
    description: "Desk organizers and gadgets.",
    scene: "walnut-desk",
    angles: ["hero", "high", "detail"],
    platforms: ["etsy", "shopify"],
  },
  {
    id: "bedroom",
    name: "Bedroom",
    description: "Lamps and decor on a nightstand.",
    scene: "nightstand",
    angles: ["hero", "front"],
    platforms: ["etsy", "instagram"],
  },
  {
    id: "catalog-variants",
    name: "Catalog variants",
    description: "Same front angle for every color.",
    scene: "white-sweep",
    angles: ["front"],
    platforms: ["shopify", "woocommerce"],
  },
  {
    id: "pastel",
    name: "Pastel",
    description: "Soft pink and blue papers.",
    scene: "blush-paper",
    angles: ["hero", "front"],
    platforms: ["instagram", "pinterest"],
  },
  {
    id: "full-set",
    name: "Full set",
    description: "Six angles on white for any store.",
    scene: "white-sweep",
    angles: ["hero", "front", "left", "side", "high", "detail"],
    platforms: ["etsy"],
  },
];
