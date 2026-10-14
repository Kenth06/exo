import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns";
import { projects } from "./project.entity";

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    r2Key: text("r2_key").notNull(),
    filename: text("filename").notNull(),
    size: integer("size").notNull(),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (t) => [index("files_project_idx").on(t.projectId, t.position)],
);

export type StoredFile = typeof files.$inferSelect;
