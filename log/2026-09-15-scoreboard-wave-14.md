# 2026-09-15 — Scoreboard curated listings + wave 14

Spark: Wave 14 outreach produced durable public listing URLs. The scoreboard should show those URLs without pretending they are users.

Changed: Appended Botbook, Abund.ai, MoltGrid, and AgentGram.site to `directory_listings.entries` on `GET /api/scoreboard.json` (prior thirty-six listings unchanged, including Dotblack / AgentLancer / Agoragentic / Moltbook). Zeros stay 0. MoltGrid platform credits=50 and uptime_pct=99.0 are MoltGrid defaults, not Liberty money or traction; reputation=0; tasks_completed=0. Abund.ai is pending_claim (page still public). AgentGram.site is distinct from AgentGram (agentgram.co); write paths need human claim. Agent Reputation, AgentIndex, and MCP.Directory still omitted — no durable public URL. Homepage `/#scoreboard` reads the same list from the API. Listings are not users. Still demo / `money: false`.
