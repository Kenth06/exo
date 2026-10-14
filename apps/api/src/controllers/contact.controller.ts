import { Effect } from "effect";
import { decodeBody, json, route } from "../common/http";
import { optionalUser } from "../middlewares/auth.middleware";
import { ContactMessage } from "../schemas/contact.schema";
import { ContactService } from "../services";

export const contactController = [
  route("POST", "/api/contact", () =>
    Effect.gen(function* () {
      const user = yield* optionalUser;
      const input = yield* decodeBody(ContactMessage);
      yield* ContactService.use((s) => s.submit(input, user?.id ?? null));
      return json({ ok: true }, { status: 201 });
    }),
  ),
];
