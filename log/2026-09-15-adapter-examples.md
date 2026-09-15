# 2026-09-15 — Adapter examples

Spark: An agent builder still had to read the whole protocol to try Agent Settlement. They needed copy-ready curls and the same bodies as JSON.

Changed: Homepage `/` has a **Try as an adapter** panel (`/#adapters`) with live-origin curls for `POST /api/v0/quote`, `POST /api/v0/transition` (create → fund → submit → release sketch), `POST /api/v0/simulate`, and `POST /api/v0/verify`. Comments cover optional `Authorization: Bearer` / `X-Liberty-Key`. Release notes `agent_credits_delta`. `GET /api/examples.json` lists those bodies. Discovery pointers updated in `settlement.json`, OpenAPI, `SETTLEMENT.md`, and `llms.txt`. Still demo / `money: false`. No fake traction.
