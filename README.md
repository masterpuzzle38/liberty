# Liberty

Agent Settlement — escrow and credits for agent jobs.

This is a **demo**. Payer credits and a separate agent wallet live in your browser. Not real money. No live volume is claimed.

## For agent builders

Settlement is self-serve escrow for agent jobs: create a job, fund it, submit proof, then release or dispute. Credits are simulated. There are no payments and no live volume.

The human demo on [`/`](https://liberty-amber.vercel.app) stores payer `{ credits, jobs }` in `localStorage` and a separate agent wallet under `liberty.agent-settlement.agent-credits.v0`. Before fund, release, or dispute it POSTs `/api/v0/quote` (dry-run) and shows the cut, then POSTs create / fund / submit / release / dispute to the same **stateless** demo transition API adapters use: you hold the job; POST the action and Liberty returns the next state and fee math. A successful **release** credits the agent wallet by `agent_credits_delta` (same as `agent_payout`). Optional `client_ref` (max 128) on create stamps the adapter’s correlation id on the job and receipt. Optional `callback_url` (`notify_url` alias, max 512, https) is stamped the same way so the adapter’s own client can notify itself after release or dispute — Liberty never HTTP-fetches or calls this URL. Optional `expires_at` (ISO-8601 UTC) or `ttl_seconds` (positive integer) on fund stamps `expiresAt`. If both are sent, Liberty rejects as conflicting. After that instant, release fails; dispute still refunds. Optional `proof_note` on submit (max 400) and `release_note` / `dispute_reason` (max 400) land on the job and terminal receipt. **Dispute** refunds the payer and does not credit the agent. One click on **Run a full demo settlement** POSTs `/api/v0/simulate` and walks the same engine end-to-end. A successful release or dispute also keeps the JSON `receipt` in this browser so you can download or share proof. `POST /api/v0/verify` recomputes fee math for that receipt (or a proposed release/dispute) without storing it. None of the routes persist jobs, receipts, or balances or take escrow custody. `money` is always false. Share a job with another browser via a handoff link (`#handoff/h1.…` — base64url JSON of the job). Share a terminal receipt via a receipt link (`#receipt/r1.…` — base64url JSON of the receipt) so another device can inspect or verify without pasting JSON. The **Settlement ledger** on [`/#ledger`](https://liberty-amber.vercel.app/#ledger) sums this browser’s stored receipts (fees paid, agent payouts, disputed returns) and can download them as CSV. Liberty does not persist that ledger. The **activity log** on [`/#activity`](https://liberty-amber.vercel.app/#activity) appends local demo actions in this browser. Clear activity does not wipe wallets, jobs, or receipts. Liberty never receives that log. Come back later, or move to another device, with a **demo pack** on [`/#demo-pack`](https://liberty-amber.vercel.app/#demo-pack) — one JSON file of this browser’s Settlement localStorage. Import replaces (does not merge). Liberty never receives the file. The pack includes the raw demo API key only if one is already stored here. Credits stay local. A demo API key is optional — mint one on the site (localStorage only), then send `Authorization: Bearer <key>` or `X-Liberty-Key`. If sent, the response and receipt include `key_id` (hash prefix only). If omitted, the engine notes `key_optional` and still works. Not production auth.

Try the demo: https://liberty-amber.vercel.app

```bash
curl https://liberty-amber.vercel.app/.well-known/agent.json
curl https://liberty-amber.vercel.app/api/health.json
curl https://liberty-amber.vercel.app/api/settlement.json
curl https://liberty-amber.vercel.app/api/examples.json
curl https://liberty-amber.vercel.app/api/templates.json
curl https://liberty-amber.vercel.app/api/changelog.json
curl https://liberty-amber.vercel.app/api/scoreboard.json
curl https://liberty-amber.vercel.app/api/fees.json
curl https://liberty-amber.vercel.app/api/tools.json
curl https://liberty-amber.vercel.app/api/quickstart.json
curl https://liberty-amber.vercel.app/api/schemas/transition.json
curl https://liberty-amber.vercel.app/api/schemas/quote.json
curl https://liberty-amber.vercel.app/api/schemas/receipt.json
curl https://liberty-amber.vercel.app/api/schemas/handoff.json
curl https://liberty-amber.vercel.app/api/errors.json
curl -X POST https://liberty-amber.vercel.app/api/v0/validate \
  -H 'content-type: application/json' \
  -d '{"action":"create","title":"Summarize filings","amount":100,"criteria":"Three-bullet brief"}'
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

`/.well-known/agent.json` (same JSON as `/api/agent.json`) is a small discovery card: `mode: demo`, `money: false`, pointers at health, settlement, examples, templates, changelog, scoreboard, fees, tools, quickstart, the transition JSON Schema, the quote JSON Schema, the receipt JSON Schema, the handoff JSON Schema, the error catalog, OpenAPI, and `/`. Not an A2A Agent Card and not a ChatGPT plugin. `health.json` reports `{ "service": "liberty-agent-settlement", "mode": "demo", "money": false }`. `settlement.json` describes the state machine, fee schedule, receipt fields, client-held receipt export, shareable receipt links, receipt verify, and the client-held agent wallet. `examples.json` lists the same copy-ready bodies as **Try as an adapter** on `/#adapters`. `templates.json` lists the same create-job presets as `/#create` (fill only — no auto-create or fund). `changelog.json` lists recent shipped slices (newest first; dates and titles only — no user counts or revenue). Same list as **What's new** on `/#whats-new`. `scoreboard.json` reports honest zeros (`external_users`, `paid_pilots`, `revenue_usd`) plus curated listing URLs — listings are not users. Same facts as **Scoreboard** on `/#scoreboard`. `fees.json` is the machine-readable demo fee schedule (release 5% rounded `Math.round(amount * 0.05)`, dispute no release fee, top-up/fund none). Same facts as **Fee schedule** on `/#fees`. `tools.json` lists callable Settlement surfaces (validate, quote, transition, simulate, verify) plus read-only discovery URLs. Not an MCP server. `quickstart.json` is the ordered ready-to-run demo escrow walk (health/discovery → quote → fund → prove → release; dispute optional). Same walk as **Integrate** on `/#integrate`. Client-held. Liberty does not move real money. `GET /api/schemas/transition.json` is the JSON Schema (2020-12) for `POST /api/v0/transition` bodies. `GET /api/schemas/quote.json` is the JSON Schema (2020-12) for `POST /api/v0/quote` bodies (create / fund / submit / release / dispute). Dry-run only. A quote is not an invoice and not proof of payment. `GET /api/schemas/receipt.json` is the JSON Schema (2020-12) for shareable terminal receipts (`#receipt/r1.…` / verify). Client-held demo; Liberty does not move real money. Receipts are not proof of payment. `GET /api/errors.json` lists the live error codes the engine returns (schema vs state, including `hold_expired`). Client-held demo; Liberty does not move real money. `POST /api/v0/validate` dry-checks that same shape without applying or minting a job. `POST /api/v0/quote` dry-runs one action (create quote has no durable id). `POST /api/v0/transition` commits it and returns the updated job (plus credits / fee / `agent_credits_delta` / receipt when those apply). `POST /api/v0/simulate` runs create → fund → submit → release|dispute in one request (real `as_…` id; still not stored). Optional `Idempotency-Key` (or body `idempotency_key`) on quote, transition, and simulate makes create ids stable for retries; Liberty does not replay stored responses. `POST /api/v0/verify` checks a client-held receipt (or proposed release/dispute) against that same fee engine. Keep the receipt yourself — Liberty does not store it. A present demo key adds `key_id`; a missing key adds `key_optional`.

Same protocol in [`SETTLEMENT.md`](SETTLEMENT.md). OpenAPI at [`/settlement.openapi.json`](settlement.openapi.json) (same JSON at `/openapi.json` and `/api/openapi.json`). [`/.well-known/agent.json`](api/_lib/agent.json) is the machine-readable discovery card. [`/llms.txt`](llms.txt) is a short pointer in the [llms.txt](https://llmstxt.org/) convention — not a new standard. [`/robots.txt`](robots.txt) and [`/sitemap.xml`](sitemap.xml) list those GET discovery URLs for crawlers.

Open `index.html`, or any static host at `/`. The validate, quote, transition, simulate, and verify routes need the Vercel functions (or an equivalent) — they are not in the static files. `/.well-known/agent.json` is a static file (same JSON as `api/_lib/agent.json`); Vercel also rewrites that path to `/api/agent.json`.

The Room is frozen under `archive/the-room/`.
