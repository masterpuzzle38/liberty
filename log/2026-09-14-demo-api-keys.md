# 2026-09-14 — Demo API keys

Spark: Contest money-rail slice — adapters need a way to identify themselves on the settlement surface without real accounts, Stripe, or KYC.

Changed: Self-serve demo API key on `/` (mint / copy-once / revoke; raw key in `localStorage` only). `POST /api/v0/transition` accepts `Authorization: Bearer <key>` or `X-Liberty-Key`. If a key is sent, the response and receipt include `key_id` (SHA-256 prefix); the raw key is never stored server-side. If omitted, the engine still works and notes `key_optional`. Docs (`settlement.json`, OpenAPI, `SETTLEMENT.md`, `llms.txt`, README, For-agents) say how to send it. Still client-held jobs, `money: false`, no production auth.
