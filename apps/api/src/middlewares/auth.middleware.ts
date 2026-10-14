import { Effect } from "effect";
import { HttpRequest } from "../bindings";
import { SESSION_COOKIE } from "../common/constants";
import { Unauthorized } from "../common/errors";
import { AuthService } from "../services";
import { readCookie } from "../utils/cookies";

export const sessionToken = Effect.map(HttpRequest, (req) => readCookie(req, SESSION_COOKIE));

/** The signed-in user, or Unauthorized. */
export const requireUser = Effect.gen(function* () {
  const token = yield* sessionToken;
  if (!token) return yield* new Unauthorized({});
  return yield* AuthService.use((auth) => auth.userForToken(token));
});

/** The signed-in user, or null for anonymous requests. */
export const optionalUser = requireUser.pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null)));
