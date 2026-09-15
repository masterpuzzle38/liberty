# 2026-09-15 — JSON Schema for shareable job handoffs

Spark: Agent builders still had to infer `#handoff/h1.…` payload fields from OpenAPI or prose before trusting a shared job link.

Changed: `GET /api/schemas/handoff.json` is a JSON Schema (draft 2020-12) for the real decoded handoff payload (`{ v, job, next }` after compact keys expand — same fields as `job-handoff.js`). `$id` is the production URL. Explicit: client-held demo; Liberty does not move real money; handoffs are not custody transfers. Served via rewrite to the existing agent discovery function (`?doc=handoff-schema`) so Hobby stays at 12 functions. Listed from `tools.json` and pointed at from quickstart related / Integrate / Jobs, discovery, OpenAPI, llms.txt, and For agents. Still demo only. No fake traction.
