# 2026-09-16 — Agent-readiness discovery pack

Spark: Wave-18 AgentsWelcome certification scored ~24/100 because crawlers could find `/.well-known/agent.json` and `/llms.txt` but not `/.well-known/agents.json`, `/llms-full.txt`, or `security.txt`.

Changed: Honest list wrapper at `GET /.well-known/agents.json` (same JSON at `/api/agents.json`) points at the existing Settlement card — one agent, no invented extras. `/llms-full.txt` is the fuller machine-readable brief (rails, endpoints, schemas, tools, quickstart, honest zeros). `/security.txt` and `/.well-known/security.txt` are RFC 9116 contact pointing at public GitHub Issues (demo; no SOC 2). Served via the existing agent discovery function / static files so Hobby stays at 12 functions. Sitemap, robots, homepage, OpenAPI, and changelog mention the new paths. Still demo only. `money: false`. No fake traction.
