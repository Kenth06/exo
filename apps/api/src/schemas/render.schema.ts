import { Schema } from "effect";
import { RENDER_CONTENT_TYPES } from "../common/constants";

const Dimension = Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 64, maximum: 8192 }));
const Short = Schema.String.check(Schema.isMaxLength(80));

/** Sent as the `meta` query parameter (JSON) next to the raw image/video body. */
export const RenderMeta = Schema.Struct({
  kind: Schema.Literals(["image", "video"]),
  label: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(160)),
  projectId: Schema.optional(Schema.String),
  platform: Schema.optional(Short),
  filament: Schema.optional(Short),
  scene: Schema.optional(Short),
  angle: Schema.optional(Short),
  motion: Schema.optional(Short),
  width: Dimension,
  height: Dimension,
});
export type RenderMeta = typeof RenderMeta.Type;

export const RenderContentType = Schema.Literals(RENDER_CONTENT_TYPES);
