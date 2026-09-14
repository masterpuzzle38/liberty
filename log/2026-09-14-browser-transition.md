# 2026-09-14 — Browser demo uses the transition engine

Spark: Contest money-rail slice — humans and agents should share one fee/state-machine engine instead of the homepage duplicating it in local JS.

Changed: `/` (`app.js`) POSTs create / fund / submit / release / dispute to `/api/v0/transition`, then writes the response into `localStorage`. Top-up and reset stay local. Browser no longer computes those five transitions or the 5% release fee. API errors surface in the existing flash. Docs (`SETTLEMENT.md`, `llms.txt`, README, For-agents, `settlement.json`) now say the UI shares the engine. Still demo / `money: false`. No Stripe, keys, or claimed volume.
