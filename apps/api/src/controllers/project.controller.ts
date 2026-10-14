import { Effect } from "effect";
import { HttpRequest } from "../bindings";
import { decodeBody, json, route, searchParam } from "../common/http";
import { requireUser } from "../middlewares/auth.middleware";
import { CreateProject, UpdateProject } from "../schemas/project.schema";
import { FileService, ProjectService } from "../services";

export const projectController = [
  route("GET", "/api/projects", () =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const projects = yield* ProjectService.use((s) => s.list(user.id));
      return json({ projects });
    }),
  ),

  route("POST", "/api/projects", () =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const input = yield* decodeBody(CreateProject);
      const project = yield* ProjectService.use((s) => s.create(user.id, input.name));
      return json({ project }, { status: 201 });
    }),
  ),

  route("GET", "/api/projects/:id", ({ id }) =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const project = yield* ProjectService.use((s) => s.get(user.id, id!));
      return json({ project });
    }),
  ),

  route("PATCH", "/api/projects/:id", ({ id }) =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const patch = yield* decodeBody(UpdateProject);
      yield* ProjectService.use((s) => s.update(user.id, id!, patch));
      return json({ ok: true });
    }),
  ),

  route("DELETE", "/api/projects/:id", ({ id }) =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      yield* ProjectService.use((s) => s.remove(user.id, id!));
      return json({ ok: true });
    }),
  ),

  // Raw upload: PUT /api/projects/:id/files?name=lamp.gcode.3mf with the file as the body.
  route("PUT", "/api/projects/:id/files", ({ id }) =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const req = yield* HttpRequest;
      const filename = ((yield* searchParam("name")) ?? "").slice(0, 200);
      const file = yield* FileService.use((s) =>
        s.upload({
          userId: user.id,
          projectId: id!,
          filename,
          size: Number(req.headers.get("content-length") ?? "0"),
          body: req.body,
        }),
      );
      return json({ file }, { status: 201 });
    }),
  ),
];
