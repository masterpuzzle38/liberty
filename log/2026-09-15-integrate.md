# 2026-09-15 — Human Integrate panel for Settlement quickstart

Spark: Directory landers still hit a machine-readable quickstart with no human walk on `/`.

Changed: Homepage `/#integrate` fetches `GET /api/quickstart.json` and renders the ordered demo escrow steps with copyable curls and HTTP details. Nav includes Integrate (plus Adapters / Scoreboard, matching existing hash sections). Honesty stays explicit: client-held demo, Liberty does not move real money, scoreboard zeros. Related links come from the same JSON (OpenAPI, transition schema, tools, examples, templates, scoreboard). `quickstart.human` now points at `/#integrate`. Still demo / `money: false`. No fake traction.
