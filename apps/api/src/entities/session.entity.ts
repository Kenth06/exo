import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./user.entity";

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 of the cookie token; the raw token is never stored. */
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);
