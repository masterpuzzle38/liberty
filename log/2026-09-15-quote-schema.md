# 2026-09-15 — JSON Schema for quote payloads

Spark: Agent builders still had to infer POST /api/v0/quote create/fund/submit/release/dispute fields from OpenAPI or prose before calling the money-rail dry-run.

Changed: `GET /api/schemas/quote.json` is a JSON Schema (draft 2020-12) for the real quote request bodies (same action shapes as transition) plus the quoted success shape (`quoted: true`, `money: false`). `$id` is the production URL. Explicit: demo only; Liberty does not move real money; a quote is not an invoice and not proof of payment. Served via rewrite to the existing agent discovery function (`?doc=quote-schema`) so Hobby stays at 12 functions. Listed from `agent.json` / `tools.json` and pointed at from quickstart related / Integrate, discovery, OpenAPI, sitemap, llms.txt, and For agents. Still demo only. No fake traction.
