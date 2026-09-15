# 2026-09-15 — OpenAPI also at /openapi.json

Spark: Adapters often probe `/openapi.json` and `/api/openapi.json`, but Liberty only served the spec at `/settlement.openapi.json`.

Changed: Those two paths now return the same existing OpenAPI 3.1 document — `/openapi.json` rewrites to the static file; `/api/openapi.json` rewrites to the existing agent function (`?doc=openapi`) so Hobby stays at 12 functions. CORS and cache headers match `/settlement.openapi.json`. Discovery lists (`/api/tools.json`, `/api/settlement.json`, `llms.txt`, sitemap, changelog) mention the aliases without dropping the canonical path. Still demo only. `money: false`. No fake traction.
