import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns";
import { users } from "./user.entity";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Client-owned editor state (colors, scene, angles, platforms). */
    settings: text("settings", { mode: "json" }).notNull(),
    ...timestamps,
  },
  (t) => [index("projects_user_idx").on(t.userId, t.updatedAt)],
);

export type Project = typeof projects.$inferSelect;
