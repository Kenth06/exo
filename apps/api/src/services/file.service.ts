import { MAX_PARTS, MAX_UPLOAD_BYTES, type ProjectFile } from "@exo/shared";
import { and, asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { BucketStorage, DbQuery } from "../bindings";
import { BadRequest, Conflict, type DbError, NotFound, PayloadTooLarge, type StorageError } from "../common/errors";
import { files } from "../entities";
import { newId } from "../utils/ids";
import { ProjectService, toProjectFile } from "./project.service";

/** Only sliced G-code is accepted; everything else gets a message that says what to export instead. */
export const filenameProblem = (name: string): string | null => {
  const n = name.toLowerCase();
  if (n.endsWith(".gcode.3mf") || n.endsWith(".gcode")) return null;
  if (n.endsWith(".bgcode")) return "Binary G-code (.bgcode) isn't supported. Export plain .gcode instead.";
  if (/\.(stl|obj|step|stp)$/.test(n))
    return "That's a model file. Slice it first and upload the .gcode.3mf or .gcode.";
  if (n.endsWith(".3mf")) return "This 3MF isn't sliced. In Bambu Studio use Export plate sliced file (.gcode.3mf).";
  return "Upload a sliced .gcode.3mf or .gcode file.";
};

export interface UploadInput {
  userId: string;
  projectId: string;
  filename: string;
  size: number;
  body: ReadableStream | null;
}

export class FileService extends Context.Service<
  FileService,
  {
    readonly upload: (
      input: UploadInput,
    ) => Effect.Effect<ProjectFile, BadRequest | Conflict | PayloadTooLarge | NotFound | DbError | StorageError>;
    readonly open: (userId: string, id: string) => Effect.Effect<R2ObjectBody, NotFound | DbError | StorageError>;
    readonly remove: (userId: string, id: string) => Effect.Effect<void, NotFound | DbError | StorageError>;
  }
>()("FileService") {
  static readonly layer = Layer.effect(
    FileService,
    Effect.gen(function* () {
      const query = yield* DbQuery;
      const storage = yield* BucketStorage;
      const projectsSvc = yield* ProjectService;

      const ownedFile = (userId: string, id: string) =>
        Effect.gen(function* () {
          const [f] = yield* query((db) =>
            db
              .select()
              .from(files)
              .where(and(eq(files.id, id), eq(files.userId, userId))),
          );
          if (!f) return yield* new NotFound({ resource: "File" });
          return f;
        });

      return {
        upload: (input) =>
          Effect.gen(function* () {
            const problem = filenameProblem(input.filename);
            if (problem) return yield* new BadRequest({ message: problem });
            if (!input.size || !input.body) return yield* new BadRequest({ message: "The file is empty." });
            if (input.size > MAX_UPLOAD_BYTES) return yield* new PayloadTooLarge({ limit: MAX_UPLOAD_BYTES });
            const project = yield* projectsSvc.owned(input.userId, input.projectId);
            const existing = yield* query((db) =>
              db.select().from(files).where(eq(files.projectId, project.id)).orderBy(asc(files.position)),
            );
            if (existing.length >= MAX_PARTS) {
              return yield* new Conflict({ message: `A product can have up to ${MAX_PARTS} parts.` });
            }
            const id = newId("fil");
            const r2Key = `u/${input.userId}/p/${project.id}/${id}`;
            const body = input.body;
            yield* storage((b) =>
              b.put(r2Key, body, {
                httpMetadata: { contentType: "application/octet-stream" },
                customMetadata: { filename: input.filename },
              }),
            );
            const position = existing.reduce((m, f) => Math.max(m, f.position + 1), 0);
            const [row] = yield* query((db) =>
              db
                .insert(files)
                .values({
                  id,
                  projectId: project.id,
                  userId: input.userId,
                  r2Key,
                  filename: input.filename,
                  size: input.size,
                  position,
                })
                .returning(),
            );
            yield* projectsSvc.touch(project.id);
            return toProjectFile(row!);
          }),

        open: (userId, id) =>
          Effect.gen(function* () {
            const f = yield* ownedFile(userId, id);
            const obj = yield* storage((b) => b.get(f.r2Key));
            if (!obj) return yield* new NotFound({ resource: "File" });
            return obj;
          }),

        remove: (userId, id) =>
          Effect.gen(function* () {
            const f = yield* ownedFile(userId, id);
            yield* storage((b) => b.delete(f.r2Key));
            yield* query((db) => db.delete(files).where(eq(files.id, f.id)));
            yield* projectsSvc.touch(f.projectId);
          }),
      };
    }),
  );
}
