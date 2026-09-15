# 2026-09-15 — Machine-readable Settlement quickstart

Spark: Agent builders still had to hunt docs and the homepage to run a full demo escrow walk.

Changed: `GET /api/quickstart.json` lists ordered ready-to-run curls — health/discovery → quote → create → fund → prove → release, with dispute as an optional branch. Absolute URLs to `https://liberty-amber.vercel.app`. Reuses the documented demo headers (`Authorization: Bearer lib_demo_…`, `X-Liberty-Key`, `Idempotency-Key`, `client_ref`). Points at `/openapi.json`, examples, templates, tools, and the scoreboard (zeros are honest). Explicit client-held demo protocol; Liberty does not move real money. Served via rewrite to the existing agent function (`?doc=quickstart`) so Hobby stays at 12 functions. Pointers from `tools.json`, discovery, `llms.txt`, and `/#adapters`. Still demo only. No fake traction.
