import { Effect } from "effect";
import { HttpRequest } from "../bindings";
import { BadRequest } from "../common/errors";
import { decodeValue, json, route, searchParam } from "../common/http";
import { requireUser } from "../middlewares/auth.middleware";
import { RenderContentType, RenderMeta } from "../schemas/render.schema";
import { RenderService } from "../services";

const parseJson = (raw: string | null) =>
  Effect.try({
    try: () => JSON.parse(raw ?? "") as unknown,
    catch: () => new BadRequest({ message: "The meta parameter must be JSON." }),
  });

export const renderController = [
  // Raw body (image/video) with the description in `?meta=<json>`.
  route("POST", "/api/renders", () =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const req = yield* HttpRequest;
      const meta = yield* decodeValue(RenderMeta, yield* parseJson(yield* searchParam("meta")));
      const contentType = yield* decodeValue(RenderContentType, req.headers.get("content-type")?.split(";")[0]);
      const render = yield* RenderService.use((s) =>
        s.save({
          userId: user.id,
          meta,
          contentType,
          size: Number(req.headers.get("content-length") ?? "0"),
          body: req.body,
        }),
      );
      return json({ render }, { status: 201 });
    }),
  ),

  route("GET", "/api/renders", () =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const projectId = (yield* searchParam("projectId")) ?? undefined;
      const before = Number((yield* searchParam("before")) ?? "") || undefined;
      const limit = Math.min(200, Math.max(1, Number((yield* searchParam("limit")) ?? "60") || 60));
      const renders = yield* RenderService.use((s) => s.list(user.id, { projectId, before, limit }));
      return json({ renders });
    }),
  ),

  route("GET", "/api/renders/:id/file", ({ id }) =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const obj = yield* RenderService.use((s) => s.open(user.id, id!));
      const download = (yield* searchParam("download")) === "1";
      const headers = new Headers({
        "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
        "content-length": String(obj.size),
        "cache-control": "private, max-age=86400, immutable",
        etag: obj.httpEtag,
      });
      if (download) headers.set("content-disposition", `attachment; filename="${id}"`);
      return new Response(obj.body, { headers });
    }),
  ),

  route("DELETE", "/api/renders/:id", ({ id }) =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      yield* RenderService.use((s) => s.remove(user.id, id!));
      return json({ ok: true });
    }),
  ),
];
