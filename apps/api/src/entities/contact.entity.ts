import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns";

export const contactMessages = sqliteTable("contact_messages", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  userId: text("user_id"),
  ...timestamps,
});
