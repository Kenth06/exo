import { Effect } from "effect";
import { HttpRequest } from "../bindings";
import { SESSION_COOKIE } from "../common/constants";
import { Unauthorized } from "../common/errors";
import { decodeBody, json, route } from "../common/http";
import { optionalUser, requireUser, sessionToken } from "../middlewares/auth.middleware";
import { ChangePassword, Credentials } from "../schemas/auth.schema";
import { AuthService, toPublicUser } from "../services";
import { sessionCookie } from "../utils/cookies";

const withSession = (grant: { token: string; maxAgeSeconds: number }) =>
  Effect.map(HttpRequest, (req) => sessionCookie(req, SESSION_COOKIE, grant.token, grant.maxAgeSeconds));

export const authController = [
  route("POST", "/api/auth/signup", () =>
    Effect.gen(function* () {
      const input = yield* decodeBody(Credentials);
      const grant = yield* AuthService.use((a) => a.signup(input));
      const cookie = yield* withSession(grant);
      return json({ user: toPublicUser(grant.user) }, { status: 201, headers: { "set-cookie": cookie } });
    }),
  ),

  route("POST", "/api/auth/login", () =>
    Effect.gen(function* () {
      const input = yield* decodeBody(Credentials).pipe(
        Effect.catchTag("BadRequest", () => Effect.fail(new Unauthorized({ message: "Wrong email or password." }))),
      );
      const grant = yield* AuthService.use((a) => a.login(input));
      const cookie = yield* withSession(grant);
      return json({ user: toPublicUser(grant.user) }, { headers: { "set-cookie": cookie } });
    }),
  ),

  route("POST", "/api/auth/logout", () =>
    Effect.gen(function* () {
      const token = yield* sessionToken;
      if (token) yield* AuthService.use((a) => a.logout(token));
      const cookie = yield* withSession({ token: "", maxAgeSeconds: 0 });
      return json({ ok: true }, { headers: { "set-cookie": cookie } });
    }),
  ),

  route("GET", "/api/me", () => Effect.map(optionalUser, (user) => json({ user: user ? toPublicUser(user) : null }))),

  route("POST", "/api/auth/password", () =>
    Effect.gen(function* () {
      const user = yield* requireUser;
      const input = yield* decodeBody(ChangePassword);
      yield* AuthService.use((a) => a.changePassword(user, input.current, input.next));
      return json({ ok: true });
    }),
  ),
];
