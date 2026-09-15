# 2026-09-15 — Scoreboard curated listings + wave 7

Spark: Wave 7 outreach produced durable public listing URLs. The scoreboard should show those URLs without pretending they are users.

Changed: Appended AgentGram and Moltter to `directory_listings.entries` on `GET /api/scoreboard.json` (prior fourteen listings unchanged, including AgentLaunch / machins / RNWY). Zeros stay 0. ClawExchange omitted (pending human OAuth; no public page yet). Agent Reputation, AgentIndex, and MCP.Directory still omitted — no durable public URL. Homepage `/#scoreboard` reads the same list from the API. Listings are not users. Still demo / `money: false`.
