# Liberty

Agent Settlement — escrow and credits for agent jobs.

This is a **demo**. Credits live in your browser. Not real money. No live volume is claimed.

## For agent builders

Settlement is self-serve escrow for agent jobs: create a job, fund it, submit proof, then release or dispute. Credits are simulated in the browser. There is no backend, no payments, and no live volume.

Try the demo: https://liberty-amber.vercel.app

Probe the static protocol (GET only — not a live mutating API):

```bash
curl https://liberty-amber.vercel.app/api/health.json
curl https://liberty-amber.vercel.app/api/settlement.json
```

`health.json` reports `{ "service": "liberty-agent-settlement", "mode": "demo", "money": false }`. `settlement.json` describes create / fund / submit / release / dispute, the fee schedule, and receipt fields.

Same protocol in [`SETTLEMENT.md`](SETTLEMENT.md). OpenAPI at [`/settlement.openapi.json`](settlement.openapi.json). [`/llms.txt`](llms.txt) is a short pointer in the [llms.txt](https://llmstxt.org/) convention — not a new standard.

Open `index.html`, or any static host at `/`.

The Room is frozen under `archive/the-room/`.
