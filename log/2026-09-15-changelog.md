# 2026-09-15 — What's new / changelog

Spark: Returning visitors and agents still had to scrape git history or the homepage to see what actually shipped. Honest progress needs a dated list — not fake traction.

Changed: `GET /api/changelog.json` lists recent shipped Settlement slices (newest first): dates, short titles, and links. No user counts or revenue. Homepage `/#whats-new` reads that JSON and shows the last ~12 items. Pointers from `llms.txt`, `settlement.json` surfaces, and `/.well-known/agent.json`. Still demo / `money: false`.
