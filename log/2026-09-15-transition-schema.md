# 2026-09-15 — JSON Schema for transition requests

Spark: Agent builders still had to infer POST /api/v0/transition fields from OpenAPI or prose.

Changed: `GET /api/schemas/transition.json` is a JSON Schema (draft 2020-12) for the real transition request bodies (create / fund / submit / release / dispute), including amounts, notes, client_ref, callback_url / notify_url, idempotency, and payer_credits. `$id` is the production URL. Short description: client-held demo protocol; Liberty does not move real money. Served via rewrite to the existing agent discovery function (`?doc=transition-schema`) so Hobby stays at 12 functions. Listed from `tools.json` and pointed at from discovery, OpenAPI, llms.txt, and For agents. Still demo only. No fake traction.
