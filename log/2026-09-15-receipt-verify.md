# 2026-09-15 — Receipt / settlement verify

Spark: Exportable receipts just shipped, but a shared JSON receipt is only a blob until someone can check it against Liberty’s fee engine — without Liberty storing receipts or taking custody.

Changed: `POST /api/v0/verify` recomputes fee / agent_payout / returned_to_payer with the same engine as quote/transition. Send a terminal receipt, or a job (terminal, or submitted plus release/dispute) and optional claimed money fields. Response is `{ ok, mode:"demo", money:false, valid, verified:true, expected, received, mismatches }`. A wrong fee is `200` + `valid:false`; illegal input is 4xx. Homepage Receipts / Export can paste JSON or pick a stored receipt and show valid / mismatches. Docs (`SETTLEMENT.md`, `settlement.json`, OpenAPI, `llms.txt`, README, For-agents) list verify next to quote/transition. Still demo / `money: false`. No server ledger, Stripe, or claimed volume.
