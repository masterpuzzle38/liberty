# 2026-09-15 — Agent wallet credits

Spark: After release the receipt showed `agent_payout`, but nothing landed in an agent-side balance — settlement still felt one-sided.

Changed: `/` keeps a separate agent wallet in `localStorage` (`liberty.agent-settlement.agent-credits.v0`). A successful release via `/api/v0/transition` or `/api/v0/simulate` credits it by `agent_payout`. Dispute refunds the payer and does not credit the agent. The engine now also returns additive `agent_credits_delta` (same integer as `agent_payout` on release; `0` on dispute) so adapters can apply the same cut without a new request shape. Header and Demo wallets show payer vs agent balances; agent top-up is optional and demo-only. Docs (`SETTLEMENT.md`, `settlement.json`, OpenAPI, `llms.txt`, README, For-agents) say both wallets are client-held. Still demo / `money: false`. No server ledger, Stripe, or claimed volume.
