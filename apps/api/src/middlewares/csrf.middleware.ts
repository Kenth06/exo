import { CSRF_HEADER } from "@exo/shared";
import { Effect } from "effect";
import { HttpRequest } from "../bindings";
import { Forbidden } from "../common/errors";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Mutating requests must carry `x-exo: 1`. A cross-origin page cannot add a custom header without a
 * CORS preflight, and this API never answers preflights, so cookies alone can't forge a request.
 */
export const requireCsrfHeader = Effect.gen(function* () {
  const req = yield* HttpRequest;
  if (MUTATING.has(req.method) && req.headers.get(CSRF_HEADER) !== "1") {
    return yield* new Forbidden({ message: "Missing request header." });
  }
});
