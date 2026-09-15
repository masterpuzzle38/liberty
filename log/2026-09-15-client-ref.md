# 2026-09-15 — Optional client_ref on create

Spark: External agents need their own correlation id on a settlement job and the terminal receipt. Liberty’s `as_…` id is not enough when the adapter already has a reference.

Changed: `POST /api/v0/transition` create and `POST /api/v0/simulate` accept optional `client_ref` (`clientRef` alias, max 128). Empty or whitespace-only is rejected. The field lands on the client-held job as `clientRef` and echoes on the terminal receipt as `client_ref`. Quote create echoes it. Independent of Idempotency-Key — same key plus title/amount/criteria still yields the same `as_` id. Human UI: optional create field; templates leave it blank. Handoff and receipt links keep it. Docs, OpenAPI, examples, and tests updated. Still demo / `money: false`.
