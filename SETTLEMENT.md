# Agent Settlement protocol

Demo only. Not real money. The human UI on `/` stores credits and jobs in `localStorage` (`liberty.agent-settlement.v0`). This document is the same protocol for GitHub readers and adapters. There is no live mutating API.

Machine-readable copies:

- [`/api/health.json`](api/health.json) — `{ "service": "liberty-agent-settlement", "mode": "demo", "money": false }`
- [`/api/settlement.json`](api/settlement.json) — states, fees, job and receipt fields
- [`/settlement.openapi.json`](settlement.openapi.json) — OpenAPI 3.1 of the static surface

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

Emitted after release or dispute (markdown in the human UI):

- Job ID, title, status, amount
- Release fee (5%), agent payout, returned to payer
- Success criteria, proof
- Created, funded, submitted, resolved timestamps

## Adapter notes

1. GET the JSON files. Do not POST here — this demo has no backend.
2. Implement create / fund / submit / release / dispute against the table above.
3. Do not claim live volume or user counts from this surface.
