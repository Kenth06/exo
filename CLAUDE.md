# Exo — instrucciones para agentes

Este repo sigue `C:\Users\Kenneth\Desktop\Projects\stack-standards` (léelo primero: CLAUDE.md, MONOREPO.md,
BACKEND.md, FRONTEND.md, DESIGN.md). Aquí solo van las reglas propias de Exo. Si descubres algo que sirva a
otros proyectos, actualiza stack-standards y su CHANGELOG.

## Qué es

Exo convierte G-code laminado (.gcode.3mf de Bambu Studio / Orca, .gcode de Prusa / Cura) en fotos y vídeos
de producto con las líneas de capa reales. Todo el render ocurre en el navegador (WebGL). Es gratis: no hay
créditos, planes ni pagos.

## Mapa

| Ruta                   | Contenido                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/gcode`       | Parser de G-code, extractor de .gcode.3mf, geometría de cordones, muestras procedurales. Puro y testeado. |
| `packages/shared`      | Catálogo (filamentos, escenas, ángulos, plataformas, plantillas, movimientos) y contratos HTTP.           |
| `apps/api`             | Worker `exo-api`: Effect + Drizzle/D1 + R2. Auth por cookie, proyectos, archivos, renders, contacto.      |
| `apps/web`             | Worker `exo-web`: SPA React + Kumo, motor 3D en `src/lib/engine`, proxy `/api` por service binding.       |
| `docs/rea-analysis.md` | Resultado del análisis REA de los bundles y medidas tomadas.                                              |

## Reglas del dominio

- El parser excluye skirt, brim, prime tower, purga, wipe e ironing; los soportes se muestran solo si el
  usuario lo pide. Infill y bottom surface no se dibujan (quedan ocultos). Si cambias la clasificación, añade
  un test en `packages/gcode/test`.
- Las muestras (`SAMPLE_*`) deben emitir G-code con el formato real de Bambu (`; CHANGE_LAYER`, `; FEATURE:`),
  incluida la última capa del fondo como `Top surface`.
- El color debe ser fiel: `NeutralToneMapping`, exposiciones por escena en `src/lib/engine/scenes.ts`.
- Amazon (`whiteBackground`) siempre se renderiza en `white-sweep`.
- Cambiar el catálogo en `packages/shared` afecta a la API y a la web a la vez.

## Comandos

```bash
pnpm install
pnpm --filter api db:migrate:local
pnpm --filter api dev      # :8787
pnpm --filter web dev      # :5173, proxy /api → :8787
pnpm lint && pnpm check-types && pnpm test && pnpm build
```

Cuenta de prueba local: `apps/api/seed.dev.json`.
