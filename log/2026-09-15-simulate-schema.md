# 2026-09-15 — JSON Schema for simulate request bodies

Spark: Agent builders still had to infer POST /api/v0/simulate fields from OpenAPI or prose before calling the one-shot create → fund → submit → release|dispute walk.

Changed: `GET /api/schemas/simulate.json` is a JSON Schema (draft 2020-12) for the real simulate request bodies (title, amount, criteria, payer_credits, proof_url, optional terminal, client_ref, callback_url / notify_url, expires_at / ttl_seconds, notes, and idempotency). `$id` is the production URL. Short description: client-held demo protocol; Liberty does not move real money. Served via rewrite to the existing agent discovery function (`?doc=simulate-schema`) so Hobby stays at 12 functions. Listed from `tools.json` and pointed at from discovery, OpenAPI, llms.txt, and For agents. Still demo only. No fake traction.
