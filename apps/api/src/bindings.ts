import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { Context, Effect } from "effect";
import { DbError, StorageError } from "./common/errors";
import * as schema from "./entities";

export type AppEnv = Env;
export type Database = DrizzleD1Database<typeof schema>;

export class Bindings extends Context.Service<Bindings, AppEnv>()("Bindings") {}
export class Db extends Context.Service<Db, Database>()("Db") {}
export class Bucket extends Context.Service<Bucket, R2Bucket>()("Bucket") {}
export class HttpRequest extends Context.Service<HttpRequest, Request>()("HttpRequest") {}
export class Ctx extends Context.Service<Ctx, ExecutionContext>()("Ctx") {}

export const makeDb = (env: AppEnv): Database => drizzle(env.DB, { schema });

export type Query = <A>(f: (db: Database) => Promise<A>) => Effect.Effect<A, DbError>;
export type Storage = <A>(f: (bucket: R2Bucket) => Promise<A>) => Effect.Effect<A, StorageError>;

/** Services capture these once in their Layer so their methods carry no requirements. */
export const DbQuery = Effect.map(
  Db,
  (db): Query =>
    (f) =>
      Effect.tryPromise({ try: () => f(db), catch: (cause) => new DbError({ cause }) }),
);

export const BucketStorage = Effect.map(
  Bucket,
  (bucket): Storage =>
    (f) =>
      Effect.tryPromise({ try: () => f(bucket), catch: (cause) => new StorageError({ cause }) }),
);
