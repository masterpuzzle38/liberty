# Agent Settlement protocol

Demo only. Not real money. Live demo: https://liberty-amber.vercel.app. The human UI on `/` stores credits and jobs in `localStorage` (`liberty.agent-settlement.v0`), then POSTs create / fund / submit / release / dispute to `/api/v0/transition`. Adapters use the same engine. That route is a **stateless demo engine** — it does not persist jobs, does not take escrow custody, and does not move real money. An optional demo API key can identify the adapter; it is not production auth. A payer and an agent can share the same job with a **handoff link** (`#handoff/h1.…`) that encodes the current job in the URL. Credits stay in each browser. Liberty never stores the snapshot.

Machine-readable copies:

- [`/api/health.json`](api/health.json) — `{ "service": "liberty-agent-settlement", "mode": "demo", "money": false }`
- [`/api/settlement.json`](api/settlement.json) — states, fees, job and receipt fields
- [`POST /api/v0/transition`](api/v0/transition.js) — apply one action; client holds the job
- [`/settlement.openapi.json`](settlement.openapi.json) — OpenAPI 3.1
- [`/llms.txt`](llms.txt) — short pointer ([llms.txt](https://llmstxt.org/) convention)

## Currency

Credits are integers ≥ 1. Simulated. `money` is always false.

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
| release | submitted | released | Terminal. Set `fee` and `agentPayout`. Escrow is not returned to the payer. |
| dispute | submitted | disputed | Terminal. Return `amount` to the payer. `fee = 0`, `agentPayout = 0`. |

## `POST /api/v0/transition`

JSON body. CORS is open for `POST` and `OPTIONS`. Demo API key is optional (`Authorization: Bearer <key>` or `X-Liberty-Key`). Illegal transitions return 4xx JSON (`error`, `message`; `money` stays false).

| `action` | Send | Receive |
| --- | --- | --- |
| `create` | `title`, `amount`, `criteria` | `job` (`status: open`, id `as_` + 10 hex) |
| `fund` | `job`, `payer_credits` | updated `job`, updated `payer_credits` |
| `submit` | `job`, `proof_url` | updated `job` |
| `release` | `job` | updated `job`, `fee`, `agent_payout`, `receipt` |
| `dispute` | `job` (optional `payer_credits`) | updated `job`, `fee: 0`, `returned_to_payer`, `receipt` |

The job object matches the browser UI / OpenAPI shape (`proofUrl`, `createdAt`, `agentPayout`). Snake_case aliases (`proof_url`, `created_at`, `agent_payout`, `payerCredits`) are accepted on input.

Liberty does not store the job. Send the current job on every later action.

### Job handoff (two browsers)

The human UI can copy a shareable link or compact `h1.` code for any existing job. The payload is compact JSON of the current job (short keys), then base64url. It lives in the URL hash (`#handoff/<token>`); `?handoff=<token>` is also accepted. Opening the link (or pasting the code) loads that job into the other browser’s `localStorage` so the next legal action can go through `POST /api/v0/transition`.

The snapshot is the job only. Demo credits and the demo API key stay in each browser. Copy a fresh link after each action. This is not a server-side job ledger.

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

## Adapter notes

1. GET the JSON files for the protocol. POST `/api/v0/transition` for one demo transition — the same engine the human UI uses. This is not live escrow custody.
2. Implement create / fund / submit / release / dispute against the table above (or let Liberty compute the next state).
3. Optional: mint a demo key on `/` and send it as `Authorization: Bearer <key>` or `X-Liberty-Key`. Missing keys still work (`key_optional`).
4. To continue a job in another browser, share a handoff link from `/` (`#handoff/h1.…`) or the compact `h1.` code. Decode is client-side. Liberty does not persist the job.
5. Do not claim live volume or user counts from this surface.
