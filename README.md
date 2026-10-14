# Exo

Product photos and videos rendered from sliced G-code, with the real layer lines. Free. Runs on Cloudflare
Workers; rendering happens in the browser with WebGL.

## Stack

pnpm + Turborepo monorepo · React 19 + Vite + Tailwind v4 + Kumo · Cloudflare Workers + Effect v4 ·
D1 + Drizzle · R2 · three.js · oxlint + oxfmt. Conventions: `../stack-standards`.

```txt
apps/api        exo-api Worker (auth, projects, files, renders, contact)
apps/web        exo-web Worker (SPA + /api proxy via service binding) and the 3D engine
packages/gcode  G-code parser, .gcode.3mf reader, bead geometry, sample prints
packages/shared catalog and HTTP contracts
```

## Local development

```bash
pnpm install
pnpm --filter api db:migrate:local
pnpm --filter api dev   # http://localhost:8787
pnpm --filter web dev   # http://localhost:5173
```

## Checks

```bash
pnpm lint
pnpm check-types
pnpm test     # gcode unit tests + API integration tests in workerd
pnpm build
```

## Deploy

```bash
cd apps/api
npx wrangler d1 create exo            # paste the id into apps/api/wrangler.jsonc
npx wrangler r2 bucket create exo-files
pnpm db:migrate:remote
pnpm deploy                           # exo-api
cd ../web && pnpm deploy              # exo-web (binds to exo-api)
```

Add a route or custom domain to `exo-web` in `apps/web/wrangler.jsonc`. `exo-api` has `workers_dev: false`
and is reachable only through the web Worker's service binding.
