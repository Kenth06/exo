import { Effect } from "effect";
import type { AppEnv } from "./bindings";
import { exitToResponse, json, matchRoute } from "./common/http";
import { cleanupJob } from "./jobs/cleanup.job";
import { makeAppLayer, makeJobLayer } from "./layers";
import { requireCsrfHeader } from "./middlewares/csrf.middleware";
import { routes } from "./router";

export default {
  async fetch(req, env, ctx) {
    const match = matchRoute(routes, req);
    if ("status" in match) {
      return json(
        { error: match.status === 405 ? "Method not allowed." : "Not found.", code: "ERR_NOT_FOUND" },
        { status: match.status },
      );
    }
    const program = Effect.gen(function* () {
      if (!match.route.public) yield* requireCsrfHeader;
      return yield* match.route.handler(match.params);
    }).pipe(Effect.provide(makeAppLayer(env, ctx, req)));
    return exitToResponse(await Effect.runPromiseExit(program));
  },

  async scheduled(_controller, env, ctx) {
    const exit = await Effect.runPromiseExit(cleanupJob.pipe(Effect.provide(makeJobLayer(env, ctx))));
    if (exit._tag === "Failure") console.error({ event: "cleanup_failed", cause: String(exit.cause) });
  },
} satisfies ExportedHandler<AppEnv>;
