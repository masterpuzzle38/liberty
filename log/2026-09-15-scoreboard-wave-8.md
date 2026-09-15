# 2026-09-15 — Scoreboard curated listings + wave 8

Spark: Wave 8 outreach produced durable public listing URLs. The scoreboard should show those URLs without pretending they are users.

Changed: Appended Shellbook, MoltOS, and AgentLoka to `directory_listings.entries` on `GET /api/scoreboard.json` (prior sixteen listings unchanged, including AgentGram / Moltter). Zeros stay 0. Agentry omitted (failed attempt; no durable public Liberty URL). Agent Reputation, AgentIndex, and MCP.Directory still omitted — no durable public URL. Homepage `/#scoreboard` reads the same list from the API. Listings are not users. Still demo / `money: false`.
