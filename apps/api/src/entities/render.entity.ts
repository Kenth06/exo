import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns";
import { projects } from "./project.entity";
import { users } from "./user.entity";

export const renders = sqliteTable(
  "renders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["image", "video"] }).notNull(),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    label: text("label").notNull(),
    meta: text("meta", { mode: "json" }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("renders_user_idx").on(t.userId, t.createdAt),
    index("renders_project_idx").on(t.projectId, t.createdAt),
  ],
);

export type Render = typeof renders.$inferSelect;
