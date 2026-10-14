import type { ApiErrorBody, ErrorCode } from "@exo/shared";
import { Data } from "effect";

export class BadRequest extends Data.TaggedError("BadRequest")<{ readonly message: string }> {}
export class Unauthorized extends Data.TaggedError("Unauthorized")<{ readonly message?: string }> {}
export class Forbidden extends Data.TaggedError("Forbidden")<{ readonly message?: string }> {}
export class NotFound extends Data.TaggedError("NotFound")<{ readonly resource: string }> {}
export class Conflict extends Data.TaggedError("Conflict")<{ readonly message: string }> {}
export class PayloadTooLarge extends Data.TaggedError("PayloadTooLarge")<{ readonly limit: number }> {}
export class DbError extends Data.TaggedError("DbError")<{ readonly cause: unknown }> {}
export class StorageError extends Data.TaggedError("StorageError")<{ readonly cause: unknown }> {}

export type ApiError =
  | BadRequest
  | Unauthorized
  | Forbidden
  | NotFound
  | Conflict
  | PayloadTooLarge
  | DbError
  | StorageError;

const body = (status: number, code: ErrorCode, error: string) =>
  Response.json({ error, code } satisfies ApiErrorBody, { status, headers: { "cache-control": "no-store" } });

export const errorToResponse = (e: ApiError): Response => {
  switch (e._tag) {
    case "BadRequest":
      return body(400, "ERR_BAD_REQUEST", e.message);
    case "Unauthorized":
      return body(401, "ERR_UNAUTHORIZED", e.message ?? "Sign in to continue.");
    case "Forbidden":
      return body(403, "ERR_FORBIDDEN", e.message ?? "Not allowed.");
    case "NotFound":
      return body(404, "ERR_NOT_FOUND", `${e.resource} not found.`);
    case "Conflict":
      return body(409, "ERR_CONFLICT", e.message);
    case "PayloadTooLarge":
      return body(413, "ERR_PAYLOAD_TOO_LARGE", `Files are limited to ${Math.round(e.limit / 1048576)} MB.`);
    case "DbError":
    case "StorageError":
      console.error({ event: e._tag, cause: String(e.cause) });
      return body(500, "ERR_INTERNAL", "Something went wrong on our side.");
  }
};

export const internalError = () => body(500, "ERR_INTERNAL", "Something went wrong on our side.");
