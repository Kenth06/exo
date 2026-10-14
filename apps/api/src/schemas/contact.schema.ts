import { Schema } from "effect";
import { Email } from "./auth.schema";

export const ContactMessage = Schema.Struct({
  email: Email,
  topic: Schema.Literals(["question", "bug", "file", "feedback"]),
  message: Schema.String.check(Schema.isMinLength(10), Schema.isMaxLength(5000)),
});
export type ContactMessage = typeof ContactMessage.Type;
