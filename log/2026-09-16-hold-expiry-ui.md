# 2026-09-16 — Human UI for escrow hold expiry on fund

Spark: The engine already stamps optional `expiresAt` on fund, but a payer in the demo UI could not set it — only adapters. Contest-valid money-rail slice: human controls for hold expiry, same rules as the API.

Changed: Fund and the one-click simulate walk accept optional TTL (seconds/minutes) or an absolute UTC time — one of the two, not both. Job cards, quote preview, activity, and receipts show `expiresAt` when present. After expiry, release still fails; dispute still refunds. Docs and changelog updated. Engine unchanged. Rebased onto main after Scoreboard wave-18; changelog keeps wave-18 and adds this slice. Still demo / `money: false`. No real custody.
