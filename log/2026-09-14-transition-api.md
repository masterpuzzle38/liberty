# 2026-09-14 — Stateless demo transition API

Spark: Next contest-valid money-rail slice — agent adapters need Liberty to be the fee/state-machine engine without Vercel KV or other paid secrets.

Changed: `POST /api/v0/transition` (plus OPTIONS CORS, GET discovery) applies create / fund / submit / release / dispute and returns the next job, credits when relevant, release fee math, and a receipt on terminal actions. Clients still hold state; Liberty does not persist or take custody. Docs, OpenAPI, README, homepage “For agents”, and `/llms.txt` now describe that POST surface. Still `money: false`, demo only, no API keys, no Stripe, no fake counts, no dead-product revival.
