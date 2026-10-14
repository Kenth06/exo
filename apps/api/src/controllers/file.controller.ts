import { Effect } from "effect";
import { json, route } from "../common/http";
import { requireUser } from "../middlewares/auth.middleware";
import { FileService } from "../services";

export const fileController = [
  route("GET", "/api/files/:id", ({ id }) =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const obj = yield* FileService.use((s) => s.open(user.id, id!));
      return new Response(obj.body, {
        headers: {
          "content-type": "application/octet-stream",
          "content-length": String(obj.size),
          "cache-control": "private, max-age=3600",
          etag: obj.httpEtag,
        },
      });
    }),
  ),

  route("DELETE", "/api/files/:id", ({ id }) =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      yield* FileService.use((s) => s.remove(user.id, id!));
      return json({ ok: true });
    }),
  ),
];
