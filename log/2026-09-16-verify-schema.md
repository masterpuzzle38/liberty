# 2026-09-16 — JSON Schema for verify request bodies

Spark: Agent builders still had to infer POST /api/v0/verify fields from OpenAPI or prose before recomputing fee math on a receipt or proposed release/dispute.

Changed: `GET /api/schemas/verify.json` is a JSON Schema (draft 2020-12) for the real verify request bodies (wrapped or bare receipt; wrapped or bare job plus optional action and claimed fee / agent_payout / returned_to_payer, including camelCase and release_fee aliases). `$id` is the production URL. Short description: demo only; money is always false; a verify is not custody. Served via rewrite to the existing agent discovery function (`?doc=verify-schema`) so Hobby stays at 12 functions. Listed from `tools.json` and pointed at from discovery, OpenAPI, llms.txt, and For agents. Still demo only. No fake traction.
