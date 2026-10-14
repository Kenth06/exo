import { Schema } from "effect";

export const ProjectName = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120));

export const CreateProject = Schema.Struct({ name: ProjectName });

/** Settings are an opaque editor document owned by the client; the service bounds its size. */
export const UpdateProject = Schema.Struct({
  name: Schema.optional(ProjectName),
  settings: Schema.optional(Schema.Unknown),
});
export type UpdateProject = typeof UpdateProject.Type;
