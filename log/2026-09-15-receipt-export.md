# 2026-09-15 — Client-held receipt export

Spark: Contest money-rail slice — a human or adapter needs to keep and share proof of a terminal settlement without Liberty taking custody of receipts.

Changed: After a successful release or dispute, `/` stores the transition `receipt` in this browser (`liberty.agent-settlement.receipts.v0`, separate from jobs/credits). Receipts / Export lists fee, agent payout, returned to payer, status, job id, and timestamps, with download JSON (one), download all (JSON array or NDJSON), and copy. Quote dry-runs are not stored. Docs (`SETTLEMENT.md`, `settlement.json`, OpenAPI, `llms.txt`, README, For-agents) say export is client-held. Still demo / `money: false`. No server ledger, Stripe, or claimed volume.
