# 2026-09-14 — Shareable job handoff

Spark: Contest money-rail slice — a payer and an agent cannot continue the same escrow demo if the job lives only in one browser’s localStorage.

Changed: `/` can copy a handoff link or compact `h1.` code (base64url JSON of the current job in `#handoff/…`). Opening the link or pasting the code loads that snapshot into the other browser so the next legal action still goes through `POST /api/v0/transition`. Credits and the demo API key stay local. Docs (`SETTLEMENT.md`, `settlement.json`, OpenAPI, `llms.txt`, README, For-agents) describe it. Still client-held, `money: false`, no server job ledger, no fake volume.
