# REA analysis of the Exo builds

Static analysis of our own production bundles with [REA](https://github.com/morluto/rea) 6.5.0
(`rea analyze-javascript-application`). Raw Evidence JSON goes to `.rea/` (git-ignored).

```bash
pnpm --filter web build
npx -y rea-agents@latest analyze-javascript-application "$PWD/apps/web/dist" --format json > .rea/web-dist.json
cd apps/api && npx wrangler deploy --dry-run --outdir ../../.rea/api-bundle && cd ../..
npx -y rea-agents@latest analyze-javascript-application "$PWD/.rea/api-bundle" --format json > .rea/api.json
```

## Web bundle (`apps/web/dist`)

| Check                   | Result                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files parsed            | 37 JS + `index.html`, 0 parse failures, 0 truncated observations                                                                                                                                            |
| Graph                   | 562 nodes, 1,598 edges                                                                                                                                                                                      |
| Client routes           | 15, matching `src/app/App.tsx`                                                                                                                                                                              |
| Static `/api` calls     | `/api/me`, `/api/auth/{signup,login,logout,password}`, `/api/projects`, `/api/renders`, `/api/contact`. Templated paths (`/api/projects/${id}`, files, renders by id) are dynamic and unresolved by design. |
| External URLs in JS     | None                                                                                                                                                                                                        |
| `eval` / `new Function` | None                                                                                                                                                                                                        |
| Storage                 | `localStorage` (theme preference), `sessionStorage` (React Router scroll restoration). No tokens or personal data.                                                                                          |
| Workers                 | `loader.worker` (G-code parsing, module worker) and a `blob:` worker created by fflate's async zip                                                                                                          |

### Actions taken

- The inline theme script in `index.html` was the only code REA could not analyze. It now lives in
  `public/theme-init.js`, so the bundle is fully covered and the CSP can use `script-src 'self'`.
- `public/_headers` sets a Content-Security-Policy built from these findings: no third-party scripts or
  connections, Google Fonts for type, `worker-src 'self' blob:` for the zip worker, `blob:` images and
  video for finished renders. It also sets `nosniff`, a referrer policy, a permissions policy and COOP.

## API bundle (`wrangler deploy --dry-run`)

| Check             | Result                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| Size              | 1.0 MB raw, 197 KB gzip (Workers limit: 3 MB gzip on Free)                              |
| Routes            | REA recognizes the `route(method, path, handler)` helper: GET, POST, PUT, PATCH, DELETE |
| Storage / workers | None in the bundle (D1 and R2 are bindings)                                             |

## Limits of this analysis

REA parses bundles as inert text and never executes them. Dynamic paths stay unresolved, and a missing
fact means "not observed", not "absent". Runtime behavior is covered by the API integration tests
(`pnpm --filter api test`) and the browser checks.
