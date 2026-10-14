interface WebEnv {
  ASSETS: Fetcher;
  API: Fetcher;
}

export default {
  fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith("/api/")) return env.API.fetch(req);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<WebEnv>;
