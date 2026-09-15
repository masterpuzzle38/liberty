# 2026-09-15 — Optional callback_url on create

Spark: Adapters need a URL of their own on the job and terminal receipt so *their* client can notify itself after release or dispute. Liberty must never call it.

Changed: `POST /api/v0/transition` create and `POST /api/v0/simulate` accept optional `callback_url` (`callbackUrl` / `notify_url` / `notifyUrl` aliases, max 512, https only). Empty or whitespace-only is rejected. The field lands on the client-held job as `callbackUrl` and echoes on the terminal receipt as `callback_url`. Quote create echoes it. Independent of Idempotency-Key — same key plus title/amount/criteria still yields the same `as_` id. Liberty never HTTP-fetches or calls this URL (no SSRF, no server-side notify). Human UI: optional create field; templates leave it blank. Handoff and receipt links keep it. Docs, OpenAPI, examples, and tests updated. Still demo / `money: false`.
