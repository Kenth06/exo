import type { RenderView } from "@exo/shared";
import { and, desc, eq, lt } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { BucketStorage, DbQuery } from "../bindings";
import { MAX_RENDER_BYTES } from "../common/constants";
import { BadRequest, type DbError, NotFound, PayloadTooLarge, type StorageError } from "../common/errors";
import { type Render, renders } from "../entities";
import type { RenderMeta } from "../schemas/render.schema";
import { newId } from "../utils/ids";
import { ProjectService } from "./project.service";

export const toRenderView = (r: Render): RenderView => ({
  id: r.id,
  kind: r.kind,
  label: r.label,
  projectId: r.projectId,
  meta: r.meta as RenderView["meta"],
  url: `/api/renders/${r.id}/file`,
  createdAt: r.createdAt,
});

export interface SaveRenderInput {
  userId: string;
  meta: RenderMeta;
  contentType: string;
  size: number;
  body: ReadableStream | null;
}

export class RenderService extends Context.Service<
  RenderService,
  {
    readonly save: (
      input: SaveRenderInput,
    ) => Effect.Effect<RenderView, BadRequest | PayloadTooLarge | NotFound | DbError | StorageError>;
    readonly list: (
      userId: string,
      opts: { projectId?: string; before?: number; limit: number },
    ) => Effect.Effect<RenderView[], DbError>;
    readonly open: (userId: string, id: string) => Effect.Effect<R2ObjectBody, NotFound | DbError | StorageError>;
    readonly remove: (userId: string, id: string) => Effect.Effect<void, NotFound | DbError | StorageError>;
  }
>()("RenderService") {
  static readonly layer = Layer.effect(
    RenderService,
    Effect.gen(function* () {
      const query = yield* DbQuery;
      const storage = yield* BucketStorage;
      const projectsSvc = yield* ProjectService;

      const owned = (userId: string, id: string) =>
        Effect.gen(function* () {
          const [r] = yield* query((db) =>
            db
              .select()
              .from(renders)
              .where(and(eq(renders.id, id), eq(renders.userId, userId))),
          );
          if (!r) return yield* new NotFound({ resource: "Render" });
          return r;
        });

      return {
        save: (input) =>
          Effect.gen(function* () {
            if (!input.size || !input.body) return yield* new BadRequest({ message: "The render is empty." });
            if (input.size > MAX_RENDER_BYTES) return yield* new PayloadTooLarge({ limit: MAX_RENDER_BYTES });
            const expected = input.meta.kind === "video" ? "video/" : "image/";
            if (!input.contentType.startsWith(expected)) {
              return yield* new BadRequest({ message: `A ${input.meta.kind} render must be ${expected}*.` });
            }
            if (input.meta.projectId) yield* projectsSvc.owned(input.userId, input.meta.projectId);
            const id = newId("rnd");
            const r2Key = `u/${input.userId}/r/${id}`;
            const body = input.body;
            yield* storage((b) => b.put(r2Key, body, { httpMetadata: { contentType: input.contentType } }));
            const { projectId, ...meta } = input.meta;
            const [row] = yield* query((db) =>
              db
                .insert(renders)
                .values({
                  id,
                  userId: input.userId,
                  projectId: projectId ?? null,
                  kind: input.meta.kind,
                  r2Key,
                  contentType: input.contentType,
                  size: input.size,
                  label: input.meta.label,
                  meta,
                })
                .returning(),
            );
            return toRenderView(row!);
          }),

        list: (userId, opts) =>
          query((db) =>
            db
              .select()
              .from(renders)
              .where(
                and(
                  eq(renders.userId, userId),
                  opts.projectId ? eq(renders.projectId, opts.projectId) : undefined,
                  opts.before ? lt(renders.createdAt, opts.before) : undefined,
                ),
              )
              .orderBy(desc(renders.createdAt))
              .limit(opts.limit),
          ).pipe(Effect.map((rows) => rows.map(toRenderView))),

        open: (userId, id) =>
          Effect.gen(function* () {
            const r = yield* owned(userId, id);
            const obj = yield* storage((b) => b.get(r.r2Key));
            if (!obj) return yield* new NotFound({ resource: "Render" });
            return obj;
          }),

        remove: (userId, id) =>
          Effect.gen(function* () {
            const r = yield* owned(userId, id);
            yield* storage((b) => b.delete(r.r2Key));
            yield* query((db) => db.delete(renders).where(eq(renders.id, r.id)));
          }),
      };
    }),
  );
}
