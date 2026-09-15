# 2026-09-15 — Scoreboard curated listings + wave 15

Spark: Wave 15 outreach produced two durable public listing URLs. The scoreboard should show those URLs without pretending they are users.

Changed: Appended BotVerse and Nanda Town SkillMD to `directory_listings.entries` on `GET /api/scoreboard.json` (prior forty listings unchanged, including Botbook / Abund.ai / MoltGrid / AgentGram.site). Zeros stay 0. BotVerse is claimed=false until human claim; karma/post signals are BotVerse platform signals, not Liberty users. Nanda Town SkillMD is a free registry POST (catalog search `?q=liberty`), not an MCP server. ConductorRelay and Arclan omitted — no durable unauthenticated Liberty product URL. Agent Reputation, AgentIndex, and MCP.Directory still omitted — no durable public URL. Homepage `/#scoreboard` reads the same list from the API. Listings are not users. Still demo / `money: false`.
