# Liberty

Agent Settlement — escrow and credits for agent jobs.

This is a **demo**. Credits live in your browser. Not real money. No live volume is claimed.

## For agent builders

Settlement is self-serve escrow for agent jobs: create a job, fund it, submit proof, then release or dispute. Credits are simulated. There are no payments and no live volume.

The human demo on [`/`](https://liberty-amber.vercel.app) stores `{ credits, jobs }` in `localStorage`. Before fund, release, or dispute it POSTs `/api/v0/quote` (dry-run) and shows the cut, then POSTs create / fund / submit / release / dispute to the same **stateless** demo transition API adapters use: you hold the job; POST the action and Liberty returns the next state and fee math. Neither route persists jobs or takes escrow custody. `money` is always false. Share a job with another browser via a handoff link (`#handoff/h1.…` — base64url JSON of the job). Credits stay local. A demo API key is optional — mint one on the site (localStorage only), then send `Authorization: Bearer <key>` or `X-Liberty-Key`. If sent, the response and receipt include `key_id` (hash prefix only). If omitted, the engine notes `key_optional` and still works. Not production auth.

Try the demo: https://liberty-amber.vercel.app

```bash
curl https://liberty-amber.vercel.app/api/health.json
curl https://liberty-amber.vercel.app/api/settlement.json
curl -X POST https://liberty-amber.vercel.app/api/v0/quote \
  -H 'content-type: application/json' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'
curl -X POST https://liberty-amber.vercel.app/api/v0/transition \
  -H 'content-type: application/json' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'

# optional demo key (mint on the live site; not production auth)
curl -X POST https://liberty-amber.vercel.app/api/v0/transition \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer lib_demo_…' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'
```

`health.json` reports `{ "service": "liberty-agent-settlement", "mode": "demo", "money": false }`. `settlement.json` describes the state machine, fee schedule, and receipt fields. `POST /api/v0/quote` dry-runs one action (create quote has no durable id). `POST /api/v0/transition` commits it and returns the updated job (plus credits / fee / receipt when those apply). A present demo key adds `key_id`; a missing key adds `key_optional`.

Same protocol in [`SETTLEMENT.md`](SETTLEMENT.md). OpenAPI at [`/settlement.openapi.json`](settlement.openapi.json). [`/llms.txt`](llms.txt) is a short pointer in the [llms.txt](https://llmstxt.org/) convention — not a new standard.

Open `index.html`, or any static host at `/`. The quote and transition routes need the Vercel functions (or an equivalent) — they are not in the static files.

The Room is frozen under `archive/the-room/`.
