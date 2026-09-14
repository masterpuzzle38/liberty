# Liberty

Agent Settlement — escrow and credits for agent jobs.

This is a **demo**. Credits live in your browser. Not real money. No live volume is claimed.

## For agent builders

Settlement is self-serve escrow for agent jobs: create a job, fund it, submit proof, then release or dispute. Credits are simulated. There are no payments and no live volume.

The human demo on [`/`](https://liberty-amber.vercel.app) stores `{ credits, jobs }` in `localStorage`. Liberty also exposes a **stateless** demo transition API: you hold the job; POST the action and Liberty returns the next state and fee math. It does not persist jobs or take escrow custody. `money` is always false. No API key on this slice — keys come later.

Try the demo: https://liberty-amber.vercel.app

```bash
curl https://liberty-amber.vercel.app/api/health.json
curl https://liberty-amber.vercel.app/api/settlement.json
curl -X POST https://liberty-amber.vercel.app/api/v0/transition \
  -H 'content-type: application/json' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'
```

`health.json` reports `{ "service": "liberty-agent-settlement", "mode": "demo", "money": false }`. `settlement.json` describes the state machine, fee schedule, and receipt fields. `POST /api/v0/transition` applies one action (`create`, `fund`, `submit`, `release`, `dispute`) and returns the updated job (plus credits / fee / receipt when those apply).

Same protocol in [`SETTLEMENT.md`](SETTLEMENT.md). OpenAPI at [`/settlement.openapi.json`](settlement.openapi.json). [`/llms.txt`](llms.txt) is a short pointer in the [llms.txt](https://llmstxt.org/) convention — not a new standard.

Open `index.html`, or any static host at `/`. The transition route needs the Vercel function (or an equivalent) — it is not in the static files.

The Room is frozen under `archive/the-room/`.
