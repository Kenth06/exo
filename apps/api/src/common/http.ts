import { Cause, Effect, Exit, Option, Schema } from "effect";
import { HttpRequest } from "../bindings";
import { type ApiError, BadRequest, errorToResponse, internalError } from "./errors";

export type Params = Record<string, string>;
export type Handler<R> = (params: Params) => Effect.Effect<Response, ApiError, R>;

export interface Route<R> {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler<R>;
  /** Skip the CSRF header check (only for routes with their own authentication). */
  public: boolean;
}

export const route = <R>(
  method: string,
  path: string,
  handler: Handler<R>,
  opts: { public?: boolean } = {},
): Route<R> => {
  const keys: string[] = [];
  const pattern = path.replace(/:(\w+)/g, (_, k: string) => {
    keys.push(k);
    return "([^/]+)";
  });
  return { method, regex: new RegExp(`^${pattern}$`), keys, handler, public: opts.public ?? false };
};

export const json = (data: unknown, init: ResponseInit = {}) =>
  Response.json(data, { ...init, headers: { "cache-control": "no-store", ...init.headers } });

/** Validate a plain value with an Effect Schema, failing with BadRequest. */
export const decodeValue = <S extends Schema.Top>(schema: S, value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError((e) => new BadRequest({ message: e.message })),
  ) as Effect.Effect<S["Type"], BadRequest>;

/** Read the JSON body and validate it with an Effect Schema. */
export const decodeBody = <S extends Schema.Top>(schema: S): Effect.Effect<S["Type"], BadRequest, HttpRequest> =>
  Effect.gen(function* () {
    const req = yield* HttpRequest;
    const raw = yield* Effect.tryPromise({
      try: () => req.json(),
      catch: () => new BadRequest({ message: "Expected a JSON body." }),
    });
    return yield* decodeValue(schema, raw);
  });

export const searchParam = (name: string) => Effect.map(HttpRequest, (r) => new URL(r.url).searchParams.get(name));

export interface Match<R> {
  route: Route<R>;
  params: Params;
}

/** Find the route for a request, or the status to answer with when nothing matches. */
export const matchRoute = <R>(routes: ReadonlyArray<Route<R>>, req: Request): Match<R> | { status: 404 | 405 } => {
  const { pathname } = new URL(req.url);
  let pathMatched = false;
  for (const r of routes) {
    const m = r.regex.exec(pathname);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== req.method) continue;
    const params: Params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]!)));
    return { route: r, params };
  }
  return { status: pathMatched ? 405 : 404 };
};

/** Typed failures map to their status; defects are logged and become a generic 500. */
export const exitToResponse = (exit: Exit.Exit<Response, ApiError>): Response => {
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isSome(failure)) return errorToResponse(failure.value);
  console.error({ event: "defect", cause: Cause.pretty(exit.cause) });
  return internalError();
};
