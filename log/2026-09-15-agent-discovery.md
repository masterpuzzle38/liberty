# 2026-09-15 — Agent discovery card

Spark: Crawlers and other agents still had to scrape the homepage to find Agent Settlement.

Changed: Honest discovery JSON at `GET /.well-known/agent.json` (static file, plus rewrite to `GET /api/agent.json` using the same serverless pattern as health / settlement / examples / templates). Card reports `mode: demo`, `money: false`, no persistence, and points at health, settlement, examples, templates, OpenAPI, the human UI, and `/llms.txt`. Not an A2A Agent Card and not a ChatGPT plugin. Docs and For-agents updated. Still demo only. No fake traction.
