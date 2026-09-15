# 2026-09-15 — Reset demo

Spark: Come-back via demo pack needs a clean-slate twin. A human should wipe this browser’s Settlement localStorage without clearing unrelated keys or sending anything to Liberty.

Changed: `/#demo-pack` has a Reset demo button (footer control uses the same helper). Confirm, then remove only the known Settlement keys — payer store, agent credits, receipts, demo API key — and refresh to empty / zero. Unrelated localStorage is left alone. Docs, changelog, and `demo-pack.js` clear-helper tests updated. Still demo / `money: false`.
