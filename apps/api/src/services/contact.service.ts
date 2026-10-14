import { Context, Effect, Layer } from "effect";
import { DbQuery } from "../bindings";
import type { DbError } from "../common/errors";
import { contactMessages } from "../entities";
import type { ContactMessage } from "../schemas/contact.schema";
import { newId } from "../utils/ids";

export class ContactService extends Context.Service<
  ContactService,
  { readonly submit: (input: ContactMessage, userId: string | null) => Effect.Effect<void, DbError> }
>()("ContactService") {
  static readonly layer = Layer.effect(
    ContactService,
    Effect.gen(function* () {
      const query = yield* DbQuery;
      return {
        submit: (input, userId) =>
          query((db) => db.insert(contactMessages).values({ id: newId("msg"), ...input, userId })).pipe(
            Effect.tap(() => Effect.sync(() => console.log({ event: "contact", topic: input.topic }))),
            Effect.asVoid,
          ),
      };
    }),
  );
}
