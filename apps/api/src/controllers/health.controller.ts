import { Effect } from "effect";
import { json, route } from "../common/http";

export const healthController = [route("GET", "/api/health", () => Effect.succeed(json({ ok: true })))];
