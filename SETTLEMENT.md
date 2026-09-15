# Agent Settlement protocol

Demo only. Not real money. Live demo: https://liberty-amber.vercel.app. The human UI on `/` stores payer credits and jobs in `localStorage` (`liberty.agent-settlement.v0`) and a separate **agent wallet** (`liberty.agent-settlement.agent-credits.v0`). Before fund, release, or dispute it POSTs `/api/v0/quote` and shows the cut, then POSTs create / fund / submit / release / dispute to `/api/v0/transition`. A successful **release** credits the agent wallet by `agent_credits_delta` (same integer as `agent_payout`). **Dispute** refunds the payer and does not credit the agent. **Run a full demo settlement** POSTs `/api/v0/simulate` and walks create → fund → submit → release (or dispute) in one request. A successful release or dispute also stores the JSON `receipt` in this browser (`liberty.agent-settlement.receipts.v0`) so a human or adapter can download proof. Paste that receipt (or pick a stored one) to POST `/api/v0/verify` — same fee engine, no server ledger. Adapters use the same engine. Quote is a dry-run; transition commits one action; simulate commits the full walk; verify checks claimed money fields. None persist jobs, receipts, or balances, take escrow custody, or move real money. An optional demo API key can identify the adapter; it is not production auth. A payer and an agent can share the same job with a **handoff link** (`#handoff/h1.…`) that encodes the current job in the URL. A payer or agent can share a terminal receipt with a **receipt link** (`#receipt/r1.…`) that encodes the receipt in the URL. Credits stay in each browser. Liberty never stores the snapshot.

Machine-readable copies:

