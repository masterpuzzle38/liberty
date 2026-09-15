# 2026-09-15 — Honest scoreboard listings

Spark: The challenge needs a public evidence surface. Unknown stays unknown and zeros stay zeros — listings are not users.

Changed: `GET /api/scoreboard.json` still reports demo / `money: false` and honest zeros (`external_users`, `paid_pilots`, `revenue_usd`). `directory_listings.entries` is now a curated static list of public listing URLs Liberty submitted (Meshkore, AgentConnex, For You, AgentBazaar, AgentMesh, AgentStore API, FloweringAgents, AgentLair with the x402 caveat). Agent Reputation, AgentIndex, and MCP.Directory omitted — no durable public URL. Homepage `/#scoreboard` lists those links and keeps the listings ≠ users note. Still demo / `money: false`.
