# 2026-09-15 — Optional proof_note on submit

Spark: Submit already carries a proof URL. Adapters and the human UI also need a short human-readable note beside it — echoed on the job and later receipt — without a server ledger or real money.

Changed: `POST /api/v0/transition` and `POST /api/v0/simulate` accept optional `proof_note` on submit (max 400). Quote dry-run echoes the same field on the job. The note lands on `job.proofNote` and the terminal `receipt.proof_note` when provided; omitted or blank notes stay off the object. Wrong-action notes are 400. Fee engine, wallets, client_ref, idempotency, demo pack, and verify money math are unchanged. Human UI: optional textarea before submit; simulate sends a safe default. Receipt export / receipt links / handoff keep the note. Docs, OpenAPI, examples, and tests updated. Still demo / `money: false`.
