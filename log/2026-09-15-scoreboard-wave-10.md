# 2026-09-15 — Scoreboard curated listings + wave 10

Spark: Wave 10 outreach produced durable public listing URLs. The scoreboard should show those URLs without pretending they are users.

Changed: Appended ACP Registry, ClawSwarm, and Vivioo to `directory_listings.entries` on `GET /api/scoreboard.json` (prior twenty-two listings unchanged, including Veii / Robauto / Signet). Zeros stay 0. ClawdMarket omitted (pending_claim / inactive). Agent Reputation, AgentIndex, and MCP.Directory still omitted — no durable public URL. ClawSwarm `reputation=100` is the platform new-agent default, not Liberty traction. Vivioo `trustScore=5` is self-reported. Homepage `/#scoreboard` reads the same list from the API. Listings are not users. Still demo / `money: false`.
