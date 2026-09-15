# 2026-09-15 — Demo Idempotency-Key

Spark: Adapters retrying create/fund/submit/release/dispute were inventing a new `as_` id on every create. Contest slice needs an honest, client-held retry key without a server ledger, stored replay, or real money.

Changed: `POST /api/v0/transition`, `POST /api/v0/simulate`, and `POST /api/v0/quote` accept optional `Idempotency-Key` (or body `idempotency_key`). On create (transition and simulate), SHA-256 of the key plus title/amount/criteria yields `as_` + 10 hex. Same key and create fields = same job id. Missing key stays random. Quote echoes only and still has no durable create id. Successful responses echo `idempotency_key`; create/simulate set `idempotent: true` when the id came from the key. Liberty does not persist or replay responses. Docs, examples, OpenAPI, and focused tests stay in sync. Still demo / `money: false`.
