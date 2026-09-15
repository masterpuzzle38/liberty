# 2026-09-15 — Shareable receipt links

Spark: Contest money-rail slice — a payer or agent who just got a release/dispute receipt still had to paste JSON to inspect or POST `/api/v0/verify` on another device.

Changed: `/` can copy a receipt link or compact `r1.` code (base64url JSON of the receipt in `#receipt/…`) after a successful release, dispute, or simulate. Opening the link or pasting the code loads that receipt into Receipts / Export Verify. Same client-held style as job handoff (`h1.`). Docs (`SETTLEMENT.md`, `settlement.json`, OpenAPI, `llms.txt`, README, For-agents) describe it. Still demo / `money: false`. No server receipt ledger, Stripe, or claimed volume.
