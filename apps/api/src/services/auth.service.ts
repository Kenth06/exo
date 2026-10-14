import type { PublicUser } from "@exo/shared";
import { and, eq, gt, lt } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DbQuery } from "../bindings";
import { SESSION_DAYS } from "../common/constants";
import { BadRequest, Conflict, type DbError, Unauthorized } from "../common/errors";
import { sessions, type User, users } from "../entities";
import type { Credentials } from "../schemas/auth.schema";
import { hashPassword, randomToken, sha256, verifyPassword } from "../utils/crypto";
import { newId } from "../utils/ids";

export interface SessionGrant {
  user: User;
  token: string;
  maxAgeSeconds: number;
}

export const toPublicUser = (u: User): PublicUser => ({ id: u.id, email: u.email, createdAt: u.createdAt });

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class AuthService extends Context.Service<
  AuthService,
  {
    readonly signup: (input: Credentials) => Effect.Effect<SessionGrant, Conflict | DbError>;
    readonly login: (input: Credentials) => Effect.Effect<SessionGrant, Unauthorized | DbError>;
    readonly logout: (token: string) => Effect.Effect<void, DbError>;
    readonly userForToken: (token: string) => Effect.Effect<User, Unauthorized | DbError>;
    readonly changePassword: (user: User, current: string, next: string) => Effect.Effect<void, BadRequest | DbError>;
    readonly purgeExpiredSessions: () => Effect.Effect<number, DbError>;
  }
>()("AuthService") {
  static readonly layer = Layer.effect(
    AuthService,
    Effect.gen(function* () {
      const query = yield* DbQuery;

      const startSession = (user: User) =>
        Effect.gen(function* () {
          const token = randomToken();
          const tokenHash = yield* Effect.promise(() => sha256(token));
          const maxAgeSeconds = SESSION_DAYS * 86_400;
          yield* query((db) =>
            db.insert(sessions).values({ tokenHash, userId: user.id, expiresAt: Date.now() + maxAgeSeconds * 1000 }),
          );
          return { user, token, maxAgeSeconds };
        });

      return {
        signup: (input) =>
          Effect.gen(function* () {
            const email = normalizeEmail(input.email);
            const existing = yield* query((db) =>
              db.select({ id: users.id }).from(users).where(eq(users.email, email)),
            );
            if (existing.length > 0)
              return yield* new Conflict({ message: "An account with this email already exists." });
            const { hash, salt } = yield* Effect.promise(() => hashPassword(input.password));
            const [user] = yield* query((db) =>
              db
                .insert(users)
                .values({ id: newId("usr"), email, passwordHash: hash, passwordSalt: salt })
                .returning(),
            );
            return yield* startSession(user!);
          }),

        login: (input) =>
          Effect.gen(function* () {
            const [user] = yield* query((db) =>
              db
                .select()
                .from(users)
                .where(eq(users.email, normalizeEmail(input.email))),
            );
            // Hash even for unknown emails so timing does not reveal which accounts exist.
            const ok = yield* Effect.promise(() =>
              user
                ? verifyPassword(input.password, user.passwordHash, user.passwordSalt)
                : hashPassword(input.password).then(() => false),
            );
            if (!user || !ok) return yield* new Unauthorized({ message: "Wrong email or password." });
            return yield* startSession(user);
          }),

        logout: (token) =>
          Effect.gen(function* () {
            const tokenHash = yield* Effect.promise(() => sha256(token));
            yield* query((db) => db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)));
          }),

        userForToken: (token) =>
          Effect.gen(function* () {
            const tokenHash = yield* Effect.promise(() => sha256(token));
            const rows = yield* query((db) =>
              db
                .select({ user: users })
                .from(sessions)
                .innerJoin(users, eq(users.id, sessions.userId))
                .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, Date.now())))
                .limit(1),
            );
            const row = rows[0];
            if (!row) return yield* new Unauthorized({ message: "Your session has expired. Sign in again." });
            return row.user;
          }),

        changePassword: (user, current, next) =>
          Effect.gen(function* () {
            const ok = yield* Effect.promise(() => verifyPassword(current, user.passwordHash, user.passwordSalt));
            if (!ok) return yield* new BadRequest({ message: "Your current password is wrong." });
            const { hash, salt } = yield* Effect.promise(() => hashPassword(next));
            yield* query((db) =>
              db
                .update(users)
                .set({ passwordHash: hash, passwordSalt: salt, updatedAt: Date.now() })
                .where(eq(users.id, user.id)),
            );
          }),

        purgeExpiredSessions: () =>
          query((db) =>
            db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).returning({ t: sessions.tokenHash }),
          ).pipe(Effect.map((rows) => rows.length)),
      };
    }),
  );
}
