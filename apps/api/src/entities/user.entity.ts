import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
