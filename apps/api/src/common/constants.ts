export const SESSION_COOKIE = "exo_session";
export const SESSION_DAYS = 30;
/** Workers caps PBKDF2 at 100k iterations. */
export const PBKDF2_ITERATIONS = 100_000;
export const MAX_RENDER_BYTES = 60 * 1024 * 1024;
export const RENDER_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"] as const;
