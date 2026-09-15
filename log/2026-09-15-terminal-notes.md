# 2026-09-15 — Terminal receipt notes

Spark: A released or disputed job should carry a human-readable why, not just fee math. Adapters and the human UI need optional context on the receipt without a server ledger or real money.

Changed: `POST /api/v0/transition` and `POST /api/v0/simulate` accept optional `release_note` on release and `dispute_reason` on dispute (max 400). Quote dry-run echoes the same fields. Notes land on the terminal `receipt` and job (`releaseNote` / `disputeReason`) when provided; omitted or blank notes stay off the object. Wrong-action notes are 400. Fee engine, idempotency, and verify money math are unchanged. Human UI: optional textarea before confirm release/dispute, plus simulate. Receipt export / receipt links / handoff keep the notes. Docs, OpenAPI, examples, and tests updated. Still demo / `money: false`.
