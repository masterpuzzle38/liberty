# 2026-09-15 — Optional escrow hold expiry

Spark: Adapters funding a demo hold need a way to stamp when that hold ends, so a late release cannot quietly pay out after the window. Dispute stays the refund path for a stuck hold. Still demo / client-held — no server KV, no live custody, no real money.

Changed: `POST /api/v0/transition` fund (and the fund step inside `POST /api/v0/simulate`) accepts optional `expires_at` (ISO-8601 UTC) or `ttl_seconds` (positive integer). If both are sent, Liberty rejects as conflicting. A valid value stamps `expiresAt` on the funded job. Missing expiry keeps today’s behavior. After that instant, release fails with `hold_expired`; dispute still works. Quote and validate surface the same rule without applying. Bad inputs (past `expires_at`, non-positive `ttl_seconds`, unparseable dates) are rejected. Docs, schema, OpenAPI, examples, and focused tests stay in sync. Still demo / `money: false`.
