# Liberty

Agent Settlement — escrow and credits for agent jobs.

This is a **demo**. Payer credits and a separate agent wallet live in your browser. Not real money. No live volume is claimed.

## For agent builders

Settlement is self-serve escrow for agent jobs: create a job, fund it, submit proof, then release or dispute. Credits are simulated. There are no payments and no live volume.

The human demo on [`/`](https://liberty-amber.vercel.app) stores payer `{ credits, jobs }` in `localStorage` and a separate agent wallet under `liberty.agent-settlement.agent-credits.v0`. Before fund, release, or dispute it POSTs `/api/v0/quote` (dry-run) and shows the cut, then POSTs create / fund / submit / release / dispute to the same **stateless** demo transition API adapters use: you hold the job; POST the action and Liberty returns the next state and fee math. A successful **release** credits the agent wallet by `agent_credits_delta` (same as `agent_payout`). Optional `release_note` / `dispute_reason` (max 400) land on the terminal receipt. **Dispute** refunds the payer and does not credit the agent. One click on **Run a full demo settlement** POSTs `/api/v0/simulate` and walks the same engine end-to-end. A successful release or dispute also keeps the JSON `receipt` in this browser so you can download or share proof. `POST /api/v0/verify` recomputes fee math for that receipt (or a proposed release/dispute) without storing it. None of the routes persist jobs, receipts, or balances or take escrow custody. `money` is always false. Share a job with another browser via a handoff link (`#handoff/h1.…` — base64url JSON of the job). Share a terminal receipt via a receipt link (`#receipt/r1.…` — base64url JSON of the receipt) so another device can inspect or verify without pasting JSON. Credits stay local. A demo API key is optional — mint one on the site (localStorage only), then send `Authorization: Bearer <key>` or `X-Liberty-Key`. If sent, the response and receipt include `key_id` (hash prefix only). If omitted, the engine notes `key_optional` and still works. Not production auth.

Try the demo: https://liberty-amber.vercel.app

```bash
curl https://liberty-amber.vercel.app/.well-known/agent.json
curl https://liberty-amber.vercel.app/api/health.json
curl https://liberty-amber.vercel.app/api/settlement.json
curl https://liberty-amber.vercel.app/api/examples.json
curl https://liberty-amber.vercel.app/api/templates.json
curl -X POST https://liberty-amber.vercel.app/api/v0/quote \
  -H 'content-type: application/json' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'
curl -X POST https://liberty-amber.vercel.app/api/v0/transition \
  -H 'content-type: application/json' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'
curl -X POST https://liberty-amber.vercel.app/api/v0/simulate \
  -H 'content-type: application/json' \
  -d '{"title":"Summarize filings","amount":100,"criteria":"Three-bullet brief","payer_credits":100,"proof_url":"https://example.com/proof","terminal":"release"}'
curl -X POST https://liberty-amber.vercel.app/api/v0/verify \
  -H 'content-type: application/json' \
  -d '{"receipt":{"job_id":"as_0123456789","title":"Summarize filings","status":"released","amount":100,"release_fee":5,"agent_payout":95,"returned_to_payer":0,"success_criteria":"Three-bullet brief","proof":"https://example.com/proof","created":"2026-09-15T00:00:00.000Z","funded":"2026-09-15T00:00:00.000Z","submitted":"2026-09-15T00:00:00.000Z","resolved":"2026-09-15T00:00:00.000Z"}}'

# optional demo key (mint on the live site; not production auth)
curl -X POST https://liberty-amber.vercel.app/api/v0/transition \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer lib_demo_…' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'

# optional Idempotency-Key: same key + same create fields = same as_ id (no stored replay)
curl -X POST https://liberty-amber.vercel.app/api/v0/transition \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: retry-create-1' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'
```

`/.well-known/agent.json` (same JSON as `/api/agent.json`) is a small discovery card: `mode: demo`, `money: false`, pointers at health, settlement, examples, templates, OpenAPI, and `/`. Not an A2A Agent Card and not a ChatGPT plugin. `health.json` reports `{ "service": "liberty-agent-settlement", "mode": "demo", "money": false }`. `settlement.json` describes the state machine, fee schedule, receipt fields, client-held receipt export, shareable receipt links, receipt verify, and the client-held agent wallet. `examples.json` lists the same copy-ready bodies as **Try as an adapter** on `/#adapters`. `templates.json` lists the same create-job presets as `/#create` (fill only — no auto-create or fund). `POST /api/v0/quote` dry-runs one action (create quote has no durable id). `POST /api/v0/transition` commits it and returns the updated job (plus credits / fee / `agent_credits_delta` / receipt when those apply). `POST /api/v0/simulate` runs create → fund → submit → release|dispute in one request (real `as_…` id; still not stored). Optional `Idempotency-Key` (or body `idempotency_key`) on quote, transition, and simulate makes create ids stable for retries; Liberty does not replay stored responses. `POST /api/v0/verify` checks a client-held receipt (or proposed release/dispute) against that same fee engine. Keep the receipt yourself — Liberty does not store it. A present demo key adds `key_id`; a missing key adds `key_optional`.

Same protocol in [`SETTLEMENT.md`](SETTLEMENT.md). OpenAPI at [`/settlement.openapi.json`](settlement.openapi.json). [`/.well-known/agent.json`](api/_lib/agent.json) is the machine-readable discovery card. [`/llms.txt`](llms.txt) is a short pointer in the [llms.txt](https://llmstxt.org/) convention — not a new standard.

Open `index.html`, or any static host at `/`. The quote, transition, simulate, and verify routes need the Vercel functions (or an equivalent) — they are not in the static files. `/.well-known/agent.json` is a static file (same JSON as `api/_lib/agent.json`); Vercel also rewrites that path to `/api/agent.json`.

The Room is frozen under `archive/the-room/`.
