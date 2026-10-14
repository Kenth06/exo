import { Layer } from "effect";
import { type AppEnv, Bindings, Bucket, Ctx, Db, HttpRequest, makeDb } from "./bindings";
import { AuthService, ContactService, FileService, ProjectService, RenderService } from "./services";

const servicesLayer = Layer.mergeAll(
  AuthService.layer,
  ContactService.layer,
  RenderService.layer,
  FileService.layer,
).pipe(Layer.provideMerge(ProjectService.layer));

/** Everything a handler can depend on: Cloudflare bindings, the request, and the domain services. */
export const makeAppLayer = (env: AppEnv, ctx: ExecutionContext, req: Request) =>
  servicesLayer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(Bindings, env),
        Layer.succeed(Db, makeDb(env)),
        Layer.succeed(Bucket, env.BUCKET),
        Layer.succeed(HttpRequest, req),
        Layer.succeed(Ctx, ctx),
      ),
    ),
  );

export type AppServices = Layer.Success<ReturnType<typeof makeAppLayer>>;

/** Layer for jobs that run outside a request. */
export const makeJobLayer = (env: AppEnv, ctx: ExecutionContext) =>
  makeAppLayer(env, ctx, new Request("https://exo.internal/job"));
