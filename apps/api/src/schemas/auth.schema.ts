import { Schema } from "effect";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Email = Schema.String.check(Schema.isPattern(EMAIL_RE), Schema.isMaxLength(254));
export const Password = Schema.String.check(Schema.isMinLength(8), Schema.isMaxLength(200));

export const Credentials = Schema.Struct({ email: Email, password: Password });
export type Credentials = typeof Credentials.Type;

export const ChangePassword = Schema.Struct({ current: Schema.String, next: Password });
