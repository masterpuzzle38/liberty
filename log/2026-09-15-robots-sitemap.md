# 2026-09-15 — robots.txt and sitemap

Spark: Directories and crawlers still had to scrape the homepage to find Agent Settlement discovery URLs.

Changed: Static `GET /robots.txt` and `GET /sitemap.xml` list the real discovery routes (`/`, `/.well-known/agent.json`, health / settlement / fees / scoreboard / changelog / examples / templates, `SETTLEMENT.md`, `llms.txt`, OpenAPI). Hash UI states stay on `/` once — they are not separate routes. Same static + `vercel.json` header pattern as `llms.txt`. Light pointers from `/.well-known/agent.json` and `llms.txt`. Still demo only. No fake traction.