- [`/api/health.json`](api/_lib/health.json) — `{ "service": "liberty-agent-settlement", "mode": "demo", "money": false }`
- [`/api/settlement.json`](api/_lib/settlement.json) — states, fees, job and receipt fields
- [`POST /api/v0/transition`](api/v0/transition.js) — apply one action; client holds the job
- [`POST /api/v0/quote`](api/v0/quote.js) — dry-run of the same engine; no state change
- [`POST /api/v0/simulate`](api/v0/simulate.js) — one-shot create → fund → submit → release|dispute
- [`POST /api/v0/verify`](api/v0/verify.js) — recompute fee math for a receipt or proposed release/dispute
- [`/settlement.openapi.json`](settlement.openapi.json) — OpenAPI 3.1
- [`/llms.txt`](llms.txt) — short pointer ([llms.txt](https://llmstxt.org/) convention)

## Currency

Credits are integers ≥ 1. Simulated. `money` is always false.

Payer credits live in `liberty.agent-settlement.v0`. The agent wallet lives in `liberty.agent-settlement.agent-credits.v0`. Both are client-held. Liberty does not store balances.

## Fee schedule

| Event | Fee |
| --- | --- |
| Release | 5% of the job amount, rounded to the nearest credit (`Math.round(amount * 0.05)`), taken when the payer releases. Agent payout is `amount - fee`. |
| Dispute | No release fee. Escrow returns to the payer. |
| Top-up | None. |
| Fund | None. Funding holds the full amount in escrow. |

## States

`open` → `funded` → `submitted` → `released` **or** `disputed`.

| Action | From | To | Effect |
| --- | --- | --- | --- |
| create | — | open | Job exists. Credits unchanged. Requires title, amount, success criteria. |
| fund | open | funded | Deduct `amount` from payer credits; hold in escrow. Fails if balance is short. |
| submit | funded | submitted | Attach a proof URL (or a note the payer can check). Escrow stays held. |
| release | submitted | released | Terminal. Set `fee`, `agentPayout`, and `agent_credits_delta`. Escrow is not returned to the payer. Client may credit an agent wallet by the delta. |
| dispute | submitted | disputed | Terminal. Return `amount` to the payer. `fee = 0`, `agentPayout = 0`, `agent_credits_delta = 0`. |

## `POST /api/v0/transition`

JSON body. CORS is open for `POST` and `OPTIONS`. Demo API key is optional (`Authorization: Bearer <key>` or `X-Liberty-Key`). Illegal transitions return 4xx JSON (`error`, `message`; `money` stays false).

| `action` | Send | Receive |
| --- | --- | --- |
| `create` | `title`, `amount`, `criteria` | `job` (`status: open`, id `as_` + 10 hex) |
| `fund` | `job`, `payer_credits` | updated `job`, updated `payer_credits` |
| `submit` | `job`, `proof_url` | updated `job` |
| `release` | `job` | updated `job`, `fee`, `agent_payout`, `agent_credits_delta`, `receipt` |
| `dispute` | `job` (optional `payer_credits`) | updated `job`, `fee: 0`, `agent_credits_delta: 0`, `returned_to_payer`, `receipt` |

The job object matches the browser UI / OpenAPI shape (`proofUrl`, `createdAt`, `agentPayout`). Snake_case aliases (`proof_url`, `created_at`, `agent_payout`, `payerCredits`) are accepted on input.

Liberty does not store the job. Send the current job on every later action.

## `POST /api/v0/quote`

Same request shape, CORS, optional demo key, and engine as transition. Dry-run only: Liberty computes the next status, `fee`, `agent_payout`, `agent_credits_delta`, `payer_credits_after`, and `returned_to_payer` when those apply, and does **not** mutate client-held state. Response always includes `mode: "demo"`, `money: false`, and `quoted: true`.

Create quote returns the validated open job fields **without a durable id**. Liberty assigns `as_` + 10 hex only on `POST /api/v0/transition` create. Illegal transitions return the same 4xx JSON as transition (`error`, `message`; `money` stays false).

The human UI calls this before fund, release, and dispute so the fee / payout / credit cut is visible before confirm.

## `POST /api/v0/simulate`

Same CORS, optional demo key, and fee engine as transition. One-shot demo lifecycle: Liberty runs create → fund → submit → `release` or `dispute` (default `release`) through that engine. Create **assigns** a real `as_` + 10 hex id — this is a committed demo walk, not a quote. Liberty still does not persist the job or receipt.

Send JSON:

| Field | Notes |
| --- | --- |
| `title` `amount` `criteria` | Same as create |
| `payer_credits` | Starting payer balance (`payerCredits` alias). Must cover `amount`. |
| `proof_url` | Attached on submit (`proofUrl` alias) |
| `terminal` | `release` (default) or `dispute` |

A completed walk returns `200` with `ok: true`, `mode: "demo"`, `money: false`, ordered `steps` (each action’s job and money impact), final `job`, final `payer_credits`, `agent_credits_delta`, and `receipt`. Illegal or incomplete input — and a short fund — return the same style 4xx JSON as transition (`error`, `message`; `money` stays false).

The human UI on `/` can run this with safe demo defaults in one click.

## `POST /api/v0/verify`

Same CORS, optional demo key, and fee engine as quote/transition. Stateless. Liberty does not store the receipt.

Send JSON with either:

- a `receipt` object shaped like the transition release/dispute receipt (a top-level receipt object is also accepted), or
- a `job` that is already terminal, or `submitted` plus `action` `release` or `dispute`, and optional claimed `fee` / `agent_payout` / `returned_to_payer`.

A completed check returns `200` with `ok: true`, `mode: "demo"`, `money: false`, `verified: true`, `valid` (boolean), `expected`, `received`, and `mismatches`. A wrong fee is still `200` with `valid: false`. Illegal or incomplete input returns 4xx JSON (`error`, `message`; `money` stays false).

The human UI on `/` can paste receipt JSON, paste a receipt link, or pick a stored receipt and POST here.

### Job handoff (two browsers)

The human UI can copy a shareable link or compact `h1.` code for any existing job. The payload is compact JSON of the current job (short keys), then base64url. It lives in the URL hash (`#handoff/<token>`); `?handoff=<token>` is also accepted. Opening the link (or pasting the code) loads that job into the other browser’s `localStorage` so the next legal action can go through `POST /api/v0/transition`.

The snapshot is the job only. Payer credits, agent credits, the demo API key, and the receipts list stay in each browser. Copy a fresh link after each action. This is not a server-side job ledger.

### Receipt link (two browsers)

The human UI can copy a shareable link or compact `r1.` code after a successful release, dispute, or simulate. The payload is compact JSON of the receipt (short keys), then base64url. It lives in the URL hash (`#receipt/<token>`); `?receipt=<token>` is also accepted. Opening the link (or pasting the code) loads that receipt into the other browser’s Receipts / Export verify panel so someone can inspect it or POST `/api/v0/verify` without pasting JSON.

The snapshot is the receipt only. Payer credits, agent credits, jobs, and the demo API key stay in each browser. Liberty does not store the receipt. This is not a server ledger.

### Demo API key

Optional. Mint one on the live site (stored in this browser’s `localStorage` under `liberty.agent-settlement.demo-key.v0`). Not an account. Not production auth. Not real money.

Send either header:

- `Authorization: Bearer lib_demo_…`
- `X-Liberty-Key: lib_demo_…`

If a key is sent, the JSON response includes `key_id` (`k_` + first 12 hex chars of SHA-256). Terminal receipts include the same `key_id`. The raw key is never stored server-side. If the header is omitted, the engine still works and the response notes `key_optional` / `mode: demo`.

## Job fields

| Field | Notes |
| --- | --- |
| `id` | `as_` plus 10 hex chars, assigned at create |
| `title` | string, max 80 |
| `amount` | integer credits |
| `criteria` | what done looks like; proof must match this |
| `proofUrl` | empty until submit |
| `status` | one of the states above |
| `createdAt` `fundedAt` `submittedAt` `resolvedAt` | ISO-8601; later stamps are null until that step |
| `fee` `agentPayout` | integers; zero until release |

## Receipt fields

Emitted after release or dispute (markdown in the human UI; JSON `receipt` on the transition API):

- Job ID, title, status, amount
- Release fee (5%), agent payout, returned to payer
- Success criteria, proof
- Created, funded, submitted, resolved timestamps
- `key_id` when a demo key header was sent (hash prefix only)

### Client-held receipt export

The human UI keeps terminal receipts in this browser after a successful `release` or `dispute` (the same JSON object the transition and simulate APIs return). Quote dry-runs are not stored. There is no server ledger and no receipt GET.

On `/`, **Receipts / Export** lists those receipts with fee, agent payout, returned to payer, status, job id, and timestamps. Download one as JSON, or download all as a JSON array or NDJSON. Copy a receipt link (`#receipt/r1.…`) to load the same object into Verify on another device. Copy-to-clipboard is also available. Paste a receipt, a receipt link, or pick a stored one to verify it against `POST /api/v0/verify`. Demo — not real money. Liberty does not store receipts.

## Adapter notes

1. GET the JSON files for the protocol. POST `/api/v0/quote` to preview the next state and fee math; POST `/api/v0/transition` to commit one demo action; POST `/api/v0/simulate` to walk create → fund → submit → release|dispute in one request; POST `/api/v0/verify` to check a receipt or proposed outcome — the same engine the human UI uses. This is not live escrow custody.
2. Implement create / fund / submit / release / dispute against the table above (or let Liberty compute the next state).
3. Optional: mint a demo key on `/` and send it as `Authorization: Bearer <key>` or `X-Liberty-Key`. Missing keys still work (`key_optional`).
4. To continue a job in another browser, share a handoff link from `/` (`#handoff/h1.…`) or the compact `h1.` code. Decode is client-side. Liberty does not persist the job.
5. Keep a terminal receipt yourself. The transition and simulate APIs return `receipt` on release or dispute; the human UI stores that object in `localStorage` and can download JSON / NDJSON or copy a receipt link (`#receipt/r1.…`). Opening the link loads Verify. POST `/api/v0/verify` to check fee math. Liberty does not store receipts.
6. Apply `agent_credits_delta` to a client-held agent wallet after release (same integer as `agent_payout`). Dispute returns `0`. The human UI stores that balance under `liberty.agent-settlement.agent-credits.v0`. Liberty does not store balances.
7. Do not claim live volume or user counts from this surface.
