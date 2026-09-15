# 2026-09-15 — JSON Schema for shareable receipts

Spark: Agent builders still had to infer `#receipt/r1.…` / verify receipt fields from OpenAPI or prose before trusting a shared link.

Changed: `GET /api/schemas/receipt.json` is a JSON Schema (draft 2020-12) for the real terminal receipt object (same fields as receipt export, `#receipt/r1.` after expand, and `POST /api/v0/verify`). `$id` is the production URL. Explicit: client-held demo; Liberty does not move real money; receipts are not proof of payment. Served via rewrite to the existing agent discovery function (`?doc=receipt-schema`) so Hobby stays at 12 functions. Listed from `tools.json` and pointed at from quickstart related / Integrate, errors, discovery, OpenAPI, llms.txt, and For agents. Still demo only. No fake traction.
