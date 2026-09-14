# 2026-09-14 — Discovery JSON as Vercel functions

Spark: Live `/api/health.json` and `/api/settlement.json` returned Vercel `NOT_FOUND` even though the files were on main — `/api` is reserved for serverless functions, so static JSON there never deploys.

Changed: Those exact URLs are Node functions (`api/health.json.js`, `api/settlement.json.js`) that return the protocol documents from `api/_lib`. Same advertised paths. Tests pin states, fees, receipts, optional demo key, and client-held handoff to the engine. Still demo / `money: false`.
