import { Effect } from "effect";
import { AuthService } from "../services";

/** Nightly: drop expired sessions so the table doesn't grow forever. */
export const cleanupJob = Effect.gen(function* () {
  const purged = yield* AuthService.use((a) => a.purgeExpiredSessions());
  console.log({ event: "cleanup", purgedSessions: purged });
});
