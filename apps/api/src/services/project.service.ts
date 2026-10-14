import { DEFAULT_SETTINGS, type ProjectDetail, type ProjectFile, type ProjectSummary } from "@exo/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { BucketStorage, DbQuery } from "../bindings";
import { BadRequest, type DbError, NotFound, type StorageError } from "../common/errors";
import { files, type Project, projects, renders, type StoredFile } from "../entities";
import type { UpdateProject } from "../schemas/project.schema";
import { newId } from "../utils/ids";

const MAX_SETTINGS_CHARS = 64_000;

export const toProjectFile = (f: StoredFile): ProjectFile => ({
  id: f.id,
  filename: f.filename,
  size: f.size,
  position: f.position,
  url: `/api/files/${f.id}`,
});

export class ProjectService extends Context.Service<
  ProjectService,
  {
    readonly list: (userId: string) => Effect.Effect<ProjectSummary[], DbError>;
    readonly create: (userId: string, name: string) => Effect.Effect<ProjectDetail, DbError>;
    readonly get: (userId: string, id: string) => Effect.Effect<ProjectDetail, NotFound | DbError>;
    readonly owned: (userId: string, id: string) => Effect.Effect<Project, NotFound | DbError>;
    readonly update: (
      userId: string,
      id: string,
      patch: UpdateProject,
    ) => Effect.Effect<void, NotFound | BadRequest | DbError>;
    readonly touch: (id: string) => Effect.Effect<void, DbError>;
    readonly remove: (userId: string, id: string) => Effect.Effect<void, NotFound | DbError | StorageError>;
  }
>()("ProjectService") {
  static readonly layer = Layer.effect(
    ProjectService,
    Effect.gen(function* () {
      const query = yield* DbQuery;
      const storage = yield* BucketStorage;

      const owned = (userId: string, id: string) =>
        Effect.gen(function* () {
          const [p] = yield* query((db) =>
            db
              .select()
              .from(projects)
              .where(and(eq(projects.id, id), eq(projects.userId, userId))),
          );
          if (!p) return yield* new NotFound({ resource: "Project" });
          return p;
        });

      const filesOf = (projectId: string) =>
        query((db) => db.select().from(files).where(eq(files.projectId, projectId)).orderBy(asc(files.position)));

      return {
        owned,

        list: (userId) =>
          Effect.gen(function* () {
            const rows = yield* query((db) =>
              db
                .select()
                .from(projects)
                .where(eq(projects.userId, userId))
                .orderBy(desc(projects.updatedAt))
                .limit(200),
            );
            const ids = rows.map((r) => r.id);
            const all = ids.length
              ? yield* query((db) =>
                  db.select().from(files).where(inArray(files.projectId, ids)).orderBy(asc(files.position)),
                )
              : [];
            return rows.map((p) => ({
              id: p.id,
              name: p.name,
              updatedAt: p.updatedAt,
              files: all.filter((f) => f.projectId === p.id).map(toProjectFile),
            }));
          }),

        create: (userId, name) =>
          Effect.gen(function* () {
            const [p] = yield* query((db) =>
              db
                .insert(projects)
                .values({ id: newId("prj"), userId, name, settings: DEFAULT_SETTINGS })
                .returning(),
            );
            return { id: p!.id, name: p!.name, updatedAt: p!.updatedAt, settings: p!.settings, files: [] };
          }),

        get: (userId, id) =>
          Effect.gen(function* () {
            const p = yield* owned(userId, id);
            const fs = yield* filesOf(p.id);
            return {
              id: p.id,
              name: p.name,
              updatedAt: p.updatedAt,
              settings: p.settings,
              files: fs.map(toProjectFile),
            };
          }),

        update: (userId, id, patch) =>
          Effect.gen(function* () {
            yield* owned(userId, id);
            if (patch.settings !== undefined && JSON.stringify(patch.settings).length > MAX_SETTINGS_CHARS) {
              return yield* new BadRequest({ message: "Project settings are too large." });
            }
            yield* query((db) =>
              db
                .update(projects)
                .set({
                  ...(patch.name !== undefined ? { name: patch.name } : {}),
                  ...(patch.settings !== undefined ? { settings: patch.settings } : {}),
                  updatedAt: Date.now(),
                })
                .where(eq(projects.id, id)),
            );
          }),

        touch: (id) =>
          query((db) => db.update(projects).set({ updatedAt: Date.now() }).where(eq(projects.id, id))).pipe(
            Effect.asVoid,
          ),

        remove: (userId, id) =>
          Effect.gen(function* () {
            const p = yield* owned(userId, id);
            const fs = yield* filesOf(p.id);
            if (fs.length) yield* storage((b) => b.delete(fs.map((f) => f.r2Key)));
            // Renders outlive the project in the gallery (project_id is set to null).
            yield* query((db) => db.update(renders).set({ projectId: null }).where(eq(renders.projectId, p.id)));
            yield* query((db) => db.delete(projects).where(eq(projects.id, p.id)));
          }),
      };
    }),
  );
}
